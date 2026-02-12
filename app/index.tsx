import { Link } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Tabs Demo</Text>
      <Link href="/profile" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Open Profile</Text>
        </Pressable>
      </Link>
      <View style={styles.links}>
        <Link href={{ pathname: '/profile', params: { tab: 'posts' } }} asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>/profile?tab=posts</Text>
          </Pressable>
        </Link>
        <Link href={{ pathname: '/profile', params: { tab: 'media' } }} asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>/profile?tab=media</Text>
          </Pressable>
        </Link>
        <Link href={{ pathname: '/profile', params: { tab: 'likes' } }} asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>/profile?tab=likes</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  links: {
    gap: 12,
  },
  link: {
    padding: 12,
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
  },
  linkText: {
    color: '#a78bfa',
    fontSize: 14,
  },
});
