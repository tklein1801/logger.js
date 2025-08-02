import util from 'util';

import {LOG_COLORS, LOG_LEVEL_COLORS} from './config';
import {shouldPublishLog} from './shouldPublishLog/shouldPublishLog';
import {Transport, TransportManager} from './transport';

export enum LogLevel {
  FATAL = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  SILENT = 5,
}

type LogLevelStrings = keyof typeof LogLevel;

export type LogClientOptions = {
  /**
   * The scope of the logger, used to identify the source of log messages.
   */
  scope: string;
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
   * A custom log function to handle log messages.
   * If provided, this will override the default console logging.
   *
   * @param level The log level of the message.
   * @param message The formatted log message.
   * @param args Will contain an object with additional metadata if provided.
   *
   * @example
   * ```ts
   * (level: LogLevel, message: string, meta: any) => {
   *   printMessage(level, message, meta, true); // Hide metadata in console output
   *   // Transport logs to a file or external service...
   * }
   * ```
   */
  log?: (level: LogLevel, message: string, ...args: any[]) => void;
  /**
   * Formats a log message.
   * @param dateTime The date and time of the log entry.
   * @param level The log level of the message.
   * @param scope The scope of the logger.
   * @param message The log message. The parameters will already be resolved, so you can use it directly.
   * @param meta Optional metadata to include in the log message.
   * @returns The formatted log message.
   */
  format?: (dateTime: Date, level: LogLevel, scope: string, message: string, meta?: LogMeta) => string;
  /**
   * An array of transports to use for this logger.
   * Transports are responsible for sending log messages to their final destination (e.g., console, file, network).
   */
  transports?: Transport[];
};

export type LogMeta = Record<string, any>;

export type LogFunction = (message: string, ...params: any[]) => void;

export type LogClient = {
  [K in Lowercase<LogLevelStrings>]: LogFunction;
} & {
  /**
   * Sets the log level for this logger.
   * @param level The log level to set.
   */
  setLogLevel: (level: LogLevel) => void;
  /**
   * Gets the current log level of this logger.
   * @returns The current log level.
   */
  getLogLevel: () => LogLevel;
  /**
   * Gets the name of the current log level.
   * @param level The log level to get the name for. If not provided, the current log level will be used.
   * @returns The name of the log level.
   */
  getLogLevelName: (level?: LogLevel) => string;
  /**
   * Creates a child logger with the same configuration as this logger.
   * @param childOptions Options for the child logger.
   * @returns A new LogClient instance for the child logger.
   */
  child: (options: LogClientOptions) => LogClient;
  /**
   * Gets the transports associated with this logger.
   * @returns An array of transports.
   */
  getTransports?: () => Transport[];
};

interface LogState {
  /**
   * Indicates whether logging is enabled.
   * If false, all log messages will be ignored.
   */
  isEnabled: boolean;
  /**
   * The current log level.
   * Messages below this level will not be logged.
   */
  level: LogLevel;
}

const LEVEL_STRINGS = Object.values(LogLevel)
  .filter(level => typeof level == 'string')
  .map(level => level.toLowerCase()) as Lowercase<LogLevelStrings>[];
const MAX_LEVEL_LENGTH = Math.max(...LEVEL_STRINGS.map(l => l.length));

/**
 * Pads the log level string to a fixed length for consistent formatting.
 * @param level The log level to pad.
 * @returns The padded log level string.
 */
function getPaddedLevel(level: LogLevel) {
  return LogLevel[level].padEnd(MAX_LEVEL_LENGTH, ' ');
}

/**
 * Formats a log message with the given level, message, and scope.
 * @param dateTime The date and time of the log entry.
 * @param level The log level.
 * @param message The log message.
 * @param scope The log scope.
 * @returns The formatted log message.
 */
export function formatMessage(dateTime: Date, level: LogLevel, message: string, scope: string): string {
  const timestamp = dateTime.toISOString();
  const levelString = getPaddedLevel(level);
  return `${LOG_COLORS.dim}${timestamp}${LOG_COLORS.reset} ${LOG_LEVEL_COLORS[level]}${levelString}${LOG_COLORS.reset} ${LOG_COLORS.bright}[${scope}]:${LOG_COLORS.reset} ${message}`;
}

/**
 * Splits the log parameters into a message, parameters, and optional metadata.
 * @param args The arguments passed to the log function.
 * @returns An object containing the split log parameters.
 */
function splitLogParams(args: any[]): {msg: string; params: any[]; meta?: LogMeta} {
  let meta: LogMeta | undefined;
  if (
    args.length > 1 &&
    typeof args[args.length - 1] === 'object' &&
    args[args.length - 1] !== null &&
    !Array.isArray(args[args.length - 1])
  ) {
    meta = args.pop();
  }
  const [msg, ...params] = args;
  return {msg, params, meta};
}

export function printMessage(level: LogLevel, formattedMessage: string, meta?: LogMeta, hideMeta?: boolean) {
  switch (level) {
    case LogLevel.FATAL:
    case LogLevel.ERROR:
      meta && !hideMeta ? console.error(formattedMessage, meta) : console.error(formattedMessage);
      break;
    case LogLevel.WARN:
      meta && !hideMeta ? console.warn(formattedMessage, meta) : console.warn(formattedMessage);
      break;
    case LogLevel.INFO:
    case LogLevel.DEBUG:
    default:
      meta && !hideMeta ? console.log(formattedMessage, meta) : console.log(formattedMessage);
  }
}

export function createLogger(options: LogClientOptions): LogClient {
  const state: LogState = {
    isEnabled: options.disabled !== true,
    level: options.level ?? LogLevel.INFO,
  };
  const transportManager = new TransportManager(options.transports);

  function log(level: LogLevel): LogFunction {
    return (message: string, ...args: any[]) => {
      if (!state.isEnabled || !shouldPublishLog(state.level, level)) return;

      // Split params/metadata
      const {msg, params, meta} = splitLogParams([message, ...args]);

      // Format message like console.log with util.format
      const formattedText = args.length > 0 ? util.format(msg, ...params) : msg;

      const dateTime = new Date();
      const formattedMessage = options.format
        ? options.format(dateTime, level, options.scope, formattedText, meta)
        : formatMessage(dateTime, level, formattedText, options.scope);

      if (options.log) {
        return options.log(level, formattedMessage, meta);
      }

      transportManager.addLogToQueue({
        dateTime,
        level,
        message: formattedMessage,
        meta,
      });

      // REVISIT: Wollen wir hier wirklich die Logs in der Konsole ausgeben wenn wir bereits Transporte implementiert haben?
      // Alternativ können wir Standardmäßig einen Console-Transport hinzufügen, welcher widerrum überschrieben werden kann.
      // Dafür wäre es sinnvoll, einem Transport einen `name` zu verpassen, damit geprüft werden kann, ob der Console-Transport bereits existiert.
      printMessage(level, formattedMessage, meta, options.hideMeta);
    };
  }

  return {
    ...Object.fromEntries(LEVEL_STRINGS.map(level => [level, log(LogLevel[level.toUpperCase() as LogLevelStrings])])),
    setLogLevel(level: LogLevel) {
      state.level = level;
    },
    getLogLevel() {
      return state.level;
    },
    getLogLevelName(level: LogLevel = state.level): string {
      return LogLevel[level];
    },
    getTransports() {
      return options.transports || [];
    },
    child(childOptions) {
      return createLogger({
        scope: childOptions.scope,
        disabled: childOptions.disabled ?? options.disabled,
        hideMeta: childOptions.hideMeta ?? options.hideMeta,
        level: childOptions.level ?? state.level,
        log: childOptions.log ?? options.log,
        format: childOptions.format ?? options.format,
      });
    },
  } as LogClient;
}
