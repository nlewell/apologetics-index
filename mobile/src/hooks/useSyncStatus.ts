import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContentVersion } from './useIndexItems';
import { CONTENT_VERSION_KEY, LAST_SYNCED_AT_KEY } from '../constants/sync';

export const useSyncStatus = () => {
  const [storedVersion, setStoredVersion] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const {
    data: contentVersion,
    refetch: refetchContentVersion,
    isFetching: isCheckingVersion,
  } = useContentVersion();

  useEffect(() => {
    const hydrateSyncState = async () => {
      const [versionValue, syncedAtValue] = await Promise.all([
        AsyncStorage.getItem(CONTENT_VERSION_KEY),
        AsyncStorage.getItem(LAST_SYNCED_AT_KEY),
      ]);

      setStoredVersion(versionValue);
      setLastSyncedAt(syncedAtValue);
      setIsHydrated(true);
    };

    hydrateSyncState().catch(() => {
      setIsHydrated(true);
    });
  }, []);

  const markSynced = useCallback(async (version?: string) => {
    const versionToStore = version ?? contentVersion?.version;

    if (!versionToStore) {
      return;
    }

    const syncedAt = new Date().toISOString();

    await Promise.all([
      AsyncStorage.setItem(CONTENT_VERSION_KEY, versionToStore),
      AsyncStorage.setItem(LAST_SYNCED_AT_KEY, syncedAt),
    ]);

    setStoredVersion(versionToStore);
    setLastSyncedAt(syncedAt);
  }, [contentVersion?.version]);

  useEffect(() => {
    if (isHydrated && !storedVersion && contentVersion?.version) {
      markSynced(contentVersion.version).catch(() => undefined);
    }
  }, [contentVersion?.version, isHydrated, markSynced, storedVersion]);

  const hasNewContent = Boolean(
    contentVersion?.version &&
      storedVersion &&
      contentVersion.version !== storedVersion,
  );

  const checkForUpdates = useCallback(async () => {
    const result = await refetchContentVersion();
    const latestVersion = result.data?.version ?? null;

    return {
      hasNewContent: Boolean(
        latestVersion && storedVersion && latestVersion !== storedVersion,
      ),
      version: latestVersion,
    };
  }, [refetchContentVersion, storedVersion]);

  const statusText = useMemo(() => {
    if (!storedVersion) {
      return 'Not synced yet';
    }

    return hasNewContent ? 'Update available' : 'Up to date';
  }, [hasNewContent, storedVersion]);

  const lastSyncedText = useMemo(() => {
    if (!lastSyncedAt) {
      return 'Never synced';
    }

    const date = new Date(lastSyncedAt);
    return `Last synced: ${date.toLocaleString()}`;
  }, [lastSyncedAt]);

  return {
    statusText,
    lastSyncedText,
    lastSyncedAt,
    hasNewContent,
    isCheckingVersion,
    checkForUpdates,
    markSynced,
  };
};
