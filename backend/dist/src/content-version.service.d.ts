import { PrismaService } from './prisma.service';
export declare class ContentVersionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getContentVersion(): Promise<{
        version: string;
        totalItems: number;
        lastUpdatedAt: string | null;
    }>;
}
