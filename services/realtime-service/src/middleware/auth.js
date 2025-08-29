const jwt = require('jsonwebtoken');

/**
 * Socket.IO authentication middleware
 * Validates JWT tokens and sets user context
 */
const authMiddleware = async (socket, next) => {
  try {
    // Get token from auth header or query parameter
    const token = socket.handshake.auth?.token || 
                 socket.handshake.query?.token ||
                 socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow connection but mark as unauthenticated
      socket.user = null;
      socket.authenticated = false;
      return next();
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    // Validate token structure
    if (!decoded || !decoded.id) {
      return next(new Error('Invalid token structure'));
    }

    // Check token expiration
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return next(new Error('Token expired'));
    }

    // Set user context on socket
    socket.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
      tier: decoded.tier || 'free',
      verified: decoded.verified || false
    };

    socket.authenticated = true;
    socket.userId = decoded.id;

    // Add authentication timestamp
    socket.authenticatedAt = new Date();

    // Log successful authentication
    console.log(`Socket authenticated: ${socket.id} for user ${decoded.id}`);

    next();

  } catch (error) {
    console.error('Socket authentication error:', error.message);
    
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Invalid token'));
    }

    if (error.name === 'NotBeforeError') {
      return next(new Error('Token not active'));
    }

    // Generic auth error
    return next(new Error('Authentication failed'));
  }
};

/**
 * Middleware factory for role-based access control
 */
const requireRole = (requiredRole) => {
  return (socket, next) => {
    if (!socket.authenticated) {
      return next(new Error('Authentication required'));
    }

    const userRole = socket.user?.role;
    const roleHierarchy = {
      'admin': 4,
      'moderator': 3,
      'premium': 2,
      'user': 1,
      'guest': 0
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return next(new Error('Insufficient permissions'));
    }

    next();
  };
};

/**
 * Middleware for permission-based access control
 */
const requirePermission = (permission) => {
  return (socket, next) => {
    if (!socket.authenticated) {
      return next(new Error('Authentication required'));
    }

    const userPermissions = socket.user?.permissions || [];
    
    if (!userPermissions.includes(permission) && socket.user?.role !== 'admin') {
      return next(new Error(`Permission required: ${permission}`));
    }

    next();
  };
};

/**
 * Middleware for tier-based access control
 */
const requireTier = (requiredTier) => {
  return (socket, next) => {
    if (!socket.authenticated) {
      return next(new Error('Authentication required'));
    }

    const userTier = socket.user?.tier;
    const tierHierarchy = {
      'enterprise': 3,
      'premium': 2,
      'basic': 1,
      'free': 0
    };

    const userLevel = tierHierarchy[userTier] || 0;
    const requiredLevel = tierHierarchy[requiredTier] || 0;

    if (userLevel < requiredLevel) {
      return next(new Error(`${requiredTier} tier required`));
    }

    next();
  };
};

/**
 * Middleware to require verified users
 */
const requireVerified = (socket, next) => {
  if (!socket.authenticated) {
    return next(new Error('Authentication required'));
  }

  if (!socket.user?.verified) {
    return next(new Error('Email verification required'));
  }

  next();
};

/**
 * Middleware to log authentication events
 */
const logAuth = (socket, next) => {
  const logData = {
    socketId: socket.id,
    authenticated: socket.authenticated,
    userId: socket.userId || null,
    userAgent: socket.handshake.headers['user-agent'],
    ipAddress: socket.handshake.address,
    timestamp: new Date().toISOString()
  };

  console.log('Socket connection auth log:', JSON.stringify(logData));

  // You could also store this in Redis or a database for audit trails
  // await redis.lpush('auth_logs', JSON.stringify(logData));

  next();
};

/**
 * Rate limiting middleware for authentication attempts
 */
const authRateLimit = (() => {
  const attempts = new Map(); // IP -> { count, firstAttempt }
  const MAX_ATTEMPTS = 10;
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  return (socket, next) => {
    const ip = socket.handshake.address;
    const now = Date.now();
    
    const attempt = attempts.get(ip);
    
    if (!attempt) {
      attempts.set(ip, { count: 1, firstAttempt: now });
      return next();
    }

    // Reset window if enough time has passed
    if (now - attempt.firstAttempt > WINDOW_MS) {
      attempts.set(ip, { count: 1, firstAttempt: now });
      return next();
    }

    // Check if limit exceeded
    if (attempt.count >= MAX_ATTEMPTS) {
      return next(new Error('Too many authentication attempts. Please try again later.'));
    }

    // Increment attempt count
    attempt.count++;
    attempts.set(ip, attempt);

    next();
  };
})();

/**
 * Middleware to handle authentication errors gracefully
 */
const handleAuthErrors = (socket, next) => {
  // This middleware runs after authentication
  if (!socket.authenticated && socket.handshake.auth?.token) {
    // Token was provided but authentication failed
    socket.emit('auth:failed', { 
      message: 'Authentication failed',
      reason: 'invalid_token'
    });
  }

  next();
};

/**
 * Composite authentication middleware
 * Combines all auth-related middleware into a single middleware stack
 */
const createAuthMiddleware = (options = {}) => {
  const middlewares = [];

  // Always include rate limiting
  if (options.rateLimit !== false) {
    middlewares.push(authRateLimit);
  }

  // Main auth middleware
  middlewares.push(authMiddleware);

  // Optional role requirement
  if (options.requireRole) {
    middlewares.push(requireRole(options.requireRole));
  }

  // Optional permission requirement
  if (options.requirePermission) {
    middlewares.push(requirePermission(options.requirePermission));
  }

  // Optional tier requirement
  if (options.requireTier) {
    middlewares.push(requireTier(options.requireTier));
  }

  // Optional verification requirement
  if (options.requireVerified) {
    middlewares.push(requireVerified);
  }

  // Optional logging
  if (options.logging !== false) {
    middlewares.push(logAuth);
  }

  // Error handling
  middlewares.push(handleAuthErrors);

  // Return composed middleware
  return (socket, next) => {
    const runMiddleware = (index) => {
      if (index >= middlewares.length) {
        return next();
      }

      try {
        middlewares[index](socket, (error) => {
          if (error) {
            return next(error);
          }
          runMiddleware(index + 1);
        });
      } catch (error) {
        next(error);
      }
    };

    runMiddleware(0);
  };
};

module.exports = authMiddleware;

// Export individual middleware functions for more granular use
module.exports.authMiddleware = authMiddleware;
module.exports.requireRole = requireRole;
module.exports.requirePermission = requirePermission;
module.exports.requireTier = requireTier;
module.exports.requireVerified = requireVerified;
module.exports.logAuth = logAuth;
module.exports.authRateLimit = authRateLimit;
module.exports.handleAuthErrors = handleAuthErrors;
module.exports.createAuthMiddleware = createAuthMiddleware;