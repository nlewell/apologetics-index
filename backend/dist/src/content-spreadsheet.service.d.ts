import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
type ExportResponse = {
    filename: string;
    generatedAt: string;
    rowCount: number;
    csv: string;
};
type ImportResponse = {
    generatedAt: string;
    rowsRead: number;
    indexItemsCreated: number;
    indexItemsUpdated: number;
    pinnedRowsReplaced: number;
    pinnedRowsImported: number;
    metadataHydrated: number;
};
export declare class ContentSpreadsheetService {
    private readonly prisma;
    private readonly configService;
    constructor(prisma: PrismaService, configService: ConfigService);
    exportCsv(): Promise<ExportResponse>;
    importCsv(csv: string): Promise<ImportResponse>;
    private buildExportRow;
    private normalizeImportRow;
    private rowToYoutubeSearchResult;
    private coerceYoutubeSearchResult;
    private stringifyCsv;
    private escapeCsvValue;
    private buildTopicPathQuery;
    private buildGroupKey;
    private normalizeQueryKey;
    private decodeHtmlEntities;
    private extractVideoId;
    private fetchVideoMetadataById;
    private parseIso8601DurationToSeconds;
    private formatDuration;
    private getErrorMessage;
    private timestampSlug;
}
export {};
