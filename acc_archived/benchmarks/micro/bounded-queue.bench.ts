import { run, bench, group } from 'mitata';
import { BoundedQueue } from '../../packages/core/src/BoundedQueue';

group('BoundedQueue Async Producer-Consumer Memory Operations', () => {
  bench('Enqueue & Dequeue Sequential (100 Items)', async () => {
    const queue = new BoundedQueue<number>(100);
    for (let i = 0; i < 100; i++) {
      await queue.enqueue(i);
    }
    for (let i = 0; i < 100; i++) {
      await queue.dequeue();
    }
  });

  bench('High-Throughput Concurrent Producer-Consumer (50 Items, Capacity 10)', async () => {
    const queue = new BoundedQueue<number>(10);
    const count = 50;

    const producer = async () => {
      for (let i = 0; i < count; i++) {
        await queue.enqueue(i);
      }
      queue.end();
    };

    const consumer = async () => {
      let itemsRead = 0;
      while (true) {
        const item = await queue.dequeue();
        if (item === undefined && queue.ended()) break;
        if (item !== undefined) itemsRead++;
      }
      return itemsRead;
    };

    await Promise.all([producer(), consumer()]);
  });
});

if (import.meta.main) {
  run();
}
