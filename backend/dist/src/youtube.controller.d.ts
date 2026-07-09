import { YoutubeService } from './youtube.service';
import type { YoutubeSearchResult } from './youtube.service';
declare class YoutubeSearchQueryDto {
    q: string;
    maxResults?: number;
    debug?: boolean;
    forceRefresh?: boolean;
}
declare class YoutubeSearchOverrideDto {
    query: string;
    videoId: string;
    item: YoutubeSearchResult;
    startTimestamp?: string | null;
    keepOnRefresh?: boolean;
}
export declare class YoutubeController {
    private readonly youtubeService;
    constructor(youtubeService: YoutubeService);
    search(query: YoutubeSearchQueryDto): Promise<import("./youtube.service").YoutubeSearchResponse>;
    saveSearchOverride(body: YoutubeSearchOverrideDto): Promise<YoutubeSearchResult>;
}
export {};
