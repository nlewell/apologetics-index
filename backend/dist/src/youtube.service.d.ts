import { ConfigService } from '@nestjs/config';
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
export declare class YoutubeService {
    private readonly configService;
    private readonly channelIdCache;
    private readonly shortsMaxSeconds;
    constructor(configService: ConfigService);
    search(query: string, maxResults?: number, debug?: boolean): Promise<YoutubeSearchResponse>;
    private searchWithinChannel;
    private get environment();
    private computeRelevanceScore;
    private normalizeText;
    private tokenize;
    private loadWhitelistEntries;
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
