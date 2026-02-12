import React from "react";
import { StyleSheet, Text, View } from "react-native";

type EventLog = {
  at: number;
  text: string;
};

type Props = {
  logs: EventLog[];
};

export function TaskDebugScreen({ logs }: Props): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Task debug timeline</Text>
      {logs.length === 0 ? (
        <Text style={styles.empty}>No events yet.</Text>
      ) : (
        logs.slice(0, 25).map((log) => (
          <Text key={`${log.at}:${log.text}`} style={styles.logLine}>
            [{new Date(log.at).toLocaleTimeString()}] {log.text}
          </Text>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#272727",
    backgroundColor: "#101010",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  title: {
    color: "#F4F4F4",
    fontWeight: "700",
  },
  empty: {
    color: "#949494",
  },
  logLine: {
    color: "#CFCFCF",
    fontFamily: "monospace",
    fontSize: 12,
  },
});
