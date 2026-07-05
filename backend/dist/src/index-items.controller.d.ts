import { IndexItemsService } from './index-items.service';
declare class ListIndexItemsQueryDto {
    page?: number;
    limit?: number;
    generalTopic?: string;
    subtopic?: string;
    q?: string;
}
export declare class IndexItemsController {
    private readonly indexItemsService;
    constructor(indexItemsService: IndexItemsService);
    listTopics(): Promise<{
        topic: string;
        count: number;
    }[]>;
    listTopicsWithSubtopics(): Promise<import("./index-items.service").TopicWithSubtopics[]>;
    list(query: ListIndexItemsQueryDto): Promise<{
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        items: {
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
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
}
export {};
