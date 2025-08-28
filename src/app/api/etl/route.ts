/**
 * API endpoint for triggering ETL pipeline
 * This can be called via webhook, cron job, or manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { ETLPipeline } from '@/etl/src/pipeline';
import { ETLConfig } from '@/etl/src/types';

// Validate API key for security
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  return apiKey === process.env.ETL_API_KEY;
}

export async function POST(request: NextRequest) {
  // Validate API key
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const { fullSync, fromDate, limit } = body;

    // Build configuration
    const config: ETLConfig = {
      apiBaseUrl: process.env.FINDTREATMENT_API_URL || 'https://api.findtreatment.gov',
      apiKey: process.env.FINDTREATMENT_API_KEY || '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      batchSize: 100,
      rateLimit: 10,
      maxRetries: 3,
      concurrency: 5
    };

    // Create pipeline instance
    const pipeline = new ETLPipeline(config);

    // Run pipeline
    const options = {
      fullSync: fullSync || false,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      limit: limit || undefined
    };

    const metrics = await pipeline.run(options);

    return NextResponse.json({
      success: true,
      metrics
    });

  } catch (error) {
    console.error('ETL pipeline error:', error);
    
    return NextResponse.json(
      {
        error: 'ETL pipeline failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Validate API key
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Return ETL status and information
  return NextResponse.json({
    status: 'ready',
    endpoints: {
      run: 'POST /api/etl',
      options: {
        fullSync: 'boolean - Run full synchronization',
        fromDate: 'string - ISO date for incremental sync',
        limit: 'number - Limit number of records (for testing)'
      }
    },
    configuration: {
      batchSize: process.env.ETL_BATCH_SIZE || '100',
      rateLimit: process.env.ETL_RATE_LIMIT || '10',
      hasApiKey: !!process.env.FINDTREATMENT_API_KEY
    }
  });
}