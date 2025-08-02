import {LogEntry, Transport, TransportOptions} from './transport';

/**
 * Console transport that outputs logs to the console
 */
export class ConsoleTransport extends Transport {
  constructor(options: TransportOptions = {}) {
    super(options);
  }

  protected sendBatch(logs: LogEntry[]): void {
    logs.forEach(log => {
      const timestamp = log.timestamp.toISOString();
      const metaStr = log.meta ? ` ${JSON.stringify(log.meta)}` : '';
      console.log(`[${timestamp}] [${log.scope}] ${log.message}${metaStr}`);
    });
  }
}
