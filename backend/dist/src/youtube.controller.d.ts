import { YoutubeService } from './youtube.service';
declare class YoutubeSearchQueryDto {
    q: string;
    maxResults?: number;
    debug?: boolean;
}
export declare class YoutubeController {
    private readonly youtubeService;
    constructor(youtubeService: YoutubeService);
    search(query: YoutubeSearchQueryDto): Promise<import("./youtube.service").YoutubeSearchResponse>;
}
export {};
