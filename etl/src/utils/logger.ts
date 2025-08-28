/**
 * Logger utility for ETL pipeline
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private context: string;
  private level: LogLevel;

  constructor(context: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = level;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] [${this.context}] ${message}`;
    
    if (data) {
      return `${formatted}\n${JSON.stringify(data, null, 2)}`;
    }
    
    return formatted;
  }

  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message));
      if (error) {
        console.error(error);
      }
    }
  }
}