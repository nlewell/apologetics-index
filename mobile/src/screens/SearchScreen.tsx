import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Image,
  Linking,
  SafeAreaView,
  SectionList,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  useIndexItemsTopicsWithSubtopics,
  useYoutubeSearch,
} from '../hooks';
import { RootStackParamList } from '../types/navigation';
import { YoutubeSearchItem } from '../types';
import { formatApiError } from '../lib/formatApiError';

type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;

type VideoSection = {
  title: string;
  data: YoutubeSearchItem[];
};

export const SearchScreen: React.FC<SearchScreenProps> = () => {
  const isYoutubeDebugEnabled =
    process.env.EXPO_PUBLIC_YOUTUBE_DEBUG === 'true';
  const [searchQuery, setSearchQuery] = useState('');
  const [youtubeQuery, setYoutubeQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | null>(null);
  const [selectedCharge, setSelectedCharge] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedSubtopics, setExpandedSubtopics] = useState<
    Record<string, boolean>
  >({});

  const {
    data: topicTree,
    isLoading: isTopicsLoading,
    isFetching: isTopicsFetching,
    isError: isTopicsError,
    error: topicsError,
    refetch: refetchTopics,
  } = useIndexItemsTopicsWithSubtopics();

  useFocusEffect(
    useCallback(() => {
      if (isTopicsError || (!topicTree?.length && !isTopicsLoading)) {
        refetchTopics();
      }
    }, [isTopicsError, isTopicsLoading, refetchTopics, topicTree?.length]),
  );

  const handleRefreshTopics = () => {
    refetchTopics();
  };

  const {
    data: searchData,
    isLoading: isVideosLoading,
    isError: isVideosError,
    error: videosError,
    refetch: refetchVideos,
  } = useYoutubeSearch(youtubeQuery, 5, isYoutubeDebugEnabled);

  const hasYoutubeQuery = youtubeQuery.length > 0;

  const groupedSections = useMemo<VideoSection[]>(() => {
    const items = searchData?.items ?? [];
    const topMatchVideoId = items[0]?.videoId;
    const remainingItems = topMatchVideoId
      ? items.filter((video) => video.videoId !== topMatchVideoId)
      : items;

    const longForm = remainingItems.filter((video) => !video.isShort);
    const shortForm = remainingItems.filter((video) => video.isShort);

    const sections: VideoSection[] = [];

    if (shortForm.length > 0) {
      sections.push({
        title: `Short-form videos (${shortForm.length})`,
        data: shortForm,
      });
    }

    if (longForm.length > 0) {
      sections.push({
        title: `Long-form videos (${longForm.length})`,
        data: longForm,
      });
    }

    return sections;
  }, [searchData]);

  const topMatch = searchData?.items?.[0] ?? null;
  const topMatchDebugReason = useMemo(() => {
    if (!topMatch || !searchData?.debug?.enabled) {
      return null;
    }

    const scoreItem = searchData.debug.scores.find(
      (item) => item.videoId === topMatch.videoId,
    );

    if (!scoreItem) {
      return null;
    }

    return `Rank score ${scoreItem.relevanceScore}${
      scoreItem.preferredBoostApplied ? ' (preferred channel boost applied)' : ''
    }`;
  }, [searchData?.debug, topMatch]);

  const runHierarchySearch = (queryText: string) => {
    const normalized = queryText.trim();
    setSearchQuery(normalized);
    setYoutubeQuery(normalized);
  };

  const toggleTopic = (
    topic: string,
    hasSubtopics: boolean,
    hasCharges: boolean,
  ) => {
    setExpandedTopics((previous) => ({
      ...previous,
      [topic]: !previous[topic],
    }));

    setSelectedTopic(topic);
    setSelectedSubtopic(null);
    setSelectedCharge(null);

    if (!hasSubtopics && !hasCharges) {
      runHierarchySearch(topic);
    }
  };

  const toggleSubtopic = (
    topic: string,
    subtopic: string,
    hasCharges: boolean,
  ) => {
    const key = `${topic}::${subtopic}`;
    setExpandedSubtopics((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));

    setSelectedTopic(topic);
    setSelectedSubtopic(subtopic);
    setSelectedCharge(null);

    if (!hasCharges) {
      runHierarchySearch(subtopic);
    }
  };

  const handleChargePress = (
    topic: string,
    subtopic: string | null,
    charge: string,
  ) => {
    setSelectedTopic(topic);
    setSelectedSubtopic(subtopic);
    setSelectedCharge(charge);
    runHierarchySearch(charge);
  };

  const handleVideoPress = async (item: YoutubeSearchItem) => {
    const url = item.videoUrl || `https://www.youtube.com/watch?v=${item.videoId}`;
    await Linking.openURL(url);
  };

  const handleCopyVideoUrl = async (item: YoutubeSearchItem) => {
    const url = item.videoUrl || `https://www.youtube.com/watch?v=${item.videoId}`;
    Clipboard.setString(url);
    Alert.alert('Link copied', 'The YouTube link was copied to your clipboard.');
  };

  const handleShareVideoUrl = async (item: YoutubeSearchItem) => {
    const url = item.videoUrl || `https://www.youtube.com/watch?v=${item.videoId}`;
    await Share.share({
      message: url,
      title: 'Watch this YouTube video',
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
    setYoutubeQuery('');
    setSelectedTopic(null);
    setSelectedSubtopic(null);
    setSelectedCharge(null);
    setExpandedTopics({});
    setExpandedSubtopics({});
  };

  const executeSearch = () => {
    const normalized = searchQuery.trim();
    if (!normalized) {
      return;
    }

    setYoutubeQuery(normalized);
  };

  const renderVideoCard = ({ item }: { item: YoutubeSearchItem }) => {
    const url = item.videoUrl || `https://www.youtube.com/watch?v=${item.videoId}`;

    return (
      <TouchableOpacity
        style={styles.videoCard}
        onPress={() => handleVideoPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.videoMeta}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={styles.badgeRow}>
            <Text style={styles.approvedBadge}>Approved channel</Text>
            {item.isShort ? (
              <Text style={styles.shortBadge}>Short</Text>
            ) : (
              <Text style={styles.longBadge}>Long-form</Text>
            )}
          </View>

          <Text style={styles.videoChannel} numberOfLines={1}>
            {item.channelTitle}
          </Text>

          <View style={styles.videoInfoRow}>
            <Text style={styles.videoInfoText}>
              Length: {item.duration || 'Unknown'}
            </Text>
            {item.publishedAt ? (
              <Text style={styles.videoInfoText}>
                Published: {new Date(item.publishedAt).toLocaleDateString()}
              </Text>
            ) : null}
          </View>

          <View style={styles.linkContainer}>
            <Text style={styles.linkLabel}>YouTube link</Text>
            <Text style={styles.linkText} numberOfLines={1}>
              {url}
            </Text>
            <View style={styles.linkActions}>
              <TouchableOpacity
                style={styles.linkActionButton}
                onPress={() => handleCopyVideoUrl(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.linkActionText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkActionButton}
                onPress={() => handleShareVideoUrl(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.linkActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const topicList = topicTree ?? [];
  const hierarchyFilter = searchQuery.trim().toLowerCase();
  const isFilteringHierarchy = hierarchyFilter.length > 0;

  const filteredTopicList = useMemo(() => {
    if (!isFilteringHierarchy) {
      return topicList;
    }

    return topicList
      .map((topicItem) => {
        const topicMatches = topicItem.topic.toLowerCase().includes(hierarchyFilter);

        const matchingTopicCharges = topicItem.charges.filter((charge) =>
          charge.toLowerCase().includes(hierarchyFilter),
        );

        const matchingSubtopics = topicItem.subtopics
          .map((subtopicItem) => {
            const subtopicMatches = subtopicItem.subtopic
              .toLowerCase()
              .includes(hierarchyFilter);

            const matchingSubtopicCharges = subtopicItem.charges.filter((charge) =>
              charge.toLowerCase().includes(hierarchyFilter),
            );

            if (subtopicMatches) {
              return subtopicItem;
            }

            if (matchingSubtopicCharges.length > 0) {
              return {
                ...subtopicItem,
                charges: matchingSubtopicCharges,
              };
            }

            return null;
          })
          .filter((subtopicItem): subtopicItem is (typeof topicItem.subtopics)[number] =>
            subtopicItem !== null,
          );

        if (
          topicMatches ||
          matchingTopicCharges.length > 0 ||
          matchingSubtopics.length > 0
        ) {
          return {
            ...topicItem,
            charges: topicMatches ? topicItem.charges : matchingTopicCharges,
            subtopics: topicMatches ? topicItem.subtopics : matchingSubtopics,
          };
        }

        return null;
      })
      .filter((topicItem): topicItem is (typeof topicList)[number] => topicItem !== null);
  }, [hierarchyFilter, isFilteringHierarchy, topicList]);

  const showYoutubeFallbackAction =
    hierarchyFilter.length > 0 && filteredTopicList.length === 0;

  const renderTopicGroup = ({
    item: topicItem,
  }: {
    item: (typeof filteredTopicList)[number];
  }) => {
    const isExpanded = isFilteringHierarchy
      ? true
      : Boolean(expandedTopics[topicItem.topic]);
    const isSelected = selectedTopic === topicItem.topic;
    const hasSubtopics = topicItem.subtopics.length > 0;
    const hasTopicCharges = topicItem.charges.length > 0;

    return (
      <View key={topicItem.topic} style={styles.topicGroupCard}>
        <TouchableOpacity
          style={[styles.topicHeader, isSelected && styles.topicHeaderSelected]}
          onPress={() => {
            if (isExpanded && isSelected) {
              clearSearch();
              return;
            }

            toggleTopic(topicItem.topic, hasSubtopics, hasTopicCharges);
          }}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.topicHeaderText,
              isSelected && styles.topicHeaderTextSelected,
            ]}
          >
            {topicItem.topic}
          </Text>
          <Text
            style={[styles.topicChevron, isSelected && styles.topicHeaderTextSelected]}
          >
            {isExpanded ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>

        {isExpanded ? (
          <View style={styles.subtopicsWrap}>
            {hasTopicCharges ? (
              <View style={styles.groupBlock}>
                <Text style={styles.groupLabel}>Charges</Text>
                <View style={styles.chargeWrap}>
                  {topicItem.charges.map((charge) => {
                    const isActiveCharge = selectedCharge === charge;

                    return (
                      <TouchableOpacity
                        key={`${topicItem.topic}--${charge}`}
                        style={[
                          styles.chargeChip,
                          isActiveCharge && styles.chargeChipActive,
                        ]}
                        onPress={() =>
                          handleChargePress(topicItem.topic, null, charge)
                        }
                      >
                        <Text
                          style={[
                            styles.chargeChipText,
                            isActiveCharge && styles.chargeChipTextActive,
                          ]}
                        >
                          {charge}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {hasSubtopics ? (
              topicItem.subtopics.map((subtopicItem) => {
                const subtopicKey = `${topicItem.topic}::${subtopicItem.subtopic}`;
                const isSubtopicExpanded = isFilteringHierarchy
                  ? true
                  : Boolean(expandedSubtopics[subtopicKey]);
                const isSubtopicSelected = selectedSubtopic === subtopicItem.subtopic;
                const hasSubtopicCharges = subtopicItem.charges.length > 0;

                return (
                  <View key={subtopicKey} style={styles.groupBlock}>
                    <TouchableOpacity
                      style={[
                        styles.subtopicChip,
                        isSubtopicSelected && styles.subtopicChipActive,
                      ]}
                      onPress={() =>
                        toggleSubtopic(
                          topicItem.topic,
                          subtopicItem.subtopic,
                          hasSubtopicCharges,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.subtopicChipText,
                          isSubtopicSelected && styles.subtopicChipTextActive,
                        ]}
                      >
                        {subtopicItem.subtopic}
                      </Text>
                      <Text
                        style={[
                          styles.subtopicHint,
                          isSubtopicSelected && styles.subtopicChipTextActive,
                        ]}
                      >
                        {hasSubtopicCharges
                          ? isSubtopicExpanded
                            ? 'Hide charges'
                            : 'Show charges'
                          : 'Search'}
                      </Text>
                    </TouchableOpacity>

                    {isSubtopicExpanded && hasSubtopicCharges ? (
                      <View style={styles.chargeWrap}>
                        {subtopicItem.charges.map((charge) => {
                          const isActiveCharge = selectedCharge === charge;

                          return (
                            <TouchableOpacity
                              key={`${subtopicKey}--${charge}`}
                              style={[
                                styles.chargeChip,
                                isActiveCharge && styles.chargeChipActive,
                              ]}
                              onPress={() =>
                                handleChargePress(
                                  topicItem.topic,
                                  subtopicItem.subtopic,
                                  charge,
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.chargeChipText,
                                  isActiveCharge && styles.chargeChipTextActive,
                                ]}
                              >
                                {charge}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : hasTopicCharges ? null : (
              <Text style={styles.noSubtopicsText}>
                No subtopics or charges. Tap topic to search.
              </Text>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerLockup}>
        <Image
          source={require('../../assets/lens_of_truth_header.png')}
          style={styles.headerImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Filter topics, subtopics, and charges..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={(value) => {
              setSearchQuery(value);
              setYoutubeQuery('');
            }}
            onSubmitEditing={() => {
              if (showYoutubeFallbackAction) {
                executeSearch();
              }
            }}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

        {searchQuery ? (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        ) : null}

      </View>

      <View
        style={[
          styles.topicsPanel,
          hasYoutubeQuery ? styles.topicsPanelWithResults : styles.topicsPanelFull,
        ]}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Topics, Subtopics, and Charges</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefreshTopics}
            disabled={isTopicsFetching}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshButtonText}>
              {isTopicsFetching ? 'Refreshing...' : 'Refresh'}
            </Text>
          </TouchableOpacity>
        </View>

        {isTopicsLoading ? (
          <View style={styles.inlineStateContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.inlineStateText}>Loading topics...</Text>
          </View>
        ) : isTopicsError ? (
          <View style={styles.inlineStateContainer}>
            <Text style={styles.errorDetail}>{formatApiError(topicsError)}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRefreshTopics}
              disabled={isTopicsFetching}
            >
              <Text style={styles.retryButtonText}>
                {isTopicsFetching ? 'Refreshing...' : 'Retry topics'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredTopicList}
            keyExtractor={(topicItem) => topicItem.topic}
            renderItem={renderTopicGroup}
            style={styles.topicsScrollView}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.topicsScrollContent,
              filteredTopicList.length === 0 && styles.topicsScrollContentEmpty,
            ]}
            ListEmptyComponent={
              <View style={styles.noMatchesContainer}>
                <Text style={styles.noSubtopicsText}>
                  No matching topics, subtopics, or charges.
                </Text>
                {showYoutubeFallbackAction ? (
                  <TouchableOpacity
                    style={styles.youtubeFallbackButton}
                    onPress={executeSearch}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.youtubeFallbackText}>
                      Search YouTube for "{searchQuery.trim()}"
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            }
          >
          </FlatList>
        )}
      </View>

      {hasYoutubeQuery ? (
        <>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>{`Results for "${youtubeQuery}"`}</Text>
          </View>

          {topMatch ? (
            <View style={styles.topMatchContainer}>
              <Text style={styles.topMatchLabel}>Top match</Text>
              {renderVideoCard({ item: topMatch })}
              {topMatchDebugReason ? (
                <Text style={styles.topMatchDebugText}>{topMatchDebugReason}</Text>
              ) : null}
            </View>
          ) : null}

          {isVideosLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : isVideosError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading search results</Text>
          <Text style={styles.errorDetail}>{formatApiError(videosError)}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetchVideos()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : groupedSections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No whitelisted videos found for this selection. Try another phrase in
            the search field.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={groupedSections}
          keyExtractor={(item) => item.videoId}
          renderItem={renderVideoCard}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          contentContainerStyle={styles.videoListContent}
          stickySectionHeadersEnabled={false}
          ListFooterComponent={<View style={styles.footerSpacer} />}
        />
      )}
        </>
      ) : null}
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
  headerLockup: {
    aspectRatio: 3.7,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    fontSize: 14,
    color: '#1f2937',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearButtonText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
  },
  topicsPanel: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 10,
    paddingBottom: 12,
  },
  topicsPanelFull: {
    flex: 1,
    minHeight: 0,
  },
  topicsPanelWithResults: {
    maxHeight: 280,
    flexShrink: 1,
    minHeight: 0,
  },
  topicsScrollView: {
    flex: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  panelTitle: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  refreshButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },
  topicsScrollContent: {
    paddingHorizontal: 12,
    gap: 10,
    paddingBottom: 2,
  },
  topicsScrollContentEmpty: {
    flexGrow: 1,
  },
  topicGroupCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    padding: 8,
  },
  topicHeader: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topicHeaderSelected: {
    backgroundColor: '#2563eb',
  },
  topicHeaderText: {
    color: '#1e3a8a',
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  topicHeaderTextSelected: {
    color: '#ffffff',
  },
  topicChevron: {
    color: '#1e40af',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 10,
  },
  subtopicsWrap: {
    gap: 8,
    marginTop: 8,
    paddingBottom: 2,
  },
  groupBlock: {
    gap: 6,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subtopicChip: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  subtopicChipActive: {
    backgroundColor: '#1d4ed8',
  },
  subtopicChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  subtopicChipTextActive: {
    color: '#ffffff',
  },
  subtopicHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  chargeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chargeChip: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  chargeChipActive: {
    backgroundColor: '#b45309',
  },
  chargeChipText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '700',
  },
  chargeChipTextActive: {
    color: '#ffffff',
  },
  noSubtopicsText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noMatchesContainer: {
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  resultsHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultsTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  topMatchContainer: {
    paddingTop: 8,
  },
  topMatchLabel: {
    paddingHorizontal: 14,
    paddingBottom: 6,
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  topMatchDebugText: {
    marginTop: -2,
    paddingHorizontal: 14,
    color: '#475569',
    fontSize: 11,
    fontStyle: 'italic',
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    color: '#1e3a8a',
    fontWeight: '800',
  },
  videoListContent: {
    paddingTop: 2,
  },
  videoCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  videoMeta: {
    padding: 12,
    gap: 4,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  approvedBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  shortBadge: {
    backgroundColor: '#fae8ff',
    color: '#86198f',
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  longBadge: {
    backgroundColor: '#fee2e2',
    color: '#9f1239',
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  videoChannel: {
    fontSize: 13,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  videoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  videoInfoText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  linkContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 6,
  },
  linkLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  linkActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  linkActionButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  linkActionText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineStateContainer: {
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineStateText: {
    color: '#475569',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  youtubeFallbackButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  youtubeFallbackText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#dc2626',
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 13,
    color: '#7f1d1d',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 4,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  footerSpacer: {
    height: 20,
  },
});
