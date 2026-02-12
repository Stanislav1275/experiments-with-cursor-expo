import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DownloadTask } from "@app/download-kit";

import { TitleDownloadChapterItem } from "./TitleDownloadChapterItem";

type Props = {
  tasks: DownloadTask[];
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onDelete: (taskId: string) => void;
};

function groupByTitle(tasks: DownloadTask[]): Record<string, DownloadTask[]> {
  return tasks.reduce<Record<string, DownloadTask[]>>((acc, task) => {
    if (!acc[task.titleId]) {
      acc[task.titleId] = [];
    }
    acc[task.titleId].push(task);
    return acc;
  }, {});
}

function countActiveByTitle(tasks: DownloadTask[]): Record<string, number> {
  return tasks.reduce<Record<string, number>>((acc, task) => {
    const isActive = task.state === "downloading" || task.state === "preparing";
    if (!isActive) {
      return acc;
    }

    acc[task.titleId] = (acc[task.titleId] ?? 0) + 1;
    return acc;
  }, {});
}

export function TitleDownloadsScreen(props: Props): React.JSX.Element {
  const { tasks, onPause, onResume, onCancel, onDelete } = props;
  const groups = useMemo(() => groupByTitle(tasks), [tasks]);
  const activeByTitle = useMemo(() => countActiveByTitle(tasks), [tasks]);
  const titleIds = Object.keys(groups);

  if (titleIds.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Queue is empty. Add chapters for testing.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {titleIds.map((titleId) => {
        const titleTasks = groups[titleId] ?? [];
        const titleName = titleTasks[0]?.titleName ?? titleId;
        const activeCount = activeByTitle[titleId] ?? 0;
        const isHealthy = activeCount <= 1;

        return (
          <View key={titleId} style={styles.titleBlock}>
            <View style={styles.titleHeader}>
              <Text style={styles.titleName}>{titleName}</Text>
              <Text style={[styles.constraintLabel, !isHealthy && styles.constraintLabelBad]}>
                active: {activeCount} / 1
              </Text>
            </View>

            <View style={styles.itemsList}>
              {titleTasks.map((task) => (
                <TitleDownloadChapterItem
                  key={task.taskId}
                  task={task}
                  onPause={onPause}
                  onResume={onResume}
                  onCancel={onCancel}
                  onDelete={onDelete}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
  },
  emptyState: {
    borderRadius: 12,
    padding: 20,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2D2D2D",
  },
  emptyText: {
    color: "#AAAAAA",
  },
  titleBlock: {
    gap: 8,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#0E0E0E",
    borderWidth: 1,
    borderColor: "#262626",
  },
  titleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleName: {
    color: "#EFEFEF",
    fontWeight: "700",
  },
  constraintLabel: {
    color: "#8EEA84",
    fontWeight: "600",
  },
  constraintLabelBad: {
    color: "#FF7F7F",
  },
  itemsList: {
    gap: 8,
  },
});
