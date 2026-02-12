import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useDownloadKitDemo } from "../state/useDownloadKitDemo";
import { TaskDebugScreen } from "./TaskDebugScreen";
import { TitleDownloadsScreen } from "./TitleDownloadsScreen";

export function DownloadQueueLabScreen(): React.JSX.Element {
  const {
    tasks,
    logs,
    addChapter,
    addAll,
    pauseTask,
    resumeTask,
    cancelTask,
    deleteTask,
    catalog,
  } = useDownloadKitDemo();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>download-kit example</Text>
      <Text style={styles.subtitle}>
        Manual validation: queue order, one active chapter per title, pause/resume/cancel/error.
      </Text>

      <View style={styles.controlsCard}>
        <Text style={styles.blockTitle}>Fixture catalog</Text>
        <View style={styles.buttonsWrap}>
          <Pressable onPress={() => void addAll()} style={styles.primaryButton}>
            <Text style={styles.buttonText}>Add all chapters</Text>
          </Pressable>
          {catalog.map((chapter) => (
            <Pressable
              key={chapter.chapterId}
              onPress={() => void addChapter(chapter.chapterId)}
              style={styles.secondaryButton}
            >
              <Text style={styles.buttonText}>
                Add {chapter.titleId} / #{chapter.chapterNumber}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TitleDownloadsScreen
        tasks={tasks}
        onPause={(taskId) => void pauseTask(taskId)}
        onResume={(taskId) => void resumeTask(taskId)}
        onCancel={(taskId) => void cancelTask(taskId)}
        onDelete={(taskId) => void deleteTask(taskId)}
      />

      <TaskDebugScreen logs={logs} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    backgroundColor: "#050505",
  },
  title: {
    color: "#FAFAFA",
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: "#BBBBBB",
  },
  controlsCard: {
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: "#101010",
  },
  blockTitle: {
    color: "#F0F0F0",
    fontWeight: "700",
  },
  buttonsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#2D5A8A",
  },
  secondaryButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#2A2A2A",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
