import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useCreateIndexItem,
  useAddYoutubeWhitelistEntry,
  useIndexItems,
  useSaveYoutubeSearchOverride,
  useUpdateAllYoutubeWhitelistEntries,
  useUpdateYoutubeWhitelistEntry,
  useYoutubeWhitelist,
  useUpdateIndexItemFields,
  useYoutubeSearch,
} from '../hooks';
import {
  IndexItem,
  YoutubeSearchItem,
  YoutubeWhitelistEntry,
} from '../types';
import { RootStackParamList } from '../types/navigation';
import { formatApiError } from '../lib/formatApiError';
import { SEARCH_CARD_EDIT_ENABLED_KEY } from '../constants/admin';

type YoutubeAdminScreenProps = NativeStackScreenProps<RootStackParamList, 'YoutubeAdmin'>;

type VideoSection = {
  title: string;
  data: YoutubeSearchItem[];
};

type HelpSectionKey =
  | 'overview'
  | 'searchCardEdit'
  | 'youtubeSearch'
  | 'whitelist'
  | 'indexItems';

const HELP_CONTENT: Record<
  HelpSectionKey,
  {
    title: string;
    description: string;
    bullets: string[];
  }
> = {
  overview: {
    title: 'Admin editor overview',
    description:
      'This screen is for maintaining both YouTube search quality and topic structure in one place.',
    bullets: [
      'Use small changes and verify them in the Search screen.',
      'Use the topic hierarchy and YouTube results tools to inspect and tune video results.',
      'Use the Index items panel to add or edit topic, subtopic, and charge entries.',
    ],
  },
  searchCardEdit: {
    title: 'Search card edit buttons',
    description:
      'This setting controls whether the normal Search screen shows Edit buttons on result cards.',
    bullets: [
      'Turn this on only for admins or review sessions.',
      'Leave it off for regular users to keep the Search screen simpler.',
      'This setting does not change the data by itself. It only shows or hides the edit action.',
    ],
  },
  youtubeSearch: {
    title: 'YouTube search tools',
    description:
      'This section lets you inspect and adjust YouTube results for a specific query.',
    bullets: [
      'YouTube results can change when whitelist channels are enabled or disabled.',
      'If you do not like the results for a topic, search YouTube for that topic, find a channel that has the video you want, add that channel to the whitelist, and run search again.',
      'After the video appears in results, use Edit and enable Keep on refresh.',
      'Use Edit on a result and turn on Keep on refresh to keep that result stable across refreshes.',
      'Use Search on an index item to run YouTube search for that topic path.',
    ],
  },
  whitelist: {
    title: 'Channel whitelist',
    description:
      'Only approved channels should be used in YouTube search results. This list controls which channels are allowed.',
    bullets: [
      'Add a channel handle or channel ID to approve a new source.',
      'Disable a channel if its content should stop appearing without deleting the entry.',
      'Use Enable all or Disable all only for broad maintenance changes.',
    ],
  },
  indexItems: {
    title: 'Index items',
    description:
      'This section is for browsing and editing the topic structure that users search and navigate.',
    bullets: [
      'Start typing to filter existing topics, subtopics, and charges.',
      'Use Edit to correct wording or move an item into the right structure.',
      'Use Add to create a new topic, subtopic, or charge entry.',
    ],
  },
};

export const YoutubeAdminScreen: React.FC<YoutubeAdminScreenProps> = () => {
  const [activeQuery, setActiveQuery] = useState('');
  const [editingItem, setEditingItem] = useState<YoutubeSearchItem | null>(null);
  const [editingStartTimestamp, setEditingStartTimestamp] = useState('');
  const [editingKeepOnRefresh, setEditingKeepOnRefresh] = useState(false);
  const [showAddToFields, setShowAddToFields] = useState(false);
  const [addToTopic, setAddToTopic] = useState('');
  const [addToSubtopic, setAddToSubtopic] = useState('');
  const [addToCharge, setAddToCharge] = useState('');
  const [isSearchCardEditEnabled, setIsSearchCardEditEnabled] = useState(false);
  const [isIndexItemsCollapsed, setIsIndexItemsCollapsed] = useState(true);
  const [isWhitelistCollapsed, setIsWhitelistCollapsed] = useState(true);
  const [selectedIndexItemForEdit, setSelectedIndexItemForEdit] = useState<IndexItem | null>(null);
  const [newWhitelistEntry, setNewWhitelistEntry] = useState('');
  const [whitelistSearchText, setWhitelistSearchText] = useState('');

  const [indexQueryText, setIndexQueryText] = useState('');
  const [activeIndexFilter, setActiveIndexFilter] = useState('');
  const [editingIndexItem, setEditingIndexItem] = useState<IndexItem | null>(null);
  const [editingGeneralTopic, setEditingGeneralTopic] = useState('');
  const [editingSubtopic, setEditingSubtopic] = useState('');
  const [editingCharge, setEditingCharge] = useState('');
  const [creatingIndexItem, setCreatingIndexItem] = useState(false);
  const [newGeneralTopic, setNewGeneralTopic] = useState('');
  const [newSubtopic, setNewSubtopic] = useState('');
  const [newCharge, setNewCharge] = useState('');
  const [helpSection, setHelpSection] = useState<HelpSectionKey | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const loadAdminSettings = async () => {
      try {
        const storedEditSetting = await AsyncStorage.getItem(
          SEARCH_CARD_EDIT_ENABLED_KEY,
        );

        if (isMounted) {
          setIsSearchCardEditEnabled(storedEditSetting === '1');
        }
      } catch {
        if (isMounted) {
          setIsSearchCardEditEnabled(false);
        }
      }
    };

    loadAdminSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setActiveIndexFilter(indexQueryText.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [indexQueryText]);

  const {
    data: searchData,
    isLoading,
    isError,
    error,
    refetch,
  } = useYoutubeSearch(activeQuery, 5, false, false);
  const saveYoutubeSearchOverride = useSaveYoutubeSearchOverride();
  const updateIndexItemFields = useUpdateIndexItemFields();
  const createIndexItem = useCreateIndexItem();
  const addYoutubeWhitelistEntry = useAddYoutubeWhitelistEntry();
  const updateAllYoutubeWhitelistEntries = useUpdateAllYoutubeWhitelistEntries();
  const updateYoutubeWhitelistEntry = useUpdateYoutubeWhitelistEntry();

  const {
    data: whitelistEntries,
    isLoading: isWhitelistLoading,
    isError: isWhitelistError,
    error: whitelistError,
    refetch: refetchWhitelist,
  } = useYoutubeWhitelist();
  const runHierarchySearch = (queryText: string) => {
    const normalized = queryText.trim();
    setActiveQuery(normalized);
  };

  const filteredWhitelistEntries = (whitelistEntries ?? []).filter((entry) => {
    const filter = whitelistSearchText.trim().toLowerCase();

    if (!filter) {
      return true;
    }

    return entry.entry.toLowerCase().includes(filter);
  });

  const {
    data: indexData,
    isLoading: isIndexLoading,
    isError: isIndexError,
    error: indexError,
    refetch: refetchIndex,
  } = useIndexItems(
    {
      page: 1,
      limit: 100,
      q: activeQuery || activeIndexFilter || undefined,
    },
    {
      enabled: true,
    },
  );

  const rawSearchItems = searchData?.items ?? [];
  const topMatchItems = rawSearchItems.filter((item) => item.keepOnRefresh);
  const standardItems = rawSearchItems.filter((item) => !item.keepOnRefresh);
  const shortFormItems = standardItems.filter((item) => item.isShort);
  const longFormItems = standardItems.filter((item) => !item.isShort);

  const sections: VideoSection[] = [];

  if (topMatchItems.length > 0) {
    sections.push({
      title: `Top Match (${topMatchItems.length})`,
      data: topMatchItems,
    });
  }

  if (shortFormItems.length > 0) {
    sections.push({
      title: `Short-form (${shortFormItems.length})`,
      data: shortFormItems,
    });
  }

  if (longFormItems.length > 0) {
    sections.push({
      title: `Long-form (${longFormItems.length})`,
      data: longFormItems,
    });
  }

  const addWhitelistEntry = async () => {
    const normalized = newWhitelistEntry.trim();

    if (!normalized) {
      return;
    }

    try {
      await addYoutubeWhitelistEntry.mutateAsync(normalized);
      setNewWhitelistEntry('');
      await refetchWhitelist();
    } catch (error) {
      // Keep user input so they can adjust handle/channel id and retry.
      console.warn('Failed to add whitelist entry:', error);
    }
  };

  const toggleWhitelistEntry = async (entry: YoutubeWhitelistEntry) => {
    await updateYoutubeWhitelistEntry.mutateAsync({
      id: entry.id,
      isEnabled: !entry.isEnabled,
    });

    await refetchWhitelist();
  };

  const setAllWhitelistEntries = async (isEnabled: boolean) => {
    await updateAllYoutubeWhitelistEntries.mutateAsync(isEnabled);
    await refetchWhitelist();
  };

  const openEditVideo = (item: YoutubeSearchItem) => {
    setEditingItem(item);
    setEditingStartTimestamp(item.startTimestamp ?? '');
    setEditingKeepOnRefresh(Boolean(item.keepOnRefresh));
    setShowAddToFields(false);
    setAddToTopic('');
    setAddToSubtopic('');
    setAddToCharge('');
  };

  const closeEditVideo = () => {
    setEditingItem(null);
    setEditingStartTimestamp('');
    setEditingKeepOnRefresh(false);
    setShowAddToFields(false);
    setAddToTopic('');
    setAddToSubtopic('');
    setAddToCharge('');
  };

  const buildTopicPathQuery = (
    topicValue: string,
    subtopicValue: string,
    chargeValue: string,
  ) => {
    const normalizeSegment = (value: string) => value.replace(/\s+/g, ' ').trim();

    const topic = normalizeSegment(topicValue);
    const subtopic = normalizeSegment(subtopicValue);
    const charge = normalizeSegment(chargeValue);

    if (charge) {
      return [topic, subtopic, charge].filter(Boolean).join(' ');
    }

    if (subtopic) {
      return [topic, subtopic].filter(Boolean).join(' ');
    }

    return topic;
  };

  const saveEditVideo = async () => {
    if (!editingItem || !activeQuery.trim()) {
      return;
    }

    await saveYoutubeSearchOverride.mutateAsync({
      query: activeQuery.trim(),
      videoId: editingItem.videoId,
      item: editingItem,
      startTimestamp: editingStartTimestamp.trim().length > 0 ? editingStartTimestamp.trim() : null,
      keepOnRefresh: editingKeepOnRefresh,
    });

    closeEditVideo();
    await refetch();
  };

  const addVideoToAnotherTopicPath = async () => {
    if (!editingItem) {
      return;
    }

    const destinationQuery = buildTopicPathQuery(addToTopic, addToSubtopic, addToCharge);

    if (!destinationQuery) {
      return;
    }

    await saveYoutubeSearchOverride.mutateAsync({
      query: destinationQuery,
      videoId: editingItem.videoId,
      item: editingItem,
      startTimestamp: editingStartTimestamp.trim().length > 0 ? editingStartTimestamp.trim() : null,
      keepOnRefresh: true,
    });

    setShowAddToFields(false);
    setAddToTopic('');
    setAddToSubtopic('');
    setAddToCharge('');
  };

  const openEditIndexItem = (item: IndexItem) => {
    setEditingIndexItem(item);
    setEditingGeneralTopic(item.generalTopic ?? '');
    setEditingSubtopic(item.subtopic ?? '');
    setEditingCharge(item.charge ?? '');
  };

  const closeEditIndexItem = () => {
    setEditingIndexItem(null);
    setEditingGeneralTopic('');
    setEditingSubtopic('');
    setEditingCharge('');
  };

  const saveEditIndexItem = async () => {
    if (!editingIndexItem) {
      return;
    }

    await updateIndexItemFields.mutateAsync({
      id: editingIndexItem.id,
      generalTopic: editingGeneralTopic.trim() || null,
      subtopic: editingSubtopic.trim() || null,
      charge: editingCharge.trim() || null,
    });

    closeEditIndexItem();
    await refetchIndex();
  };

  const openCreateIndexItem = () => {
    setNewGeneralTopic('');
    setNewSubtopic('');
    setNewCharge('');
    setCreatingIndexItem(true);
  };

  const closeCreateIndexItem = () => {
    setCreatingIndexItem(false);
    setNewGeneralTopic('');
    setNewSubtopic('');
    setNewCharge('');
  };

  const runIndexItemSearch = (item: IndexItem) => {
    const queryText = buildTopicPathQuery(
      item.generalTopic ?? '',
      item.subtopic ?? '',
      item.charge ?? '',
    );

    if (!queryText) {
      return;
    }

    setSelectedIndexItemForEdit(item);
    runHierarchySearch(queryText);
  };

  const resetIndexItemSearch = () => {
    setActiveQuery('');
    setSelectedIndexItemForEdit(null);
    refetchIndex();
  };

  const saveCreateIndexItem = async () => {
    await createIndexItem.mutateAsync({
      generalTopic: newGeneralTopic.trim() || null,
      subtopic: newSubtopic.trim() || null,
      charge: newCharge.trim() || null,
    });

    closeCreateIndexItem();
    await refetchIndex();
  };

  const toggleSearchCardEditEnabled = async (value: boolean) => {
    setIsSearchCardEditEnabled(value);

    try {
      await AsyncStorage.setItem(SEARCH_CARD_EDIT_ENABLED_KEY, value ? '1' : '0');
    } catch {
      setIsSearchCardEditEnabled(!value);
    }
  };

  const openHelp = (section: HelpSectionKey) => {
    setHelpSection(section);
  };

  const closeHelp = () => {
    setHelpSection(null);
  };

  const renderHelpButton = (section: HelpSectionKey) => (
    <TouchableOpacity
      style={styles.helpButton}
      onPress={() => openHelp(section)}
      activeOpacity={0.8}
    >
      <Text style={styles.helpButtonText}>Help</Text>
    </TouchableOpacity>
  );

  const renderToggleButton = (
    isCollapsed: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity style={styles.helpButton} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.helpButtonText}>{isCollapsed ? 'Show' : 'Hide'}</Text>
    </TouchableOpacity>
  );

  const renderVideoCard = ({ item }: { item: YoutubeSearchItem }) => {
    const url = item.videoUrl || `https://www.youtube.com/watch?v=${item.videoId}`;

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTextBlock}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardChannel} numberOfLines={1}>
              {item.channelTitle}
            </Text>
          </View>
          <View style={styles.cardActionsCol}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => openEditVideo(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.badgeRow}>
          {item.keepOnRefresh ? <Text style={styles.pinnedBadge}>Pinned</Text> : null}
          {item.startTimestamp ? (
            <Text style={styles.timestampBadge}>{item.startTimestamp}</Text>
          ) : null}
          <Text style={styles.linkBadge} numberOfLines={1}>
            {url}
          </Text>
        </View>
      </View>
    );
  };

  const renderIndexItemCard = ({ item }: { item: IndexItem }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTextBlock}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.generalTopic || 'No topic'}
            </Text>
            <Text style={styles.cardChannel} numberOfLines={1}>
              {item.subtopic || 'No subtopic'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditIndexItem(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={() => runIndexItemSearch(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryActionButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badgeRow}>
          <Text style={styles.linkBadge} numberOfLines={2}>
            Charge: {item.charge || 'None'}
          </Text>
          <Text style={styles.metaLabel} numberOfLines={1}>
            Source: {item.sourceKey}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Admin editor</Text>
          {renderHelpButton('overview')}
        </View>
        <Text style={styles.subtitle}>Manage YouTube overrides or update topic, subtopic, and charge fields.</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingLabel}>Enable search card edit buttons</Text>
            <Text style={styles.settingHint}>Shows the Edit action on result cards in Search.</Text>
          </View>
          <View style={styles.settingActions}>
            {renderHelpButton('searchCardEdit')}
            <Switch
              value={isSearchCardEditEnabled}
              onValueChange={toggleSearchCardEditEnabled}
            />
          </View>
        </View>
      </View>

      <View style={[styles.searchSection, styles.youtubeSearchSection]}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>YouTube search</Text>
          <View style={styles.sectionHeaderActions}>{renderHelpButton('youtubeSearch')}</View>
        </View>

        <ScrollView
          style={styles.youtubeToolsScroll}
          contentContainerStyle={styles.youtubeToolsStack}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.whitelistPanel}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.whitelistTitle}>Channel whitelist</Text>
              <View style={styles.sectionHeaderActions}>
                {renderHelpButton('whitelist')}
                {renderToggleButton(isWhitelistCollapsed, () =>
                  setIsWhitelistCollapsed((previous) => !previous),
                )}
              </View>
            </View>
            <Text style={styles.whitelistSubtitle}>
              Add channels and toggle whether each one is used during YouTube search.
            </Text>

            {isWhitelistCollapsed ? null : (
              <>
                <TextInput
                  value={whitelistSearchText}
                  onChangeText={setWhitelistSearchText}
                  placeholder="Search whitelist"
                  placeholderTextColor="#94a3b8"
                  style={styles.whitelistSearchInput}
                />

                <View style={styles.searchRow}>
                  <TextInput
                    value={newWhitelistEntry}
                    onChangeText={setNewWhitelistEntry}
                    placeholder="@channelhandle or UC..."
                    placeholderTextColor="#94a3b8"
                    style={styles.searchInput}
                    onSubmitEditing={addWhitelistEntry}
                  />
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={addWhitelistEntry}
                    activeOpacity={0.8}
                    disabled={addYoutubeWhitelistEntry.isPending}
                  >
                    <Text style={styles.addButtonText}>
                      {addYoutubeWhitelistEntry.isPending ? 'Adding...' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isWhitelistLoading ? (
                  <View style={styles.whitelistLoadingRow}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.whitelistLoadingText}>Loading whitelist...</Text>
                  </View>
                ) : isWhitelistError ? (
                  <View style={styles.whitelistErrorWrap}>
                    <Text style={styles.errorDetail}>{formatApiError(whitelistError)}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => refetchWhitelist()} activeOpacity={0.8}>
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.whitelistList}>
                    <View style={styles.whitelistBulkActionsRow}>
                      <TouchableOpacity
                        style={styles.whitelistBulkButton}
                        onPress={() => setAllWhitelistEntries(true)}
                        activeOpacity={0.8}
                        disabled={updateAllYoutubeWhitelistEntries.isPending}
                      >
                        <Text style={styles.whitelistBulkButtonText}>Enable all</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.whitelistBulkButton}
                        onPress={() => setAllWhitelistEntries(false)}
                        activeOpacity={0.8}
                        disabled={updateAllYoutubeWhitelistEntries.isPending}
                      >
                        <Text style={styles.whitelistBulkButtonText}>Disable all</Text>
                      </TouchableOpacity>
                    </View>

                    {addYoutubeWhitelistEntry.isError ? (
                      <Text style={styles.whitelistInlineError}>
                        {formatApiError(addYoutubeWhitelistEntry.error)}
                      </Text>
                    ) : null}

                    <FlatList
                      data={filteredWhitelistEntries}
                      keyExtractor={(entry) => entry.id.toString()}
                      style={styles.whitelistListScroll}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item: entry }) => (
                        <View style={styles.whitelistItemRow}>
                          <View style={styles.whitelistItemTextWrap}>
                            <Text style={styles.whitelistItemEntry}>{entry.entry}</Text>
                            <Text style={styles.whitelistItemHint}>
                              {entry.isEnabled ? 'Enabled' : 'Disabled'}
                            </Text>
                          </View>
                          <Switch
                            value={entry.isEnabled}
                            onValueChange={() => toggleWhitelistEntry(entry)}
                            disabled={updateYoutubeWhitelistEntry.isPending}
                          />
                        </View>
                      )}
                      ListEmptyComponent={
                        <Text style={styles.whitelistEmptyText}>
                          No whitelist entries match this search.
                        </Text>
                      }
                    />
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.whitelistPanel}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.whitelistTitle}>Index items</Text>
              <View style={styles.sectionHeaderActions}>
                {renderHelpButton('indexItems')}
                {(activeQuery || selectedIndexItemForEdit) ? (
                  <TouchableOpacity style={styles.helpButton} onPress={resetIndexItemSearch} activeOpacity={0.8}>
                    <Text style={styles.helpButtonText}>Reset</Text>
                  </TouchableOpacity>
                ) : null}
                {renderToggleButton(isIndexItemsCollapsed, () =>
                  setIsIndexItemsCollapsed((previous) => !previous),
                )}
              </View>
            </View>

            {isIndexItemsCollapsed ? (
              <Text style={styles.collapsedSectionHint}>Index items are hidden. Tap Show to browse and edit topics.</Text>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    value={indexQueryText}
                    onChangeText={setIndexQueryText}
                    placeholder="Filter by topic, subtopic, or charge"
                    placeholderTextColor="#94a3b8"
                    style={styles.searchInput}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.addButton} onPress={openCreateIndexItem} activeOpacity={0.8}>
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {isIndexLoading ? (
                  <View style={styles.whitelistLoadingRow}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.whitelistLoadingText}>Loading index items...</Text>
                  </View>
                ) : isIndexError ? (
                  <View style={styles.whitelistErrorWrap}>
                    <Text style={styles.errorDetail}>{formatApiError(indexError)}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => refetchIndex()} activeOpacity={0.8}>
                      <Text style={styles.retryButtonText}>Retry index items</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    data={indexData?.items ?? []}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderIndexItemCard}
                    style={styles.topicHierarchyList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      <Text style={styles.whitelistEmptyText}>No matching index items found.</Text>
                    }
                  />
                )}
              </>
            )}
          </View>

        </ScrollView>

        <View style={styles.searchResultsDivider} />

        <View style={styles.resultsSection}>
          <View style={styles.resultsSectionHeader}>
            <Text style={styles.sectionTitle} numberOfLines={1}>
              {activeQuery ? `YouTube results for ${activeQuery}` : 'YouTube results'}
            </Text>
          </View>

          <View style={styles.resultsGuidanceCard}>
            <Text style={styles.resultsGuidanceText}>
              Results can change based on which whitelist channels are enabled. If you do not like results for a topic, search YouTube for that topic, find a channel with the video you want, add that channel to the whitelist, and run Search again. When the video appears, tap Edit and enable Keep on refresh.
            </Text>
          </View>

          {!activeQuery ? (
            <View style={styles.emptyStateCompact}>
              <Text style={styles.emptyStateText}>Choose a topic path to load YouTube results.</Text>
            </View>
          ) : isLoading ? (
            <View style={styles.loadingStateCompact}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : isError ? (
            <View style={styles.errorStateCompact}>
              <Text style={styles.errorTitle}>Could not load results</Text>
              <Text style={styles.errorDetail}>{formatApiError(error)}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} activeOpacity={0.8}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.videoId}
              renderItem={renderVideoCard}
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                </View>
              )}
              contentContainerStyle={styles.listContent}
              stickySectionHeadersEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyStateCompact}>
                  <Text style={styles.emptyStateText}>No indexed results found for this query yet.</Text>
                </View>
              }
            />
          )}
        </View>

      </View>

      <Modal visible={editingItem !== null} transparent animationType="fade" onRequestClose={closeEditVideo}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit override</Text>
            <Text style={styles.modalSubtitle} numberOfLines={2}>
              {editingItem?.title ?? ''}
            </Text>

            <Text style={styles.modalLabel}>Start timestamp</Text>
            <TextInput
              style={styles.modalInput}
              value={editingStartTimestamp}
              onChangeText={setEditingStartTimestamp}
              placeholder="0:00"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.switchRow}>
              <View style={styles.switchTextBlock}>
                <Text style={styles.modalLabel}>Keep on refresh</Text>
                <Text style={styles.modalHint}>Leave pinned results in the local index.</Text>
              </View>
              <Switch value={editingKeepOnRefresh} onValueChange={setEditingKeepOnRefresh} />
            </View>

            <View style={styles.addToRow}>
              <Text style={styles.modalHint}>
                Add this same video to another topic path and keep it pinned there.
              </Text>
              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => setShowAddToFields((previous) => !previous)}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryActionButtonText}>
                  {showAddToFields ? 'Hide Add to...' : 'Add to...'}
                </Text>
              </TouchableOpacity>
            </View>

            {showAddToFields ? (
              <View style={styles.addToFieldsWrap}>
                <Text style={styles.modalLabel}>Topic</Text>
                <TextInput
                  style={styles.modalInput}
                  value={addToTopic}
                  onChangeText={setAddToTopic}
                  placeholder="General topic"
                  placeholderTextColor="#94a3b8"
                />

                <Text style={styles.modalLabel}>Subtopic (optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={addToSubtopic}
                  onChangeText={setAddToSubtopic}
                  placeholder="Subtopic"
                  placeholderTextColor="#94a3b8"
                />

                <Text style={styles.modalLabel}>Charge (optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={addToCharge}
                  onChangeText={setAddToCharge}
                  placeholder="Charge"
                  placeholderTextColor="#94a3b8"
                  multiline
                />

                <TouchableOpacity
                  style={styles.addToButton}
                  onPress={addVideoToAnotherTopicPath}
                  activeOpacity={0.8}
                  disabled={saveYoutubeSearchOverride.isPending}
                >
                  <Text style={styles.addToButtonText}>
                    {saveYoutubeSearchOverride.isPending ? 'Adding...' : 'Add pinned copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={closeEditVideo} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveEditVideo}
                activeOpacity={0.8}
                disabled={saveYoutubeSearchOverride.isPending}
              >
                <Text style={styles.modalSaveText}>
                  {saveYoutubeSearchOverride.isPending ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editingIndexItem !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEditIndexItem}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit index fields</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {editingIndexItem?.sourceKey ?? ''}
            </Text>

            <Text style={styles.modalLabel}>General topic</Text>
            <TextInput
              style={styles.modalInput}
              value={editingGeneralTopic}
              onChangeText={setEditingGeneralTopic}
              placeholder="General topic"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>Subtopic</Text>
            <TextInput
              style={styles.modalInput}
              value={editingSubtopic}
              onChangeText={setEditingSubtopic}
              placeholder="Subtopic"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>Charge</Text>
            <TextInput
              style={styles.modalInput}
              value={editingCharge}
              onChangeText={setEditingCharge}
              placeholder="Charge"
              placeholderTextColor="#94a3b8"
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={closeEditIndexItem} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveEditIndexItem}
                activeOpacity={0.8}
                disabled={updateIndexItemFields.isPending}
              >
                <Text style={styles.modalSaveText}>
                  {updateIndexItemFields.isPending ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={creatingIndexItem}
        transparent
        animationType="fade"
        onRequestClose={closeCreateIndexItem}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add index item</Text>
            <Text style={styles.modalSubtitle}>Create a new topic/subtopic/charge entry.</Text>

            <Text style={styles.modalLabel}>General topic</Text>
            <TextInput
              style={styles.modalInput}
              value={newGeneralTopic}
              onChangeText={setNewGeneralTopic}
              placeholder="General topic"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>Subtopic</Text>
            <TextInput
              style={styles.modalInput}
              value={newSubtopic}
              onChangeText={setNewSubtopic}
              placeholder="Subtopic"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.modalLabel}>Charge</Text>
            <TextInput
              style={styles.modalInput}
              value={newCharge}
              onChangeText={setNewCharge}
              placeholder="Charge"
              placeholderTextColor="#94a3b8"
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={closeCreateIndexItem} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveCreateIndexItem}
                activeOpacity={0.8}
                disabled={createIndexItem.isPending}
              >
                <Text style={styles.modalSaveText}>
                  {createIndexItem.isPending ? 'Saving...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={helpSection !== null} transparent animationType="fade" onRequestClose={closeHelp}>
        <View style={styles.modalBackdrop}>
          <View style={styles.helpModalCard}>
            <Text style={styles.modalTitle}>
              {helpSection ? HELP_CONTENT[helpSection].title : ''}
            </Text>
            <ScrollView style={styles.helpScrollView} contentContainerStyle={styles.helpScrollContent}>
              <Text style={styles.modalSubtitle}>
                {helpSection ? HELP_CONTENT[helpSection].description : ''}
              </Text>
              {helpSection
                ? HELP_CONTENT[helpSection].bullets.map((bullet) => (
                    <Text key={bullet} style={styles.helpBullet}>
                      - {bullet}
                    </Text>
                  ))
                : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveButton} onPress={closeHelp} activeOpacity={0.8}>
                <Text style={styles.modalSaveText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  subtitle: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  settingRow: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  settingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingTextWrap: {
    flex: 1,
    gap: 3,
  },
  settingLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  settingHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  youtubeSearchSection: {
    flex: 1,
  },
  resultsSection: {
    flex: 1,
    paddingTop: 8,
  },
  resultsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  resultsGuidanceCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resultsGuidanceText: {
    color: '#854d0e',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  helpButton: {
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  helpButtonText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  youtubeToolsStack: {
    gap: 10,
    paddingBottom: 4,
  },
  youtubeToolsScroll: {
    maxHeight: 360,
  },
  searchResultsDivider: {
    marginTop: 12,
    marginBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  whitelistPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 12,
    gap: 8,
  },
  whitelistTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  whitelistSubtitle: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  whitelistSearchInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  whitelistList: {
    gap: 8,
    marginTop: 2,
  },
  whitelistListScroll: {
    maxHeight: 220,
  },
  whitelistBulkActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  whitelistBulkButton: {
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  whitelistBulkButtonText: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '700',
  },
  whitelistInlineError: {
    color: '#7f1d1d',
    fontSize: 12,
    lineHeight: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  whitelistEmptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  whitelistItemRow: {
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  whitelistItemTextWrap: {
    flex: 1,
    gap: 2,
  },
  whitelistItemEntry: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  whitelistItemHint: {
    color: '#64748b',
    fontSize: 11,
  },
  whitelistLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  whitelistLoadingText: {
    color: '#475569',
    fontSize: 12,
  },
  whitelistErrorWrap: {
    gap: 6,
  },
  selectionSummaryRow: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectionSummaryText: {
    flex: 1,
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '700',
  },
  clearSelectionButton: {
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearSelectionText: {
    color: '#1e3a8a',
    fontSize: 11,
    fontWeight: '800',
  },
  topicHierarchyList: {
    maxHeight: 300,
    marginTop: 6,
  },
  topicGroupCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
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
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  searchButton: {
    borderRadius: 12,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  addButton: {
    borderRadius: 12,
    backgroundColor: '#0f766e',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyStateCompact: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  collapsedSectionHint: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  errorStateCompact: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingStateCompact: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    color: '#dc2626',
    fontSize: 18,
    fontWeight: '800',
  },
  errorDetail: {
    color: '#7f1d1d',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionHeaderText: {
    color: '#1e3a8a',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  listContent: {
    paddingVertical: 6,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTextBlock: {
    flex: 1,
    gap: 4,
  },
  cardActionsCol: {
    gap: 8,
    alignItems: 'flex-end',
  },
  cardTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  cardChannel: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '600',
  },
  editButton: {
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonText: {
    color: '#075985',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryActionButton: {
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryActionButtonDisabled: {
    opacity: 0.55,
  },
  secondaryActionButtonText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  badgeRow: {
    gap: 6,
  },
  pinnedBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    color: '#1e3a8a',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timestampBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  linkBadge: {
    color: '#64748b',
    fontSize: 12,
  },
  metaLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  helpModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#475569',
    fontSize: 13,
  },
  modalLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helpScrollView: {
    maxHeight: 320,
  },
  helpScrollContent: {
    gap: 10,
  },
  helpBullet: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
  },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  switchTextBlock: {
    flex: 1,
    gap: 4,
  },
  modalHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  addToRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  addToFieldsWrap: {
    marginTop: 8,
    gap: 6,
  },
  addToButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addToButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
