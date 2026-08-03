import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOP_MATCH_SECTION_VISIBILITY_KEY } from '../constants/admin';

export type TopMatchInsightsVisibility = {
  aiAnswer: boolean;
  bestSource: boolean;
  officialAnswer: boolean;
  commentSummary: boolean;
};

export const DEFAULT_TOP_MATCH_INSIGHTS_VISIBILITY: TopMatchInsightsVisibility = {
  aiAnswer: true,
  bestSource: true,
  officialAnswer: true,
  commentSummary: true,
};

const coerceBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
};

const coerceVisibility = (value: unknown): TopMatchInsightsVisibility => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_TOP_MATCH_INSIGHTS_VISIBILITY;
  }

  const row = value as Partial<TopMatchInsightsVisibility>;
  return {
    aiAnswer: coerceBoolean(
      row.aiAnswer,
      DEFAULT_TOP_MATCH_INSIGHTS_VISIBILITY.aiAnswer,
    ),
    bestSource: coerceBoolean(
      row.bestSource,
      DEFAULT_TOP_MATCH_INSIGHTS_VISIBILITY.bestSource,
    ),
    officialAnswer: coerceBoolean(
      row.officialAnswer,
      DEFAULT_TOP_MATCH_INSIGHTS_VISIBILITY.officialAnswer,
    ),
    commentSummary: coerceBoolean(
      row.commentSummary,
      DEFAULT_TOP_MATCH_INSIGHTS_VISIBILITY.commentSummary,
    ),
  };
};

export const loadTopMatchInsightsVisibility = async (): Promise<TopMatchInsightsVisibility> => {
  try {
    const raw = await AsyncStorage.getItem(TOP_MATCH_SECTION_VISIBILITY_KEY);
    if (!raw) {
      return DEFAULT_TOP_MATCH_INSIGHTS_VISIBILITY;
    }

    const parsed = JSON.parse(raw) as unknown;
    return coerceVisibility(parsed);
  } catch {
    return DEFAULT_TOP_MATCH_INSIGHTS_VISIBILITY;
  }
};

export const saveTopMatchInsightsVisibility = async (
  value: TopMatchInsightsVisibility,
): Promise<void> => {
  await AsyncStorage.setItem(
    TOP_MATCH_SECTION_VISIBILITY_KEY,
    JSON.stringify(value),
  );
};
