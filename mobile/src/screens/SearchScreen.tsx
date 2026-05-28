import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIndexItems } from '../hooks/useIndexItems';
import { IndexItemCard } from '../components/IndexItemCard';
import { RootStackParamList } from '../types/navigation';
import { IndexItem } from '../types';
import { useSyncStatus } from '../hooks/useSyncStatus';

type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;

export const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page] = useState(1);
  const { statusText, lastSyncedText, hasNewContent, lastSyncedAt } =
    useSyncStatus();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        hasNewContent ? <Text style={styles.headerBadge}>NEW</Text> : null,
    });
  }, [hasNewContent, navigation]);

  const { data, isLoading } = useIndexItems({
    page,
    limit: 50,
    q: debouncedQuery || undefined,
  });

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleItemPress = (item: IndexItem) => {
    navigation.navigate('IndexItemDetail', { item });
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by topic, subtopic, or charge..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
        <View style={styles.syncBadge}>
          <Text style={styles.syncBadgeTitle}>
            {hasNewContent ? 'Update available' : statusText}
          </Text>
          <Text style={styles.syncBadgeMeta}>{lastSyncedText}</Text>
        </View>
      </View>

      {isLoading && !data ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={data?.items || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No results found'
                  : 'Enter a search query'}
              </Text>
            </View>
          }
        />
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
  syncBadge: {
    marginTop: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  syncBadgeTitle: {
    color: '#1e3a8a',
    fontWeight: '700',
    fontSize: 12,
  },
  syncBadgeMeta: {
    color: '#1e40af',
    fontSize: 11,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});
