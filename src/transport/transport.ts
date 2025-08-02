import {LogLevel, LogMeta} from '../logger';

/**
 * Represents a log entry that will be transported
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  scope: string;
  timestamp: Date;
  meta?: LogMeta;
}

/**
 * Configuration options for a transport
 */
export interface TransportOptions {
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
}

/**
 * Abstract base class for log transports
 */
export abstract class Transport {
  protected options: Required<TransportOptions>;
  private logBuffer: LogEntry[] = [];
  private debounceTimer?: NodeJS.Timeout;

  constructor(options: TransportOptions = {}) {
    this.options = {
      batchSize: Math.max(1, options.batchSize ?? 10), // Ensure positive batch size
      debounceMs: Math.max(0, options.debounceMs ?? 1000),
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
  log(entry: LogEntry): void {
    if (!this.options.enabled) {
      return;
    }

    // Check if log level meets minimum requirement
    if (entry.level > this.options.level) {
      return;
    }

    this.logBuffer.push(entry);

    // Send immediately if batch size is reached
    if (this.logBuffer.length >= this.options.batchSize) {
      this.flush();
      return;
    }

    // Otherwise, debounce the send
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

    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

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
