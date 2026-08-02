import { YoutubeService } from './youtube.service';
import type { YoutubeSearchResult } from './youtube.service';
declare class YoutubeSearchQueryDto {
    q: string;
    maxResults?: number;
    debug?: boolean;
    forceRefresh?: boolean;
}
declare class YoutubeRecentQueriesDto {
    limit?: number;
}
declare class YoutubeCommentsAnalysisQueryDto {
    videoId: string;
    authorChannelId?: string;
    maxComments?: number;
    generateIfMissing?: boolean;
    forceRefresh?: boolean;
}
declare class PrecacheTopMatchCommentsDto {
    query: string;
    maxResults?: number;
    maxComments?: number;
}
declare class YoutubeOfficialAnswerQueryDto {
    videoId: string;
    topicQuery: string;
    generateIfMissing?: boolean;
    forceRefresh?: boolean;
}
declare class PrecacheTopMatchOfficialAnswersDto {
    query: string;
    maxResults?: number;
}
declare class YoutubeQueryInsightQueryDto {
    topicQuery: string;
    generateIfMissing?: boolean;
    forceRefresh?: boolean;
}
declare class PrecacheQueryInsightDto {
    query: string;
}
declare class YoutubeChannelCommentsSummaryQueryDto {
    channelId: string;
    topicQuery: string;
    maxVideos?: number;
    maxCommentsPerVideo?: number;
}
declare class YoutubeSearchOverrideDto {
    query: string;
    videoId: string;
    item: YoutubeSearchResult;
    startTimestamp?: string | null;
    keepOnRefresh?: boolean;
}
declare class AddYoutubeWhitelistEntryDto {
    entry: string;
}
declare class UpdateYoutubeWhitelistEntryDto {
    isEnabled: boolean;
}
declare class UpdateAllYoutubeWhitelistEntriesDto {
    isEnabled: boolean;
}
export declare class YoutubeController {
    private readonly youtubeService;
    constructor(youtubeService: YoutubeService);
    listRecentQueries(query: YoutubeRecentQueriesDto): Promise<import("./youtube.service").YoutubeRecentQueriesResponse>;
    search(query: YoutubeSearchQueryDto): Promise<import("./youtube.service").YoutubeSearchResponse>;
    commentsAnalysis(query: YoutubeCommentsAnalysisQueryDto): Promise<import("./youtube.service").YoutubeCommentsAnalysisResponse>;
    precacheTopMatchComments(body: PrecacheTopMatchCommentsDto): Promise<import("./youtube.service").YoutubePrecacheTopMatchCommentsResponse>;
    officialAnswer(query: YoutubeOfficialAnswerQueryDto): Promise<import("./youtube.service").YoutubeOfficialAnswerResponse>;
    precacheTopMatchOfficialAnswers(body: PrecacheTopMatchOfficialAnswersDto): Promise<import("./youtube.service").YoutubePrecacheTopMatchOfficialAnswersResponse>;
    queryAnswer(query: YoutubeQueryInsightQueryDto): Promise<import("./youtube.service").YoutubeQueryInsightResponse>;
    precacheQueryAnswer(body: PrecacheQueryInsightDto): Promise<import("./youtube.service").YoutubePrecacheQueryInsightResponse>;
    channelCommentsSummary(query: YoutubeChannelCommentsSummaryQueryDto): Promise<import("./youtube.service").YoutubeChannelCommentsSummaryResponse>;
    saveSearchOverride(body: YoutubeSearchOverrideDto): Promise<YoutubeSearchResult>;
    listWhitelistEntries(): Promise<import("./youtube.service").YoutubeWhitelistEntry[]>;
    addWhitelistEntry(body: AddYoutubeWhitelistEntryDto): Promise<import("./youtube.service").YoutubeWhitelistEntry>;
    updateWhitelistEntry(id: number, body: UpdateYoutubeWhitelistEntryDto): Promise<import("./youtube.service").YoutubeWhitelistEntry>;
    updateAllWhitelistEntries(body: UpdateAllYoutubeWhitelistEntriesDto): Promise<{
        updated: number;
    }>;
}
export {};
