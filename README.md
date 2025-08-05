# `@tklein1801/logger.js`

![CI](https://ci.tools.tklein.it/api/v1/teams/main/pipelines/logger.js/badge)
![NPM Version](https://img.shields.io/npm/v/%40tklein1801%2Flogger.js)
![NPM License](https://img.shields.io/npm/l/%40tklein1801%2Flogger.js)
![NPM Last Update](https://img.shields.io/npm/last-update/%40tklein1801%2Flogger.js)

This package provides a logger with extensive capabilities for customization and configuration.

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
   npm i
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
  scope: 'DemoService',
  level: LogLevel.INFO,
});

// When creating a ChildLogger based on an already defined instance, it inherits all options set in the parent instance. These options can still be overridden when creating the child.
const childLogger = logger.child({
  scope: 'ChildScope',
});
```

## Customizeibility

### Custom formatting

[logger.js](https://www.npmjs.com/package/@tklein1801/logger.js) allows you to format messages using your own formatting function instead of the default `formatMessage` function.

```typescript
import {LogLevel, createLogger} from '@tklein1801/logger.js';

const logger2 = createLogger({
  scope: 'TestScope2',
  level: LogLevel.INFO,
  format(level, scope, message, meta) {
    // Custom format function to format the log message
    const levelString = LogLevel[level].toUpperCase();
    const formattedMessage = `Custom Format: [${levelString}] [${scope}] ${message}`;
    return meta && Object.keys(meta).length > 0 ? `${formattedMessage} ${JSON.stringify(meta)}` : formattedMessage;
  },
});
```

### Custom log function

[logger.js](https://www.npmjs.com/package/@tklein1801/logger.js) also allows you to use your own logging function instead of the default one. This can be useful if you want to, for example, store logs in an external database.
If you still want the logs to be output to the console as usual, you can use the `printMessage` function from the package and add your own code for storing the messages.

> [!IMPORTANT]
> The `meta` parameter is typed as `any`, as the parameters in the callback fill args. In the current implementation, however, it can safely be cast to `LogMeta`, as the parameters have already been resolved to form the message.

```typescript
import {LogLevel, createLogger} from '@tklein1801/logger.js';

const logger2 = createLogger({
  scope: 'TestScope2',
  level: LogLevel.INFO,
  log: (level, message, meta) => {
    printMessage(level, message, meta, true); // Hide metadata in console output

    // Transport logs to a file or external service
  },
});
```

## Utils

### `isLogLevel`

The `isLogLevel` function checks whether a given string represents a valid log level.

### `getLogLevel`

The `getLogLevel` function parses a string and returns the corresponding `LogLevel` enum. The returned enum object can be used to set the client’s log level.

