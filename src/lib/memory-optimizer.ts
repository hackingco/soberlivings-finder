/**
 * Memory Optimizer for reducing 99.4% memory utilization
 * Implements memory monitoring, garbage collection, and optimization strategies
 */

interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
  available: number;
  threshold: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  size: number;
}

export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private cacheMap = new Map<string, CacheEntry<any>>();
  private readonly maxCacheSize = 100 * 1024 * 1024; // 100MB max cache
  private readonly memoryThreshold = 0.85; // 85% memory threshold
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCleanup = Date.now();

  private constructor() {}

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  getMemoryMetrics(): MemoryMetrics {
    const usage = process.memoryUsage();
    const total = usage.rss;
    const used = usage.heapUsed;
    const available = total - used;
    const percentage = (used / total) * 100;

    return {
      used,
      total,
      percentage,
      available,
      threshold: this.memoryThreshold * 100
    };
  }

  startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private checkMemoryPressure(): void {
    const metrics = this.getMemoryMetrics();
    
    if (metrics.percentage > this.memoryThreshold * 100) {
      console.warn(`High memory usage detected: ${metrics.percentage.toFixed(2)}%`);
      this.performEmergencyCleanup();
    } else if (metrics.percentage > 70) {
      this.performRoutineCleanup();
    }
  }

  private performEmergencyCleanup(): void {
    console.log('Performing emergency memory cleanup...');
    
    // Clear least recently used cache entries
    const sortedEntries = Array.from(this.cacheMap.entries())
      .sort((a, b) => a[1].accessCount - b[1].accessCount);
    
    // Remove 50% of cache
    const toRemove = Math.floor(sortedEntries.length / 2);
    for (let i = 0; i < toRemove; i++) {
      this.cacheMap.delete(sortedEntries[i][0]);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.lastCleanup = Date.now();
  }

  private performRoutineCleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    // Remove old cache entries
    for (const [key, entry] of this.cacheMap.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.cacheMap.delete(key);
      }
    }

    this.lastCleanup = now;
  }

  cacheData<T>(key: string, data: T, sizeEstimate?: number): void {
    const size = sizeEstimate || JSON.stringify(data).length;
    const currentCacheSize = this.getCurrentCacheSize();

    // Check if adding this would exceed max cache size
    if (currentCacheSize + size > this.maxCacheSize) {
      this.performRoutineCleanup();
    }

    this.cacheMap.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      size
    });
  }

  getCachedData<T>(key: string): T | null {
    const entry = this.cacheMap.get(key);
    if (entry) {
      entry.accessCount++;
      entry.timestamp = Date.now();
      return entry.data;
    }
    return null;
  }

  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const entry of this.cacheMap.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  // Stream processing for large datasets
  async* processInChunks<T>(
    data: T[],
    chunkSize = 100
  ): AsyncGenerator<T[], void, unknown> {
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      // Check memory before processing each chunk
      const metrics = this.getMemoryMetrics();
      if (metrics.percentage > 90) {
        await this.waitForMemory();
      }
      
      yield chunk;
    }
  }

  private async waitForMemory(): Promise<void> {
    console.log('Waiting for memory to be available...');
    this.performEmergencyCleanup();
    
    // Wait for memory to be freed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const metrics = this.getMemoryMetrics();
    if (metrics.percentage > 95) {
      throw new Error('Memory pressure too high, operation aborted');
    }
  }

  // Optimize database query batching
  getOptimalBatchSize(): number {
    const metrics = this.getMemoryMetrics();
    
    if (metrics.percentage > 85) {
      return 100; // Small batches when memory is high
    } else if (metrics.percentage > 70) {
      return 250; // Medium batches
    } else {
      return 500; // Large batches when memory is available
    }
  }

  clearCache(): void {
    this.cacheMap.clear();
    if (global.gc) {
      global.gc();
    }
  }

  getStats() {
    return {
      cacheEntries: this.cacheMap.size,
      cacheSize: this.getCurrentCacheSize(),
      lastCleanup: new Date(this.lastCleanup).toISOString(),
      memoryMetrics: this.getMemoryMetrics()
    };
  }
}

// Export singleton instance
export const memoryOptimizer = MemoryOptimizer.getInstance();

// Start monitoring on module load
memoryOptimizer.startMonitoring();