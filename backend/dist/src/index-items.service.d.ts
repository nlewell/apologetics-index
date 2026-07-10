import { PrismaService } from './prisma.service';
export type ListIndexItemsInput = {
    page: number;
    limit: number;
    generalTopic?: string;
    subtopic?: string;
    q?: string;
};
export type UpdateIndexItemFieldsInput = {
    generalTopic?: string | null;
    subtopic?: string | null;
    charge?: string | null;
};
export type TopicWithSubtopics = {
    topic: string;
    charges: string[];
    subtopics: TopicWithCharges[];
};
export type TopicWithCharges = {
    subtopic: string;
    charges: string[];
};
export declare class IndexItemsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private normalizeNullableText;
    updateFields(id: number, input: UpdateIndexItemFieldsInput): Promise<{
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
    }>;
    listTopicsWithSubtopics(): Promise<TopicWithSubtopics[]>;
    listTopicCounts(): Promise<{
        topic: string;
        count: number;
    }[]>;
    list(input: ListIndexItemsInput): Promise<{
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
