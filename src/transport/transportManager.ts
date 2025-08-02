import {LogEntry, Transport} from './transport';

/**
 * Manages multiple transports for a logger
 */
export class TransportManager {
  private transports: Transport[] = [];

  /**
   * Adds a transport to the manager
   */
  add(transport: Transport): void {
    this.transports.push(transport);
  }

  /**
   * Removes a transport from the manager
   */
  remove(transport: Transport): void {
    const index = this.transports.indexOf(transport);
    if (index > -1) {
      this.transports.splice(index, 1);
      transport.destroy();
    }
  }

  /**
   * Sends a log entry to all transports
   */
  log(entry: LogEntry): void {
    this.transports.forEach(transport => {
      transport.log(entry);
    });
  }

  /**
   * Flushes all transports
   */
  flush(): void {
    this.transports.forEach(transport => {
      transport.flush();
    });
  }

  /**
   * Destroys all transports and clears the list
   */
  destroy(): void {
    this.transports.forEach(transport => {
      transport.destroy();
    });
    this.transports = [];
  }

  /**
   * Gets the number of registered transports
   */
  get count(): number {
    return this.transports.length;
  }

  /**
   * Gets all registered transports
   */
  get all(): readonly Transport[] {
    return [...this.transports];
  }
}
