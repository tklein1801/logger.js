import {LogEntry, Transport, TransportOptions} from './transport';

/**
 * HTTP transport that sends logs to a remote endpoint
 */
export class HttpTransport extends Transport {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(
    endpoint: string,
    options: TransportOptions & {
      headers?: Record<string, string>;
    } = {},
  ) {
    super(options);
    this.endpoint = endpoint;
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  protected async sendBatch(logs: LogEntry[]): Promise<void> {
    const payload = {
      logs: logs.map(log => ({
        level: log.level,
        message: log.message,
        scope: log.scope,
        timestamp: log.timestamp.toISOString(),
        meta: log.meta,
      })),
      batchSize: logs.length,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to send logs to ${this.endpoint}: ${error}`);
    }
  }
}
