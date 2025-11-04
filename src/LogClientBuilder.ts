import type {LogLevel, LogMeta} from './LogClient';
import {LogClient, type LogClientConfig} from './LogClient';
import type {Transport} from './transport';

/**
 * Builder class for creating LogClient instances with fluent API
 */
export class LogClientBuilder {
  private config: LogClientConfig = {};

  /**
   * Sets the logger label
   */
  withLabel(label: string): LogClientBuilder {
    this.config.label = label;
    return this;
  }

  /**
   * Sets the log level
   */
  withLevel(level: LogLevel): LogClientBuilder {
    this.config.level = level;
    return this;
  }

  /**
   * Adds a transport to the logger
   */
  withTransport(transport: Transport): LogClientBuilder {
    if (!this.config.transports) {
      this.config.transports = [];
    }
    this.config.transports.push(transport);
    return this;
  }

  /**
   * Adds multiple transports to the logger
   */
  withTransports(transports: Transport[]): LogClientBuilder {
    this.config.transports = [...(this.config.transports || []), ...transports];
    return this;
  }

  /**
   * Sets default metadata for all log entries
   */
  withDefaultMeta(meta: LogMeta): LogClientBuilder {
    this.config.defaultMeta = meta;
    return this;
  }

  /**
   * Enables or disables metadata hiding
   */
  withHideMeta(hide: boolean = true): LogClientBuilder {
    this.config.hideMeta = hide;
    return this;
  }

  /**
   * Disables the logger
   */
  disabled(): LogClientBuilder {
    this.config.disabled = true;
    return this;
  }

  /**
   * Suppresses warning messages
   */
  supressNoTransportWarning(): LogClientBuilder {
    this.config.supressNoTransportWarning = true;
    return this;
  }

  /**
   * Creates the LogClient instance
   */
  build(): LogClient {
    return new LogClient(this.config);
  }
}
