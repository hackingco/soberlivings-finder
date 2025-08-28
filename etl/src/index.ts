/**
 * ETL Pipeline Entry Point
 */

import * as dotenv from 'dotenv';
import { ETLScheduler, SCHEDULE_PATTERNS } from './scheduler';
import { ETLConfig } from './types';
import { Logger } from './utils/logger';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create logger
const logger = new Logger('ETL');

// Build configuration from environment
const config: ETLConfig = {
  // API Configuration
  apiBaseUrl: process.env.FINDTREATMENT_API_URL || 'https://api.findtreatment.gov',
  apiKey: process.env.FINDTREATMENT_API_KEY || '',
  
  // Database Configuration
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // ETL Settings
  batchSize: parseInt(process.env.ETL_BATCH_SIZE || '100'),
  rateLimit: parseInt(process.env.ETL_RATE_LIMIT || '10'),
  maxRetries: parseInt(process.env.ETL_RETRY_ATTEMPTS || '3'),
  concurrency: parseInt(process.env.ETL_CONCURRENCY || '5'),
  
  // Features
  enableGeocoding: process.env.ETL_ENABLE_GEOCODING === 'true',
  enableDeduplication: process.env.ETL_ENABLE_DEDUPLICATION !== 'false',
  enableValidation: process.env.ETL_ENABLE_VALIDATION !== 'false'
};

// Validate configuration
function validateConfig(): boolean {
  const required = ['supabaseUrl', 'supabaseServiceKey'];
  const missing = required.filter(key => !config[key as keyof ETLConfig]);
  
  if (missing.length > 0) {
    logger.error(`Missing required configuration: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

// Main execution
async function main() {
  logger.info('ETL Pipeline Starting...');
  
  // Validate configuration
  if (!validateConfig()) {
    process.exit(1);
  }
  
  // Create scheduler
  const scheduler = new ETLScheduler(config);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  
  switch (command) {
    case 'run':
      // Run once immediately
      logger.info('Running ETL pipeline once...');
      await scheduler.runNow();
      break;
      
    case 'schedule':
      // Schedule recurring runs
      const interval = args[1] || 'hourly';
      let cronExpression = SCHEDULE_PATTERNS.EVERY_HOUR;
      
      switch (interval) {
        case 'every-5-min':
          cronExpression = SCHEDULE_PATTERNS.EVERY_5_MINUTES;
          break;
        case 'every-15-min':
          cronExpression = SCHEDULE_PATTERNS.EVERY_15_MINUTES;
          break;
        case 'every-30-min':
          cronExpression = SCHEDULE_PATTERNS.EVERY_30_MINUTES;
          break;
        case 'hourly':
          cronExpression = SCHEDULE_PATTERNS.EVERY_HOUR;
          break;
        case 'daily':
          cronExpression = SCHEDULE_PATTERNS.DAILY_MIDNIGHT;
          break;
        case 'weekly':
          cronExpression = SCHEDULE_PATTERNS.WEEKLY_SUNDAY;
          break;
        default:
          // Assume it's a custom cron expression
          cronExpression = interval;
      }
      
      logger.info(`Scheduling ETL pipeline with pattern: ${cronExpression}`);
      scheduler.schedule('main', cronExpression);
      
      // Keep process running
      process.on('SIGINT', () => {
        logger.info('Shutting down scheduler...');
        scheduler.stopAll();
        process.exit(0);
      });
      break;
      
    case 'full-sync':
      // Run a full synchronization
      logger.info('Running full synchronization...');
      await scheduler.runNow({ fullSync: true });
      break;
      
    case 'incremental':
      // Run incremental sync from last sync date
      logger.info('Running incremental sync...');
      const fromDate = args[1] ? new Date(args[1]) : undefined;
      await scheduler.runNow({ fullSync: false, fromDate });
      break;
      
    case 'test':
      // Run with limited records for testing
      logger.info('Running test sync with limited records...');
      await scheduler.runNow({ limit: 10 });
      break;
      
    default:
      logger.error(`Unknown command: ${command}`);
      console.log(`
Usage:
  npm run etl:run              - Run ETL once
  npm run etl:schedule [pattern] - Schedule recurring runs
  npm run etl:full-sync        - Full synchronization
  npm run etl:incremental [date] - Incremental sync from date
  npm run etl:test             - Test with limited records

Schedule patterns:
  every-5-min, every-15-min, every-30-min, hourly, daily, weekly
  Or provide a custom cron expression: "0 */6 * * *"
      `);
      process.exit(1);
  }
}

// Run main function
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});