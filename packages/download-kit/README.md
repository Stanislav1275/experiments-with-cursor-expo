# @app/download-kit

Standalone module for chapter downloads with queue management and MMKV persistence.

## What it does

- Persists queue/tasks in MMKV (`MMKVDownloadStore`).
- Enforces **one active chapter per title**.
- Supports queue actions: enqueue, pause, resume, cancel, delete.
- Handles re-download by replacing an existing chapter task.
- Emits scheduler events for UI and notifications.

## Core pieces

- `DownloadScheduler` - orchestrates queue and active tasks.
- `MMKVDownloadStore` - persistence adapter for React Native.
- `KeshaBackgroundDownloadQueue` - fork-style queue engine (inspired by fivecar) with:
  - `@kesha-antonov/react-native-background-downloader` transport
  - MMKV-backed queue persistence
  - global request headers support
  - pause/resume/remove/retry behavior
- `FakeChapterDownloader` - deterministic test downloader for example/demo runs.

## Notes for real background downloads

`KeshaBackgroundDownloadQueue` is the production-oriented transport candidate in this repo.
It addresses the "one-file queue fork" approach by adapting queue state storage to MMKV
and exposing explicit global headers for image requests.
