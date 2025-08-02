import {LogLevel, type LogMeta} from '../logger';
import {shouldPublishLog} from '../shouldPublishLog';

/**
 * Represents a log entry that will be transported
 */
export type LogEntry = {
  dateTime: Date;
  level: LogLevel;
  /**
   * Formatted log message
   */
  message: string;
  meta?: LogMeta;
};

/**
 * Configuration options for a transport
 */
export type TransportOptions = {
  /**
   * The batch size for sending logs
   * @default 10
   */
  batchSize?: number;

  /**
   * Debounce delay in milliseconds before sending logs
   * @default 1000
   */
  debounceMs?: number;

  /**
   * Minimum log level to transport
   * @default LogLevel.INFO
   */
  level?: LogLevel;

  /**
   * Whether to enable the transport
   * @default true
   */
  enabled?: boolean;
};

/**
 * Abstract base class for log transports
 */
export abstract class Transport {
  protected options: Required<TransportOptions>;
  private logQueue: LogEntry[] = [];
  private debounceTimer?: NodeJS.Timeout;

  constructor(options: TransportOptions = {}) {
    this.options = {
      batchSize: Math.max(1, options.batchSize ?? 10), // Ensure positive batch size
      debounceMs: Math.max(0, options.debounceMs ?? 1000), // Ensure positive debounce time
      level: options.level ?? LogLevel.INFO,
      enabled: options.enabled ?? true,
    };
  }

  /**
   * Abstract method that transports must implement to send log batches
   */
  protected abstract sendBatch(logs: LogEntry[]): Promise<void> | void;

  /**
   * Adds a log entry to the transport queue
   */
  addLogToQueue(entry: LogEntry): void {
    if (!this.options.enabled) {
      return;
    }

    // Check if log level meets minimum requirement
    if (shouldPublishLog(this.options.level, entry.level)) {
      return;
    }

    this.logQueue.push(entry);

    // Send immediately if batch size is reached
    if (this.logQueue.length >= this.options.batchSize) {
      this.flush();
      return;
    }

    // Otherwise, debounce the send
    // REVISIT: Check if this has the desired effect
    this.scheduleFlush();
  }

  /**
   * Schedules a flush operation with debouncing
   */
  private scheduleFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.options.debounceMs);
  }

  /**
   * Immediately flushes all buffered logs
   */
  flush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    if (this.logQueue.length === 0) {
      return;
    }

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    try {
      const result = this.sendBatch(logsToSend);

      // Handle async transports
      if (result instanceof Promise) {
        result.catch(error => {
          console.error('Transport failed to send batch:', error);
          // Optionally re-queue failed logs
        });
      }
    } catch (error) {
      console.error('Transport failed to send batch:', error);
    }
  }

  /**
   * Updates transport options
   */
  configure(options: Partial<TransportOptions>): void {
    this.options = {
      ...this.options,
      ...options,
      batchSize: Math.max(1, options.batchSize ?? this.options.batchSize),
      debounceMs: Math.max(0, options.debounceMs ?? this.options.debounceMs),
    };
  }

  /**
   * Enables the transport
   */
  enable(): void {
    this.options.enabled = true;
  }

  /**
   * Disables the transport and flushes remaining logs
   */
  disable(): void {
    this.options.enabled = false;
    this.flush();
  }

  /**
   * Cleanup method to be called when transport is no longer needed
   */
  destroy(): void {
    this.flush();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
