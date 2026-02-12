# Download Kit implementation plan (internal)

## Why this split

`download-kit` is isolated in `packages/download-kit` so queue logic, persistence,
and downloader contracts are reusable and testable without coupling to app screens.

`example` is a manual QA sandbox that validates UX and state transitions.

## Architecture

### 1) Scheduler layer

- `DownloadScheduler` is the single authority for task state transitions.
- It enforces:
  - max one active chapter per title (`perTitleConcurrency = 1`)
  - configurable global active title count (`maxActiveTitles`)
- It emits events for UI and notification updates.

### 2) Persistence layer

- `MMKVDownloadStore` stores queue + tasks snapshot under one key.
- Snapshot restores on boot.
- Tasks in `preparing/downloading` are recovered back to `queued` on restart.

### 3) Transport layer

- `ChapterDownloader` contract is transport-agnostic:
  - `download(task, { signal, onProgress })`
  - `remove(task)`
- Demo uses `FakeChapterDownloader` to simulate bytes/pages/errors.
- `KeshaBackgroundDownloadQueue` is included as a fork-style transport engine based on
  the fivecar queue approach, but adapted for:
  - Kesha v4 (`createDownloadTask`, `getExistingDownloadTasks`)
  - MMKV persistence for queue specs
  - explicit global headers support for image requests
- Platform-native behavior is still provided by Kesha internals:
  - iOS URLSession background transfers
  - Android DownloadManager / foreground service flow

## Re-download policy

- Enqueueing the same chapter ID again triggers replacement:
  1. existing task is cancelled and removed
  2. files are removed via downloader `remove`
  3. fresh task starts from 0%

## UI contract summary

`TitleDownloadChapterItem` must always show:

- chapter number and title
- progress percent and `downloaded/total` pages
- Pause/Resume button
- Cancel button (or Delete when completed)
- `E` marker when failed

## Example test strategy

Use `example/src/screens/DownloadQueueLabScreen.tsx`.

### Smoke checks

1. Add all fixture chapters.
2. Ensure sequential switch of chapter number/progress after completion.
3. Ensure no title has more than one active task.

### Interaction checks

1. Pause active task and verify progress freeze.
2. Resume and verify progress continue.
3. Cancel active task and verify next chapter starts.
4. Delete completed task and verify it is gone.

### Failure checks

1. Configure hard-fail chapter (`c-44`) -> check `E`.
2. Missing required header -> check `missing_header`.
3. Resume failed task -> verify re-queued and retry counter grows.

### Replacement checks

1. Complete chapter.
2. Enqueue same chapter again.
3. Verify previous task replaced and new progress starts from zero.
