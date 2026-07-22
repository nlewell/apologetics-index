import { ContentSpreadsheetService } from './content-spreadsheet.service';
declare class ImportSpreadsheetDto {
    csv: string;
}
export declare class ContentSpreadsheetController {
    private readonly contentSpreadsheetService;
    constructor(contentSpreadsheetService: ContentSpreadsheetService);
    export(): Promise<{
        filename: string;
        generatedAt: string;
        rowCount: number;
        csv: string;
    }>;
    import(body: ImportSpreadsheetDto): Promise<{
        generatedAt: string;
        rowsRead: number;
        indexItemsCreated: number;
        indexItemsUpdated: number;
        pinnedRowsReplaced: number;
        pinnedRowsImported: number;
        metadataHydrated: number;
    }>;
}
export {};
