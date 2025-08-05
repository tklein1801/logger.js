import debounce from 'lodash.debounce';
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
  label: string;
};

/**
 * Abstract base class for log transports
 */
export abstract class Transport {
  protected transportOptions: Required<TransportOptions>;
  private logQueue: LogEntry[] = [];
  private debouncedFlush: (() => void) & {cancel: () => void};

  constructor(options: TransportOptions) {
    this.transportOptions = {
      batchSize: Math.max(1, options.batchSize ?? 10), // Ensure positive batch size
      debounceMs: Math.max(0, options.debounceMs ?? 300), // Ensure positive debounce time
      level: options.level ?? LogLevel.INFO,
      enabled: options.enabled ?? true,
      label: options.label, // Ensure label is always set
    };

    // Initialize debounced flush function
    this.debouncedFlush = debounce(() => {
      this.performFlush();
    }, this.transportOptions.debounceMs);
  }

  get options(): Required<TransportOptions> {
    return this.transportOptions;
  }

  /**
   * Abstract method that transports must implement to send log batches
   */
  protected abstract sendBatch(logs: LogEntry[]): Promise<void> | void;

  setLogLevel(level: LogLevel): void {
    this.transportOptions.level = level;
  }

  /**
   * Adds a log entry to the transport queue
   */
  addLogToQueue(entry: LogEntry): void {
    if (!this.transportOptions.enabled) {
      return;
    }

    // Check if log level meets minimum requirement
    if (!shouldPublishLog(this.transportOptions.level, entry.level)) {
      return;
    }

    this.logQueue.push(entry);

    // Send immediately if batch size is reached
    if (this.logQueue.length >= this.transportOptions.batchSize) {
      this.debouncedFlush.cancel(); // Cancel any pending debounced flush
      this.performFlush();
      return;
    }

    // Otherwise, schedule a debounced flush
    this.debouncedFlush();
  }

  /**
   * Internal method that performs the actual flush operation
   */
  private performFlush(): void {
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
          // Re-queue failed logs
          this.logQueue.unshift(...logsToSend);
        });
      }
    } catch (error) {
      console.error('Transport failed to send batch:', error);
      // Re-queue failed logs on sync error as well
      this.logQueue.unshift(...logsToSend);
    }
  }

  /**
   * Immediately flushes all queued logs
   */
  flush(): void {
    // Cancel any pending debounced flush
    this.debouncedFlush.cancel();

    // Perform the flush immediately
    this.performFlush();
  }

  /**
   * Updates transport options
   */
  configure(options: Partial<TransportOptions>): void {
    const oldDebounceMs = this.transportOptions.debounceMs;

    this.transportOptions = {
      ...this.transportOptions,
      ...options,
      batchSize: Math.max(1, options.batchSize ?? this.transportOptions.batchSize),
      debounceMs: Math.max(0, options.debounceMs ?? this.transportOptions.debounceMs),
    };

    // If debounce time changed, recreate the debounced function
    if (options.debounceMs !== undefined && oldDebounceMs !== this.transportOptions.debounceMs) {
      this.debouncedFlush.cancel(); // Cancel any pending flush
      this.debouncedFlush = debounce(() => {
        this.performFlush();
      }, this.transportOptions.debounceMs);
    }
  }

  /**
   * Enables the transport
   */
  enable(): void {
    this.transportOptions.enabled = true;
  }

  /**
   * Disables the transport and flushes remaining logs
   */
  disable(): void {
    this.transportOptions.enabled = false;
    this.flush();
  }

  /**
   * Cleanup method to be called when transport is no longer needed
   */
  destroy(): void {
    this.flush();
    this.debouncedFlush.cancel();
  }
}
