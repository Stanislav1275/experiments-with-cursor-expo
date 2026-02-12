import { useEffect, useMemo, useRef, useState } from "react";

import {
  DownloadScheduler,
  DownloadSnapshot,
  DownloadTask,
  FakeChapterDownloader,
  MMKVDownloadStore,
  SchedulerEvent,
  demoChapters,
} from "@app/download-kit";

type EventLog = {
  at: number;
  text: string;
};

function eventToText(event: SchedulerEvent): string {
  switch (event.type) {
    case "task_added":
      return `+ queued ${event.task.titleName} #${event.task.chapterNumber}`;
    case "task_started":
      return `> started ${event.task.titleName} #${event.task.chapterNumber}`;
    case "task_completed":
      return `completed ${event.task.titleName} #${event.task.chapterNumber}`;
    case "task_failed":
      return `E failed ${event.task.chapterId}: ${event.error.code}`;
    case "task_removed":
      return `- removed ${event.chapterId}`;
    case "queue_changed":
      return `queue=${event.queue.length}`;
    case "task_updated":
      return `~ ${event.task.chapterId} ${event.task.state} ${event.task.progress.percent.toFixed(0)}%`;
    default:
      return event.type;
  }
}

export function useDownloadKitDemo(): {
  snapshot: DownloadSnapshot;
  tasks: DownloadTask[];
  logs: EventLog[];
  addChapter: (chapterId: string) => Promise<void>;
  addAll: () => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  catalog: typeof demoChapters;
} {
  const scheduler = useMemo(
    () =>
      new DownloadScheduler({
        store: new MMKVDownloadStore(),
        downloader: new FakeChapterDownloader({
          requiredHeaders: ["Authorization", "Referer"],
          randomFailureRate: 0.02,
          hardFailChapterIds: ["c-44"],
        }),
        config: {
          maxActiveTitles: 2,
        },
      }),
    [],
  );
  const [snapshot, setSnapshot] = useState<DownloadSnapshot>(() => scheduler.getSnapshot());
  const [logs, setLogs] = useState<EventLog[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    scheduler.start();
    const unsubscribe = scheduler.subscribe((event) => {
      if (!mountedRef.current) {
        return;
      }

      setSnapshot(scheduler.getSnapshot());
      setLogs((previous) => {
        const next = [
          {
            at: Date.now(),
            text: eventToText(event),
          },
          ...previous,
        ];
        return next.slice(0, 200);
      });
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      scheduler.stop();
    };
  }, [scheduler]);

  const tasks = useMemo(
    () =>
      Object.values(snapshot.tasks).sort((left, right) => left.createdAt - right.createdAt),
    [snapshot.tasks],
  );

  const addChapter = async (chapterId: string): Promise<void> => {
    const chapter = demoChapters.find((item) => item.chapterId === chapterId);
    if (!chapter) {
      return;
    }
    await scheduler.enqueue(chapter);
  };

  const addAll = async (): Promise<void> => {
    for (const chapter of demoChapters) {
      // Keep order deterministic for queue testing.
      // eslint-disable-next-line no-await-in-loop
      await scheduler.enqueue(chapter);
    }
  };

  return {
    snapshot,
    tasks,
    logs,
    addChapter,
    addAll,
    pauseTask: (taskId: string) => scheduler.pause(taskId),
    resumeTask: (taskId: string) => scheduler.resume(taskId),
    cancelTask: (taskId: string) => scheduler.cancel(taskId),
    deleteTask: (taskId: string) => scheduler.delete(taskId),
    catalog: demoChapters,
  };
}
