#!/usr/bin/env node
/**
 * ETL Pipeline Monitoring and Health Check Utilities
 * Provides real-time monitoring, alerting, and performance tracking
 */

const express = require('express');
const { Pool } = require('pg');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const MONITORING_CONFIG = {
  PORT: process.env.ETL_MONITOR_PORT || 3001,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/soberlivings',
  LOG_RETENTION_DAYS: parseInt(process.env.ETL_LOG_RETENTION) || 30,
  ALERT_THRESHOLDS: {
    error_rate: parseFloat(process.env.ETL_ERROR_RATE_THRESHOLD) || 10, // 10%
    response_time: parseInt(process.env.ETL_RESPONSE_TIME_THRESHOLD) || 30000, // 30s
    memory_usage: parseFloat(process.env.ETL_MEMORY_THRESHOLD) || 80 // 80%
  },
  METRICS_COLLECTION_INTERVAL: parseInt(process.env.ETL_METRICS_INTERVAL) || 60000 // 1 minute
};

// Global metrics storage
const metrics = {
  currentRun: null,
  historicalRuns: [],
  systemMetrics: {
    memory: { used: 0, percentage: 0 },
    database: { connections: 0, queries: 0 },
    api: { requests: 0, errors: 0, avgResponseTime: 0 }
  },
  alerts: []
};

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/etl-monitor.log' }),
    new winston.transports.Console()
  ]
});

// Database connection
let pool;

/**
 * Initialize monitoring system
 */
async function initializeMonitoring() {
  try {
    // Setup database connection
    pool = new Pool({ connectionString: MONITORING_CONFIG.DATABASE_URL });
    await pool.query('SELECT NOW()');
    
    // Create logs directory
    await fs.mkdir('logs', { recursive: true });
    
    // Initialize Express app
    const app = express();
    app.use(express.json());
    
    // Setup monitoring endpoints
    setupHealthEndpoints(app);
    setupMetricsEndpoints(app);
    setupAlertEndpoints(app);
    
    // Start metrics collection
    startMetricsCollection();
    
    // Start server
    app.listen(MONITORING_CONFIG.PORT, () => {
      logger.info('ETL Monitoring server started', { 
        port: MONITORING_CONFIG.PORT,
        endpoints: ['/health', '/metrics', '/alerts', '/status']
      });
    });
    
  } catch (error) {
    logger.error('Failed to initialize monitoring', { error: error.message });
    throw error;
  }
}

/**
 * Setup health check endpoints
 */
function setupHealthEndpoints(app) {
  
  // Basic health check
  app.get('/health', async (req, res) => {
    try {
      const healthStatus = await performHealthCheck();
      
      const status = healthStatus.status === 'healthy' ? 200 : 503;
      res.status(status).json(healthStatus);
      
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Deep health check
  app.get('/health/deep', async (req, res) => {
    try {
      const healthStatus = await performDeepHealthCheck();
      
      const status = healthStatus.overall === 'healthy' ? 200 : 503;
      res.status(status).json(healthStatus);
      
    } catch (error) {
      logger.error('Deep health check failed', { error: error.message });
      res.status(503).json({
        overall: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Live probe (minimal check)
  app.get('/health/live', (req, res) => {
    res.json({ 
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  // Ready probe (ready to serve)
  app.get('/health/ready', async (req, res) => {
    try {
      // Quick database check
      await pool.query('SELECT 1');
      
      res.json({ 
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'not-ready',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Setup metrics endpoints
 */
function setupMetricsEndpoints(app) {
  
  // Current ETL run metrics
  app.get('/metrics', (req, res) => {
    res.json({
      currentRun: metrics.currentRun,
      systemMetrics: metrics.systemMetrics,
      timestamp: new Date().toISOString()
    });
  });
  
  // Historical metrics
  app.get('/metrics/history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const history = await getMetricsHistory(limit);
      
      res.json({
        runs: history,
        summary: calculateHistoricalSummary(history)
      });
    } catch (error) {
      logger.error('Failed to fetch metrics history', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });
  
  // Performance analytics
  app.get('/metrics/analytics', async (req, res) => {
    try {
      const analytics = await generatePerformanceAnalytics();
      res.json(analytics);
    } catch (error) {
      logger.error('Failed to generate analytics', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });
  
  // Database metrics
  app.get('/metrics/database', async (req, res) => {
    try {
      const dbMetrics = await getDatabaseMetrics();
      res.json(dbMetrics);
    } catch (error) {
      logger.error('Failed to get database metrics', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });
  
  // Export metrics for external monitoring
  app.get('/metrics/prometheus', (req, res) => {
    const prometheusMetrics = formatPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  });
}

/**
 * Setup alert endpoints
 */
function setupAlertEndpoints(app) {
  
  // Get current alerts
  app.get('/alerts', (req, res) => {
    res.json({
      alerts: metrics.alerts,
      count: metrics.alerts.length,
      timestamp: new Date().toISOString()
    });
  });
  
  // Create manual alert
  app.post('/alerts', (req, res) => {
    const { severity, message, source } = req.body;
    
    const alert = createAlert(severity || 'info', message || 'Manual alert', source || 'manual');
    
    res.status(201).json(alert);
  });
  
  // Clear all alerts
  app.delete('/alerts', (req, res) => {
    const clearedCount = metrics.alerts.length;
    metrics.alerts = [];
    
    logger.info('All alerts cleared manually', { clearedCount });
    
    res.json({
      message: 'All alerts cleared',
      clearedCount: clearedCount
    });
  });
  
  // Clear specific alert
  app.delete('/alerts/:id', (req, res) => {
    const alertId = req.params.id;
    const initialCount = metrics.alerts.length;
    
    metrics.alerts = metrics.alerts.filter(alert => alert.id !== alertId);
    
    const cleared = initialCount > metrics.alerts.length;
    
    res.json({
      cleared: cleared,
      message: cleared ? 'Alert cleared' : 'Alert not found'
    });
  });
}

/**
 * Perform basic health check
 */
async function performHealthCheck() {
  const checks = {
    database: false,
    memory: false,
    disk: false
  };
  
  try {
    // Database check
    await pool.query('SELECT NOW()');
    checks.database = true;
    
    // Memory check
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory = memUsagePercent < MONITORING_CONFIG.ALERT_THRESHOLDS.memory_usage;
    
    // Basic disk check (logs directory)
    await fs.access('logs');
    checks.disk = true;
    
    const healthy = Object.values(checks).every(check => check === true);
    
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      checks: checks,
      memoryUsage: memUsagePercent.toFixed(2) + '%',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      checks: checks,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Perform comprehensive health check
 */
async function performDeepHealthCheck() {
  const results = {
    overall: 'healthy',
    components: {},
    performance: {},
    timestamp: new Date().toISOString()
  };
  
  try {
    // Database connectivity and performance
    const dbStart = Date.now();
    const dbResult = await pool.query('SELECT COUNT(*) FROM facilities');
    const dbTime = Date.now() - dbStart;
    
    results.components.database = {
      status: 'healthy',
      responseTime: dbTime,
      facilityCount: parseInt(dbResult.rows[0].count),
      connectionPool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
    
    // API endpoint health (if applicable)
    try {
      const https = require('https');
      const apiStart = Date.now();
      
      await new Promise((resolve, reject) => {
        const req = https.get('https://findtreatment.gov', { timeout: 10000 }, (res) => {
          resolve(res.statusCode);
        });
        req.on('timeout', () => reject(new Error('API timeout')));
        req.on('error', reject);
      });
      
      const apiTime = Date.now() - apiStart;
      results.components.api = {
        status: 'healthy',
        responseTime: apiTime
      };
    } catch (error) {
      results.components.api = {
        status: 'degraded',
        error: error.message
      };
    }
    
    // System resources
    const memUsage = process.memoryUsage();
    results.components.memory = {
      status: (memUsage.heapUsed / memUsage.heapTotal) < 0.8 ? 'healthy' : 'warning',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Log files health
    try {
      const logFiles = await fs.readdir('logs');
      const logStats = await Promise.all(
        logFiles.map(async file => {
          const stats = await fs.stat(path.join('logs', file));
          return { file, size: stats.size, modified: stats.mtime };
        })
      );
      
      results.components.logs = {
        status: 'healthy',
        files: logStats.length,
        totalSize: logStats.reduce((sum, stat) => sum + stat.size, 0)
      };
    } catch (error) {
      results.components.logs = {
        status: 'warning',
        error: error.message
      };
    }
    
    // Check for any unhealthy components
    const unhealthyComponents = Object.values(results.components)
      .filter(component => component.status !== 'healthy').length;
      
    if (unhealthyComponents > 0) {
      results.overall = unhealthyComponents > 2 ? 'unhealthy' : 'degraded';
    }
    
  } catch (error) {
    results.overall = 'unhealthy';
    results.error = error.message;
  }
  
  return results;
}

/**
 * Start metrics collection background process
 */
function startMetricsCollection() {
  setInterval(async () => {
    try {
      // Collect system metrics
      const memUsage = process.memoryUsage();
      metrics.systemMetrics.memory = {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        percentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)
      };
      
      // Collect database metrics
      const dbStats = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT COUNT(*) FROM facilities) as total_facilities,
          (SELECT COUNT(*) FROM facilities WHERE "lastUpdated"::date = CURRENT_DATE) as today_updated
      `);
      
      if (dbStats.rows.length > 0) {
        metrics.systemMetrics.database = {
          connections: dbStats.rows[0].active_connections,
          totalFacilities: dbStats.rows[0].total_facilities,
          todayUpdated: dbStats.rows[0].today_updated
        };
      }
      
      // Check for threshold violations and create alerts
      checkThresholds();
      
      logger.debug('Metrics collected', { metrics: metrics.systemMetrics });
      
    } catch (error) {
      logger.error('Failed to collect metrics', { error: error.message });
    }
  }, MONITORING_CONFIG.METRICS_COLLECTION_INTERVAL);
}

/**
 * Check thresholds and generate alerts
 */
function checkThresholds() {
  const memoryPercent = parseFloat(metrics.systemMetrics.memory.percentage);
  
  // Memory usage alert
  if (memoryPercent > MONITORING_CONFIG.ALERT_THRESHOLDS.memory_usage) {
    createAlert('warning', `Memory usage high: ${memoryPercent}%`, 'system');
  }
  
  // Database connection alert
  if (metrics.systemMetrics.database.connections > 80) {
    createAlert('warning', `High database connection count: ${metrics.systemMetrics.database.connections}`, 'database');
  }
  
  // Clean up old alerts (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  metrics.alerts = metrics.alerts.filter(alert => alert.timestamp > oneHourAgo);
}

/**
 * Create alert
 */
function createAlert(severity, message, source) {
  const alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    severity: severity,
    message: message,
    source: source,
    timestamp: Date.now(),
    formatted: new Date().toISOString()
  };
  
  // Avoid duplicate alerts
  const isDuplicate = metrics.alerts.some(existing => 
    existing.message === message && 
    existing.source === source &&
    (Date.now() - existing.timestamp) < 300000 // 5 minutes
  );
  
  if (!isDuplicate) {
    metrics.alerts.push(alert);
    logger.warn('Alert created', alert);
  }
  
  return alert;
}

/**
 * Get metrics history from database/files
 */
async function getMetricsHistory(limit) {
  try {
    // Try to read historical data from ETL stats files
    const historyFiles = await fs.readdir('.');
    const statsFiles = historyFiles.filter(file => 
      file.startsWith('etl-') && file.endsWith('-stats.json')
    );
    
    const history = [];
    
    for (const file of statsFiles.slice(-limit)) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const stats = JSON.parse(content);
        history.push(stats);
      } catch (error) {
        logger.warn(`Failed to read stats file ${file}`, { error: error.message });
      }
    }
    
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
  } catch (error) {
    logger.error('Failed to get metrics history', { error: error.message });
    return [];
  }
}

/**
 * Calculate historical summary
 */
function calculateHistoricalSummary(history) {
  if (history.length === 0) return null;
  
  const successful = history.filter(run => !run.error);
  const failed = history.filter(run => run.error);
  
  const avgDuration = successful.reduce((sum, run) => sum + (run.duration?.seconds || 0), 0) / successful.length;
  const avgProcessed = successful.reduce((sum, run) => sum + (run.performance?.totalProcessed || 0), 0) / successful.length;
  
  return {
    totalRuns: history.length,
    successfulRuns: successful.length,
    failedRuns: failed.length,
    successRate: ((successful.length / history.length) * 100).toFixed(2) + '%',
    averageDuration: avgDuration.toFixed(2) + 's',
    averageProcessed: Math.round(avgProcessed),
    lastRun: history[0]?.timestamp,
    trends: {
      improving: successful.length >= failed.length,
      recentFailures: failed.filter(run => 
        Date.now() - new Date(run.timestamp).getTime() < 24 * 60 * 60 * 1000
      ).length
    }
  };
}

/**
 * Generate performance analytics
 */
async function generatePerformanceAnalytics() {
  try {
    const dbAnalytics = await pool.query(`
      SELECT 
        state,
        COUNT(*) as facility_count,
        AVG("qualityScore") as avg_quality,
        COUNT(*) FILTER (WHERE "lastUpdated"::date >= CURRENT_DATE - INTERVAL '7 days') as recent_updates
      FROM facilities 
      WHERE "dataSource" = 'findtreatment.gov'
      GROUP BY state
      ORDER BY facility_count DESC
      LIMIT 20
    `);
    
    const totalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_facilities,
        COUNT(DISTINCT state) as states_covered,
        AVG("qualityScore") as overall_quality,
        MIN("lastUpdated") as oldest_update,
        MAX("lastUpdated") as newest_update
      FROM facilities
      WHERE "dataSource" = 'findtreatment.gov'
    `);
    
    return {
      overview: totalStats.rows[0],
      byState: dbAnalytics.rows,
      systemHealth: await performHealthCheck(),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Failed to generate performance analytics', { error: error.message });
    throw error;
  }
}

/**
 * Get detailed database metrics
 */
async function getDatabaseMetrics() {
  try {
    const metrics = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables 
      WHERE tablename = 'facilities'
    `);
    
    const indexMetrics = await pool.query(`
      SELECT 
        indexrelname as index_name,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes 
      WHERE schemaname = 'public'
    `);
    
    const connectionMetrics = await pool.query(`
      SELECT 
        state,
        COUNT(*) as count
      FROM pg_stat_activity 
      GROUP BY state
    `);
    
    return {
      tables: metrics.rows,
      indexes: indexMetrics.rows,
      connections: connectionMetrics.rows,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
    
  } catch (error) {
    logger.error('Failed to get database metrics', { error: error.message });
    throw error;
  }
}

/**
 * Format metrics for Prometheus
 */
function formatPrometheusMetrics() {
  const timestamp = Date.now();
  
  let output = '';
  
  // System metrics
  output += `# HELP etl_memory_usage_bytes Memory usage in bytes\n`;
  output += `# TYPE etl_memory_usage_bytes gauge\n`;
  output += `etl_memory_usage_bytes ${metrics.systemMetrics.memory.used * 1024 * 1024} ${timestamp}\n\n`;
  
  // Database metrics
  if (metrics.systemMetrics.database.totalFacilities) {
    output += `# HELP etl_total_facilities Total facilities in database\n`;
    output += `# TYPE etl_total_facilities gauge\n`;
    output += `etl_total_facilities ${metrics.systemMetrics.database.totalFacilities} ${timestamp}\n\n`;
  }
  
  // Alert metrics
  output += `# HELP etl_alerts_total Total number of active alerts\n`;
  output += `# TYPE etl_alerts_total gauge\n`;
  output += `etl_alerts_total ${metrics.alerts.length} ${timestamp}\n\n`;
  
  return output;
}

/**
 * Update current run metrics (called from ETL pipeline)
 */
function updateCurrentRunMetrics(runMetrics) {
  metrics.currentRun = {
    ...runMetrics,
    lastUpdated: new Date().toISOString()
  };
  
  logger.info('Current run metrics updated', { metrics: runMetrics });
}

/**
 * ETL Pipeline monitoring wrapper
 */
function createETLMonitoringWrapper(etlFunction) {
  return async function monitoredETLRun(...args) {
    const runId = `run-${Date.now()}`;
    const startTime = Date.now();
    
    logger.info('ETL run started', { runId });
    
    try {
      // Update metrics
      updateCurrentRunMetrics({
        runId: runId,
        status: 'running',
        startTime: startTime,
        progress: 0
      });
      
      // Execute ETL function
      const result = await etlFunction(...args);
      
      const duration = Date.now() - startTime;
      
      // Update final metrics
      updateCurrentRunMetrics({
        runId: runId,
        status: 'completed',
        startTime: startTime,
        endTime: Date.now(),
        duration: duration,
        result: result,
        progress: 100
      });
      
      // Store in history
      metrics.historicalRuns.unshift({
        runId: runId,
        status: 'completed',
        duration: duration,
        timestamp: new Date().toISOString(),
        result: result
      });
      
      // Keep only last 100 runs in memory
      if (metrics.historicalRuns.length > 100) {
        metrics.historicalRuns = metrics.historicalRuns.slice(0, 100);
      }
      
      logger.info('ETL run completed successfully', { runId, duration });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update error metrics
      updateCurrentRunMetrics({
        runId: runId,
        status: 'failed',
        startTime: startTime,
        endTime: Date.now(),
        duration: duration,
        error: error.message,
        progress: 0
      });
      
      // Create alert
      createAlert('error', `ETL run ${runId} failed: ${error.message}`, 'etl');
      
      logger.error('ETL run failed', { runId, duration, error: error.message });
      
      throw error;
    }
  };
}

// Export modules
module.exports = {
  initializeMonitoring,
  createETLMonitoringWrapper,
  updateCurrentRunMetrics,
  performHealthCheck,
  performDeepHealthCheck,
  createAlert,
  metrics,
  MONITORING_CONFIG
};

// CLI execution
if (require.main === module) {
  initializeMonitoring().catch(error => {
    logger.error('Failed to start monitoring server', { error: error.message });
    process.exit(1);
  });
}