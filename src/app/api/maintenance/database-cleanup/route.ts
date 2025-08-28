import { NextResponse } from 'next/server'
import { dbMaintenance } from '@/lib/database-optimizations'

/**
 * Weekly database cleanup and optimization
 * Called by Vercel cron every Sunday at 2 AM
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

  // Database cleanup
  try {
    const cleanupStartTime = Date.now()
    const cleanupResult = await dbMaintenance.cleanupDatabase()
    results.operations.push({
      name: 'database_cleanup',
      success: true,
      duration: Date.now() - cleanupStartTime,
      details: cleanupResult
    })
  } catch (error) {
    results.operations.push({
      name: 'database_cleanup',
      success: false,
      duration: Date.now() - cleanupStartTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Create/update materialized views
  try {
    const viewsStartTime = Date.now()
    await dbMaintenance.createMaterializedViews()
    results.operations.push({
      name: 'update_materialized_views',
      success: true,
      duration: Date.now() - viewsStartTime
    })
  } catch (error) {
    results.operations.push({
      name: 'update_materialized_views',
      success: false,
      duration: Date.now() - viewsStartTime,
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
    status: successCount === totalOperations ? 200 : 207,
    headers: {
      'Cache-Control': 'no-store',
      'X-Cleanup-Duration': `${totalDuration}ms`
    }
  })
}