import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";

import { DownloadQueueLabScreen } from "./screens/DownloadQueueLabScreen";

export default function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.root}>
      <DownloadQueueLabScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050505",
  },
});
