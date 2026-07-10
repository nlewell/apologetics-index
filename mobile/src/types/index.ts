export interface IndexItem {
  id: number;
  sourceKey: string;
  generalTopic: string | null;
  subtopic: string | null;
  charge: string | null;
  shortResponseUrl: string | null;
  shortResponseLength: string | null;
  shortResponseAuthor: string | null;
  longResponseUrl: string | null;
  longResponseLength: string | null;
  debateUrl: string | null;
  articleUrl: string | null;
  video1Length: string | null;
  video1Author: string | null;
  video1Timestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IndexItemsResponse {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  items: IndexItem[];
}

export interface ListIndexItemsParams {
  page?: number;
  limit?: number;
  generalTopic?: string;
  subtopic?: string;
  q?: string;
}

export interface UpdateIndexItemFieldsInput {
  generalTopic?: string | null;
  subtopic?: string | null;
  charge?: string | null;
}

export interface ContentVersionResponse {
  version: string;
  totalItems: number;
  lastUpdatedAt: string | null;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface SubtopicWithCharges {
  subtopic: string;
  charges: string[];
}

export interface TopicWithSubtopics {
  topic: string;
  charges: string[];
  subtopics: SubtopicWithCharges[];
}

export interface YoutubeSearchItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  videoUrl: string;
  duration: string;
  durationSeconds: number;
  isShort: boolean;
  startTimestamp: string | null;
  keepOnRefresh: boolean;
}

export interface YoutubeSearchResponse {
  query: string;
  maxResults: number;
  whitelist: {
    sourceFile: string;
    configuredEntries: string[];
    resolvedChannelIds: string[];
  };
  items: YoutubeSearchItem[];
  debug?: {
    enabled: boolean;
    environment: string;
    preferredChannelBonus: number;
    scores: Array<{
      videoId: string;
      title: string;
      channelTitle: string;
      relevanceScore: number;
      preferredBoostApplied: boolean;
    }>;
  };
}
