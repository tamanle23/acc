export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static level: LogLevel = LogLevel.INFO;

  public static setLevel(level: LogLevel) {
    this.level = level;
  }

  private static formatMessage(namespace: string, message: string): string {
    const timestamp = new Date().toISOString();
    let sanitized = message;
    try {
      const { DynamicSecretsManager } = require('./security/DynamicSecretsManager');
      sanitized = DynamicSecretsManager.getInstance().sanitize(message);
    } catch {}
    return `[${timestamp}] [${namespace}] ${sanitized}`;
  }

  public static debug(namespace: string, message: string, ...optionalParams: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage(namespace, message), ...optionalParams);
    }
  }

  public static info(namespace: string, message: string, ...optionalParams: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage(namespace, message), ...optionalParams);
    }
  }

  public static warn(namespace: string, message: string, ...optionalParams: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage(namespace, message), ...optionalParams);
    }
  }

  public static error(namespace: string, message: string, ...optionalParams: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatMessage(namespace, message), ...optionalParams);
    }
  }
}
