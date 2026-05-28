import { ContentVersionService } from './content-version.service';
export declare class ContentVersionController {
    private readonly contentVersionService;
    constructor(contentVersionService: ContentVersionService);
    getVersion(): Promise<{
        version: string;
        totalItems: number;
        lastUpdatedAt: string | null;
    }>;
}
