import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeTouchEvent,
} from 'react-native';
import { IndexItem } from '../types';

interface IndexItemCardProps {
  item: IndexItem;
  onPress: (event: NativeSyntheticEvent<NativeTouchEvent>) => void;
  showNewBadge?: boolean;
}

export const IndexItemCard: React.FC<IndexItemCardProps> = ({
  item,
  onPress,
  showNewBadge = false,
}) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardContent}>
        <View style={styles.topicRow}>
          <Text style={styles.topic} numberOfLines={1}>
            {item.generalTopic || 'N/A'}
          </Text>
          {showNewBadge ? (
            <View style={styles.newBubble}>
              <Text style={styles.newBubbleText}>NEW</Text>
            </View>
          ) : null}
        </View>
        {item.subtopic && (
          <Text style={styles.subtopic} numberOfLines={2}>
            {item.subtopic}
          </Text>
        )}
        {item.charge && (
          <Text style={styles.charge} numberOfLines={2}>
            {item.charge}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardContent: {
    gap: 6,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topic: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  newBubble: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  newBubbleText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtopic: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  charge: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
