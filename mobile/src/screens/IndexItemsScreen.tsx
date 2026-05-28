import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIndexItems, useIndexItemsTopics } from '../hooks/useIndexItems';
import { IndexItemCard } from '../components/IndexItemCard';
import { RootStackParamList } from '../types/navigation';
import { IndexItem } from '../types';
import { useSyncStatus } from '../hooks/useSyncStatus';

type IndexItemsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'IndexItems'
>;

export const IndexItemsScreen: React.FC<IndexItemsScreenProps> = ({
  navigation,
}) => {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [limit] = useState(15);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>(
    undefined,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const chipScrollRef = useRef<ScrollView>(null);
  const chipPositionsRef = useRef<Record<string, number>>({});

  const { data, isLoading, isError, error, refetch } = useIndexItems({
    page,
    limit,
    generalTopic: selectedTopic,
    q: debouncedQuery || undefined,
  });
  const { data: topics, isLoading: isTopicsLoading } = useIndexItemsTopics();
  const {
    hasNewContent,
    checkForUpdates,
    isCheckingVersion,
    lastSyncedAt,
    markSynced,
  } = useSyncStatus();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        hasNewContent ? <Text style={styles.headerBadge}>NEW</Text> : null,
    });
  }, [hasNewContent, navigation]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  React.useEffect(() => {
    setPage(1);
  }, [selectedTopic]);

  const orderedTopics = React.useMemo(() => {
    if (!topics?.length) {
      return [];
    }

    if (!selectedTopic) {
      return topics;
    }

    const selected = topics.find((topic) => topic.topic === selectedTopic);
    if (!selected) {
      return topics;
    }

    return [selected, ...topics.filter((topic) => topic.topic !== selectedTopic)];
  }, [selectedTopic, topics]);

  React.useEffect(() => {
    if (!selectedTopic) {
      chipScrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }

    const chipX = chipPositionsRef.current[selectedTopic];
    if (typeof chipX === 'number') {
      chipScrollRef.current?.scrollTo({
        x: Math.max(0, chipX - 16),
        animated: true,
      });
    }
  }, [selectedTopic]);

  const hasActiveFilters = Boolean(selectedTopic || searchQuery.trim());

  const handleClearFilters = () => {
    setSelectedTopic(undefined);
    setSearchQuery('');
    setDebouncedQuery('');
    setPage(1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [versionResult] = await Promise.all([checkForUpdates(), refetch()]);

      if (versionResult.version) {
        await markSynced(versionResult.version);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleItemPress = (item: IndexItem) => {
    navigation.navigate('IndexItemDetail', { item });
  };

  const handleNextPage = () => {
    if (data && page < data.meta.totalPages) {
      setPage(page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const renderItem = ({ item }: { item: IndexItem }) => {
    const showNewBadge =
      Boolean(lastSyncedAt) &&
      new Date(item.createdAt).getTime() > new Date(lastSyncedAt!).getTime();

    return (
      <IndexItemCard
        item={item}
        onPress={() => handleItemPress(item)}
        showNewBadge={showNewBadge}
      />
    );
  };

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading items</Text>
          <Text style={styles.errorDetail}>
            {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search topics..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {hasActiveFilters ? (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={handleClearFilters}
            activeOpacity={0.7}
          >
            <Text style={styles.clearFiltersButtonText}>Clear filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.topicsContainer}>
        <ScrollView
          ref={chipScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <TouchableOpacity
            style={[
              styles.topicChip,
              !selectedTopic && styles.topicChipActive,
            ]}
            onPress={() => setSelectedTopic(undefined)}
          >
            <Text
              style={[
                styles.topicChipText,
                !selectedTopic && styles.topicChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {!isTopicsLoading &&
            orderedTopics.map((topicItem) => {
              const isActive = topicItem.topic === selectedTopic;

              return (
                <TouchableOpacity
                  key={topicItem.topic}
                  style={[styles.topicChip, isActive && styles.topicChipActive]}
                  onPress={() => setSelectedTopic(topicItem.topic)}
                  onLayout={(event) => {
                    chipPositionsRef.current[topicItem.topic] =
                      event.nativeEvent.layout.x;
                  }}
                >
                  <View style={styles.topicChipContent}>
                    <Text
                      style={[
                        styles.topicChipText,
                        isActive && styles.topicChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {topicItem.topic}
                    </Text>
                    <View
                      style={[
                        styles.topicCountBadge,
                        isActive && styles.topicCountBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.topicCountBadgeText,
                          isActive && styles.topicCountBadgeTextActive,
                        ]}
                      >
                        {topicItem.count}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </View>

      {hasNewContent && (
        <View style={styles.bannerContainer}>
          <Text style={styles.bannerText}>New content is available.</Text>
          <TouchableOpacity
            style={styles.bannerButton}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            <Text style={styles.bannerButtonText}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && !data ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={data?.items || []}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing || isCheckingVersion}
                onRefresh={handleRefresh}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No items found</Text>
              </View>
            }
          />

          {data && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  page === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={handlePreviousPage}
                disabled={page === 1}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    page === 1 && styles.paginationButtonTextDisabled,
                  ]}
                >
                  Previous
                </Text>
              </TouchableOpacity>

              <View style={styles.pageInfoContainer}>
                <Text style={styles.pageInfoText}>
                  {page} / {data.meta.totalPages}
                </Text>
                <Text style={styles.totalInfoText}>
                  ({data.meta.total} total)
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  page >= data.meta.totalPages &&
                    styles.paginationButtonDisabled,
                ]}
                onPress={handleNextPage}
                disabled={page >= data.meta.totalPages}
              >
                <Text
                  style={[
                    styles.paginationButtonText,
                    page >= data.meta.totalPages &&
                      styles.paginationButtonTextDisabled,
                  ]}
                >
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    fontSize: 14,
    color: '#1f2937',
  },
  clearFiltersButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#eef2ff',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearFiltersButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3730a3',
  },
  topicsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  topicChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 4,
  },
  topicChipActive: {
    backgroundColor: '#2563eb',
  },
  topicChipText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  topicChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topicCountBadge: {
    minWidth: 18,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  topicCountBadgeActive: {
    backgroundColor: '#1d4ed8',
  },
  topicCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  topicCountBadgeTextActive: {
    color: '#dbeafe',
  },
  topicChipTextActive: {
    color: '#fff',
  },
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerText: {
    color: '#1e3a8a',
    fontSize: 13,
    fontWeight: '600',
  },
  bannerButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  paginationButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  paginationButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  paginationButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationButtonTextDisabled: {
    color: '#9ca3af',
  },
  pageInfoContainer: {
    alignItems: 'center',
  },
  pageInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalInfoText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
