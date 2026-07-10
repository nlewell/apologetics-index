import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from './prisma.service';

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
  startTimestamp: string | null;
  keepOnRefresh: boolean;
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

export type YoutubeWhitelistEntry = {
  id: number;
  entry: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ScoredYoutubeSearchResult = YoutubeSearchResult & {
  relevanceScore: number;
  preferredBoostApplied: boolean;
};

@Injectable()
export class YoutubeService {
  private readonly memoryChannelIdCache = new Map<string, string>();

  private readonly shortsMaxSeconds: number;

  // Cache for 7 days to reduce quota usage significantly
  private readonly cacheTtlMs = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    this.shortsMaxSeconds = this.getShortsMaxSeconds();
  }

  async listWhitelistEntries(): Promise<YoutubeWhitelistEntry[]> {
    await this.ensureWhitelistSeededFromFile();

    const rows = await this.prismaService.youtubeChannelWhitelistEntry.findMany({
      orderBy: [{ isEnabled: 'desc' }, { identifier: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      entry: row.identifier,
      isEnabled: row.isEnabled,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async addWhitelistEntry(entry: string): Promise<YoutubeWhitelistEntry> {
    const normalized = this.normalizeWhitelistEntry(entry);

    if (!normalized) {
      throw new BadRequestException('Entry must be a channel ID or handle.');
    }

    const existing = await this.prismaService.youtubeChannelWhitelistEntry.findUnique({
      where: { identifier: normalized },
    });

    if (existing) {
      throw new BadRequestException('Channel is already in the whitelist.');
    }

    const row = await this.prismaService.youtubeChannelWhitelistEntry.create({
      data: { identifier: normalized, isEnabled: true },
    });

    return {
      id: row.id,
      entry: row.identifier,
      isEnabled: row.isEnabled,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateAllWhitelistEntries(isEnabled: boolean): Promise<{ updated: number }> {
    const result = await this.prismaService.youtubeChannelWhitelistEntry.updateMany({
      data: { isEnabled },
    });

    return { updated: result.count };
  }

  async updateWhitelistEntry(
    id: number,
    isEnabled: boolean,
  ): Promise<YoutubeWhitelistEntry> {
    try {
      const row = await this.prismaService.youtubeChannelWhitelistEntry.update({
        where: { id },
        data: { isEnabled },
      });

      return {
        id: row.id,
        entry: row.identifier,
        isEnabled: row.isEnabled,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        throw new NotFoundException('Whitelist entry not found.');
      }

      throw error;
    }
  }

  async search(
    query: string,
    maxResults = 5,
    debug = false,
    forceRefresh = false,
  ): Promise<YoutubeSearchResponse> {
    const normalizedQuery = query.trim();
    const cacheKey = this.normalizeQueryKey(query);

    if (!normalizedQuery) {
      return {
        query: normalizedQuery,
        maxResults,
        whitelist: {
          sourceFile: this.whitelistPath,
          configuredEntries: [],
          resolvedChannelIds: [],
        },
        items: [],
      };
    }

    const cachedResponse = forceRefresh
      ? null
      : await this.getCachedSearchResponse(cacheKey);
    if (cachedResponse) {
      const cachedItems = await this.applySearchOverrides(
        cacheKey,
        cachedResponse.items,
        forceRefresh,
      );
      return {
        ...cachedResponse,
        maxResults,
        items: cachedItems,
      };
    }

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
        this.searchWithinChannel(
          query,
          cacheKey,
          channelId,
          perChannelMaxResults,
          apiKey,
        ),
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

    const itemsWithMetadata = await this.applySearchOverrides(cacheKey, items, forceRefresh);

    const isDebugEnabled = debug && this.environment !== 'production';

    const response: YoutubeSearchResponse = {
      query: normalizedQuery,
      maxResults,
      whitelist: {
        sourceFile: this.whitelistPath,
        configuredEntries: whitelist,
        resolvedChannelIds,
      },
      items: itemsWithMetadata,
    };

    await this.saveSearchResponse(cacheKey, response);

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

  private async getCachedSearchResponse(
    cacheKey: string,
  ): Promise<YoutubeSearchResponse | null> {
    const cachedEntry = await this.prismaService.youtubeVideoIndex.findFirst({
      where: { query: cacheKey },
    });

    if (!cachedEntry) {
      const legacyEntry = await this.prismaService.youtubeSearchCache.findFirst({
        where: { query: cacheKey },
      });

      if (!legacyEntry) {
        return null;
      }

      const legacyItems = this.parseCachedSearchItems(legacyEntry.items);

      if (!legacyItems.length) {
        return null;
      }

      await this.saveVideoIndex(cacheKey, legacyItems).catch(() => {
        // Best-effort migration from the legacy local cache.
      });

      return {
        query: legacyEntry.query,
        maxResults: legacyItems.length,
        whitelist: {
          sourceFile: this.whitelistPath,
          configuredEntries: [],
          resolvedChannelIds: [],
        },
        items: legacyItems,
      };
    }

    const parsedItems = this.parseCachedSearchItems(cachedEntry.items);

    if (!parsedItems.length) {
      return null;
    }

    return {
      query: cachedEntry.query,
      maxResults: parsedItems.length,
      whitelist: {
        sourceFile: this.whitelistPath,
        configuredEntries: [],
        resolvedChannelIds: [],
      },
      items: parsedItems,
    };
  }

  private async saveSearchResponse(
    cacheKey: string,
    response: YoutubeSearchResponse,
  ): Promise<void> {
    await this.saveVideoIndex(cacheKey, response.items.slice(0, 25));
  }

  private async saveVideoIndex(
    cacheKey: string,
    items: YoutubeSearchResult[],
  ): Promise<void> {
    const normalizedItems = items
      .map((item) => this.coerceSearchResult(item))
      .filter((item): item is YoutubeSearchResult => item !== null);

    if (!normalizedItems.length) {
      return;
    }

    const itemsToStore = normalizedItems.map((item) => ({
      videoId: item.videoId,
      title: item.title,
      description: item.description,
      channelTitle: item.channelTitle,
      channelId: item.channelId,
      publishedAt: item.publishedAt,
      thumbnailUrl: item.thumbnailUrl,
      videoUrl: item.videoUrl,
      duration: item.duration,
      durationSeconds: item.durationSeconds,
      isShort: item.isShort,
      startTimestamp: item.startTimestamp,
      keepOnRefresh: item.keepOnRefresh,
    }));

    await this.prismaService.youtubeVideoIndex.upsert({
      where: { query: cacheKey },
      update: {
        items: itemsToStore,
        refreshedAt: new Date(),
      },
      create: {
        query: cacheKey,
        items: itemsToStore,
        refreshedAt: new Date(),
      },
    });
  }

  async saveSearchOverride(input: {
    query: string;
    videoId: string;
    item: YoutubeSearchResult;
    startTimestamp: string | null;
    keepOnRefresh: boolean;
  }): Promise<YoutubeSearchResult> {
    const cacheKey = this.normalizeQueryKey(input.query);
    const mergedItem = this.applyOverrideToItem(input.item, {
      startTimestamp: input.startTimestamp,
      keepOnRefresh: input.keepOnRefresh,
    });

    await this.prismaService.youtubeVideoMetadata.upsert({
      where: {
        query_videoId: {
          query: cacheKey,
          videoId: input.videoId,
        },
      },
      update: {
        item: input.item,
        startTimestamp: input.startTimestamp,
        keepOnRefresh: input.keepOnRefresh,
      },
      create: {
        query: cacheKey,
        videoId: input.videoId,
        item: input.item,
        startTimestamp: input.startTimestamp,
        keepOnRefresh: input.keepOnRefresh,
      },
    });

    return mergedItem;
  }

  private async searchWithinChannel(
    query: string,
    cacheKey: string,
    channelId: string,
    maxResults: number,
    apiKey: string,
  ): Promise<ScoredYoutubeSearchResult[]> {
    // Check per-channel cache first - this avoids API calls for repeated searches
    const cachedChannelSearch = await this.getCachedChannelSearch(cacheKey, channelId);
    if (cachedChannelSearch.length > 0) {
      return cachedChannelSearch;
    }

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
          startTimestamp: null,
          keepOnRefresh: false,
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

    const scoredResults = mappedItems.map((item, index) => {
      const durationRaw = durationByVideoId.get(item.videoId) ?? '';
      const durationSeconds = this.parseIso8601DurationToSeconds(durationRaw);
      const enrichedItem = {
        ...item,
        duration: this.formatDuration(durationSeconds),
        durationSeconds,
        isShort: durationSeconds > 0 && durationSeconds <= this.shortsMaxSeconds,
        startTimestamp: item.startTimestamp ?? null,
        keepOnRefresh: item.keepOnRefresh ?? false,
      };

      return {
        ...enrichedItem,
        relevanceScore: this.computeRelevanceScore(query, enrichedItem, index),
        preferredBoostApplied: false,
      };
    });

    // Cache per-channel results to avoid re-fetching on subsequent searches
    await this.saveChannelSearch(cacheKey, channelId, scoredResults).catch(err => {
      console.warn(`Failed to cache channel search for query "${query}" in channel ${channelId}:`, err);
    });

    return scoredResults;
  }

  private async getCachedChannelSearch(
    cacheKey: string,
    channelId: string,
  ): Promise<ScoredYoutubeSearchResult[]> {
    try {
      const cached = await this.prismaService.youtubeChannelSearchCache.findUnique({
        where: {
          query_channelId: { query: cacheKey, channelId },
        },
      });

      if (!cached) {
        return [];
      }

      if (!Array.isArray(cached.items)) {
        return [];
      }

      return cached.items
        .map((item) => this.coerceScoredSearchResult(item))
        .filter((item): item is ScoredYoutubeSearchResult => item !== null);
    } catch (error) {
      // Silently fail cache lookups - they're optional optimizations
      return [];
    }
  }

  private async saveChannelSearch(
    cacheKey: string,
    channelId: string,
    items: ScoredYoutubeSearchResult[],
  ): Promise<void> {
    try {
      const validItems = items
        .map((item) => this.coerceScoredSearchResult(item))
        .filter((item): item is ScoredYoutubeSearchResult => item !== null);

      if (!validItems.length) {
        return;
      }

      await this.prismaService.youtubeChannelSearchCache.upsert({
        where: {
          query_channelId: { query: cacheKey, channelId },
        },
        update: {
          items: validItems,
          updatedAt: new Date(),
        },
        create: {
          query: cacheKey,
          channelId,
          items: validItems,
        },
      });
    } catch (error) {
      // Silently fail - cache writes are optional
    }
  }

  private async applySearchOverrides(
    cacheKey: string,
    items: YoutubeSearchResult[],
    forceRefresh: boolean,
  ): Promise<YoutubeSearchResult[]> {
    if (!items.length) {
      return this.loadPreservedOverrideItems(cacheKey, [], forceRefresh);
    }

    const videoIds = items.map((item) => item.videoId);
    const overrideRows = await this.prismaService.youtubeVideoMetadata.findMany({
      where: {
        query: cacheKey,
        videoId: { in: videoIds },
      },
    });

    const overridesByVideoId = new Map(
      overrideRows.map((row) => [row.videoId, row]),
    );

    const mergedItems = items.map((item) => {
      const override = overridesByVideoId.get(item.videoId);

      if (!override) {
        return {
          ...item,
          startTimestamp: item.startTimestamp ?? null,
          keepOnRefresh: item.keepOnRefresh ?? false,
        };
      }

      return this.applyOverrideToItem(item, {
        startTimestamp: override.startTimestamp ?? null,
        keepOnRefresh: override.keepOnRefresh,
      });
    });

    return this.loadPreservedOverrideItems(cacheKey, mergedItems, forceRefresh);
  }

  private async loadPreservedOverrideItems(
    cacheKey: string,
    items: YoutubeSearchResult[],
    forceRefresh: boolean,
  ): Promise<YoutubeSearchResult[]> {
    const overrideRows = await this.prismaService.youtubeVideoMetadata.findMany({
      where: {
        query: cacheKey,
        keepOnRefresh: true,
      },
    });

    if (!overrideRows.length) {
      return items;
    }

    const seenVideoIds = new Set(items.map((item) => item.videoId));
    const preservedItems = overrideRows
      .filter((row) => forceRefresh || !seenVideoIds.has(row.videoId))
      .map((row) => this.overrideRowToSearchResult(row));

    if (!preservedItems.length) {
      return items;
    }

    return [...items, ...preservedItems.filter((item) => !seenVideoIds.has(item.videoId))];
  }

  private overrideRowToSearchResult(row: {
    item: unknown;
    startTimestamp: string | null;
    keepOnRefresh: boolean;
  }): YoutubeSearchResult {
    const snapshot = row.item as Partial<YoutubeSearchResult>;
    const item: YoutubeSearchResult = {
      videoId: snapshot.videoId ?? '',
      title: snapshot.title ?? '',
      description: snapshot.description ?? '',
      channelTitle: snapshot.channelTitle ?? '',
      channelId: snapshot.channelId ?? '',
      publishedAt: snapshot.publishedAt ?? '',
      thumbnailUrl: snapshot.thumbnailUrl ?? null,
      videoUrl: snapshot.videoUrl ?? '',
      duration: snapshot.duration ?? '',
      durationSeconds: snapshot.durationSeconds ?? 0,
      isShort: snapshot.isShort ?? false,
      startTimestamp: row.startTimestamp ?? null,
      keepOnRefresh: row.keepOnRefresh,
    };

    return this.applyStartTimestampToItem(item);
  }

  private applyOverrideToItem(
    item: YoutubeSearchResult,
    override: { startTimestamp: string | null; keepOnRefresh: boolean },
  ): YoutubeSearchResult {
    const merged: YoutubeSearchResult = {
      ...item,
      startTimestamp: override.startTimestamp,
      keepOnRefresh: override.keepOnRefresh,
    };

    return this.applyStartTimestampToItem(merged);
  }

  private applyStartTimestampToItem(item: YoutubeSearchResult): YoutubeSearchResult {
    if (!item.startTimestamp) {
      return item;
    }

    const startSeconds = this.parseStartTimestampToSeconds(item.startTimestamp);
    if (startSeconds === null) {
      return item;
    }

    return {
      ...item,
      videoUrl: this.appendStartSeconds(item.videoUrl, startSeconds),
    };
  }

  private parseCachedSearchItems(items: unknown): YoutubeSearchResult[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .map((item) => this.coerceSearchResult(item))
      .filter((item): item is YoutubeSearchResult => item !== null);
  }

  private coerceSearchResult(item: unknown): YoutubeSearchResult | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const row = item as Partial<YoutubeSearchResult>;
    if (!row.videoId || !row.title || !row.channelId) {
      return null;
    }

    const normalized: YoutubeSearchResult = {
      videoId: row.videoId,
      title: row.title,
      description: row.description ?? '',
      channelTitle: row.channelTitle ?? '',
      channelId: row.channelId,
      publishedAt: row.publishedAt ?? '',
      thumbnailUrl: row.thumbnailUrl ?? null,
      videoUrl: row.videoUrl ?? `https://www.youtube.com/watch?v=${row.videoId}`,
      duration: row.duration ?? '',
      durationSeconds: Number(row.durationSeconds ?? 0),
      isShort: Boolean(row.isShort ?? false),
      startTimestamp: row.startTimestamp ?? null,
      keepOnRefresh: Boolean(row.keepOnRefresh ?? false),
    };

    return this.applyStartTimestampToItem(normalized);
  }

  private coerceScoredSearchResult(item: unknown): ScoredYoutubeSearchResult | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const base = this.coerceSearchResult(item);
    if (!base) {
      return null;
    }

    const scoredItem = item as Partial<ScoredYoutubeSearchResult>;
    return {
      ...base,
      relevanceScore: Number(scoredItem.relevanceScore ?? 0),
      preferredBoostApplied: Boolean(scoredItem.preferredBoostApplied ?? false),
    };
  }

  private normalizeQueryKey(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private parseStartTimestampToSeconds(startTimestamp: string): number | null {
    const trimmed = startTimestamp.trim();

    if (!trimmed) {
      return null;
    }

    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }

    const parts = trimmed.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) {
      return null;
    }

    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return minutes * 60 + seconds;
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return hours * 3600 + minutes * 60 + seconds;
    }

    return null;
  }

  private appendStartSeconds(videoUrl: string, startSeconds: number): string {
    const url = new URL(videoUrl);
    url.searchParams.set('t', String(startSeconds));
    return url.toString();
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
    await this.ensureWhitelistSeededFromFile();

    const rows = await this.prismaService.youtubeChannelWhitelistEntry.findMany({
      where: { isEnabled: true },
      orderBy: { identifier: 'asc' },
    });

    return rows.map((row) => row.identifier);
  }

  private async ensureWhitelistSeededFromFile(): Promise<void> {
    const existingCount = await this.prismaService.youtubeChannelWhitelistEntry.count();

    if (existingCount > 0) {
      return;
    }

    const fallbackEntries = await this.readWhitelistEntriesFromFile();

    if (!fallbackEntries.length) {
      return;
    }

    await this.prismaService.youtubeChannelWhitelistEntry.createMany({
      data: fallbackEntries.map((entry) => ({
        identifier: entry,
        isEnabled: true,
      })),
      skipDuplicates: true,
    });
  }

  private async readWhitelistEntriesFromFile(): Promise<string[]> {
    const raw = await fs.readFile(this.whitelistPath, 'utf-8');

    return raw
      .split(/\r?\n/)
      .map((line) => this.normalizeWhitelistEntry(line))
      .filter((line): line is string => Boolean(line));
  }

  private normalizeWhitelistEntry(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      return null;
    }

    if (/^UC[\w-]{20,}$/.test(trimmed)) {
      return trimmed;
    }

    const handle = trimmed.replace(/^@/, '').trim().toLowerCase();

    if (!handle) {
      return null;
    }

    return `@${handle}`;
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

    // Check in-memory cache first
    const memoryCached = this.memoryChannelIdCache.get(cacheKey);
    if (memoryCached) {
      return memoryCached;
    }

    // Check database cache (persists across service restarts)
    const dbCached = await this.prismaService.youtubeChannelCache.findUnique({
      where: { handle: cacheKey },
    });

    if (dbCached) {
      // Restore to memory cache for faster access
      this.memoryChannelIdCache.set(cacheKey, dbCached.channelId);
      return dbCached.channelId;
    }

    // Cache miss - call YouTube API
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

    // Cache in both memory and database
    this.memoryChannelIdCache.set(cacheKey, channelId);
    await this.prismaService.youtubeChannelCache.upsert({
      where: { handle: cacheKey },
      update: { channelId },
      create: { handle: cacheKey, channelId },
    }).catch(err => {
      // Log but don't fail if cache write fails
      console.warn(`Failed to cache channel ID for ${handle}:`, err);
    });

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