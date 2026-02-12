import { ChapterDownloader, DownloadTask } from "../types";

const DEFAULT_TICK_MS = 120;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createAbortError(): Error {
  const error = new Error("Download aborted");
  (error as Error & { name: string }).name = "AbortError";
  return error;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface FakeChapterDownloaderOptions {
  tickMs?: number;
  minPageBytes?: number;
  maxPageBytes?: number;
  randomFailureRate?: number;
  requiredHeaders?: string[];
  hardFailChapterIds?: string[];
}

export class FakeChapterDownloader implements ChapterDownloader {
  private readonly tickMs: number;
  private readonly minPageBytes: number;
  private readonly maxPageBytes: number;
  private readonly randomFailureRate: number;
  private readonly requiredHeaders: string[];
  private readonly hardFailChapterIds: Set<string>;
  private readonly downloadedChapterIds = new Set<string>();

  constructor(options: FakeChapterDownloaderOptions = {}) {
    this.tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    this.minPageBytes = options.minPageBytes ?? 400_000;
    this.maxPageBytes = options.maxPageBytes ?? 1_200_000;
    this.randomFailureRate = options.randomFailureRate ?? 0;
    this.requiredHeaders = options.requiredHeaders ?? [];
    this.hardFailChapterIds = new Set(options.hardFailChapterIds ?? []);
  }

  public async download(
    task: DownloadTask,
    context: {
      signal: AbortSignal;
      onProgress: (partial: {
        downloadedImages: number;
        totalImages: number;
        downloadedBytes: number;
        totalBytes: number;
        percent?: number;
      }) => void;
    },
  ): Promise<void> {
    if (this.hardFailChapterIds.has(task.chapterId)) {
      throw {
        code: "hard_fail_chapter",
        message: `Chapter ${task.chapterId} is configured to fail`,
      };
    }

    for (const header of this.requiredHeaders) {
      if (!task.headers?.[header]) {
        throw {
          code: "missing_header",
          message: `Missing required header: ${header}`,
        };
      }
    }

    const totalImages = task.imageUrls.length;
    const pageSizes = task.imageUrls.map(() => randomInt(this.minPageBytes, this.maxPageBytes));
    const totalBytes = pageSizes.reduce((acc, size) => acc + size, 0);
    let downloadedBytes = task.progress.downloadedBytes || 0;
    let downloadedImages = task.progress.downloadedImages || 0;

    context.onProgress({
      totalImages,
      downloadedImages,
      downloadedBytes,
      totalBytes,
    });

    for (let pageIndex = downloadedImages; pageIndex < totalImages; pageIndex += 1) {
      if (context.signal.aborted) {
        throw createAbortError();
      }

      if (Math.random() < this.randomFailureRate) {
        throw {
          code: "fake_random_network_error",
          message: "Fake random failure for testing retries",
          failedPageIndex: pageIndex,
        };
      }

      const pageBytes = pageSizes[pageIndex];
      let pageDownloaded = 0;
      while (pageDownloaded < pageBytes) {
        if (context.signal.aborted) {
          throw createAbortError();
        }

        const chunk = Math.min(randomInt(15_000, 90_000), pageBytes - pageDownloaded);
        pageDownloaded += chunk;
        downloadedBytes += chunk;

        context.onProgress({
          totalImages,
          downloadedImages,
          downloadedBytes,
          totalBytes,
        });

        await wait(this.tickMs);
      }

      downloadedImages += 1;
      context.onProgress({
        totalImages,
        downloadedImages,
        downloadedBytes,
        totalBytes,
      });
    }

    this.downloadedChapterIds.add(task.chapterId);
  }

  public async remove(task: DownloadTask): Promise<void> {
    this.downloadedChapterIds.delete(task.chapterId);
  }
}
