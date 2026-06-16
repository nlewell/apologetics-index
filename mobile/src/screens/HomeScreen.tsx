import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { formatApiError } from '../lib/formatApiError';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [checkMessage, setCheckMessage] = React.useState<string | null>(null);
  const {
    statusText,
    lastSyncedText,
    checkForUpdates,
    hasNewContent,
    isCheckingVersion,
  } = useSyncStatus();

  const handleCheckForUpdates = async () => {
    try {
      const result = await checkForUpdates();

      if (result.hasNewContent) {
        setCheckMessage('New content found. Open Browse Topics and pull to refresh.');
        return;
      }

      setCheckMessage('You are already up to date.');
    } catch (error) {
      setCheckMessage(`Unable to check updates: ${formatApiError(error)}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerLockup}>
          <Image
            source={require('../../assets/lens_of_truth_header.png')}
            style={styles.headerImage}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.subtitle}>Browse responses to common questions</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('IndexItems')}
            activeOpacity={0.7}
          >
            <View style={styles.primaryButtonContent}>
              <Text style={styles.primaryButtonText}>Browse Topics</Text>
              {hasNewContent ? (
                <View style={styles.updateBadge}>
                  <Text style={styles.updateBadgeText}>NEW</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Explore resources and answers to strengthen your understanding.
          </Text>

          <View style={styles.syncPanel}>
            <Text style={styles.syncStatusText}>
              Sync status: {hasNewContent ? 'Update available' : statusText}
            </Text>
            <Text style={styles.syncMetaText}>{lastSyncedText}</Text>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleCheckForUpdates}
              disabled={isCheckingVersion}
              activeOpacity={0.7}
            >
              <Text style={styles.syncButtonText}>
                {isCheckingVersion ? 'Checking...' : 'Check for updates'}
              </Text>
            </TouchableOpacity>
            {checkMessage ? (
              <Text style={styles.syncMessageText}>{checkMessage}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: 'space-between',
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
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  updateBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  updateBadgeText: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  infoContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
    textAlign: 'center',
  },
  syncPanel: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
    paddingTop: 12,
    gap: 8,
  },
  syncStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  syncMetaText: {
    fontSize: 12,
    color: '#1e40af',
  },
  syncButton: {
    marginTop: 4,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  syncMessageText: {
    fontSize: 12,
    color: '#1e40af',
  },
});
