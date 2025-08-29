/**
 * ETL Pipeline Scheduler
 * 
 * Manages scheduled and on-demand ETL runs
 */

import * as cron from 'node-cron';
import { ETLPipeline } from './pipeline';
import { ETLConfig } from './types';
import { Logger } from './utils/logger';

export class ETLScheduler {
  private pipeline: ETLPipeline;
  private logger: Logger;
  private jobs: Map<string, cron.ScheduledTask>;
  private isRunning: boolean = false;

  constructor(config: ETLConfig) {
    this.pipeline = new ETLPipeline(config);
    this.logger = new Logger('ETLScheduler');
    this.jobs = new Map();
  }

  /**
   * Schedule a recurring ETL job
   */
  schedule(name: string, cronExpression: string, options?: any): void {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    // Remove existing job if it exists
    this.stop(name);

    // Create new scheduled task
    const task = cron.schedule(cronExpression, async () => {
      await this.runJob(name, options);
    });

    this.jobs.set(name, task);
    this.logger.info(`Scheduled job '${name}' with cron expression: ${cronExpression}`);
  }

  /**
   * Run a job immediately
   */
  async runNow(options?: any): Promise<void> {
    return this.runJob('manual', options);
  }

  /**
   * Run a scheduled job
   */
  private async runJob(jobName: string, options?: any): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(`Job '${jobName}' skipped - another job is already running`);
      return;
    }

    this.isRunning = true;
    this.logger.info(`Starting job '${jobName}'`);

    try {
      const metrics = await this.pipeline.run(options);
      this.logger.info(`Job '${jobName}' completed successfully`, metrics);
      
      // Send success notification if configured
      await this.notifySuccess(jobName, metrics);
    } catch (error) {
      this.logger.error(`Job '${jobName}' failed`, error);
      
      // Send failure notification if configured
      await this.notifyFailure(jobName, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop a scheduled job
   */
  stop(name: string): void {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      this.logger.info(`Stopped job '${name}'`);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll(): void {
    for (const [name, job] of this.jobs) {
      job.stop();
      this.logger.info(`Stopped job '${name}'`);
    }
    this.jobs.clear();
  }

  /**
   * List all scheduled jobs
   */
  listJobs(): Array<{ name: string; running: boolean }> {
    return Array.from(this.jobs.keys()).map(name => ({
      name,
      running: this.isRunning
    }));
  }

  /**
   * Send success notification
   */
  private async notifySuccess(jobName: string, metrics: any): Promise<void> {
    // Implement notification logic (Slack, email, etc.)
    const message = `ETL Job '${jobName}' completed successfully\n` +
      `Records processed: ${metrics.recordsLoaded}\n` +
      `Duration: ${metrics.duration}ms`;
    
    // Log for now, can integrate with notification service
    this.logger.info(message);
  }

  /**
   * Send failure notification
   */
  private async notifyFailure(jobName: string, error: any): Promise<void> {
    // Implement notification logic (Slack, email, etc.)
    const message = `ETL Job '${jobName}' failed\n` +
      `Error: ${error.message || error}`;
    
    // Log for now, can integrate with notification service
    this.logger.error(message);
  }
}

/**
 * Predefined schedule patterns
 */
export const SCHEDULE_PATTERNS = {
  EVERY_MINUTE: '* * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  EVERY_12_HOURS: '0 */12 * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  DAILY_NOON: '0 12 * * *',
  WEEKLY_SUNDAY: '0 0 * * 0',
  MONTHLY_FIRST: '0 0 1 * *'
};