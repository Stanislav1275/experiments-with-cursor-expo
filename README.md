# experiments-with-cursor-expo

Repository scaffold for a standalone `download-kit` module and an `example` app flow
to validate background chapter downloads.

## Structure

- `packages/download-kit` - queue/scheduler core, MMKV persistence adapter, test downloader.
- `example` - demo screens and test scenarios for validating UX and download states.

## Goals

- One active chapter download per title.
- Sequential chapter processing inside each title queue.
- Pause/resume/cancel/delete/re-download behavior.
- Unified progress model to drive in-app UI and a single system notification.
- Persistent queue state in MMKV.

## Quick start

```bash
npm install
npm run typecheck
```
