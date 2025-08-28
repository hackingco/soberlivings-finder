/**
 * Performance monitoring and analytics for SoberLivings Finder
 * Real-time metrics collection and analysis
 */

interface PerformanceMetrics {
  timestamp: number;
  metric: string;
  value: number;
  tags?: Record<string, string>;
}

interface WebVitals {
  CLS?: number; // Cumulative Layout Shift
  FID?: number; // First Input Delay
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

/**
 * Edge-native performance monitoring
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private vitals: WebVitals = {};
  private reportingEndpoint: string;
  private batchSize = 50;
  private flushInterval = 10000; // 10 seconds

  constructor(reportingEndpoint?: string) {
    this.reportingEndpoint = reportingEndpoint || '/api/metrics';
    this.initializeMonitoring();
  }

  /**
   * Initialize Web Vitals monitoring
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Dynamic import for client-side only
    import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB, onINP }) => {
      onCLS((metric) => this.recordWebVital('CLS', metric.value));
      onFID((metric) => this.recordWebVital('FID', metric.value));
      onFCP((metric) => this.recordWebVital('FCP', metric.value));
      onLCP((metric) => this.recordWebVital('LCP', metric.value));
      onTTFB((metric) => this.recordWebVital('TTFB', metric.value));
      onINP((metric) => this.recordWebVital('INP', metric.value));
    });

    // Set up periodic flush
    setInterval(() => this.flush(), this.flushInterval);

    // Flush on page unload
    if ('sendBeacon' in navigator) {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  /**
   * Record a web vital metric
   */
  private recordWebVital(name: keyof WebVitals, value: number): void {
    this.vitals[name] = value;
    this.recordMetric(`webvital.${name}`, value, {
      page: window.location.pathname,
      userAgent: navigator.userAgent
    });
  }

  /**
   * Record a custom metric
   */
  recordMetric(
    metric: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    this.metrics.push({
      timestamp: Date.now(),
      metric,
      value,
      tags
    });

    // Auto-flush if batch size reached
    if (this.metrics.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Record API latency
   */
  async measureApiLatency<T>(
    apiCall: () => Promise<T>,
    endpoint: string
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      
      this.recordMetric('api.latency', duration, {
        endpoint,
        status: 'success'
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric('api.latency', duration, {
        endpoint,
        status: 'error',
        error: error instanceof Error ? error.message : 'unknown'
      });
      
      throw error;
    }
  }

  /**
   * Measure render performance
   */
  measureRender(componentName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric('render.duration', duration, {
        component: componentName
      });
    };
  }

  /**
   * Track user interactions
   */
  trackInteraction(
    action: string,
    target: string,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric('user.interaction', 1, {
      action,
      target,
      ...metadata
    });
  }

  /**
   * Flush metrics to reporting endpoint
   */
  private async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        // Use sendBeacon for reliability
        navigator.sendBeacon(
          this.reportingEndpoint,
          JSON.stringify(metricsToSend)
        );
      } else {
        // Fallback to fetch
        await fetch(this.reportingEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metricsToSend)
        });
      }
    } catch (error) {
      console.error('Failed to send metrics:', error);
      // Re-add metrics to queue for retry
      this.metrics.unshift(...metricsToSend);
    }
  }

  /**
   * Get current Web Vitals
   */
  getWebVitals(): WebVitals {
    return { ...this.vitals };
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    vitals: WebVitals;
    metrics: Record<string, number>;
    recommendations: string[];
  } {
    const metrics: Record<string, number> = {};
    
    // Aggregate metrics
    this.metrics.forEach(m => {
      if (!metrics[m.metric]) {
        metrics[m.metric] = 0;
      }
      metrics[m.metric] += m.value;
    });

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (this.vitals.LCP && this.vitals.LCP > 2500) {
      recommendations.push('Optimize Largest Contentful Paint - consider lazy loading images and code splitting');
    }
    
    if (this.vitals.FID && this.vitals.FID > 100) {
      recommendations.push('Improve First Input Delay - reduce JavaScript execution time');
    }
    
    if (this.vitals.CLS && this.vitals.CLS > 0.1) {
      recommendations.push('Reduce Cumulative Layout Shift - set dimensions for images and ads');
    }

    return {
      vitals: this.vitals,
      metrics,
      recommendations
    };
  }
}

/**
 * Resource timing analyzer
 */
export class ResourceTimingAnalyzer {
  /**
   * Analyze resource loading performance
   */
  analyzeResources(): {
    totalResources: number;
    slowResources: PerformanceResourceTiming[];
    recommendations: string[];
  } {
    if (typeof window === 'undefined') {
      return { totalResources: 0, slowResources: [], recommendations: [] };
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const slowThreshold = 500; // 500ms
    
    const slowResources = resources.filter(r => r.duration > slowThreshold);
    const recommendations: string[] = [];

    // Analyze by type
    const resourcesByType = resources.reduce((acc, r) => {
      const type = this.getResourceType(r.name);
      if (!acc[type]) acc[type] = [];
      acc[type].push(r);
      return acc;
    }, {} as Record<string, PerformanceResourceTiming[]>);

    // Generate recommendations
    if (resourcesByType.image?.length > 20) {
      recommendations.push('Consider lazy loading images or using image optimization');
    }

    if (resourcesByType.script?.some(r => r.duration > 1000)) {
      recommendations.push('Optimize JavaScript bundle size or use code splitting');
    }

    if (resourcesByType.css?.some(r => r.duration > 500)) {
      recommendations.push('Consider inlining critical CSS or reducing stylesheet size');
    }

    return {
      totalResources: resources.length,
      slowResources,
      recommendations
    };
  }

  /**
   * Get resource type from URL
   */
  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    const typeMap: Record<string, string> = {
      js: 'script',
      mjs: 'script',
      css: 'css',
      jpg: 'image',
      jpeg: 'image',
      png: 'image',
      webp: 'image',
      svg: 'image',
      woff: 'font',
      woff2: 'font',
      ttf: 'font',
      json: 'data',
      xml: 'data'
    };

    return typeMap[extension || ''] || 'other';
  }
}

/**
 * Edge function performance tracker
 */
export class EdgeFunctionTracker {
  private executions: Map<string, number[]> = new Map();

  /**
   * Track edge function execution
   */
  async track<T>(
    functionName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = typeof process !== 'undefined' 
      ? process.memoryUsage().heapUsed 
      : 0;

    try {
      const result = await fn();
      
      const duration = Date.now() - startTime;
      const memoryUsed = typeof process !== 'undefined'
        ? process.memoryUsage().heapUsed - startMemory
        : 0;

      // Store execution time
      if (!this.executions.has(functionName)) {
        this.executions.set(functionName, []);
      }
      this.executions.get(functionName)!.push(duration);

      // Keep only last 100 executions
      const executions = this.executions.get(functionName)!;
      if (executions.length > 100) {
        executions.shift();
      }

      // Log if slow
      if (duration > 1000) {
        console.warn(`Edge function ${functionName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      console.error(`Edge function ${functionName} failed:`, error);
      throw error;
    }
  }

  /**
   * Get performance stats for a function
   */
  getStats(functionName: string): {
    avg: number;
    median: number;
    p95: number;
    p99: number;
  } | null {
    const executions = this.executions.get(functionName);
    if (!executions || executions.length === 0) return null;

    const sorted = [...executions].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { avg, median, p95, p99 };
  }
}

// Export singleton instances
export const performanceMonitor = typeof window !== 'undefined' 
  ? new PerformanceMonitor()
  : null;

export const resourceAnalyzer = typeof window !== 'undefined'
  ? new ResourceTimingAnalyzer()
  : null;

export const edgeFunctionTracker = new EdgeFunctionTracker();