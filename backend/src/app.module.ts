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
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController, IndexItemsController, ContentVersionController],
  providers: [
    AppService,
    PrismaService,
    IndexItemsService,
    ContentVersionService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
