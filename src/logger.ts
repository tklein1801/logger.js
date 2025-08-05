import util from 'node:util';
import {LOG_COLORS, LOG_LEVEL_COLORS} from './config';
import {shouldPublishLog} from './shouldPublishLog';
import {ConsoleTransport, type Transport} from './transport';
import {TransportManager} from './transportManager';

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
   * The label of the logger, used to identify the source of log messages.
   */
  label: string;
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
};

// REVISIT: Maybe only support strings and numbers as metadata keys and values?
// biome-ignore lint/suspicious/noExplicitAny: The metadata can be of any type, so we allow any here.
export type LogMeta = Record<string, any>;

// biome-ignore lint/suspicious/noExplicitAny: The log function parameters can be of any type, so we allow any here.
export type LogFunction = (message: string, ...params: any[]) => void;

export type LogClient = {
  [K in Lowercase<LogLevelStrings>]: LogFunction;
} & {
  setLogLevel: (level: LogLevel) => void;
  getLogLevel: () => LogLevel;
  getLogLevelName: () => LogLevelStrings;
  child: (options: LogClientOptions) => LogClient;
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
  .filter(level => typeof level === 'string')
  .map(level => level.toLowerCase()) as Lowercase<LogLevelStrings>[];
const MAX_LEVEL_LENGTH = Math.max(...LEVEL_STRINGS.map(l => l.length));

export function createLogger(options: LogClientOptions): LogClient {
  const state: LogState = {
    isEnabled: options.disabled !== true,
    level: options.level ?? LogLevel.INFO,
  };
  const transportManager = new TransportManager(options.transports || []);

  function log(level: LogLevel): LogFunction {
    // biome-ignore lint/suspicious/noExplicitAny: We need to allow any type for the log function parameters
    return (message: string, ...args: any[]) => {
      if (!state.isEnabled || !shouldPublishLog(state.level, level)) return;

      // Split params/metadata
      const {msg, params, meta} = splitLogParams([message, ...args]);

      // Format message like console.log with util.format
      const formattedText = args.length > 0 ? util.format(msg, ...params) : msg;
      const dateTime = new Date();

      transportManager.addLogToQueue({
        dateTime: dateTime,
        level: level,
        message: formattedText,
        meta: meta,
      });
    };
  }

  // Print warning if no transports are configured for this log-client
  if (transportManager.count === 0) {
    printMessage(
      LogLevel.WARN,
      formatMessage(
        new Date(),
        LogLevel.WARN,
        'No transports configured. Logs will be sent to the console by default.',
        options.label,
      ),
    );

    transportManager.add(
      new ConsoleTransport({
        label: options.label,
        level: state.level,
        hideMeta: options.hideMeta,
      }),
    );
  }

  return {
    ...Object.fromEntries(LEVEL_STRINGS.map(level => [level, log(LogLevel[level.toUpperCase() as LogLevelStrings])])),
    setLogLevel(level: LogLevel) {
      state.level = level;
    },
    getLogLevel() {
      return state.level;
    },
    getLogLevelName() {
      return LogLevel[state.level] as LogLevelStrings;
    },
    child(childOptions) {
      return createLogger({
        label: childOptions.label,
        disabled: childOptions.disabled ?? options.disabled,
        hideMeta: childOptions.hideMeta ?? options.hideMeta,
        level: childOptions.level ?? state.level,
      });
    },
  } as LogClient;
}

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
 * @param label The log label.
 * @returns The formatted log message.
 */
export function formatMessage(dateTime: Date, level: LogLevel, message: string, label: string): string {
  const timestamp = dateTime.toISOString();
  const levelString = getPaddedLevel(level);
  return `${LOG_COLORS.dim}${timestamp}${LOG_COLORS.reset} ${LOG_LEVEL_COLORS[level]}${levelString}${LOG_COLORS.reset} ${LOG_COLORS.bright}[${label}]:${LOG_COLORS.reset} ${message}`;
}

/**
 * TODO: This function needs some improvements in order to better handle metadata detection.
 * Splits the log parameters into a message, parameters, and optional metadata.
 * @param args The arguments passed to the log function.
 * @returns An object containing the split log parameters.
 */

// biome-ignore lint/suspicious/noExplicitAny: The arguments can be of any type, so we allow any here.
export function splitLogParams(args: any[]): {msg: string; params: any[]; meta?: LogMeta} {
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

/**
 * Prints a log message to the console.
 * @param level The log level of the message.
 * @param formattedMessage The formatted log message.
 * @param meta Optional metadata associated with the log message.
 * @param hideMeta Optional flag to hide metadata in the output.
 */
export function printMessage(level: LogLevel, formattedMessage: string, meta?: LogMeta, hideMeta?: boolean) {
  switch (level) {
    case LogLevel.FATAL:
    case LogLevel.ERROR:
      meta && !hideMeta ? console.error(formattedMessage, meta) : console.error(formattedMessage);
      break;
    case LogLevel.WARN:
      meta && !hideMeta ? console.warn(formattedMessage, meta) : console.warn(formattedMessage);
      break;
    // For readability, we can keep INFO and DEBUG
    // case LogLevel.INFO:
    // case LogLevel.DEBUG:
    default:
      meta && !hideMeta ? console.log(formattedMessage, meta) : console.log(formattedMessage);
  }
}
