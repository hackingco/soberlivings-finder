import { NextResponse } from 'next/server'
import { optimizedPrisma, dbMaintenance } from '@/lib/database-optimizations'
import { supabaseService } from '@/lib/supabase'

/**
 * Scheduled maintenance endpoint for cache refresh and database optimization
 * Called by Vercel cron every 6 hours
 */
export async function GET() {
  const startTime = Date.now()
  const results = {
    timestamp: new Date().toISOString(),
    operations: [] as Array<{
      name: string
      success: boolean
      duration: number
      details?: any
      error?: string
    }>
  }

  // Refresh materialized views
  try {
    const viewStartTime = Date.now()
    await dbMaintenance.refreshMaterializedViews()
    results.operations.push({
      name: 'refresh_materialized_views',
      success: true,
      duration: Date.now() - viewStartTime
    })
  } catch (error) {
    results.operations.push({
      name: 'refresh_materialized_views',
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Clear query cache to force fresh data
  const cacheStartTime = Date.now()
  try {
    optimizedPrisma.clearCache()
    results.operations.push({
      name: 'clear_query_cache',
      success: true,
      duration: Date.now() - cacheStartTime
    })
  } catch (error) {
    results.operations.push({
      name: 'clear_query_cache',
      success: false,
      duration: Date.now() - cacheStartTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Analyze database performance
  const analysisStartTime = Date.now()
  try {
    const stats = await dbMaintenance.analyzeTablesPerformance()
    results.operations.push({
      name: 'analyze_database',
      success: true,
      duration: Date.now() - analysisStartTime,
      details: stats
    })
  } catch (error) {
    results.operations.push({
      name: 'analyze_database',
      success: false,
      duration: Date.now() - analysisStartTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Health check all systems
  const healthStartTime = Date.now()
  try {
    const prismaHealth = await optimizedPrisma.healthCheck()
    const supabaseHealth = await supabaseService.healthCheck()
    
    results.operations.push({
      name: 'health_check',
      success: prismaHealth.connectionStatus !== 'disconnected' || supabaseHealth,
      duration: Date.now() - healthStartTime,
      details: {
        prisma: prismaHealth,
        supabase: supabaseHealth
      }
    })
  } catch (error) {
    results.operations.push({
      name: 'health_check',
      success: false,
      duration: Date.now() - healthStartTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  const totalDuration = Date.now() - startTime
  const successCount = results.operations.filter(op => op.success).length
  const totalOperations = results.operations.length

  return NextResponse.json({
    ...results,
    summary: {
      totalDuration,
      successfulOperations: successCount,
      failedOperations: totalOperations - successCount,
      successRate: totalOperations > 0 ? (successCount / totalOperations) * 100 : 0
    }
  }, {
    status: successCount === totalOperations ? 200 : 207, // 207 Multi-Status for partial success
    headers: {
      'Cache-Control': 'no-store',
      'X-Maintenance-Duration': `${totalDuration}ms`
    }
  })
}