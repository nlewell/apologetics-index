import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
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
export declare class YoutubeService {
    private readonly configService;
    private readonly prismaService;
    private readonly memoryChannelIdCache;
    private readonly shortsMaxSeconds;
    private readonly cacheTtlMs;
    constructor(configService: ConfigService, prismaService: PrismaService);
    listWhitelistEntries(): Promise<YoutubeWhitelistEntry[]>;
    addWhitelistEntry(entry: string): Promise<YoutubeWhitelistEntry>;
    updateAllWhitelistEntries(isEnabled: boolean): Promise<{
        updated: number;
    }>;
    updateWhitelistEntry(id: number, isEnabled: boolean): Promise<YoutubeWhitelistEntry>;
    search(query: string, maxResults?: number, debug?: boolean, forceRefresh?: boolean): Promise<YoutubeSearchResponse>;
    private getCachedSearchResponse;
    private saveSearchResponse;
    private saveVideoIndex;
    saveSearchOverride(input: {
        query: string;
        videoId: string;
        item: YoutubeSearchResult;
        startTimestamp: string | null;
        keepOnRefresh: boolean;
    }): Promise<YoutubeSearchResult>;
    private searchWithinChannel;
    private getCachedChannelSearch;
    private saveChannelSearch;
    private applySearchOverrides;
    private loadPreservedOverrideItems;
    private overrideRowToSearchResult;
    private applyOverrideToItem;
    private applyStartTimestampToItem;
    private parseCachedSearchItems;
    private coerceSearchResult;
    private coerceScoredSearchResult;
    private normalizeQueryKey;
    private parseStartTimestampToSeconds;
    private appendStartSeconds;
    private get environment();
    private computeRelevanceScore;
    private normalizeText;
    private tokenize;
    private loadWhitelistEntries;
    private ensureWhitelistSeededFromFile;
    private readWhitelistEntriesFromFile;
    private normalizeWhitelistEntry;
    private loadPreferredEntries;
    private resolveChannelIds;
    private resolveChannelIdFromHandle;
    private get whitelistPath();
    private get preferredPath();
    private get preferredChannelBonus();
    private fetchVideoDurations;
    private parseIso8601DurationToSeconds;
    private formatDuration;
    private getShortsMaxSeconds;
}
