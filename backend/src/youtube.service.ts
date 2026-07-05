import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

type YoutubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
  };
};

type YoutubeChannelItem = {
  id?: string;
};

type YoutubeVideoItem = {
  id?: string;
  contentDetails?: {
    duration?: string;
  };
};

export type YoutubeSearchResult = {
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
};

export type YoutubeSearchResponse = {
  query: string;
  maxResults: number;
  whitelist: {
    sourceFile: string;
    configuredEntries: string[];
    resolvedChannelIds: string[];
  };
  items: YoutubeSearchResult[];
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
};

type ScoredYoutubeSearchResult = YoutubeSearchResult & {
  relevanceScore: number;
  preferredBoostApplied: boolean;
};

@Injectable()
export class YoutubeService {
  private readonly channelIdCache = new Map<string, string>();

  private readonly shortsMaxSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.shortsMaxSeconds = this.getShortsMaxSeconds();
  }

  async search(
    query: string,
    maxResults = 5,
    debug = false,
  ): Promise<YoutubeSearchResponse> {
    const apiKey = this.configService.get<string>('YOUTUBE_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'YOUTUBE_API_KEY is not configured on the server',
      );
    }

    const whitelist = await this.loadWhitelistEntries();
    const resolvedChannelIds = await this.resolveChannelIds(whitelist, apiKey);
    const preferredEntries = await this.loadPreferredEntries();
    const preferredChannelIds = new Set(
      await this.resolveChannelIds(preferredEntries, apiKey),
    );

    if (!resolvedChannelIds.length) {
      return {
        query,
        maxResults,
        whitelist: {
          sourceFile: this.whitelistPath,
          configuredEntries: whitelist,
          resolvedChannelIds: [],
        },
        items: [],
      };
    }

    const perChannelMaxResults = Math.max(
      1,
      Math.min(10, Math.ceil(maxResults / resolvedChannelIds.length) + 1),
    );

    const channelSearchResults = await Promise.all(
      resolvedChannelIds.map((channelId) =>
        this.searchWithinChannel(query, channelId, perChannelMaxResults, apiKey),
      ),
    );

    const deduped = new Map<string, ScoredYoutubeSearchResult>();
    for (const item of channelSearchResults.flat()) {
      if (!deduped.has(item.videoId)) {
        deduped.set(item.videoId, item);
      }
    }

    const scoredItems = Array.from(deduped.values())
      .map((item) => ({
        ...item,
        relevanceScore:
          item.relevanceScore +
          (preferredChannelIds.has(item.channelId)
            ? this.preferredChannelBonus
            : 0),
        preferredBoostApplied: preferredChannelIds.has(item.channelId),
      }))
      .sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }

        return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
      })
      .slice(0, maxResults);

    const items = scoredItems.map(
      ({ relevanceScore: _relevanceScore, preferredBoostApplied: _preferredBoostApplied, ...item }) => item,
    );

    const isDebugEnabled = debug && this.environment !== 'production';

    const response: YoutubeSearchResponse = {
      query,
      maxResults,
      whitelist: {
        sourceFile: this.whitelistPath,
        configuredEntries: whitelist,
        resolvedChannelIds,
      },
      items,
    };

    if (isDebugEnabled) {
      response.debug = {
        enabled: true,
        environment: this.environment,
        preferredChannelBonus: this.preferredChannelBonus,
        scores: scoredItems.map((item) => ({
          videoId: item.videoId,
          title: item.title,
          channelTitle: item.channelTitle,
          relevanceScore: item.relevanceScore,
          preferredBoostApplied: item.preferredBoostApplied,
        })),
      };
    }

    return response;
  }

  private async searchWithinChannel(
    query: string,
    channelId: string,
    maxResults: number,
    apiKey: string,
  ): Promise<ScoredYoutubeSearchResult[]> {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('order', 'relevance');
    url.searchParams.set('channelId', channelId);
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('key', apiKey);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new BadGatewayException(
        `YouTube API request failed (${response.status}): ${text}`,
      );
    }

    const payload = (await response.json()) as { items?: YoutubeSearchItem[] };

    const mappedItems = (payload.items ?? [])
      .map((item): YoutubeSearchResult | null => {
        const videoId = item.id?.videoId;
        const snippet = item.snippet;

        if (!videoId || !snippet?.title || !snippet.channelId) {
          return null;
        }

        return {
          videoId,
          title: snippet.title,
          description: snippet.description ?? '',
          channelTitle: snippet.channelTitle ?? '',
          channelId: snippet.channelId,
          publishedAt: snippet.publishedAt ?? '',
          thumbnailUrl:
            snippet.thumbnails?.medium?.url ??
            snippet.thumbnails?.high?.url ??
            snippet.thumbnails?.default?.url ??
            null,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          duration: '',
          durationSeconds: 0,
          isShort: false,
        };
      })
      .filter((item): item is YoutubeSearchResult => item !== null);

    if (!mappedItems.length) {
      return [];
    }

    const durationByVideoId = await this.fetchVideoDurations(
      mappedItems.map((item) => item.videoId),
      apiKey,
    );

    return mappedItems.map((item, index) => {
      const durationRaw = durationByVideoId.get(item.videoId) ?? '';
      const durationSeconds = this.parseIso8601DurationToSeconds(durationRaw);
      const enrichedItem = {
        ...item,
        duration: this.formatDuration(durationSeconds),
        durationSeconds,
        isShort: durationSeconds > 0 && durationSeconds <= this.shortsMaxSeconds,
      };

      return {
        ...enrichedItem,
        relevanceScore: this.computeRelevanceScore(query, enrichedItem, index),
        preferredBoostApplied: false,
      };
    });
  }

  private get environment(): string {
    return this.configService.get<string>('NODE_ENV') ?? 'development';
  }

  private computeRelevanceScore(
    query: string,
    item: YoutubeSearchResult,
    rankIndex: number,
  ): number {
    const normalizedQuery = this.normalizeText(query);
    const normalizedTitle = this.normalizeText(item.title);
    const normalizedDescription = this.normalizeText(item.description);
    const queryTokens = this.tokenize(normalizedQuery);

    let score = 0;

    if (!normalizedQuery) {
      return score;
    }

    if (normalizedTitle === normalizedQuery) {
      score += 160;
    } else if (normalizedTitle.includes(normalizedQuery)) {
      score += 120;
    }

    if (normalizedTitle.startsWith(normalizedQuery)) {
      score += 40;
    }

    if (normalizedDescription.includes(normalizedQuery)) {
      score += 25;
    }

    const titleTokens = new Set(this.tokenize(normalizedTitle));
    const descriptionTokens = new Set(this.tokenize(normalizedDescription));

    for (const token of queryTokens) {
      if (titleTokens.has(token)) {
        score += 12;
      }

      if (descriptionTokens.has(token)) {
        score += 4;
      }
    }

    // Keep an ordering signal from YouTube's relevance ranking per channel.
    score += Math.max(0, 30 - rankIndex * 2);

    return score;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(text: string): string[] {
    if (!text) {
      return [];
    }

    return text.split(' ').filter((token) => token.length > 1);
  }

  private async loadWhitelistEntries(): Promise<string[]> {
    const raw = await fs.readFile(this.whitelistPath, 'utf-8');

    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  }

  private async loadPreferredEntries(): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.preferredPath, 'utf-8');

      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'ENOENT'
      ) {
        return [];
      }

      throw error;
    }
  }

  private async resolveChannelIds(
    entries: string[],
    apiKey: string,
  ): Promise<string[]> {
    const resolved = await Promise.all(
      entries.map(async (entry) => {
        const normalized = entry.trim();

        if (/^UC[\w-]{20,}$/.test(normalized)) {
          return normalized;
        }

        const handle = normalized.replace(/^@/, '');
        return this.resolveChannelIdFromHandle(handle, apiKey);
      }),
    );

    return Array.from(
      new Set(resolved.filter((channelId): channelId is string => Boolean(channelId))),
    );
  }

  private async resolveChannelIdFromHandle(
    handle: string,
    apiKey: string,
  ): Promise<string | null> {
    if (!handle) {
      return null;
    }

    const cacheKey = handle.toLowerCase();
    const cached = this.channelIdCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'id');
    url.searchParams.set('forHandle', handle);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new BadGatewayException(
        `YouTube channel lookup failed (${response.status}): ${text}`,
      );
    }

    const payload = (await response.json()) as { items?: YoutubeChannelItem[] };
    const channelId = payload.items?.[0]?.id;

    if (!channelId) {
      return null;
    }

    this.channelIdCache.set(cacheKey, channelId);
    return channelId;
  }

  private get whitelistPath(): string {
    return (
      this.configService.get<string>('YOUTUBE_CHANNEL_WHITELIST_FILE') ??
      resolve(process.cwd(), 'data/raw/youtube-channel-whitelist.txt')
    );
  }

  private get preferredPath(): string {
    return (
      this.configService.get<string>('YOUTUBE_CHANNEL_PREFERRED_FILE') ??
      resolve(process.cwd(), 'data/raw/youtube-channel-preferred.txt')
    );
  }

  private get preferredChannelBonus(): number {
    const configuredRaw = this.configService.get<string>(
      'YOUTUBE_CHANNEL_PREFERRED_BONUS',
    );
    const configured = Number(configuredRaw);

    if (Number.isFinite(configured) && configured > 0) {
      return configured;
    }

    return 35;
  }

  private async fetchVideoDurations(
    videoIds: string[],
    apiKey: string,
  ): Promise<Map<string, string>> {
    if (!videoIds.length) {
      return new Map<string, string>();
    }

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails');
    url.searchParams.set('id', videoIds.join(','));
    url.searchParams.set('key', apiKey);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new BadGatewayException(
        `YouTube videos lookup failed (${response.status}): ${text}`,
      );
    }

    const payload = (await response.json()) as { items?: YoutubeVideoItem[] };
    const result = new Map<string, string>();

    for (const item of payload.items ?? []) {
      if (!item.id) {
        continue;
      }

      result.set(item.id, item.contentDetails?.duration ?? '');
    }

    return result;
  }

  private parseIso8601DurationToSeconds(duration: string): number {
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);

    if (!match) {
      return 0;
    }

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private formatDuration(totalSeconds: number): string {
    if (totalSeconds <= 0) {
      return '';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  private getShortsMaxSeconds(): number {
    const configuredRaw = this.configService.get<string>(
      'YOUTUBE_SHORTS_MAX_SECONDS',
    );
    const configured = Number(configuredRaw);

    if (Number.isFinite(configured) && configured > 0) {
      return configured;
    }

    return 60;
  }
}