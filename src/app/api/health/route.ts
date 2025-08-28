import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase'
import { optimizedPrisma } from '@/lib/database-optimizations'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: {
      status: 'up' | 'down' | 'degraded'
      responseTime: number
      error?: string
    }
    supabase: {
      status: 'up' | 'down' | 'degraded'
      responseTime: number
      error?: string
    }
    memory: {
      used: number
      total: number
      percentage: number
    }
    env: {
      nodeVersion: string
      platform: string
      environment: string
    }
  }
}

/**
 * Comprehensive health check endpoint for production monitoring
 * Returns detailed status of all system components
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks: {
      database: {
        status: 'up',
        responseTime: 0,
      },
      supabase: {
        status: 'up', 
        responseTime: 0,
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      env: {
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'development',
      }
    }
  }

  // Check database connection (Prisma)
  try {
    const dbStartTime = Date.now()
    await optimizedPrisma.$queryRaw`SELECT 1 as test`
    const dbResponseTime = Date.now() - dbStartTime
    
    healthCheck.checks.database = {
      status: dbResponseTime < 500 ? 'up' : 'degraded',
      responseTime: dbResponseTime,
    }
  } catch (error) {
    healthCheck.checks.database = {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Database connection failed',
    }
    healthCheck.status = 'unhealthy'
  }

  // Check Supabase connection
  try {
    const supabaseStartTime = Date.now()
    const isHealthy = await supabaseService.healthCheck()
    const supabaseResponseTime = Date.now() - supabaseStartTime
    
    healthCheck.checks.supabase = {
      status: isHealthy ? (supabaseResponseTime < 500 ? 'up' : 'degraded') : 'down',
      responseTime: supabaseResponseTime,
    }
    
    if (!isHealthy && healthCheck.status === 'healthy') {
      healthCheck.status = 'degraded'
    }
  } catch (error) {
    healthCheck.checks.supabase = {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Supabase connection failed',
    }
    
    // Supabase failure is not critical if we have Prisma
    if (healthCheck.checks.database.status === 'down') {
      healthCheck.status = 'unhealthy'
    } else if (healthCheck.status === 'healthy') {
      healthCheck.status = 'degraded'
    }
  }

  // Memory usage check
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memoryUsage = process.memoryUsage()
    const totalMemory = memoryUsage.heapTotal
    const usedMemory = memoryUsage.heapUsed
    const memoryPercentage = (usedMemory / totalMemory) * 100

    healthCheck.checks.memory = {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round(memoryPercentage * 100) / 100,
    }

    // Flag high memory usage
    if (memoryPercentage > 90 && healthCheck.status === 'healthy') {
      healthCheck.status = 'degraded'
    }
  }

  // Determine overall health status
  if (healthCheck.checks.database.status === 'down' && healthCheck.checks.supabase.status === 'down') {
    healthCheck.status = 'unhealthy'
  } else if (
    healthCheck.checks.database.status === 'degraded' || 
    healthCheck.checks.supabase.status === 'degraded' ||
    healthCheck.checks.memory.percentage > 85
  ) {
    if (healthCheck.status === 'healthy') {
      healthCheck.status = 'degraded'
    }
  }

  // Return appropriate HTTP status code
  let statusCode = 200
  if (healthCheck.status === 'degraded') {
    statusCode = 200 // Still functional
  } else if (healthCheck.status === 'unhealthy') {
    statusCode = 503 // Service unavailable
  }

  return NextResponse.json(healthCheck, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Status': healthCheck.status,
      'X-Response-Time': `${Date.now() - startTime}ms`,
    }
  })
}

/**
 * Simple ping endpoint for basic uptime monitoring
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache',
      'X-Timestamp': new Date().toISOString(),
    }
  })
}