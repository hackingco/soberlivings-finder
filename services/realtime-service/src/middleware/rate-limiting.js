const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');

class RateLimitingMiddleware {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.rateLimiters = new Map();
    
    // Default configuration
    this.defaultConfig = {
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds
      blockDuration: 60, // Block for 60 seconds if limit exceeded
      execEvenly: true // Spread requests evenly across duration
    };

    // Predefined rate limiting configurations
    this.configs = {
      // General API requests
      general: {
        points: 100,
        duration: 60,
        blockDuration: 60
      },
      
      // Authentication attempts
      auth: {
        points: 5,
        duration: 300, // 5 minutes
        blockDuration: 900 // Block for 15 minutes
      },
      
      // WebSocket connections
      connection: {
        points: 10,
        duration: 60,
        blockDuration: 300
      },
      
      // Message sending
      message: {
        points: 30,
        duration: 60,
        blockDuration: 120
      },
      
      // Subscription changes
      subscription: {
        points: 20,
        duration: 60,
        blockDuration: 180
      },
      
      // Room joining/leaving
      room_changes: {
        points: 10,
        duration: 60,
        blockDuration: 300
      },
      
      // Admin operations
      admin: {
        points: 200,
        duration: 60,
        blockDuration: 60
      },
      
      // Premium users - more lenient limits
      premium: {
        points: 300,
        duration: 60,
        blockDuration: 30
      }
    };

    this.initializeRateLimiters();
  }

  initializeRateLimiters() {
    // Create rate limiters for each configuration
    Object.entries(this.configs).forEach(([name, config]) => {
      const rateLimiterConfig = {
        ...this.defaultConfig,
        ...config,
        storeClient: this.redis,
        keyPrefix: `rl_${name}:`
      };

      let rateLimiter;
      if (this.redis) {
        rateLimiter = new RateLimiterRedis(rateLimiterConfig);
      } else {
        // Fallback to memory-based rate limiter
        rateLimiter = new RateLimiterMemory(rateLimiterConfig);
      }

      this.rateLimiters.set(name, rateLimiter);
    });
  }

  // Express middleware for HTTP requests
  createHttpMiddleware(type = 'general') {
    const rateLimiter = this.rateLimiters.get(type);
    
    if (!rateLimiter) {
      throw new Error(`Rate limiter type '${type}' not found`);
    }

    return async (req, res, next) => {
      try {
        // Use IP address as key, but consider user ID if authenticated
        const key = req.user?.id || req.ip || 'anonymous';
        
        await rateLimiter.consume(key);
        
        // Add rate limit headers
        const resRateLimiter = await rateLimiter.get(key);
        if (resRateLimiter) {
          res.set({
            'X-RateLimit-Limit': this.configs[type].points,
            'X-RateLimit-Remaining': resRateLimiter.remainingPoints,
            'X-RateLimit-Reset': new Date(Date.now() + resRateLimiter.msBeforeNext)
          });
        }

        next();
      } catch (rejRes) {
        // Rate limit exceeded
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        res.set({
          'Retry-After': String(secs),
          'X-RateLimit-Limit': this.configs[type].points,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext)
        });

        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${secs} seconds.`,
          retryAfter: secs
        });
      }
    };
  }

  // Socket.IO middleware for WebSocket connections
  createSocketMiddleware(type = 'connection') {
    const rateLimiter = this.rateLimiters.get(type);
    
    if (!rateLimiter) {
      throw new Error(`Rate limiter type '${type}' not found`);
    }

    return async (socket, next) => {
      try {
        // Use socket ID or user ID as key
        const key = socket.userId || socket.id;
        
        await rateLimiter.consume(key);
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        next(new Error(`Rate limit exceeded. Try again in ${secs} seconds.`));
      }
    };
  }

  // Method to check rate limit without consuming points
  async checkLimit(type, key) {
    const rateLimiter = this.rateLimiters.get(type);
    
    if (!rateLimiter) {
      return { allowed: true, remainingPoints: Infinity };
    }

    try {
      const resRateLimiter = await rateLimiter.get(key);
      return {
        allowed: !resRateLimiter || resRateLimiter.remainingPoints > 0,
        remainingPoints: resRateLimiter?.remainingPoints || this.configs[type].points,
        msBeforeNext: resRateLimiter?.msBeforeNext || 0
      };
    } catch (error) {
      // If there's an error checking the limit, allow the request
      return { allowed: true, remainingPoints: this.configs[type].points };
    }
  }

  // Method to consume points for a specific rate limiter
  async consumePoints(type, key, points = 1) {
    const rateLimiter = this.rateLimiters.get(type);
    
    if (!rateLimiter) {
      throw new Error(`Rate limiter type '${type}' not found`);
    }

    try {
      const result = await rateLimiter.consume(key, points);
      return {
        success: true,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext
      };
    } catch (rejRes) {
      return {
        success: false,
        remainingPoints: 0,
        msBeforeNext: rejRes.msBeforeNext,
        blocked: true
      };
    }
  }

  // Reset rate limit for a specific key
  async resetLimit(type, key) {
    const rateLimiter = this.rateLimiters.get(type);
    
    if (!rateLimiter) {
      throw new Error(`Rate limiter type '${type}' not found`);
    }

    await rateLimiter.delete(key);
  }

  // Get current rate limit status
  async getStatus(type, key) {
    const rateLimiter = this.rateLimiters.get(type);
    
    if (!rateLimiter) {
      return null;
    }

    try {
      const result = await rateLimiter.get(key);
      if (!result) {
        return {
          points: this.configs[type].points,
          remainingPoints: this.configs[type].points,
          msBeforeNext: 0,
          blocked: false
        };
      }

      return {
        points: this.configs[type].points,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
        blocked: result.remainingPoints <= 0
      };
    } catch (error) {
      return null;
    }
  }

  // Dynamic rate limiting based on user tier
  getUserRateLimitType(user) {
    if (!user) {
      return 'general';
    }

    if (user.role === 'admin') {
      return 'admin';
    }

    if (user.tier === 'premium' || user.tier === 'enterprise') {
      return 'premium';
    }

    return 'general';
  }

  // Smart rate limiting that adapts based on user context
  createSmartMiddleware(baseType = 'general') {
    return async (req, res, next) => {
      try {
        // Determine appropriate rate limit type based on user
        const rateLimitType = req.user ? this.getUserRateLimitType(req.user) : baseType;
        const key = req.user?.id || req.ip || 'anonymous';

        const result = await this.consumePoints(rateLimitType, key);

        if (!result.success) {
          const secs = Math.round(result.msBeforeNext / 1000) || 1;
          
          res.set({
            'Retry-After': String(secs),
            'X-RateLimit-Type': rateLimitType
          });

          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again in ${secs} seconds.`,
            retryAfter: secs,
            type: rateLimitType
          });
        }

        // Add informational headers
        res.set({
          'X-RateLimit-Type': rateLimitType,
          'X-RateLimit-Remaining': result.remainingPoints
        });

        next();
      } catch (error) {
        // If rate limiting fails, log error but don't block request
        console.error('Rate limiting error:', error);
        next();
      }
    };
  }

  // Burst protection - allows temporary spikes but maintains average rate
  createBurstProtection(type, burstLimit = 10) {
    const rateLimiter = this.rateLimiters.get(type);
    const burstLimiter = new RateLimiterMemory({
      points: burstLimit,
      duration: 1, // 1 second burst window
      blockDuration: 5
    });

    return async (req, res, next) => {
      try {
        const key = req.user?.id || req.ip || 'anonymous';

        // Check burst limit first
        await burstLimiter.consume(key);

        // Then check main rate limit
        await rateLimiter.consume(key);

        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Request rate too high. Please slow down.',
          retryAfter: secs
        });
      }
    };
  }

  // Get statistics for all rate limiters
  async getStatistics() {
    const stats = {};

    for (const [type, rateLimiter] of this.rateLimiters.entries()) {
      // This is a simplified version - actual implementation would depend on
      // the rate limiter's ability to provide statistics
      stats[type] = {
        config: this.configs[type],
        active: true
      };
    }

    return stats;
  }
}

// Export a factory function to create the middleware
module.exports = (redisClient, options) => {
  const rateLimiting = new RateLimitingMiddleware(redisClient, options);
  
  // Return the general HTTP middleware by default
  return rateLimiting.createHttpMiddleware('general');
};

// Export the class for more advanced usage
module.exports.RateLimitingMiddleware = RateLimitingMiddleware;