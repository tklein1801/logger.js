import {LogEntry, Transport, TransportOptions} from './transport';

/**
 * File transport that writes logs to a file
 */
export class FileTransport extends Transport {
  private filePath: string;
  private fs: any;

  constructor(filePath: string, options: TransportOptions = {}) {
    super(options);
    this.filePath = filePath;

    try {
      this.fs = require('fs');
    } catch {
      throw new Error('FileTransport requires Node.js fs module');
    }
  }

  protected sendBatch(logs: LogEntry[]): void {
    const logLines = logs.map(log => {
      const timestamp = log.timestamp.toISOString();
      const metaStr = log.meta ? ` ${JSON.stringify(log.meta)}` : '';
      return `[${timestamp}] [${log.scope}] ${log.message}${metaStr}\n`;
    });

    const content = logLines.join('');

    try {
      this.fs.appendFileSync(this.filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write logs to file ${this.filePath}: ${error}`);
    }
  }
}
