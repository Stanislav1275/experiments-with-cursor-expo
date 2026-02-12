import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ListRenderItem,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, MaterialTabBar } from 'react-native-collapsible-tab-view';
import type { TabBarProps } from 'react-native-collapsible-tab-view';
import Animated, {
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';

const HEADER_HEIGHT = 280;
const TAB_BAR_HEIGHT = 52;

const TAB_NAMES = ['posts', 'media', 'likes'] as const;
type TabName = (typeof TAB_NAMES)[number];

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

// Generate mock data
const generatePosts = () =>
  Array.from({ length: 80 }, (_, i) => ({
    id: `post-${i}`,
    title: `Post ${i + 1}`,
    content: `Content for post ${i + 1}. Lorem ipsum dolor sit amet.`,
  }));

const generateMedia = () =>
  Array.from({ length: 60 }, (_, i) => ({
    id: `media-${i}`,
    type: i % 3 === 0 ? 'video' : 'image',
    caption: `Media item ${i + 1}`,
  }));

const generateLikes = () =>
  Array.from({ length: 50 }, (_, i) => ({
    id: `like-${i}`,
    from: `User ${i + 1}`,
    item: `Liked item ${i + 1}`,
  }));

// Profile Header
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

// Horizontal scroll section
const HorizontalSection = ({
  title,
  items,
}: {
  title: string;
  items: { id: string; color: string; label: string }[];
}) => (
  <View style={styles.horizontalSection}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalScroll}
    >
      {items.map((item, i) => (
        <View
          key={item.id}
          style={[
            styles.horizontalCard,
            { backgroundColor: item.color },
            i < items.length - 1 && { marginRight: 12 },
          ]}
        >
          <Text style={styles.horizontalLabel}>{item.label}</Text>
        </View>
      ))}
    </ScrollView>
  </View>
);

// Pill indicator - rounded background that animates between tabs
const PillIndicator = ({
  indexDecimal,
  tabCount,
  width,
}: {
  indexDecimal: SharedValue<number>;
  tabCount: number;
  width: number;
}) => {
  const tabWidth = width / tabCount;
  const pillWidth = tabWidth - 24;
  const pillMargin = 12;

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const translateX = interpolate(
      indexDecimal.value,
      Array.from({ length: tabCount }, (_, i) => i),
      Array.from({ length: tabCount }, (_, i) => i * tabWidth + pillMargin)
    );
    return {
      transform: [{ translateX }],
      width: pillWidth,
    };
  });

  return (
    <Animated.View
      style={[styles.pillIndicator, animatedStyle]}
      pointerEvents="none"
    />
  );
};

// Custom tab bar with pill + safe area
const PillTabBar = ({ props, insets }: { props: TabBarProps<TabName>; insets: { top: number } }) => {
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.tabBarWrapper, { paddingTop: insets.top }]}>
      <View style={styles.tabBar}>
        <PillIndicator
          indexDecimal={props.indexDecimal}
          tabCount={props.tabNames.length}
          width={width}
        />
        <MaterialTabBar
          {...props}
          activeColor="#fff"
          inactiveColor="#71717a"
          indicatorStyle={styles.hiddenIndicator}
        />
      </View>
    </View>
  );
};

// Lazy tab content with simulated fetch
const LazyTabContent = ({
  tabName,
  children,
}: {
  tabName: TabName;
  children: React.ReactNode;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading {tabName}...</Text>
      </View>
    );
  }

  return <>{children}</>;
};

// Profile section with many horizontal scrolls
const ProfileSection = () => {
  const interests = COLORS.map((c, i) => ({
    id: `int-${i}`,
    color: c,
    label: `Interest ${i + 1}`,
  }));
  const highlights = COLORS.map((c, i) => ({
    id: `hl-${i}`,
    color: c,
    label: `Highlight ${i + 1}`,
  }));
  const badges = COLORS.map((c, i) => ({
    id: `badge-${i}`,
    color: c,
    label: `Badge ${i + 1}`,
  }));

  return (
    <View style={styles.profileSection}>
      <HorizontalSection title="Interests" items={interests} />
      <HorizontalSection title="Highlights" items={highlights} />
      <HorizontalSection title="Badges" items={badges} />
      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>About</Text>
        <Text style={styles.infoText}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.
        </Text>
      </View>
      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>Links</Text>
        <Text style={styles.infoLink}>website.com</Text>
        <Text style={styles.infoLink}>github.com/username</Text>
      </View>
    </View>
  );
};

// Grid item for posts
const PostGridItem = ({ item }: { item: { id: string; title: string } }) => (
  <View style={styles.gridItem}>
    <View style={styles.gridPlaceholder} />
    <Text style={styles.gridLabel} numberOfLines={2}>{item.title}</Text>
  </View>
);

// Media grid item
const MediaGridItem = ({ item }: { item: { id: string; caption: string } }) => (
  <View style={styles.mediaGridItem}>
    <View style={styles.mediaGridPlaceholder} />
  </View>
);

export default function ProfileScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const containerRef = useRef<Tabs.ContainerRef>(null);
  const insets = useSafeAreaInsets();

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
      <PillTabBar props={props} insets={insets} />
    ),
    [insets]
  );

  const POSTS_DATA = React.useMemo(() => generatePosts(), []);
  const MEDIA_DATA = React.useMemo(() => generateMedia(), []);
  const LIKES_DATA = React.useMemo(() => generateLikes(), []);

  const renderPostsItem: ListRenderItem<(typeof POSTS_DATA)[0]> = useCallback(
    ({ item }) => <PostGridItem item={item} />,
    []
  );

  const renderMediaItem: ListRenderItem<(typeof MEDIA_DATA)[0]> = useCallback(
    ({ item }) => <MediaGridItem item={item} />,
    []
  );

  return (
    <View style={styles.container}>
      <Tabs.Container
        ref={containerRef}
        headerHeight={HEADER_HEIGHT}
        tabBarHeight={TAB_BAR_HEIGHT + insets.top}
        renderHeader={ProfileHeader}
        renderTabBar={renderTabBar}
        initialTabName={initialTab}
        onTabChange={({ tabName }) => handleTabChange({ tabName: tabName as TabName })}
        minHeaderHeight={0}
        revealHeaderOnScroll
        lazy
      >
        <Tabs.Tab name="posts" label="Posts">
          <Tabs.Lazy startMounted={initialTab === 'posts'}>
            <LazyTabContent tabName="posts">
              <Tabs.FlashList
                data={POSTS_DATA}
                renderItem={renderPostsItem}
                keyExtractor={(item) => item.id}
                numColumns={3}
                ListHeaderComponent={<ProfileSection />}
              />
            </LazyTabContent>
          </Tabs.Lazy>
        </Tabs.Tab>
        <Tabs.Tab name="media" label="Media">
          <Tabs.Lazy startMounted={initialTab === 'media'}>
            <LazyTabContent tabName="media">
              <Tabs.FlashList
                data={MEDIA_DATA}
                renderItem={renderMediaItem}
                keyExtractor={(item) => item.id}
                numColumns={3}
                ListHeaderComponent={
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Media Grid</Text>
                  </View>
                }
              />
            </LazyTabContent>
          </Tabs.Lazy>
        </Tabs.Tab>
        <Tabs.Tab name="likes" label="Likes">
          <Tabs.Lazy startMounted={initialTab === 'likes'}>
            <LazyTabContent tabName="likes">
              <Tabs.SectionList
                sections={[
                  { title: 'Recent', data: LIKES_DATA.slice(0, 25) },
                  { title: 'Earlier', data: LIKES_DATA.slice(25) },
                ]}
                renderItem={({ item }) => (
                  <View style={styles.listItem}>
                    <Text style={styles.itemTitle}>{item.from}</Text>
                    <Text style={styles.itemContent}>{item.item}</Text>
                  </View>
                )}
                keyExtractor={(item) => item.id}
                renderSectionHeader={({ section }) => (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  </View>
                )}
                ListHeaderComponent={
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Likes</Text>
                  </View>
                }
              />
            </LazyTabContent>
          </Tabs.Lazy>
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
  tabBarWrapper: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tabBar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    position: 'relative',
  },
  hiddenIndicator: {
    opacity: 0,
    height: 0,
  },
  pillIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272a',
  },
  horizontalSection: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  horizontalScroll: {
    paddingVertical: 8,
  },
  horizontalCard: {
    width: 120,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  profileSection: {
    paddingBottom: 16,
  },
  infoBlock: {
    padding: 16,
    backgroundColor: '#18181b',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  infoLink: {
    fontSize: 14,
    color: '#6366f1',
    marginTop: 4,
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
  gridItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
  },
  gridPlaceholder: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 8,
    marginBottom: 4,
  },
  gridLabel: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  mediaGridItem: {
    flex: 1,
    margin: 4,
    aspectRatio: 1,
  },
  mediaGridPlaceholder: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 8,
  },
  listItem: {
    padding: 16,
    backgroundColor: '#18181b',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#71717a',
    fontSize: 16,
  },
});
