import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { ContentSpreadsheetService } from './content-spreadsheet.service';

class ImportSpreadsheetDto {
  @IsString()
  csv!: string;
}

@Controller('content-spreadsheet')
export class ContentSpreadsheetController {
  constructor(private readonly contentSpreadsheetService: ContentSpreadsheetService) {}

  @Get('export')
  export() {
    return this.contentSpreadsheetService.exportCsv();
  }

  @Post('import')
  import(@Body() body: ImportSpreadsheetDto) {
    return this.contentSpreadsheetService.importCsv(body.csv);
  }
}