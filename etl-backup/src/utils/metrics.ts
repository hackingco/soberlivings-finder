/**
 * Metrics collection utility for ETL pipeline
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export class MetricsCollector {
  private metrics: Map<string, number>;
  private timers: Map<string, number>;
  private history: Metric[];

  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
    this.history = [];
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
    
    this.history.push({
      name,
      value,
      timestamp: new Date()
    });
  }

  /**
   * Set a gauge metric
   */
  gauge(name: string, value: number): void {
    this.metrics.set(name, value);
    
    this.history.push({
      name,
      value,
      timestamp: new Date()
    });
  }

  /**
   * Start a timer
   */
  startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * End a timer and record the duration
   */
  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      throw new Error(`Timer ${name} not started`);
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);
    this.gauge(`${name}.duration`, duration);
    
    return duration;
  }

  /**
   * Get a specific metric value
   */
  get(name: string): number {
    return this.metrics.get(name) || 0;
  }

  /**
   * Get all metrics
   */
  getAll(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Collect and format metrics for reporting
   */
  collect(): any {
    const now = Date.now();
    
    return {
      startTime: now - (this.get('pipeline.duration') || 0),
      endTime: now,
      duration: this.get('pipeline.duration') || 0,
      recordsExtracted: this.get('records.extracted') || 0,
      recordsTransformed: this.get('records.transformed') || 0,
      recordsValidated: this.get('records.valid') || 0,
      recordsLoaded: this.get('records.loaded') || 0,
      recordsRejected: this.get('records.invalid') || 0,
      apiCalls: this.get('api.calls') || 0,
      errors: this.get('api.errors') + this.get('transform.errors') + this.get('load.errors') || 0,
      duplicates: this.get('records.duplicates') || 0,
      metrics: this.getAll()
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.timers.clear();
    this.history = [];
  }

  /**
   * Get metrics history
   */
  getHistory(since?: Date): Metric[] {
    if (since) {
      return this.history.filter(m => m.timestamp >= since);
    }
    return this.history;
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheus(): string {
    const lines: string[] = [];
    
    for (const [name, value] of this.metrics) {
      const metricName = name.replace(/\./g, '_');
      lines.push(`etl_${metricName} ${value}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Calculate rate metrics
   */
  calculateRates(duration: number): Record<string, number> {
    const rates: Record<string, number> = {};
    
    if (duration > 0) {
      const durationSeconds = duration / 1000;
      
      rates.recordsPerSecond = (this.get('records.loaded') || 0) / durationSeconds;
      rates.apiCallsPerSecond = (this.get('api.calls') || 0) / durationSeconds;
      rates.errorRate = (this.get('errors') || 0) / (this.get('records.extracted') || 1);
      rates.validationRate = (this.get('records.valid') || 0) / (this.get('records.extracted') || 1);
    }
    
    return rates;
  }
}