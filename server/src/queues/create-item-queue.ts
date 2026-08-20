export const CREATE_ITEM_FLUSH_INTERVAL_MS = 10_000;

type QueueTask<T> = () => T | Promise<T>;

interface PendingCreateRequest {
  id: number;
  execute: () => Promise<void>;
}

export class CreateItemQueue {
  private readonly timer: ReturnType<typeof setInterval>;

  private readonly pendingRequests: PendingCreateRequest[] = [];

  private readonly pendingById = new Map<number, Promise<unknown>>();

  private activeFlush: Promise<void> | null = null;

  private isAccepting = true;

  constructor(intervalMs = CREATE_ITEM_FLUSH_INTERVAL_MS) {
    this.timer = setInterval(() => {
      void this.flush();
    }, intervalMs);
  }

  enqueue<T>(id: number, task: QueueTask<T>): Promise<T> {
    if (!this.isAccepting) {
      return Promise.reject(new Error('Create item queue is stopped'));
    }

    const existingRequest = this.pendingById.get(id);

    if (existingRequest !== undefined) {
      return existingRequest as Promise<T>;
    }

    let resolveRequest!: (value: T | PromiseLike<T>) => void;
    let rejectRequest!: (reason?: unknown) => void;

    const promise = new Promise<T>((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });

    const request: PendingCreateRequest = {
      id,

      execute: async () => {
        try {
          const result = await task();
          resolveRequest(result);
        } catch (error) {
          rejectRequest(error);
        } finally {
          const currentRequest = this.pendingById.get(id);

          if (currentRequest === promise) {
            this.pendingById.delete(id);
          }
        }
      },
    };

    this.pendingById.set(id, promise);
    this.pendingRequests.push(request);

    return promise;
  }

  flush(): Promise<void> {
    if (this.activeFlush !== null) {
      return this.activeFlush;
    }

    if (this.pendingRequests.length === 0) {
      return Promise.resolve();
    }

    const batch = this.pendingRequests.splice(
      0,
      this.pendingRequests.length,
    );

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

  private async processBatch(
    batch: PendingCreateRequest[],
  ): Promise<void> {
    try {
      for (const request of batch) {
        await request.execute();
      }
    } finally {
      this.activeFlush = null;
    }
  }
}