export interface IConductorListenerStrategy {
    start(): Promise<void>;
    stop(): void;
}
