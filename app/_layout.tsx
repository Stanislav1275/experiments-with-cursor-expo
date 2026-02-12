import { configureReanimatedLogger } from 'react-native-reanimated';
import { Stack } from 'expo-router';

// Отключаем strict mode — react-native-collapsible-tab-view читает shared values
configureReanimatedLogger({ strict: false });

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
