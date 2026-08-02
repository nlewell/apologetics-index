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

export interface CreateIndexItemInput {
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
  sourceKey: string;
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
  pinOrder: number;
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

export interface YoutubeRecentQueriesResponse {
  queries: string[];
}

export interface YoutubeWhitelistEntry {
  id: number;
  entry: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface YoutubeCommentArgument {
  label: string;
  summary: string;
  supportCount: number;
  supportPct: number;
  engagementSupportScore: number;
  strengthScore: number;
  strength: 'weak' | 'medium' | 'strong';
  whyStrong: string[];
  whyWeak: string[];
  exampleComments: string[];
}

export interface YoutubeCommentsAnalysisResponse {
  videoId: string;
  analyzedCommentCount: number;
  sampleCommentCount: number;
  authorChannelIdFilter: string | null;
  cacheStatus: 'hit' | 'generated' | 'miss';
  cachedAt: string | null;
  overallSummary: string;
  confidenceScore: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  disagreementScore: number;
  arguments: YoutubeCommentArgument[];
}

export interface YoutubePrecacheTopMatchCommentsResponse {
  query: string;
  maxResults: number;
  maxComments: number;
  topMatchVideoIds: string[];
  generatedCount: number;
  hitCount: number;
}

export interface YoutubeOfficialAnswerResponse {
  videoId: string;
  topicQuery: string;
  cacheStatus: 'hit' | 'generated' | 'miss';
  cachedAt: string | null;
  matchFound: boolean;
  answerTitle: string | null;
  answerUrl: string | null;
  answerSource: string | null;
  answerSnippet: string | null;
  rationale: string | null;
  confidenceScore: number;
}

export interface YoutubePrecacheTopMatchOfficialAnswersResponse {
  query: string;
  maxResults: number;
  topMatchVideoIds: string[];
  generatedCount: number;
  hitCount: number;
  matchedCount: number;
}

export interface YoutubeQueryInsightResponse {
  topicQuery: string;
  cacheStatus: 'hit' | 'generated' | 'miss';
  cachedAt: string | null;
  answerText: string | null;
  bestSourceTitle: string | null;
  bestSourceUrl: string | null;
  bestSourceSnippet: string | null;
  bestSourceRationale: string | null;
  confidenceScore: number;
}

export interface YoutubePrecacheQueryInsightResponse {
  query: string;
  cacheStatus: 'hit' | 'generated' | 'miss';
  hasAnswer: boolean;
  hasBestSource: boolean;
}

export interface YoutubeChannelCommentsSummaryResponse {
  channelId: string;
  topicQuery: string;
  videosAnalyzed: number;
  totalCommentsAnalyzed: number;
  overallSummary: string;
  confidenceScore: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  disagreementScore: number;
  topArguments: YoutubeCommentArgument[];
  videoBreakdown: Array<{
    videoId: string;
    analyzedCommentCount: number;
    confidenceScore: number;
  }>;
}

export interface ContentSpreadsheetExportResponse {
  filename: string;
  generatedAt: string;
  rowCount: number;
  csv: string;
}

export interface ContentSpreadsheetImportResponse {
  generatedAt: string;
  rowsRead: number;
  indexItemsCreated: number;
  indexItemsUpdated: number;
  pinnedRowsReplaced: number;
  pinnedRowsImported: number;
}
