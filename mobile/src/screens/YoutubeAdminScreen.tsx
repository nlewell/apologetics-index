import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useCreateIndexItem,
  useIndexItems,
  useSaveYoutubeSearchOverride,
  useUpdateIndexItemFields,
  useYoutubeSearch,
} from '../hooks';
import { IndexItem, YoutubeSearchItem } from '../types';
import { RootStackParamList } from '../types/navigation';
import { formatApiError } from '../lib/formatApiError';

type YoutubeAdminScreenProps = NativeStackScreenProps<RootStackParamList, 'YoutubeAdmin'>;

type VideoSection = {
  title: string;
  data: YoutubeSearchItem[];
};

export const YoutubeAdminScreen: React.FC<YoutubeAdminScreenProps> = () => {
  const [mode, setMode] = useState<'youtube' | 'index'>('youtube');

  const [queryText, setQueryText] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [editingItem, setEditingItem] = useState<YoutubeSearchItem | null>(null);
  const [editingStartTimestamp, setEditingStartTimestamp] = useState('');
  const [editingKeepOnRefresh, setEditingKeepOnRefresh] = useState(false);

  const [indexQueryText, setIndexQueryText] = useState('');
  const [activeIndexQuery, setActiveIndexQuery] = useState('');
  const [editingIndexItem, setEditingIndexItem] = useState<IndexItem | null>(null);
  const [editingGeneralTopic, setEditingGeneralTopic] = useState('');
  const [editingSubtopic, setEditingSubtopic] = useState('');
  const [editingCharge, setEditingCharge] = useState('');
  const [creatingIndexItem, setCreatingIndexItem] = useState(false);
  const [newGeneralTopic, setNewGeneralTopic] = useState('');
  const [newSubtopic, setNewSubtopic] = useState('');
  const [newCharge, setNewCharge] = useState('');

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

  const {
    data: indexData,
    isLoading: isIndexLoading,
    isError: isIndexError,
    error: indexError,
    refetch: refetchIndex,
  } = useIndexItems(
    {
      page: 1,
      limit: 30,
      q: activeIndexQuery || undefined,
    },
    {
      enabled: mode === 'index' && activeIndexQuery.trim().length > 0,
    },
  );

  const sections = (searchData?.items ?? []).length
    ? [
        {
          title: `Results (${searchData?.items?.length ?? 0})`,
          data: searchData?.items ?? [],
        },
      ]
    : [];

  const runSearch = () => {
    const normalized = queryText.trim();
    setActiveQuery(normalized);
  };

  const runIndexSearch = () => {
    const normalized = indexQueryText.trim();
    setActiveIndexQuery(normalized);
  };

  const openEditVideo = (item: YoutubeSearchItem) => {
    setEditingItem(item);
    setEditingStartTimestamp(item.startTimestamp ?? '');
    setEditingKeepOnRefresh(Boolean(item.keepOnRefresh));
  };

  const closeEditVideo = () => {
    setEditingItem(null);
    setEditingStartTimestamp('');
    setEditingKeepOnRefresh(false);
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

  const saveCreateIndexItem = async () => {
    await createIndexItem.mutateAsync({
      generalTopic: newGeneralTopic.trim() || null,
      subtopic: newSubtopic.trim() || null,
      charge: newCharge.trim() || null,
    });

    closeCreateIndexItem();
    await refetchIndex();
  };

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
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditVideo(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
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
        <Text style={styles.title}>Admin editor</Text>
        <Text style={styles.subtitle}>Manage YouTube overrides or update topic, subtopic, and charge fields.</Text>

        <View style={styles.modeSwitchRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'youtube' && styles.modeButtonActive]}
            onPress={() => setMode('youtube')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeButtonText, mode === 'youtube' && styles.modeButtonTextActive]}>
              YouTube
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'index' && styles.modeButtonActive]}
            onPress={() => setMode('index')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeButtonText, mode === 'index' && styles.modeButtonTextActive]}>
              Index Items
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {mode === 'youtube' ? (
        <>
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <TextInput
                value={queryText}
                onChangeText={setQueryText}
                placeholder="Search query"
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                onSubmitEditing={runSearch}
              />
              <TouchableOpacity style={styles.searchButton} onPress={runSearch} activeOpacity={0.8}>
                <Text style={styles.searchButtonText}>Open</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!activeQuery ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Enter a query to load the indexed results.</Text>
            </View>
          ) : isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : isError ? (
            <View style={styles.errorState}>
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
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No indexed results found for this query yet.</Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        <>
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <TextInput
                value={indexQueryText}
                onChangeText={setIndexQueryText}
                placeholder="Find by topic, subtopic, or charge"
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                onSubmitEditing={runIndexSearch}
              />
              <TouchableOpacity style={styles.searchButton} onPress={runIndexSearch} activeOpacity={0.8}>
                <Text style={styles.searchButtonText}>Find</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={openCreateIndexItem} activeOpacity={0.8}>
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!activeIndexQuery ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Search for index items, then edit topic fields.</Text>
            </View>
          ) : isIndexLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : isIndexError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorTitle}>Could not load index items</Text>
              <Text style={styles.errorDetail}>{formatApiError(indexError)}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetchIndex()} activeOpacity={0.8}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={indexData?.items ?? []}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderIndexItemCard}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No matching index items found.</Text>
                </View>
              }
            />
          )}
        </>
      )}

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
  subtitle: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  modeSwitchRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  modeButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#1e3a8a',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
  emptyStateText: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
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
