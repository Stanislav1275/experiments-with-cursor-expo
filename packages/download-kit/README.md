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
- `FakeChapterDownloader` - deterministic test downloader for example/demo runs.

## Notes for real background downloads

To satisfy background behavior after app termination:

- iOS: use native `URLSession` background transfers.
- Android: use `WorkManager` with foreground notification.

The scheduler in this package is transport-agnostic: swap `FakeChapterDownloader`
with a native-backed downloader implementation.
