/**
 * Metrics collection endpoint for performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for metrics storage
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
  : null;

interface Metric {
  timestamp: number;
  metric: string;
  value: number;
  tags?: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const metrics: Metric[] = await request.json();

    if (!Array.isArray(metrics)) {
      return NextResponse.json(
        { error: 'Invalid metrics format' },
        { status: 400 }
      );
    }

    // Process metrics
    const processedMetrics = metrics.map(metric => ({
      ...metric,
      user_agent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      edge_location: request.headers.get('cf-ray') || 'unknown',
      timestamp: new Date(metric.timestamp).toISOString()
    }));

    // Store in database if available
    if (supabase) {
      const { error } = await supabase
        .from('performance_metrics')
        .insert(processedMetrics);

      if (error) {
        console.error('Failed to store metrics:', error);
      }
    }

    // Analyze and generate alerts for critical metrics
    analyzeMetrics(processedMetrics);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Metrics processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process metrics' },
      { status: 500 }
    );
  }
}

/**
 * Analyze metrics for anomalies and performance issues
 */
function analyzeMetrics(metrics: any[]) {
  // Check for performance degradation
  const apiLatencyMetrics = metrics.filter(m => m.metric === 'api.latency');
  const avgLatency = apiLatencyMetrics.reduce((sum, m) => sum + m.value, 0) / apiLatencyMetrics.length;
  
  if (avgLatency > 1000) {
    console.warn(`High API latency detected: ${avgLatency}ms average`);
    // Could trigger alerts here
  }

  // Check Web Vitals
  const vitalMetrics = metrics.filter(m => m.metric.startsWith('webvital.'));
  vitalMetrics.forEach(vital => {
    const thresholds: Record<string, number> = {
      'webvital.LCP': 2500,
      'webvital.FID': 100,
      'webvital.CLS': 0.1,
      'webvital.TTFB': 800,
      'webvital.INP': 200
    };

    const threshold = thresholds[vital.metric];
    if (threshold && vital.value > threshold) {
      console.warn(`Poor ${vital.metric}: ${vital.value} (threshold: ${threshold})`);
    }
  });
}

/**
 * GET endpoint for retrieving aggregated metrics
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeRange = searchParams.get('range') || '1h';
  const metric = searchParams.get('metric');

  if (!supabase) {
    return NextResponse.json({
      summary: {
        message: 'Metrics storage not configured',
        timeRange
      }
    });
  }

  try {
    // Calculate time boundaries
    const now = new Date();
    const startTime = new Date(now.getTime() - getTimeRangeMs(timeRange));

    // Build query
    let query = supabase
      .from('performance_metrics')
      .select('*')
      .gte('timestamp', startTime.toISOString());

    if (metric) {
      query = query.eq('metric', metric);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Aggregate metrics
    const aggregated = aggregateMetrics(data || []);

    return NextResponse.json({
      timeRange,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      metrics: aggregated
    });
  } catch (error) {
    console.error('Failed to retrieve metrics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}

/**
 * Convert time range string to milliseconds
 */
function getTimeRangeMs(range: string): number {
  const units: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  const match = range.match(/^(\d+)([mhdw])$/);
  if (!match) return 60 * 60 * 1000; // Default 1 hour

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
}

/**
 * Aggregate metrics for reporting
 */
function aggregateMetrics(metrics: any[]) {
  const grouped = metrics.reduce((acc, metric) => {
    if (!acc[metric.metric]) {
      acc[metric.metric] = [];
    }
    acc[metric.metric].push(metric.value);
    return acc;
  }, {} as Record<string, number[]>);

  return Object.entries(grouped).map(([name, values]: [string, number[]]) => {
    const sorted = values.sort((a: number, b: number) => a - b);
    return {
      metric: name,
      count: values.length,
      avg: values.reduce((a: number, b: number) => a + b, 0) / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  });
}