import {
  completeHandler,
  createDownloadTask,
  getExistingDownloadTasks,
  setConfig,
  type DownloadTask as NativeDownloadTask,
} from "@kesha-antonov/react-native-background-downloader";
import RNFS from "react-native-fs";
import { createMMKV, MMKV } from "react-native-mmkv";

export interface KeshaQueueNetInfoState {
  isConnected: boolean | null;
  type: string;
}

export type KeshaQueueNetInfoUnsubscribe = () => void;
export type KeshaQueueAddEventListener = (
  listener: (state: KeshaQueueNetInfoState) => void,
) => KeshaQueueNetInfoUnsubscribe;

export interface KeshaQueueStatus {
  url: string;
  path: string;
  complete: boolean;
}

export interface KeshaQueueHandlers {
  onBegin?: (url: string, totalBytes: number) => void;
  onProgress?: (
    url: string,
    fractionWritten: number,
    bytesWritten: number,
    totalBytes: number,
  ) => void;
  onDone?: (url: string, localPath: string) => void;
  onWillRemove?: (url: string) => Promise<void>;
  onError?: (url: string, error: unknown) => void;
}

export interface KeshaQueueOptions {
  domain?: string;
  handlers?: KeshaQueueHandlers;
  headers?: Record<string, string>;
  urlToPath?: (url: string) => string;
  startActive?: boolean;
  netInfoAddEventListener?: KeshaQueueAddEventListener;
  netInfoFetchState?: () => Promise<KeshaQueueNetInfoState>;
  activeNetworkTypes?: string[];
  retryDelayMs?: number;
}

export interface KeshaQueueAddUrlOptions {
  headers?: Record<string, string>;
}

interface Spec {
  id: string;
  url: string;
  path: string;
  createTime: number;
  finished: boolean;
  headers?: Record<string, string>;
}

function createId(): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${now}-${rand}`;
}

function roundToNextMinute(timestamp: number): number {
  return Math.ceil(timestamp / 60000) * 60000;
}

function splitFilenameFromExtension(filename: string): [string, string] {
  const parts = filename.split(".");
  if (parts.length <= 1) {
    return [filename, ""];
  }

  const extension = parts.pop();
  return [parts.join("."), extension ?? ""];
}

function parseSpecs(raw: string | undefined): Spec[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Spec => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const candidate = item as Partial<Spec>;
        return (
          typeof candidate.id === "string" &&
          typeof candidate.url === "string" &&
          typeof candidate.path === "string" &&
          typeof candidate.createTime === "number" &&
          typeof candidate.finished === "boolean"
        );
      })
      .map((item) => ({
        ...item,
        headers: item.headers && typeof item.headers === "object" ? item.headers : undefined,
      }));
  } catch {
    return [];
  }
}

export class KeshaBackgroundDownloadQueue {
  private readonly storage: MMKV;
  private readonly storageNamespace: string;
  private domain = "main";
  private specs: Spec[] = [];
  private readonly tasks = new Map<string, NativeDownloadTask>();
  private handlers?: KeshaQueueHandlers;
  private headers: Record<string, string> = {};
  private urlToPath?: (url: string) => string;
  private inited = false;
  private active = true;
  private isPausedByUser = false;
  private wouldAutoPause = false;
  private netInfoUnsubscriber?: () => void;
  private netInfoFetchState?: () => Promise<KeshaQueueNetInfoState>;
  private activeNetworkTypes: string[] = [];
  private erroredIds = new Set<string>();
  private errorTimer: ReturnType<typeof setInterval> | null = null;
  private retryDelayMs = 60_000;
  private deleteTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(params?: { storage?: MMKV; storageId?: string; storageNamespace?: string }) {
    this.storage =
      params?.storage ??
      createMMKV({
        id: params?.storageId ?? "download-kit",
      });
    this.storageNamespace = params?.storageNamespace ?? "download-kit:kesha-queue:v1";
  }

  public async init(options: KeshaQueueOptions = {}): Promise<void> {
    if (this.inited) {
      throw new Error("KeshaBackgroundDownloadQueue already initialized");
    }

    const {
      domain = "main",
      handlers = undefined,
      headers = {},
      urlToPath = undefined,
      startActive = true,
      netInfoAddEventListener = undefined,
      netInfoFetchState = undefined,
      activeNetworkTypes = [],
      retryDelayMs = 60_000,
    } = options;

    if (
      activeNetworkTypes.length > 0 &&
      (!netInfoAddEventListener || !netInfoFetchState)
    ) {
      throw new Error(
        "If activeNetworkTypes is set, both netInfoAddEventListener and netInfoFetchState are required.",
      );
    }

    if (netInfoAddEventListener && !netInfoFetchState) {
      throw new Error(
        "If netInfoAddEventListener is set, netInfoFetchState is required.",
      );
    }

    this.domain = domain;
    this.handlers = handlers;
    this.headers = { ...headers };
    this.urlToPath = urlToPath;
    this.active = startActive;
    this.isPausedByUser = !startActive;
    this.retryDelayMs = retryDelayMs;
    this.activeNetworkTypes = activeNetworkTypes;
    this.netInfoFetchState = netInfoFetchState;

    setConfig({
      headers: this.headers,
    });

    await RNFS.mkdir(this.getDomainedBasePath(), {
      NSURLIsExcludedFromBackupKey: true,
    });

    this.specs = this.readSpecs();
    await this.cleanupInvalidAndExpiredSpecs();
    await this.reconcileWithExistingTasks();
    await this.ensurePendingSpecsStarted();
    await this.removeOrphanedFiles();
    this.scheduleDeletions(
      this.specs.filter((spec) => -spec.createTime > Date.now()),
      Date.now(),
    );

    this.wouldAutoPause = false;
    if (netInfoAddEventListener && netInfoFetchState) {
      const state = await netInfoFetchState();
      this.onNetInfoChanged(state);
      this.netInfoUnsubscriber = netInfoAddEventListener((nextState) => {
        this.onNetInfoChanged(nextState);
      });
    }

    this.inited = true;
  }

  public terminate(): void {
    this.active = false;
    for (const [, task] of this.tasks) {
      void task.stop();
    }
    this.tasks.clear();
    this.specs = [];
    this.handlers = undefined;
    this.urlToPath = undefined;
    this.inited = false;
    this.erroredIds.clear();

    if (this.errorTimer) {
      clearInterval(this.errorTimer);
      this.errorTimer = null;
    }

    for (const [, timeout] of this.deleteTimers) {
      clearTimeout(timeout);
    }
    this.deleteTimers.clear();

    if (this.netInfoUnsubscriber) {
      this.netInfoUnsubscriber();
      this.netInfoUnsubscriber = undefined;
    }
  }

  public async addUrl(url: string, options?: KeshaQueueAddUrlOptions): Promise<void> {
    this.verifyInitialized();

    const existing = this.specs.find((spec) => spec.url === url);
    if (existing) {
      if (existing.createTime <= 0) {
        existing.createTime = Date.now();
        if (options?.headers) {
          existing.headers = { ...options.headers };
        }
        this.persistSpecs();

        const fileExists = await RNFS.exists(existing.path);
        if (!existing.finished || !fileExists) {
          if (!this.tasks.has(existing.id)) {
            this.start(existing);
          }
        } else {
          const stat = await RNFS.stat(existing.path);
          this.handlers?.onBegin?.(existing.url, Number(stat.size));
          this.handlers?.onDone?.(existing.url, existing.path);
        }
      }
      return;
    }

    const id = createId();
    const spec: Spec = {
      id,
      url,
      path: this.pathFromId(id, this.extensionFromUri(url)),
      createTime: Date.now(),
      finished: false,
      headers: options?.headers ? { ...options.headers } : undefined,
    };

    this.specs.push(spec);
    this.persistSpecs();
    this.start(spec);
  }

  public async removeUrl(url: string, deleteTime = -1): Promise<void> {
    this.verifyInitialized();
    await this.removeUrlInternal(url, deleteTime, true);
  }

  public async setQueue(urls: string[], deleteTime = -1): Promise<void> {
    this.verifyInitialized();

    const urlSet = new Set(urls);
    const liveUrls = new Set(
      this.specs.filter((spec) => spec.createTime > 0).map((spec) => spec.url),
    );
    const urlsToAdd = [...urlSet].filter((url) => !liveUrls.has(url));
    const specsToRemove = this.specs.filter(
      (spec) => !urlSet.has(spec.url) && spec.createTime > 0,
    );

    for (const spec of specsToRemove) {
      await this.removeUrlInternal(spec.url, deleteTime, false);
    }
    this.scheduleDeletions(specsToRemove, Date.now());

    for (const url of urlsToAdd) {
      await this.addUrl(url);
    }
  }

  public async getQueueStatus(): Promise<KeshaQueueStatus[]> {
    this.verifyInitialized();

    const liveSpecs = this.specs.filter((spec) => spec.createTime > 0);
    const statuses = await Promise.all(
      liveSpecs.map(async (spec): Promise<KeshaQueueStatus> => ({
        url: spec.url,
        path: spec.path,
        complete: spec.finished && (await RNFS.exists(spec.path)),
      })),
    );
    return statuses;
  }

  public async getStatus(url: string): Promise<KeshaQueueStatus | null> {
    this.verifyInitialized();

    const spec = this.specs.find((item) => item.url === url && item.createTime > 0);
    if (!spec) {
      return null;
    }

    return {
      url: spec.url,
      path: spec.path,
      complete: spec.finished && (await RNFS.exists(spec.path)),
    };
  }

  public async getAvailableUrl(url: string): Promise<string> {
    this.verifyInitialized();

    const spec = this.specs.find((item) => item.url === url);
    if (!spec || !spec.finished || spec.createTime <= 0) {
      return url;
    }

    const exists = await RNFS.exists(spec.path);
    return exists ? spec.path : url;
  }

  public pauseAll(): void {
    this.verifyInitialized();
    this.isPausedByUser = true;
    this.pauseAllInternal();
  }

  public resumeAll(): void {
    this.verifyInitialized();
    this.isPausedByUser = false;

    if (!this.wouldAutoPause) {
      this.resumeAllInternal();
    }
  }

  public async setActiveNetworkTypes(types: string[]): Promise<void> {
    this.verifyInitialized();

    if (
      this.activeNetworkTypes.length === types.length &&
      this.activeNetworkTypes.every((type) => types.includes(type))
    ) {
      return;
    }

    this.activeNetworkTypes = [...types];
    if (!this.netInfoFetchState) {
      throw new Error(
        "setActiveNetworkTypes requires netInfoFetchState configured during init().",
      );
    }

    const state = await this.netInfoFetchState();
    this.onNetInfoChanged(state);
  }

  public setGlobalHeaders(headers: Record<string, string>): void {
    this.headers = { ...headers };
    setConfig({
      headers: this.headers,
    });
  }

  private verifyInitialized(): void {
    if (!this.inited) {
      throw new Error("KeshaBackgroundDownloadQueue not initialized");
    }
  }

  private getSpecsStorageKey(): string {
    return `${this.storageNamespace}/${this.domain}/specs`;
  }

  private readSpecs(): Spec[] {
    return parseSpecs(this.storage.getString(this.getSpecsStorageKey()));
  }

  private persistSpecs(): void {
    this.storage.set(this.getSpecsStorageKey(), JSON.stringify(this.specs));
  }

  private async cleanupInvalidAndExpiredSpecs(): Promise<void> {
    const now = Date.now();
    const seenUrls = new Set<string>();
    const filtered: Spec[] = [];
    const toDelete: Spec[] = [];

    for (const spec of this.specs) {
      const isExpired = spec.createTime === 0 || (spec.createTime < 0 && -spec.createTime <= now);
      if (isExpired) {
        toDelete.push(spec);
        continue;
      }

      if (seenUrls.has(spec.url)) {
        toDelete.push(spec);
        continue;
      }

      seenUrls.add(spec.url);
      filtered.push(spec);
    }

    this.specs = filtered;
    this.persistSpecs();

    await Promise.all(
      toDelete.map(async (spec) => {
        try {
          await RNFS.unlink(spec.path);
        } catch {
          // Missing file is expected.
        }
      }),
    );
  }

  private async reconcileWithExistingTasks(): Promise<void> {
    const existingTasks = await getExistingDownloadTasks();
    for (const task of existingTasks) {
      await this.reviveTask(task);
    }
  }

  private async ensurePendingSpecsStarted(): Promise<void> {
    for (const spec of this.specs) {
      if (spec.createTime <= 0) {
        continue;
      }

      if (this.tasks.has(spec.id)) {
        continue;
      }

      await this.reconcileFinishStateWithFile(spec);
      if (spec.finished) {
        try {
          const fileSpec = await RNFS.stat(spec.path);
          this.handlers?.onBegin?.(spec.url, Number(fileSpec.size));
          this.handlers?.onDone?.(spec.url, spec.path);
        } catch {
          spec.finished = false;
          this.persistSpecs();
          this.start(spec);
        }
      } else {
        this.start(spec);
      }
    }
  }

  private async removeOrphanedFiles(): Promise<void> {
    let dirFilenames: string[] = [];
    try {
      dirFilenames = await RNFS.readdir(this.getDomainedBasePath());
    } catch {
      return;
    }

    const orphaned = dirFilenames
      .map(splitFilenameFromExtension)
      .filter(([basename]) => !this.specs.some((spec) => spec.id === basename));

    await Promise.all(
      orphaned.map(async ([basename, extension]) => {
        try {
          await RNFS.unlink(this.pathFromId(basename, extension));
        } catch {
          // Missing file is expected.
        }
      }),
    );
  }

  private async removeUrlInternal(
    url: string,
    deleteTime: number,
    scheduleDeletion: boolean,
  ): Promise<void> {
    const index = this.specs.findIndex((spec) => spec.url === url);
    if (index < 0) {
      return;
    }

    const spec = this.specs[index];
    await this.handlers?.onWillRemove?.(spec.url);

    const task = this.removeTask(spec.id);
    if (task) {
      await task.stop();
    }

    if (deleteTime >= 0) {
      spec.createTime = -deleteTime;
      this.persistSpecs();
      if (scheduleDeletion && deleteTime > 0) {
        this.scheduleDeletions([spec], Date.now());
      }
      return;
    }

    this.specs.splice(index, 1);
    this.persistSpecs();

    try {
      await RNFS.unlink(spec.path);
    } catch {
      // Missing file is expected.
    }
  }

  private removeTask(id: string): NativeDownloadTask | undefined {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.delete(id);
    }

    this.erroredIds.delete(id);
    if (this.erroredIds.size === 0 && this.errorTimer) {
      clearInterval(this.errorTimer);
      this.errorTimer = null;
    }
    return task;
  }

  private start(spec: Spec): void {
    const path = this.pathFromId(spec.id, this.extensionFromUri(spec.url));
    if (spec.path !== path) {
      spec.path = path;
      this.persistSpecs();
    }

    const task = createDownloadTask({
      id: spec.id,
      url: spec.url,
      destination: spec.path,
      headers: {
        ...this.headers,
        ...spec.headers,
      },
      metadata: {
        url: spec.url,
        domain: this.domain,
      },
    });

    this.addTask(spec, task);
    task.start();
  }

  private addTask(spec: Spec, task: NativeDownloadTask): void {
    task
      .begin((data) => {
        if (!this.active) {
          void task.pause();
        }
        this.handlers?.onBegin?.(spec.url, data.expectedBytes);
      })
      .progress(({ bytesDownloaded, bytesTotal }) => {
        if (!this.active) {
          void task.pause();
        }
        const fraction = bytesTotal > 0 ? bytesDownloaded / bytesTotal : 0;
        this.handlers?.onProgress?.(spec.url, fraction, bytesDownloaded, bytesTotal);
      })
      .done(async ({ location }) => {
        this.removeTask(task.id);
        spec.finished = true;
        this.persistSpecs();

        try {
          await completeHandler(task.id);
        } catch {
          // No-op on platforms where this is not required.
        }

        this.handlers?.onDone?.(spec.url, location || spec.path);
      })
      .error((error) => {
        this.removeTask(task.id);
        this.handlers?.onError?.(spec.url, error);
        this.erroredIds.add(task.id);
        this.ensureErrorTimerOn();
      });

    this.tasks.set(spec.id, task);
  }

  private ensureErrorTimerOn(): void {
    if (this.errorTimer) {
      return;
    }

    this.errorTimer = setInterval(() => {
      this.retryErroredTasks();
    }, this.retryDelayMs);
  }

  private retryErroredTasks(): void {
    this.erroredIds.forEach((id) => {
      if (this.tasks.has(id)) {
        return;
      }

      const spec = this.specs.find((item) => item.id === id);
      if (!spec || spec.finished || spec.createTime <= 0) {
        return;
      }

      this.start(spec);
    });
  }

  private async reviveTask(task: NativeDownloadTask): Promise<void> {
    const spec = this.specs.find((item) => item.id === task.id);

    if (!spec) {
      if (["DOWNLOADING", "PAUSED", "PENDING"].includes(task.state)) {
        await task.stop();
      }
      return;
    }

    await this.reconcileFinishStateWithFile(spec);

    if (spec.finished) {
      if (spec.createTime > 0) {
        this.handlers?.onBegin?.(spec.url, task.bytesTotal);
        this.handlers?.onDone?.(spec.url, spec.path);
      }
      return;
    }

    if (spec.createTime <= 0) {
      if (["DOWNLOADING", "PAUSED", "PENDING"].includes(task.state)) {
        await task.stop();
      }

      try {
        await RNFS.unlink(spec.path);
      } catch {
        // Missing file is expected.
      }
      return;
    }

    if (task.state === "STOPPED") {
      this.start(spec);
      return;
    }

    if (task.state === "FAILED") {
      this.handlers?.onError?.(spec.url, "unknown error while app was backgrounded");
      this.erroredIds.add(task.id);
      this.ensureErrorTimerOn();
      return;
    }

    if (task.state === "DONE") {
      const exists = await RNFS.exists(spec.path);
      if (exists) {
        spec.finished = true;
        this.persistSpecs();
        this.handlers?.onBegin?.(spec.url, task.bytesTotal);
        this.handlers?.onDone?.(spec.url, spec.path);
        return;
      }

      await task.stop();
      this.start(spec);
      return;
    }

    this.addTask(spec, task);
    if (!this.active) {
      await task.pause();
    }
  }

  private async reconcileFinishStateWithFile(spec: Spec): Promise<void> {
    if (!spec.finished) {
      return;
    }

    const exists = await RNFS.exists(spec.path);
    if (exists) {
      return;
    }

    spec.finished = false;
    this.persistSpecs();
  }

  private pauseAllInternal(): void {
    this.active = false;
    for (const [, task] of this.tasks) {
      void task.pause();
    }

    if (this.errorTimer) {
      clearInterval(this.errorTimer);
      this.errorTimer = null;
    }
  }

  private resumeAllInternal(): void {
    this.active = true;
    for (const [, task] of this.tasks) {
      void task.resume();
    }

    if (this.erroredIds.size > 0) {
      this.ensureErrorTimerOn();
    }
  }

  private onNetInfoChanged(state: KeshaQueueNetInfoState): void {
    const shouldAutoPause =
      !state.isConnected ||
      (this.activeNetworkTypes.length > 0 && !this.activeNetworkTypes.includes(state.type));
    if (shouldAutoPause === this.wouldAutoPause) {
      return;
    }

    this.wouldAutoPause = shouldAutoPause;
    if (!this.isPausedByUser) {
      if (shouldAutoPause) {
        this.pauseAllInternal();
      } else {
        this.resumeAllInternal();
      }
    }
  }

  private scheduleDeletions(toDelete: Spec[], basisTimestamp: number): void {
    const wakeUpTimes = new Set(toDelete.map((spec) => roundToNextMinute(-spec.createTime)));
    for (const wakeUpTime of wakeUpTimes) {
      if (this.deleteTimers.has(wakeUpTime)) {
        continue;
      }

      const timeout = wakeUpTime - basisTimestamp;
      if (timeout <= 0) {
        void this.deleteExpiredSpecs(wakeUpTime);
        continue;
      }

      const timer = setTimeout(() => {
        this.deleteTimers.delete(wakeUpTime);
        void this.deleteExpiredSpecs(wakeUpTime);
      }, timeout);
      this.deleteTimers.set(wakeUpTime, timer);
    }
  }

  private async deleteExpiredSpecs(basisTimestamp: number): Promise<void> {
    const toDelete = this.specs.filter(
      (spec) => spec.createTime < 0 && -spec.createTime <= basisTimestamp,
    );
    const deleteIds = new Set(toDelete.map((spec) => spec.id));

    await Promise.all(
      toDelete.map(async (spec) => {
        try {
          await RNFS.unlink(spec.path);
        } catch {
          // Missing file is expected.
        }
      }),
    );

    this.specs = this.specs.filter((spec) => !deleteIds.has(spec.id));
    this.persistSpecs();
  }

  private extensionFromUri(uri: string): string {
    const path = this.urlToPath?.(uri);
    if (!path) {
      return "";
    }

    const filename = path.split("/").pop();
    if (!filename) {
      return "";
    }

    const parts = filename.split(".");
    if (parts.length <= 1) {
      return "";
    }

    return parts[parts.length - 1] ?? "";
  }

  private getDomainedBasePath(): string {
    return `${basePath()}/${this.domain}`;
  }

  private pathFromId(id: string, extension: string): string {
    return `${this.getDomainedBasePath()}/${id}${extension.length > 0 ? `.${extension}` : ""}`;
  }
}

function basePath(): string {
  return `${RNFS.DocumentDirectoryPath}/DownloadQueue`;
}
