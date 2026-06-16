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
  const hasShort = Boolean(item.shortResponseUrl);
  const hasLong = Boolean(item.longResponseUrl || item.video1Timestamp);
  const hasDebate = Boolean(item.debateUrl);
  const hasArticle = Boolean(item.articleUrl);

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

        {(hasShort || hasLong || hasDebate || hasArticle) && (
          <View style={styles.resourceRow}>
            {hasShort && <Tag text="Short" style={styles.tagBlue} />}
            {hasLong && <Tag text="Long" style={styles.tagPurple} />}
            {hasDebate && <Tag text="Debate" style={styles.tagAmber} />}
            {hasArticle && <Tag text="Article" style={styles.tagGreen} />}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

type TagProps = {
  text: string;
  style: object;
};

const Tag: React.FC<TagProps> = ({ text, style }) => (
  <View style={[styles.tag, style]}>
    <Text style={styles.tagText}>{text}</Text>
  </View>
);

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
  resourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tag: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.2,
  },
  tagBlue: {
    backgroundColor: '#dbeafe',
  },
  tagPurple: {
    backgroundColor: '#ede9fe',
  },
  tagAmber: {
    backgroundColor: '#fef3c7',
  },
  tagGreen: {
    backgroundColor: '#dcfce7',
  },
});
