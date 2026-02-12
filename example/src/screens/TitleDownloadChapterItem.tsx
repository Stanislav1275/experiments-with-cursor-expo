import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DownloadTask } from "@app/download-kit";

type Props = {
  task: DownloadTask;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onDelete: (taskId: string) => void;
};

function isActive(task: DownloadTask): boolean {
  return task.state === "preparing" || task.state === "downloading";
}

export function TitleDownloadChapterItem(props: Props): React.JSX.Element {
  const { task, onPause, onResume, onCancel, onDelete } = props;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.chapterLabel}>
          Chapter {task.chapterNumber}
          {task.chapterName ? ` - ${task.chapterName}` : ""}
        </Text>
        {task.state === "failed" ? <Text style={styles.errorBadge}>E</Text> : null}
      </View>

      <Text style={styles.metaText}>
        {task.titleName} | {task.state}
      </Text>
      <Text style={styles.progressText}>
        {task.progress.percent.toFixed(1)}% | {task.progress.downloadedImages}/
        {task.progress.totalImages}
      </Text>

      <View style={styles.actionsRow}>
        {isActive(task) ? (
          <Pressable onPress={() => onPause(task.taskId)} style={styles.actionButton}>
            <Text style={styles.actionText}>Pause</Text>
          </Pressable>
        ) : null}

        {task.state === "paused" || task.state === "failed" ? (
          <Pressable onPress={() => onResume(task.taskId)} style={styles.actionButton}>
            <Text style={styles.actionText}>Resume</Text>
          </Pressable>
        ) : null}

        {task.state !== "completed" ? (
          <Pressable onPress={() => onCancel(task.taskId)} style={styles.actionButtonDanger}>
            <Text style={styles.actionText}>Cancel</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => onDelete(task.taskId)} style={styles.actionButtonDanger}>
            <Text style={styles.actionText}>Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#2D2D2D",
    backgroundColor: "#121212",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chapterLabel: {
    color: "#F6F6F6",
    fontWeight: "600",
    fontSize: 15,
  },
  metaText: {
    color: "#A8A8A8",
  },
  progressText: {
    color: "#D6D6D6",
    fontVariant: ["tabular-nums"],
  },
  actionsRow: {
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#2C3E50",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionButtonDanger: {
    backgroundColor: "#5E2A2A",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  errorBadge: {
    color: "#FFFFFF",
    backgroundColor: "#8D1B1B",
    minWidth: 22,
    textAlign: "center",
    borderRadius: 11,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontWeight: "700",
  },
});
