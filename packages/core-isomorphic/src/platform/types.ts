export enum RuntimeEnvironment {
  Bun = 'bun',
  Node = 'node',
  Browser = 'browser',
  WebWorker = 'web-worker',
  Unknown = 'unknown',
}

export enum OperatingSystem {
  Windows = 'windows',
  MacOS = 'macos',
  Linux = 'linux',
  IOS = 'ios',
  Android = 'android',
  Unknown = 'unknown',
}

export interface RuntimeCapabilities {
  readonly hasBunFFI: boolean;
  readonly hasFileSystem: boolean;
  readonly hasIndexedDb: boolean;
  readonly hasWebCache: boolean;
  readonly hasWebCodecs: boolean;
}

export interface PlatformProfile {
  readonly os: OperatingSystem;
  readonly runtime: RuntimeEnvironment;
  readonly capabilities: RuntimeCapabilities;
}
