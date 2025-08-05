# `@tklein1801/logger.js`

![CI](https://ci.tools.tklein.it/api/v1/teams/main/pipelines/logger.js/badge)
![NPM Version](https://img.shields.io/npm/v/%40tklein1801%2Flogger.js)
![NPM License](https://img.shields.io/npm/l/%40tklein1801%2Flogger.js)
![NPM Last Update](https://img.shields.io/npm/last-update/%40tklein1801%2Flogger.js)

This package provides a logger with extensive capabilities for customization and configuration.

## Todo

- **HttpTransport** - Provide a default HTTP transport implementation for sending logs via HTTP (base class and examples are available)
- Rework metadata-detection (`splitLogParams`) function. In the same step change `LogMeta` to `Record<string|number, string|number|boolean>` (convert every object using `JSON.stringify`)
- Introduce a `defaultMeta` option in order to define metadata which will be set by default for each log
- Build some integration tests in order to validate that all components work well together

## Install

```bash
npm i @klein1801/logger.js
```

## Getting started

### Start developing

1. Clone repository

   ```bash
   git clone git@github.com:tklein1801/logger.js.git
   ```

2. Change directory

   ```bash
   cd logger.js/
   ```

3. Install dependencies

   ```bash
   npm install
   ```

- Execute tests

  ```bash
  npm test
  ```

- Build package

  ```bash
  npm run build
  ```

### Create an instance

```typescript
import {LogLevel, createLogger} from '@tklein1801/logger.js';

const logger = createLogger({
  label: 'DemoService',
  level: LogLevel.INFO,
});

// When creating a ChildLogger based on an already defined instance, it inherits all options set in the parent instance. These options can still be overridden when creating the child.
const childLogger = logger.child({
  label: 'ChildScope',
  level: LogLevel.DEBUG
});
```

### Using with Multiple Transports

```typescript
import {LogLevel, createLogger, Transport, type LogEntry} from '@tklein1801/logger.js';

// Create custom transports
class ConsoleTransport extends Transport {
  protected sendBatch(logs: LogEntry[]): void {
    logs.forEach(log => console.log(log.message));
  }
}

class FileTransport extends Transport {
  protected sendBatch(logs: LogEntry[]): void {
    // Simulate writing to file
    logs.forEach(log => {
      // Your file writing logic here
      console.log(`[FILE] ${log.message}`);
    });
  }
}

const logger = createLogger({
  label: 'MultiTransportApp',
  level: LogLevel.INFO,
  transports: [
    new ConsoleTransport({
      label: 'console',
      batchSize: 1,     // Log immediately to console
      debounceMs: 0,    // No debouncing for console
    }),
    new FileTransport({
      label: 'file',
      batchSize: 10,    // Batch file writes
      debounceMs: 1000, // Wait 1 second before writing
      level: LogLevel.WARN, // Only warnings and errors to file
    })
  ]
});

// This will go to both console (immediately) and file (batched)
logger.error('This is an error message');
logger.info('This only goes to console');
```

## Architecture & Components

### Overview

`logger.js` is built with a modular architecture consisting of several key components that work together to provide flexible and efficient logging:

- **Logger**: The main logging interface that formats messages and sends them to transports
- **TransportManager**: Manages multiple transports and distributes logs to all registered transports
- **Transport**: Abstract base class that handles log batching, debouncing, and transmission

### Components

#### Logger

The logger is the main entry point for logging operations. It formats messages and distributes them to configured transports through the TransportManager.

#### Transport System

The transport system is responsible for efficiently handling log transmission with built-in batching and debouncing capabilities.

**Key Features:**
- **Batching**: Groups logs together to reduce transmission overhead
- **Debouncing**: Delays transmission until logging activity cools down to avoid overwhelming receivers
- **Error Handling**: Automatically re-queues failed logs for retry
- **Level Filtering**: Only processes logs that meet the minimum level requirement

**Configuration Options:**
- `batchSize`: Number of logs to batch before immediate transmission (default: 10)
- `debounceMs`: Delay in milliseconds before sending logs (default: 1000)
- `level`: Minimum log level to process (default: LogLevel.INFO)
- `enabled`: Whether the transport is active (default: true)
- `label`: Identifier for the transport

#### TransportManager

The TransportManager coordinates multiple transports, allowing logs to be sent to multiple destinations simultaneously (e.g., console, file, remote service).

## Transports

### Using Transports

You can configure multiple transports when creating a logger to send logs to different destinations:

```typescript
import {LogLevel, createLogger, Transport, type LogEntry} from '@tklein1801/logger.js';

// Create a custom transport (example shown below)
class FileTransport extends Transport {
  protected sendBatch(logs: LogEntry[]): void {
    // Write logs to file
    logs.forEach(log => {
      console.log(`[FILE] ${log.message}`);
    });
  }
}

const logger = createLogger({
  label: 'MyApp',
  level: LogLevel.INFO,
  transports: [
    new FileTransport({
      label: 'file-transport',
      batchSize: 5,
      debounceMs: 500,
      level: LogLevel.WARN, // Only log warnings and errors to file
    })
  ]
});
```

### Creating Custom Transports

Creating custom transports is straightforward - simply extend the `Transport` base class and implement the `sendBatch` method:

```typescript
import {Transport, type LogEntry, type TransportOptions} from '@tklein1801/logger.js';

class DatabaseTransport extends Transport {
  private connectionString: string;

  constructor(options: TransportOptions & { connectionString: string }) {
    super(options);
    this.connectionString = options.connectionString;
  }

  protected sendBatch(logs: LogEntry[]): Promise<void> {
    // Send logs to database
    return this.saveToDatabase(logs);
  }

  private async saveToDatabase(logs: LogEntry[]): Promise<void> {
    // Your database logic here
    for (const log of logs) {
      await this.insertLogRecord(log);
    }
  }

  private async insertLogRecord(log: LogEntry): Promise<void> {
    // Implementation for inserting a single log record
    console.log(`Saving to DB: ${log.message}`);
  }
}

// Usage
const dbTransport = new DatabaseTransport({
  label: 'database-transport',
  connectionString: 'mongodb://localhost:27017/logs',
  batchSize: 20,        // Send 20 logs at once
  debounceMs: 2000,     // Wait 2 seconds after last log
  level: LogLevel.INFO,
});

const logger = createLogger({
  label: 'MyApp',
  transports: [dbTransport]
});
```

### HTTP Transport Example

Here's an example of creating an HTTP transport for sending logs to a remote service:

```typescript
class HttpTransport extends Transport {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(options: TransportOptions & { 
    endpoint: string; 
    headers?: Record<string, string> 
  }) {
    super(options);
    this.endpoint = options.endpoint;
    this.headers = options.headers || {};
  }

  protected async sendBatch(logs: LogEntry[]): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify({ logs }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
}

// Usage
const httpTransport = new HttpTransport({
  label: 'http-transport',
  endpoint: 'https://api.example.com/logs',
  headers: { 'Authorization': 'Bearer your-token' },
  batchSize: 15,
  debounceMs: 1500,
});
```

### Transport Lifecycle

Transports provide several lifecycle methods for proper resource management:

```typescript
// Enable/disable transport
transport.enable();
transport.disable(); // Also flushes remaining logs

// Update configuration
transport.configure({
  batchSize: 20,
  debounceMs: 3000,
  level: LogLevel.ERROR,
});

// Manual flushing
transport.flush(); // Immediately send all queued logs

// Cleanup
transport.destroy(); // Flush and clean up resources
```

### Best Practices

When implementing custom transports, consider these best practices:

1. **Error Handling**: The base Transport class automatically re-queues failed logs. Your `sendBatch` implementation should throw errors for failed transmissions.

2. **Async Operations**: If your transport performs async operations, return a Promise from `sendBatch`:
   ```typescript
   protected async sendBatch(logs: LogEntry[]): Promise<void> {
     await this.asyncOperation(logs);
   }
   ```

3. **Resource Management**: Implement proper cleanup in your transport if needed:
   ```typescript
   destroy(): void {
     super.destroy(); // Always call parent destroy
     this.cleanup(); // Your custom cleanup
   }
   ```

4. **Configuration**: Extend `TransportOptions` for transport-specific configuration:
   ```typescript
   interface MyTransportOptions extends TransportOptions {
     customOption: string;
   }
   ```

## Utils

### `isLogLevel`

The `isLogLevel` function checks whether a given string represents a valid log level.

### `getLogLevel`

The `getLogLevel` function parses a string and returns the corresponding `LogLevel` enum. The returned enum object can be used to set the client’s log level.


## Credits

- `lodash.debounce` - Used for debouncing the transportation of logs in the Transport system to reduce load on receivers and improve batching efficiency. This ensures that during high-frequency logging periods, logs are accumulated and sent in batches rather than individually, optimizing performance and reducing network overhead.