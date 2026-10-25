/**
 * Universal Isomorphic Logging Service
 * Pure TypeScript logger executing across Node.js, Bun, Browser, and Web Worker runtimes.
 * Zero external dependencies and zero Node built-in imports.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface IUniversalLoggerSink {
  log(level: LogLevel, namespace: string, message: string, ...args: unknown[]): void;
}

export class ConsoleLoggerSink implements IUniversalLoggerSink {
  public log(level: LogLevel, namespace: string, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${namespace}] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        if (typeof console.debug === 'function') {
          console.debug(formatted, ...args);
        } else {
          console.log(formatted, ...args);
        }
        break;
      case LogLevel.INFO:
        console.info(formatted, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formatted, ...args);
        break;
      case LogLevel.ERROR:
        console.error(formatted, ...args);
        break;
      default:
        break;
    }
  }
}

export class UniversalLogger {
  private static level: LogLevel = LogLevel.INFO;
  private static sink: IUniversalLoggerSink = new ConsoleLoggerSink();

  public static setLevel(level: LogLevel): void {
    UniversalLogger.level = level;
  }

  public static getLevel(): LogLevel {
    return UniversalLogger.level;
  }

  public static setSink(sink: IUniversalLoggerSink): void {
    UniversalLogger.sink = sink;
  }

  public static debug(namespace: string, message: string, ...args: unknown[]): void {
    if (UniversalLogger.level <= LogLevel.DEBUG) {
      UniversalLogger.sink.log(LogLevel.DEBUG, namespace, message, ...args);
    }
  }

  public static info(namespace: string, message: string, ...args: unknown[]): void {
    if (UniversalLogger.level <= LogLevel.INFO) {
      UniversalLogger.sink.log(LogLevel.INFO, namespace, message, ...args);
    }
  }

  public static warn(namespace: string, message: string, ...args: unknown[]): void {
    if (UniversalLogger.level <= LogLevel.WARN) {
      UniversalLogger.sink.log(LogLevel.WARN, namespace, message, ...args);
    }
  }

  public static error(namespace: string, message: string, ...args: unknown[]): void {
    if (UniversalLogger.level <= LogLevel.ERROR) {
      UniversalLogger.sink.log(LogLevel.ERROR, namespace, message, ...args);
    }
  }
}
