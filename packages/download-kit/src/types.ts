export type TaskState =
  | "queued"
  | "preparing"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskError {
  code: string;
  message: string;
  failedPageIndex?: number;
}

export interface DownloadProgress {
  downloadedImages: number;
  totalImages: number;
  downloadedBytes: number;
  totalBytes?: number;
  percent: number;
}

export interface ChapterPayload {
  titleId: string;
  titleName: string;
  titleCoverUrl?: string;
  chapterId: string;
  chapterNumber: string;
  chapterName?: string;
  imageUrls: string[];
  headers?: Record<string, string>;
  estimatedBytes?: number;
}

export interface DownloadTask extends ChapterPayload {
  taskId: string;
  state: TaskState;
  progress: DownloadProgress;
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  error?: TaskError;
}

export interface DownloadSnapshot {
  tasks: Record<string, DownloadTask>;
  queue: string[];
}

export interface DownloadStore {
  loadSnapshot(): DownloadSnapshot;
  saveSnapshot(snapshot: DownloadSnapshot): void;
}

export interface DownloadLogger {
  (message: string, context?: Record<string, unknown>): void;
}

export interface DownloadRunContext {
  signal: AbortSignal;
  onProgress: (partial: Partial<DownloadProgress>) => void;
}

export interface ChapterDownloader {
  download(task: DownloadTask, context: DownloadRunContext): Promise<void>;
  remove(task: DownloadTask): Promise<void>;
}

export interface SchedulerConfig {
  maxActiveTitles: number;
  perTitleConcurrency: 1;
  retryPerChapter: number;
}

export type SchedulerEvent =
  | { type: "task_added"; task: DownloadTask }
  | { type: "task_updated"; task: DownloadTask }
  | { type: "task_removed"; taskId: string; chapterId: string; titleId: string }
  | { type: "task_started"; task: DownloadTask }
  | { type: "task_completed"; task: DownloadTask }
  | { type: "task_failed"; task: DownloadTask; error: TaskError }
  | { type: "queue_changed"; queue: string[] };

export type SchedulerListener = (event: SchedulerEvent) => void;
