/**
 * Rate Limiter with Exponential Backoff
 * Implements token bucket algorithm with retry logic
 */

interface RateLimiterConfig {
  requests: number;      // Number of allowed requests
  per: number;          // Time period in milliseconds
  maxRetries?: number;  // Maximum retry attempts
  initialDelay?: number; // Initial retry delay
}

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly retryConfig: RetryConfig;

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.requests;
    this.tokens = config.requests;
    this.refillRate = config.requests / config.per;
    this.lastRefill = Date.now();
    
    this.retryConfig = {
      maxRetries: config.maxRetries ?? 3,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: 30000,
      factor: 2
    };
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed * this.refillRate);
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async canMakeRequest(): Promise<boolean> {
    this.refillTokens();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  async waitForToken(): Promise<void> {
    while (!(await this.canMakeRequest())) {
      const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  async executeWithRateLimit<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    await this.waitForToken();
    
    let lastError: Error | undefined;
    let delay = this.retryConfig.initialDelay;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (error?.response?.status === 429 || error?.code === 'RATE_LIMIT') {
          if (attempt < this.retryConfig.maxRetries) {
            console.log(`Rate limit hit${context ? ` for ${context}` : ''}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * this.retryConfig.factor, this.retryConfig.maxDelay);
            continue;
          }
        }
        
        throw error;
      }
    }

    throw lastError || new Error('Rate limit exceeded after all retries');
  }
}

// Exponential backoff utility
export function exponentialBackoff(config: Partial<RetryConfig> = {}) {
  const finalConfig: RetryConfig = {
    maxRetries: config.maxRetries ?? 3,
    initialDelay: config.initialDelay ?? 1000,
    maxDelay: config.maxDelay ?? 30000,
    factor: config.factor ?? 2
  };

  return async function<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let delay = finalConfig.initialDelay;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (attempt < finalConfig.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * finalConfig.factor, finalConfig.maxDelay);
          continue;
        }
      }
    }

    throw lastError || new Error('Operation failed after all retries');
  };
}

// Global rate limiters for different services
export const apiRateLimiter = new RateLimiter({
  requests: 10,
  per: 60000, // 10 requests per minute
  maxRetries: 3,
  initialDelay: 1000
});

export const searchRateLimiter = new RateLimiter({
  requests: 30,
  per: 60000, // 30 searches per minute
  maxRetries: 2,
  initialDelay: 500
});

export const bulkOperationRateLimiter = new RateLimiter({
  requests: 5,
  per: 60000, // 5 bulk operations per minute
  maxRetries: 3,
  initialDelay: 2000
});