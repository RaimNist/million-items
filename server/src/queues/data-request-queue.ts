export const DATA_REQUEST_FLUSH_INTERVAL_MS = 1_000;

export type DataRequestDedupeKey = `select-item:${number}` | `remove-selected-item:${number}`;

type QueueTask<T> = () => T | Promise<T>;

interface PendingRequest {
  dedupeKey?: DataRequestDedupeKey;
  promise: Promise<unknown>;
  isSettled: () => boolean;
  execute: () => Promise<void>;
}

export class DataRequestQueue {
  private readonly timer: ReturnType<typeof setInterval>;

  private readonly pendingRequests: PendingRequest[] = [];

  private lastRequest: PendingRequest | null = null;

  private activeFlush: Promise<void> | null = null;

  private isAccepting = true;

  constructor(intervalMs = DATA_REQUEST_FLUSH_INTERVAL_MS) {
    this.timer = setInterval(() => {
      void this.flush();
    }, intervalMs);
  }

  enqueue<T>(task: QueueTask<T>, dedupeKey?: DataRequestDedupeKey): Promise<T> {
    if (!this.isAccepting) {
      return Promise.reject(new Error('Data request queue is stopped'));
    }

    const lastRequest = this.lastRequest;

    if (
      dedupeKey !== undefined &&
      lastRequest?.dedupeKey === dedupeKey &&
      !lastRequest.isSettled()
    ) {
      return lastRequest.promise as Promise<T>;
    }

    let resolveRequest!: (value: T | PromiseLike<T>) => void;
    let rejectRequest!: (reason?: unknown) => void;

    const promise = new Promise<T>((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });

    let isSettled = false;

    const request: PendingRequest = {
      dedupeKey,
      promise,
      isSettled: () => isSettled,

      execute: async () => {
        try {
          const result = await task();
          resolveRequest(result);
        } catch (error) {
          rejectRequest(error);
        } finally {
          isSettled = true;
        }
      },
    };

    this.pendingRequests.push(request);
    this.lastRequest = request;

    return promise;
  }

  flush(): Promise<void> {
    if (this.activeFlush !== null) {
      return this.activeFlush;
    }

    if (this.pendingRequests.length === 0) {
      return Promise.resolve();
    }

    const batch = this.pendingRequests.splice(0, this.pendingRequests.length);

    this.activeFlush = this.processBatch(batch);

    return this.activeFlush;
  }

  async shutdown(): Promise<void> {
    this.isAccepting = false;

    clearInterval(this.timer);

    if (this.activeFlush !== null) {
      await this.activeFlush;
    }

    while (this.pendingRequests.length > 0) {
      await this.flush();
    }
  }

  private async processBatch(batch: PendingRequest[]): Promise<void> {
    try {
      for (const request of batch) {
        await request.execute();
      }
    } finally {
      this.activeFlush = null;
    }
  }
}
