import React, { useState } from 'react';
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import { usePostStore } from '../store/usePostStore';
import { GlassCard } from '../components/GlassCard';
import { Post } from '../types';

const { width } = Dimensions.get('window');

export const DashboardScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const posts = usePostStore((state) => state.posts);
  const fetchPosts = usePostStore((state) => state.fetchPosts);
  const resetPosts = usePostStore((state) => state.resetPosts);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (posts.length === 0) {
      fetchPosts();
    }
  }, [posts.length, fetchPosts]);

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const formatTimestamp = (timestamp: number) => {
    const elapsedMinutes = Math.floor((Date.now() - timestamp) / 60000);
    if (elapsedMinutes < 1) return 'Just now';
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    const hours = Math.floor(elapsedMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: colors.text }]}>No posts yet.</Text>
      <TouchableOpacity
        onPress={resetPosts}
        style={[styles.resetButton, { backgroundColor: colors.primary }]}
      >
        <Text style={styles.resetButtonText}>Load Demo Posts</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = !!likedPosts[item.id];
    const likeCount = (item.likes ?? 0) + (isLiked ? 1 : 0);

    return (
      <GlassCard style={styles.cardContainer}>
        {/* Post Author Header */}
        <View style={styles.header}>
          <View style={styles.authorRow}>
            {item.author.avatarUrl ? (
              <Image source={{ uri: item.author.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {item.author.displayName?.[0] ?? item.author.username[0]}
                </Text>
              </View>
            )}
            <View style={styles.authorMeta}>
              <Text style={[styles.displayName, { color: colors.text }]}>
                {item.author.displayName || item.author.username}
              </Text>
              <Text style={styles.username}>@{item.author.username}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="more-horizontal" size={18} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Post Text */}
        <Text style={[styles.content, { color: colors.text }]}>{item.content}</Text>

        {/* Post Image (if any) */}
        {item.imageUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.postImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Post Tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tags}>
            {item.tags.map((tag) => (
              <View key={tag} style={styles.tagBadge}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Post Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleLike(item.id)}
            activeOpacity={0.7}
          >
            <Feather
              name={isLiked ? 'heart' : 'heart'}
              size={18}
              color={isLiked ? '#FF3B30' : '#8E8E93'}
            />
            <Text
              style={[
                styles.actionText,
                isLiked && { color: '#FF3B30', fontWeight: '600' },
              ]}
            >
              {likeCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <Feather name="message-circle" size={18} color="#8E8E93" />
            <Text style={styles.actionText}>{item.commentsCount ?? 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <Feather name="share-2" size={18} color="#8E8E93" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <Feather name="bookmark" size={18} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </GlassCard>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Ambience / Blur test ornaments */}
      <View style={styles.ambientBlob1} pointerEvents="none" />
      <View style={styles.ambientBlob2} pointerEvents="none" />
      <View style={styles.ambientBlob3} pointerEvents="none" />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + 54,
            paddingBottom: insets.bottom + 90,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        renderItem={renderPost}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  ambientBlob1: {
    position: 'absolute',
    top: 60,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#007AFF',
    opacity: 0.25,
  },
  ambientBlob2: {
    position: 'absolute',
    top: 350,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#AF52DE',
    opacity: 0.22,
  },
  ambientBlob3: {
    position: 'absolute',
    bottom: 120,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#34C759',
    opacity: 0.18,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  cardContainer: {
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
  resetButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resetButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
    marginRight: 10,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  authorMeta: {
    flexDirection: 'column',
  },
  displayName: {
    fontWeight: '700',
    fontSize: 15,
  },
  username: {
    fontSize: 13,
    color: '#8E8E93',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagBadge: {
    backgroundColor: 'rgba(120, 120, 128, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
