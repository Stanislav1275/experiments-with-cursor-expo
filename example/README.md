# download-kit example

`example` is a sandbox to manually test queue behavior and UI state transitions for
chapter downloads.

## Proposed screen set

1. `DownloadQueueLabScreen`
   - Add chapters from fixture catalog.
   - Observe active tasks and queued tasks.
   - Observe auto-switch from chapter N to chapter N+1 with fresh progress.
2. `TitleDownloadsScreen`
   - Group tasks by title.
   - Verify rule: **max 1 active chapter per title**.
3. `TaskDebugScreen`
   - Event timeline (`task_started`, `task_failed`, `task_completed`).
   - Retry counters and latest error payload.

## UI contract for `TitleDownloadChapterItem`

- show chapter number and chapter name.
- show progress (`percent` and `downloadedImages/totalImages`).
- action buttons:
  - pause/resume
  - cancel
- show `E` badge when task is in `failed` state.

## Test matrix

### 1) Sequential progress switch

1. Add chapters 101 and 102 of same title.
2. Verify chapter 101 starts and shows progress.
3. After completion, verify chapter 102 starts automatically and progress resets.

### 2) One active chapter per title

1. Add chapters 101 and 102 of `title-a`.
2. Add chapter 12 of `title-b`.
3. Verify never more than one active task for `title-a`.

### 3) Pause / resume

1. Pause active task at ~20%.
2. Verify state is `paused`, no byte growth.
3. Resume and verify progress continues from saved values.

### 4) Cancel active chapter

1. Cancel active task.
2. Verify task disappears from queue and scheduler starts next eligible task.

### 5) Error visibility (`E`)

1. Configure fake downloader to fail on chapter `c-44`.
2. Verify task enters `failed` with visible `E`.
3. Press resume to re-queue and retry.

### 6) Re-download replacement

1. Download chapter 101 to completion.
2. Enqueue chapter 101 again.
3. Verify old task is replaced by new one and progress starts from 0%.

### 7) Header validation

1. Remove required `Authorization` header from chapter payload.
2. Verify task fails with `missing_header` and `E` indicator.

## Example wiring notes

- Use `MMKVDownloadStore` in app runtime.
- Use `FakeChapterDownloader` in example-only builds.
- Switch to native background downloader implementation for production.
