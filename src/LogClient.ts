import util from 'node:util';
import {LogClientBuilder} from './LogClientBuilder';
import {ConsoleTransport, type Transport} from './transport';
import {TransportManager} from './transportManager';
import {formatMessage, printMessage} from './utils';

/**
 * Construct a type with the properties of T and optional for those in type K.
 */

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export enum LogLevel {
  FATAL = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  SILENT = 5,
}
export type LogLevelStrings = keyof typeof LogLevel;
export type LogMeta = Record<string, string | number | boolean | null | undefined>;

export type LogClientConfig = {
  /**
   * The label of the logger, used to identify the source of log messages.
   */
  label?: string;
  /**
   * The label for this logger, used to identify the source of log messages.
   * @default false
   */
  disabled?: boolean;
  /**
   * If true, metadata will not be printed in log messages but will still be passed to the log function.
   */
  hideMeta?: boolean;
  /**
   * The log level to use for this logger.
   * @default LogLevel.INFO
   */
  level?: LogLevel;
  /**
   * An array of transports to use for this logger.
   * If no transports are provided, a `ConsoleTransport` will be used by default.
   */
  transports?: Transport[];
  /**
   * Supress the "No transports configured."-warning if no customized transports are configured for the instance.
   * @default false
   */
  supressNoTransportWarning?: boolean;
  /**
   * Default metadata that will be merged with each log entry.
   * These values are inherited by child loggers if no own defaultMeta is set.
   */
  defaultMeta?: LogMeta | undefined;
};

export class LogClient {
  private readonly config: Optional<Required<Omit<LogClientConfig, 'transports'>>, 'defaultMeta'>;
  private readonly transportManager: TransportManager;

  /**
   * Creates a new LogClientBuilder instance
   */
  static builder(): LogClientBuilder {
    return new LogClientBuilder();
  }

  /**
   * Creates a LogClient from configuration object
   */
  static fromConfig(config: LogClientConfig): LogClient {
    return new LogClient(config);
  }

  /**
   * Creates a LogClient from configuration object
   */
  static fromParent(logClient: LogClient, options?: LogClientConfig): LogClient {
    const label = options?.label || logClient.config.label;
    const level = options?.level || logClient.config.level;
    const disabled = options?.disabled !== undefined ? options.disabled : !logClient.isEnabled;
    const mergedConfig: LogClientConfig = {
      label,
      level,
      defaultMeta: options?.defaultMeta || logClient.defaultMeta,
      hideMeta: options?.hideMeta || logClient.config.hideMeta,
      disabled,
      transports:
        options?.transports ||
        logClient.transports.map(transport => {
          transport.configure({label, level, enabled: !disabled});
          return transport;
        }),
      supressNoTransportWarning: options?.supressNoTransportWarning || logClient.config.supressNoTransportWarning,
    };

    return new LogClient(mergedConfig);
  }

  constructor(config: LogClientConfig) {
    const label = config.label || 'LogClient';
    const level = config.level || LogLevel.INFO;
    const hideMeta = config.hideMeta || false;
    const isDisabled = config.disabled || false;
    const supressNoTransportWarning = config.supressNoTransportWarning || false;
    this.config = {
      label,
      level,
      disabled: isDisabled,
      defaultMeta: config.defaultMeta ? LogClient.sanitizeLogMeta(config.defaultMeta) : undefined,
      hideMeta,
      supressNoTransportWarning: supressNoTransportWarning,
    };

    this.transportManager = new TransportManager(config.transports || []);
    if (this.transportManager.count === 0) {
      if (!supressNoTransportWarning) {
        printMessage(
          LogLevel.WARN,
          formatMessage(
            new Date(),
            LogLevel.WARN,
            'No transports configured. Logs will be sent to the console by default.',
            label,
          ),
        );
      }
      this.transportManager.add(
        new ConsoleTransport({
          label: label,
          level: level,
          hideMeta: hideMeta,
          enabled: !isDisabled,
          batchSize: 1,
          debounceMs: 0,
        }),
      );
    } else {
      // Run option injection using the transport manager for all configured transports
      this.transportManager.injectOptions({
        enabled: !isDisabled,
        label: label,
        level: level,
      });
    }
  }

  get isEnabled() {
    return !this.config.disabled;
  }

  get level() {
    return this.config.level;
  }

  public setLevel(newLevel: LogLevel, pushToTransports: boolean = true) {
    this.config.level = newLevel;
    if (pushToTransports) {
      this.transportManager.injectOptions({
        level: newLevel,
      });
    }
  }

  get levelName() {
    return LogLevel[this.config.level];
  }

  get transports() {
    return this.transportManager.registeredTransports;
  }

  private get defaultMeta() {
    return this.config.defaultMeta;
  }

  /**
   * Logs a message with the specified log level.
   * @param level The log level to use.
   * @param message The log message.
   * @param args Additional arguments to include in the log.
   * @returns
   */
  private log(level: LogLevel, message: string, ...args: unknown[]) {
    if (!this.shouldPublishLog(level)) return;

    // Split params/metadata
    const {msg, params, meta} = LogClient.splitLogParams([message, ...args]);

    // Merge defaultMeta with log-specific meta
    const mergedMeta = this.defaultMeta || meta ? {...this.defaultMeta, ...meta} : undefined;

    // Format message like console.log with util.format
    const formattedText = args.length > 0 ? util.format(msg, ...params) : msg;
    const dateTime = new Date();

    this.transportManager.addLogToQueue({
      dateTime: dateTime,
      level: level,
      message: formattedText,
      meta: mergedMeta,
    });
  }

  fatal(message: string, ...args: unknown[]) {
    this.log(LogLevel.FATAL, message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.log(LogLevel.ERROR, message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.log(LogLevel.WARN, message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.log(LogLevel.INFO, message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  private shouldPublishLog(messageLevel: LogLevel): boolean {
    return this.isEnabled && LogClient.shouldPublishByLogLevel(this.config.level, messageLevel);
  }

  static shouldPublishByLogLevel(configuredLevel: LogLevel, messageLevel: LogLevel): boolean {
    if (configuredLevel === LogLevel.SILENT) return false;
    return messageLevel <= configuredLevel;
  }

  /**
   * Sanitizes metadata to ensure all values are of allowed types.
   * Converts unsupported types to strings.
   * @param rawMeta The raw metadata object
   * @returns Sanitized metadata with only allowed types
   */

  // biome-ignore lint/suspicious/noExplicitAny: We need to accept any input type to sanitize it
  static sanitizeLogMeta(rawMeta: Record<string, any>): LogMeta {
    const sanitized: LogMeta = {};

    for (const [key, value] of Object.entries(rawMeta)) {
      if (!value) {
        sanitized[key] = value;
        continue;
      }

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
        continue;
      }

      // Convert unsupported types to strings
      if (typeof value === 'function' || typeof value === 'symbol') {
        // JSON.stringify returns undefined for functions and symbols, so use String() directly
        sanitized[key] = String(value);
      } else {
        try {
          sanitized[key] = JSON.stringify(value);
        } catch {
          sanitized[key] = String(value);
        }
      }
    }

    return sanitized;
  }

  /**
   * Splits the log parameters into a message, parameters, and optional metadata.
   * Automatically sanitizes metadata to ensure only allowed types are included.
   * @param args The arguments passed to the log function.
   * @returns An object containing the split log parameters.
   */

  // biome-ignore lint/suspicious/noExplicitAny: The arguments can be of any type, so we allow any here.
  static splitLogParams(args: any[]): {msg: string; params: any[]; meta?: LogMeta} {
    let meta: LogMeta | undefined;
    if (
      args.length > 1 &&
      typeof args[args.length - 1] === 'object' &&
      args[args.length - 1] !== null &&
      !Array.isArray(args[args.length - 1])
    ) {
      const rawMeta = args.pop();
      meta = LogClient.sanitizeLogMeta(rawMeta);
    }
    const [msg, ...params] = args;
    return {msg, params, meta};
  }
}
