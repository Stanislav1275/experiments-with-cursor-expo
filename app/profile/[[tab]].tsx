import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ListRenderItem } from 'react-native';
import { Tabs, MaterialTabBar } from 'react-native-collapsible-tab-view';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

const HEADER_HEIGHT = 280;
const TAB_BAR_HEIGHT = 52;

const TAB_NAMES = ['posts', 'media', 'likes'] as const;
type TabName = (typeof TAB_NAMES)[number];

// Generate mock data for FlashList
const generatePosts = () =>
  Array.from({ length: 50 }, (_, i) => ({
    id: `post-${i}`,
    title: `Post ${i + 1}`,
    content: `Content for post ${i + 1}. Lorem ipsum dolor sit amet.`,
  }));

const generateMedia = () =>
  Array.from({ length: 30 }, (_, i) => ({
    id: `media-${i}`,
    type: i % 3 === 0 ? 'video' : 'image',
    caption: `Media item ${i + 1}`,
  }));

const generateLikes = () =>
  Array.from({ length: 40 }, (_, i) => ({
    id: `like-${i}`,
    from: `User ${i + 1}`,
    item: `Liked item ${i + 1}`,
  }));

const POSTS_DATA = generatePosts();
const MEDIA_DATA = generateMedia();
const LIKES_DATA = generateLikes();

// Profile Header Component
const ProfileHeader = () => (
  <View style={styles.header} pointerEvents="box-none">
    <View style={styles.avatar} />
    <Text style={styles.username}>@username</Text>
    <Text style={styles.bio}>Bio text and description</Text>
    <View style={styles.stats}>
      <View style={styles.stat}>
        <Text style={styles.statValue}>123</Text>
        <Text style={styles.statLabel}>Posts</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.statValue}>456</Text>
        <Text style={styles.statLabel}>Followers</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.statValue}>789</Text>
        <Text style={styles.statLabel}>Following</Text>
      </View>
    </View>
  </View>
);


// Section Header for content
const SectionHeader = ({ title }: { title: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// Post item for FlashList
const PostItem = ({ item }: { item: (typeof POSTS_DATA)[0] }) => (
  <View style={styles.listItem}>
    <Text style={styles.itemTitle}>{item.title}</Text>
    <Text style={styles.itemContent}>{item.content}</Text>
  </View>
);

// Media item
const MediaItem = ({ item }: { item: (typeof MEDIA_DATA)[0] }) => (
  <View style={[styles.listItem, styles.mediaItem]}>
    <View style={styles.mediaPlaceholder} />
    <Text style={styles.itemContent}>{item.caption}</Text>
  </View>
);

// Like item
const LikeItem = ({ item }: { item: (typeof LIKES_DATA)[0] }) => (
  <View style={styles.listItem}>
    <Text style={styles.itemTitle}>{item.from}</Text>
    <Text style={styles.itemContent}>{item.item}</Text>
  </View>
);

export default function ProfileScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const containerRef = useRef<Tabs.ContainerRef>(null);

  const initialTab = React.useMemo(() => {
    const t = tab?.toLowerCase();
    if (t && TAB_NAMES.includes(t as TabName)) return t as TabName;
    return 'posts';
  }, [tab]);

  useEffect(() => {
    if (!initialTab) return;
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const currentIndex = containerRef.current.getCurrentIndex();
        const targetIndex = TAB_NAMES.indexOf(initialTab);
        if (currentIndex !== targetIndex) {
          containerRef.current.jumpToTab(initialTab);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [initialTab]);

  const handleTabChange = useCallback(
    (data: { tabName: TabName }) => {
      router.replace(`/profile/${data.tabName}`);
    },
    [router]
  );

  const renderTabBar = useCallback(
    (props: TabBarProps<TabName>) => (
      <View style={styles.tabBar}>
        <MaterialTabBar
          {...props}
          activeColor="#6366f1"
          inactiveColor="#71717a"
        />
      </View>
    ),
    []
  );

  const renderPostsItem: ListRenderItem<(typeof POSTS_DATA)[0]> = useCallback(
    ({ item }) => <PostItem item={item} />,
    []
  );

  const renderMediaItem: ListRenderItem<(typeof MEDIA_DATA)[0]> = useCallback(
    ({ item }) => <MediaItem item={item} />,
    []
  );

  const renderLikesItem: ListRenderItem<(typeof LIKES_DATA)[0]> = useCallback(
    ({ item }) => <LikeItem item={item} />,
    []
  );

  return (
    <View style={styles.container}>
      <Tabs.Container
        ref={containerRef}
        headerHeight={HEADER_HEIGHT}
        tabBarHeight={TAB_BAR_HEIGHT}
        renderHeader={ProfileHeader}
        renderTabBar={renderTabBar}
        initialTabName={initialTab}
        onTabChange={({ tabName }) => handleTabChange({ tabName: tabName as TabName })}
        minHeaderHeight={0}
        revealHeaderOnScroll
        lazy={false}
      >
        {/* FlatList, SectionList, FlashList - все работают с collapsible header */}
        {/* FlashList v2.2: без estimatedItemSize, patch для recyclerlistview_unsafe в node_modules */}
        <Tabs.Tab name="posts" label="Posts">
          <Tabs.FlashList
            data={POSTS_DATA}
            renderItem={renderPostsItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={<SectionHeader title="Posts" />}
          />
        </Tabs.Tab>
        <Tabs.Tab name="media" label="Media">
          <Tabs.FlatList
            data={MEDIA_DATA}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={<SectionHeader title="Media" />}
          />
        </Tabs.Tab>
        <Tabs.Tab name="likes" label="Likes">
          <Tabs.SectionList
            sections={[
              { title: 'Recent', data: LIKES_DATA.slice(0, 20) },
              { title: 'Earlier', data: LIKES_DATA.slice(20) },
            ]}
            renderItem={({ item }) => <LikeItem item={item} />}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <SectionHeader title={section.title} />
            )}
          />
        </Tabs.Tab>
      </Tabs.Container>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    height: HEADER_HEIGHT,
    width: '100%',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    paddingTop: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    marginBottom: 12,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#a1a1aa',
    marginBottom: 16,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 32,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#71717a',
  },
  tabBar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  sectionHeader: {
    padding: 16,
    backgroundColor: '#18181b',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  listItem: {
    padding: 16,
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  mediaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mediaPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#27272a',
    borderRadius: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  itemContent: {
    fontSize: 14,
    color: '#a1a1aa',
  },
});
