import { createMMKV, MMKV } from "react-native-mmkv";

import { DownloadSnapshot, DownloadStore } from "../types";

const SNAPSHOT_KEY = "download-kit:snapshot:v1";

function makeEmptySnapshot(): DownloadSnapshot {
  return {
    tasks: {},
    queue: [],
  };
}

function parseSnapshot(raw: string | undefined): DownloadSnapshot {
  if (!raw) {
    return makeEmptySnapshot();
  }

  try {
    const parsed = JSON.parse(raw) as DownloadSnapshot;
    if (!parsed || typeof parsed !== "object") {
      return makeEmptySnapshot();
    }

    return {
      tasks:
        parsed.tasks && typeof parsed.tasks === "object"
          ? parsed.tasks
          : makeEmptySnapshot().tasks,
      queue: Array.isArray(parsed.queue) ? parsed.queue : makeEmptySnapshot().queue,
    };
  } catch {
    return makeEmptySnapshot();
  }
}

export class MMKVDownloadStore implements DownloadStore {
  private readonly storage: MMKV;

  constructor(storage?: MMKV) {
    this.storage =
      storage ??
      createMMKV({
        id: "download-kit",
      });
  }

  public loadSnapshot(): DownloadSnapshot {
    return parseSnapshot(this.storage.getString(SNAPSHOT_KEY));
  }

  public saveSnapshot(snapshot: DownloadSnapshot): void {
    this.storage.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
  }
}

export class InMemoryDownloadStore implements DownloadStore {
  private snapshot: DownloadSnapshot = makeEmptySnapshot();

  public loadSnapshot(): DownloadSnapshot {
    return JSON.parse(JSON.stringify(this.snapshot)) as DownloadSnapshot;
  }

  public saveSnapshot(snapshot: DownloadSnapshot): void {
    this.snapshot = JSON.parse(JSON.stringify(snapshot)) as DownloadSnapshot;
  }
}
