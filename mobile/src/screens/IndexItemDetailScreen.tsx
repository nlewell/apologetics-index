import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type IndexItemDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'IndexItemDetail'
>;

export const IndexItemDetailScreen: React.FC<IndexItemDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { item } = route.params;

  const handleOpenUrl = async () => {
    if (item.shortResponseUrl) {
      try {
        await Linking.openURL(item.shortResponseUrl);
      } catch (error) {
        console.error('Failed to open URL:', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <Text style={styles.topic}>{item.generalTopic || 'N/A'}</Text>

          {item.subtopic && (
            <Text style={styles.subtopic}>{item.subtopic}</Text>
          )}
        </View>

        {item.charge && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Charge</Text>
            <Text style={styles.sectionContent}>{item.charge}</Text>
          </View>
        )}

        {item.shortResponseUrl && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.urlButton}
              onPress={handleOpenUrl}
              activeOpacity={0.7}
            >
              <Text style={styles.urlButtonText}>View Response</Text>
            </TouchableOpacity>
            <Text style={styles.urlText} numberOfLines={1}>
              {item.shortResponseUrl}
            </Text>
          </View>
        )}

        <View style={styles.videoSection}>
          <Text style={styles.sectionTitle}>Video Resource</Text>

          {item.video1Author ? (
            <View style={styles.videoDetails}>
              <DetailRow label="Author" value={item.video1Author} />
              {item.video1Length && (
                <DetailRow label="Length" value={item.video1Length} />
              )}
              {item.video1Timestamp && (
                <DetailRow
                  label="Timestamp"
                  value={item.video1Timestamp}
                />
              )}
            </View>
          ) : (
            <Text style={styles.noDataText}>No video information available</Text>
          )}
        </View>

        <View style={styles.metadataSection}>
          <Text style={styles.metadataLabel}>Added</Text>
          <Text style={styles.metadataValue}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <Text style={[styles.metadataLabel, styles.metadataLabelSpaced]}>
            ID
          </Text>
          <Text style={styles.metadataValue}>{item.sourceKey.substring(0, 16)}...</Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

interface DetailRowProps {
  label: string;
  value: string | null;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value || 'N/A'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 100,
  },
  headerSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  topic: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtopic: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4b5563',
  },
  section: {
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
  },
  urlButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  urlButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  urlText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  videoSection: {
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8b5cf6',
  },
  videoDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    flex: 0.35,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 0.65,
  },
  noDataText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  metadataSection: {
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  metadataLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  metadataLabelSpaced: {
    marginTop: 12,
  },
  metadataValue: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'Courier New',
  },
  backButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
