import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { IndexItemsController } from './index-items.controller';
import { IndexItemsService } from './index-items.service';
import { ContentVersionController } from './content-version.controller';
import { ContentVersionService } from './content-version.service';
import { ContentSpreadsheetController } from './content-spreadsheet.controller';
import { ContentSpreadsheetService } from './content-spreadsheet.service';
import { ApiKeyGuard } from './api-key.guard';
import { YoutubeController } from './youtube.controller';
import { YoutubeService } from './youtube.service';
import { YoutubeIndexRefreshService } from './youtube-index-refresh.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    AppController,
    IndexItemsController,
    ContentVersionController,
    ContentSpreadsheetController,
    YoutubeController,
  ],
  providers: [
    AppService,
    PrismaService,
    IndexItemsService,
    ContentVersionService,
    ContentSpreadsheetService,
    YoutubeService,
    YoutubeIndexRefreshService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
