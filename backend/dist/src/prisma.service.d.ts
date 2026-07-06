import { OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
export type YoutubeSearchCacheItem = {
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
export declare class PrismaService extends PrismaClient implements OnModuleDestroy {
    onModuleDestroy(): Promise<void>;
}
