import {
  ChapterDownloader,
  ChapterPayload,
  DownloadLogger,
  DownloadSnapshot,
  DownloadStore,
  DownloadTask,
  SchedulerConfig,
  SchedulerEvent,
  SchedulerListener,
  TaskError,
} from "../types";

const DEFAULT_CONFIG: SchedulerConfig = {
  maxActiveTitles: 2,
  perTitleConcurrency: 1,
  retryPerChapter: 2,
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function normalizeError(error: unknown): TaskError {
  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;
    return {
      code: String(maybeError.code ?? "download_failed"),
      message: String(maybeError.message ?? "Unknown download error"),
      failedPageIndex:
        typeof maybeError.failedPageIndex === "number"
          ? maybeError.failedPageIndex
          : undefined,
    };
  }

  return {
    code: "download_failed",
    message: String(error ?? "Unknown download error"),
  };
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Record<string, unknown>;
  return candidate.name === "AbortError" || candidate.code === "ABORT_ERR";
}

export class DownloadScheduler {
  private readonly store: DownloadStore;
  private readonly downloader: ChapterDownloader;
  private readonly config: SchedulerConfig;
  private readonly logger?: DownloadLogger;
  private readonly listeners = new Set<SchedulerListener>();
  private readonly activeByTitle = new Map<string, string>();
  private readonly controllersByTaskId = new Map<string, AbortController>();
  private snapshot: DownloadSnapshot;
  private started = false;
  private pumping = false;

  constructor(params: {
    store: DownloadStore;
    downloader: ChapterDownloader;
    config?: Partial<SchedulerConfig>;
    logger?: DownloadLogger;
  }) {
    this.store = params.store;
    this.downloader = params.downloader;
    this.config = { ...DEFAULT_CONFIG, ...params.config, perTitleConcurrency: 1 };
    this.logger = params.logger;
    this.snapshot = this.store.loadSnapshot();
  }

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.recoverInterruptedTasks();
    this.pump();
  }

  public stop(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    for (const [, controller] of this.controllersByTaskId) {
      controller.abort();
    }
    this.controllersByTaskId.clear();
    this.activeByTitle.clear();
  }

  public subscribe(listener: SchedulerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getSnapshot(): DownloadSnapshot {
    return JSON.parse(JSON.stringify(this.snapshot)) as DownloadSnapshot;
  }

  public async enqueue(payload: ChapterPayload): Promise<DownloadTask> {
    await this.replaceExistingChapter(payload.chapterId);

    const now = Date.now();
    const taskId = `${payload.chapterId}:${now}`;
    const task: DownloadTask = {
      ...payload,
      taskId,
      state: "queued",
      progress: {
        downloadedImages: 0,
        totalImages: payload.imageUrls.length,
        downloadedBytes: 0,
        totalBytes: payload.estimatedBytes,
        percent: 0,
      },
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
    };

    this.snapshot.tasks[taskId] = task;
    this.enqueueTaskId(taskId);
    this.persist();
    this.emit({ type: "task_added", task });
    this.emit({ type: "queue_changed", queue: [...this.snapshot.queue] });
    this.pump();

    return task;
  }

  public async pause(taskId: string): Promise<void> {
    const task = this.snapshot.tasks[taskId];
    if (!task) {
      return;
    }

    this.removeFromQueue(taskId);
    if (task.state === "queued" || task.state === "failed") {
      this.updateTask(taskId, { state: "paused", error: undefined });
      this.emit({ type: "queue_changed", queue: [...this.snapshot.queue] });
      return;
    }

    if (task.state === "preparing" || task.state === "downloading") {
      this.updateTask(taskId, { state: "paused", error: undefined });
      this.controllersByTaskId.get(taskId)?.abort();
      this.emit({ type: "queue_changed", queue: [...this.snapshot.queue] });
      return;
    }
  }

  public async resume(taskId: string): Promise<void> {
    const task = this.snapshot.tasks[taskId];
    if (!task) {
      return;
    }

    if (task.state !== "paused" && task.state !== "failed") {
      return;
    }

    this.updateTask(taskId, {
      state: "queued",
      error: undefined,
    });
    this.enqueueTaskId(taskId);
    this.emit({ type: "queue_changed", queue: [...this.snapshot.queue] });
    this.pump();
  }

  public async cancel(taskId: string): Promise<void> {
    const task = this.snapshot.tasks[taskId];
    if (!task) {
      return;
    }

    this.removeFromQueue(taskId);
    this.updateTask(taskId, { state: "cancelled" });
    this.controllersByTaskId.get(taskId)?.abort();
    this.activeByTitle.delete(task.titleId);
    await this.downloader.remove(task);
    this.removeTask(taskId);
    this.emit({ type: "queue_changed", queue: [...this.snapshot.queue] });
    this.pump();
  }

  public async delete(taskId: string): Promise<void> {
    const task = this.snapshot.tasks[taskId];
    if (!task) {
      return;
    }

    this.removeFromQueue(taskId);
    this.controllersByTaskId.get(taskId)?.abort();
    this.activeByTitle.delete(task.titleId);
    await this.downloader.remove(task);
    this.removeTask(taskId);
    this.emit({ type: "queue_changed", queue: [...this.snapshot.queue] });
    this.pump();
  }

  private recoverInterruptedTasks(): void {
    Object.values(this.snapshot.tasks).forEach((task) => {
      if (task.state === "downloading" || task.state === "preparing") {
        this.snapshot.tasks[task.taskId] = {
          ...task,
          state: "queued",
          updatedAt: Date.now(),
        };
        this.enqueueTaskId(task.taskId);
      }
    });
    this.persist();
    this.emit({ type: "queue_changed", queue: [...this.snapshot.queue] });
  }

  private async replaceExistingChapter(chapterId: string): Promise<void> {
    const existingTask = Object.values(this.snapshot.tasks).find(
      (task) => task.chapterId === chapterId,
    );
    if (!existingTask) {
      return;
    }

    await this.cancel(existingTask.taskId);
  }

  private enqueueTaskId(taskId: string): void {
    if (!this.snapshot.queue.includes(taskId)) {
      this.snapshot.queue.push(taskId);
      this.persist();
    }
  }

  private removeFromQueue(taskId: string): void {
    const before = this.snapshot.queue.length;
    this.snapshot.queue = this.snapshot.queue.filter((id) => id !== taskId);
    if (before !== this.snapshot.queue.length) {
      this.persist();
    }
  }

  private updateTask(taskId: string, patch: Partial<DownloadTask>): void {
    const current = this.snapshot.tasks[taskId];
    if (!current) {
      return;
    }

    const nextTask: DownloadTask = {
      ...current,
      ...patch,
      progress: {
        ...current.progress,
        ...patch.progress,
      },
      updatedAt: Date.now(),
    };
    nextTask.progress.percent = clampPercent(nextTask.progress.percent);

    this.snapshot.tasks[taskId] = nextTask;
    this.persist();
    this.emit({ type: "task_updated", task: nextTask });
  }

  private removeTask(taskId: string): void {
    const task = this.snapshot.tasks[taskId];
    if (!task) {
      return;
    }

    delete this.snapshot.tasks[taskId];
    this.persist();
    this.emit({
      type: "task_removed",
      taskId,
      chapterId: task.chapterId,
      titleId: task.titleId,
    });
  }

  private emit(event: SchedulerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private log(message: string, context?: Record<string, unknown>): void {
    this.logger?.(message, context);
  }

  private persist(): void {
    this.store.saveSnapshot(this.snapshot);
  }

  private pump(): void {
    if (!this.started || this.pumping) {
      return;
    }

    this.pumping = true;
    try {
      while (this.started) {
        if (this.activeByTitle.size >= this.config.maxActiveTitles) {
          return;
        }

        const nextTask = this.pickNextQueuedTask();
        if (!nextTask) {
          return;
        }

        this.launch(nextTask);
      }
    } finally {
      this.pumping = false;
    }
  }

  private pickNextQueuedTask(): DownloadTask | undefined {
    for (const taskId of this.snapshot.queue) {
      const task = this.snapshot.tasks[taskId];
      if (!task) {
        continue;
      }

      if (task.state !== "queued") {
        continue;
      }

      if (this.activeByTitle.has(task.titleId)) {
        continue;
      }

      return task;
    }
    return undefined;
  }

  private launch(task: DownloadTask): void {
    this.removeFromQueue(task.taskId);
    this.activeByTitle.set(task.titleId, task.taskId);
    const controller = new AbortController();
    this.controllersByTaskId.set(task.taskId, controller);
    this.updateTask(task.taskId, { state: "preparing", error: undefined });

    const run = async () => {
      this.updateTask(task.taskId, { state: "downloading" });
      const activeTask = this.snapshot.tasks[task.taskId];
      if (!activeTask) {
        return;
      }

      this.emit({ type: "task_started", task: activeTask });
      await this.downloader.download(activeTask, {
        signal: controller.signal,
        onProgress: (partial) => {
          const current = this.snapshot.tasks[task.taskId];
          if (!current) {
            return;
          }

          const totalImages =
            partial.totalImages ?? current.progress.totalImages ?? current.imageUrls.length;
          const downloadedImages =
            partial.downloadedImages ?? current.progress.downloadedImages ?? 0;
          const totalBytes = partial.totalBytes ?? current.progress.totalBytes;
          const downloadedBytes =
            partial.downloadedBytes ?? current.progress.downloadedBytes ?? 0;

          const computedPercent =
            typeof totalBytes === "number" && totalBytes > 0
              ? (downloadedBytes / totalBytes) * 100
              : totalImages > 0
                ? (downloadedImages / totalImages) * 100
                : current.progress.percent;

          this.updateTask(task.taskId, {
            progress: {
              totalImages,
              downloadedImages,
              totalBytes,
              downloadedBytes,
              percent: clampPercent(computedPercent),
            },
          });
        },
      });

      const doneTask = this.snapshot.tasks[task.taskId];
      if (!doneTask) {
        return;
      }

      this.updateTask(task.taskId, {
        state: "completed",
        error: undefined,
        progress: {
          ...doneTask.progress,
          downloadedImages: doneTask.progress.totalImages,
          downloadedBytes: doneTask.progress.totalBytes ?? doneTask.progress.downloadedBytes,
          percent: 100,
        },
      });
      const completedTask = this.snapshot.tasks[task.taskId];
      if (completedTask) {
        this.emit({ type: "task_completed", task: completedTask });
      }
    };

    run()
      .catch((error) => {
        const current = this.snapshot.tasks[task.taskId];
        if (!current) {
          return;
        }

        if (isAbortError(error) && current.state === "paused") {
          return;
        }

        if (isAbortError(error) && current.state === "cancelled") {
          return;
        }

        const normalizedError = normalizeError(error);
        const canRetry = current.retryCount < this.config.retryPerChapter;
        if (canRetry) {
          this.updateTask(task.taskId, {
            state: "queued",
            retryCount: current.retryCount + 1,
            error: normalizedError,
          });
          this.enqueueTaskId(task.taskId);
          this.log("task_requeued", {
            taskId: task.taskId,
            retry: current.retryCount + 1,
          });
          return;
        }

        this.updateTask(task.taskId, {
          state: "failed",
          error: normalizedError,
        });

        const failedTask = this.snapshot.tasks[task.taskId];
        if (failedTask) {
          this.emit({
            type: "task_failed",
            task: failedTask,
            error: normalizedError,
          });
        }
      })
      .finally(() => {
        this.controllersByTaskId.delete(task.taskId);
        this.activeByTitle.delete(task.titleId);
        this.pump();
      });
  }
}
