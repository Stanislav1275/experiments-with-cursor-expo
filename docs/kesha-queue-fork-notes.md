# Kesha queue fork notes

## Why this exists

`react-native-background-downloader-queue` is a strong baseline, but in our case:

- we need explicit global headers for image requests,
- we want MMKV-backed state,
- we target Kesha v4 API.

`KeshaBackgroundDownloadQueue` in `packages/download-kit/src/transport` implements
that fork-style approach directly inside the project.

## Key differences from upstream queue package

1. Uses `createDownloadTask` and `getExistingDownloadTasks` from Kesha v4.
2. Stores queue specs in MMKV instead of AsyncStorage + key-value-file-system.
3. Supports global headers (`setGlobalHeaders()` and `init({ headers })`) and merges
   them with optional per-URL headers.

## Basic usage

```ts
import { KeshaBackgroundDownloadQueue } from "@app/download-kit";

const queue = new KeshaBackgroundDownloadQueue();

await queue.init({
  domain: "user-42",
  headers: {
    Authorization: "Bearer token",
    Referer: "https://example.com",
  },
  handlers: {
    onProgress: (url, fraction) => {
      console.log("progress", url, Math.round(fraction * 100));
    },
  },
});

await queue.addUrl("https://cdn.example.com/chapters/a-101/1.webp");
await queue.addUrl("https://cdn.example.com/chapters/a-101/2.webp");
```

## Integration guidance

- Keep chapter-level logic in `DownloadScheduler`.
- Use this queue as transport for file downloads.
- Continue storing chapter/task UI state in MMKV snapshot (`MMKVDownloadStore`).
