/**
 * Bounded Queue implementing Producer-Consumer pattern with asynchronous backpressure.
 */
export class BoundedQueue<T> {
  private queue: T[] = [];
  private capacity: number;
  private producersWaiting: Array<() => void> = [];
  private consumersWaiting: Array<(item: T) => void> = [];
  private isEnded: boolean = false;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error("Capacity must be greater than 0");
    }
    this.capacity = capacity;
  }

  /**
   * Enqueues an item into the queue. Blocks if capacity is reached.
   */
  public async enqueue(item: T): Promise<void> {
    if (this.isEnded) {
      throw new Error("Cannot enqueue into an ended queue");
    }

    if (this.queue.length >= this.capacity) {
      await new Promise<void>((resolve) => this.producersWaiting.push(resolve));
    }

    if (this.consumersWaiting.length > 0) {
      const consumer = this.consumersWaiting.shift()!;
      consumer(item);
    } else {
      this.queue.push(item);
    }
  }

  /**
   * Dequeues an item from the queue. Blocks if queue is empty until an item is enqueued or ended.
   */
  public async dequeue(): Promise<T | undefined> {
    if (this.queue.length > 0) {
      const item = this.queue.shift()!;
      if (this.producersWaiting.length > 0) {
        const producer = this.producersWaiting.shift()!;
        producer();
      }
      return item;
    }

    if (this.isEnded) {
      return undefined;
    }

    return new Promise<T | undefined>((resolve) => {
      this.consumersWaiting.push((item) => {
        if (this.producersWaiting.length > 0) {
          const producer = this.producersWaiting.shift()!;
          producer();
        }
        resolve(item);
      });
    });
  }

  /**
   * Marks the queue as ended so consumers know no more items will be enqueued.
   */
  public end(): void {
    this.isEnded = true;
    while (this.consumersWaiting.length > 0) {
      const consumer = this.consumersWaiting.shift()!;
      consumer(undefined as any);
    }
  }

  public size(): number {
    return this.queue.length;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public ended(): boolean {
    return this.isEnded;
  }
}
