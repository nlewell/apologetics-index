import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { YoutubeService } from './youtube.service';
import type { YoutubeSearchResult } from './youtube.service';

class YoutubeSearchQueryDto {
  @IsString()
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  maxResults?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  debug?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  forceRefresh?: boolean;
}

class YoutubeRecentQueriesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}

class YoutubeCommentsAnalysisQueryDto {
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @IsOptional()
  @IsString()
  authorChannelId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(250)
  maxComments?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  generateIfMissing?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  forceRefresh?: boolean;
}

class PrecacheTopMatchCommentsDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  maxResults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(250)
  maxComments?: number;
}

class YoutubeOfficialAnswerQueryDto {
  @IsString()
  @IsNotEmpty()
  videoId!: string;

  @IsString()
  @IsNotEmpty()
  topicQuery!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  generateIfMissing?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  forceRefresh?: boolean;
}

class PrecacheTopMatchOfficialAnswersDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  maxResults?: number;
}

class YoutubeQueryInsightQueryDto {
  @IsString()
  @IsNotEmpty()
  topicQuery!: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  generateIfMissing?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  forceRefresh?: boolean;
}

class PrecacheQueryInsightDto {
  @IsString()
  @IsNotEmpty()
  query!: string;
}

class YoutubeChannelCommentsSummaryQueryDto {
  @IsString()
  @IsNotEmpty()
  channelId!: string;

  @IsString()
  @IsNotEmpty()
  topicQuery!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  maxVideos?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(250)
  maxCommentsPerVideo?: number;
}

class YoutubeSearchOverrideDto {
  @IsString()
  query!: string;

  @IsString()
  videoId!: string;

  @IsObject()
  item!: YoutubeSearchResult;

  @IsOptional()
  @IsString()
  startTimestamp?: string | null;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  keepOnRefresh?: boolean;
}

class AddYoutubeWhitelistEntryDto {
  @IsString()
  @IsNotEmpty()
  entry!: string;
}

class UpdateYoutubeWhitelistEntryDto {
  @IsBoolean()
  isEnabled!: boolean;
}

class UpdateAllYoutubeWhitelistEntriesDto {
  @IsBoolean()
  isEnabled!: boolean;
}

@Controller('youtube')
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) {}

  @Get('recent-queries')
  listRecentQueries(@Query() query: YoutubeRecentQueriesDto) {
    return this.youtubeService.listRecentQueries(query.limit ?? 10);
  }

  @Get('search')
  search(@Query() query: YoutubeSearchQueryDto) {
    return this.youtubeService.search(
      query.q,
      query.maxResults ?? 5,
      query.debug ?? false,
      query.forceRefresh ?? false,
    );
  }

  @Get('comments-analysis')
  commentsAnalysis(@Query() query: YoutubeCommentsAnalysisQueryDto) {
    return this.youtubeService.getCommentsAnalysis({
      videoId: query.videoId,
      authorChannelId: query.authorChannelId,
      maxComments: query.maxComments ?? 120,
      generateIfMissing: query.generateIfMissing ?? true,
      forceRefresh: query.forceRefresh ?? false,
    });
  }

  @Post('comments-analysis/precache-top-matches')
  precacheTopMatchComments(@Body() body: PrecacheTopMatchCommentsDto) {
    return this.youtubeService.precacheTopMatchComments({
      query: body.query,
      maxResults: body.maxResults ?? 5,
      maxComments: body.maxComments ?? 120,
    });
  }

  @Get('official-answer')
  officialAnswer(@Query() query: YoutubeOfficialAnswerQueryDto) {
    return this.youtubeService.getOfficialChurchAnswer({
      videoId: query.videoId,
      topicQuery: query.topicQuery,
      generateIfMissing: query.generateIfMissing ?? true,
      forceRefresh: query.forceRefresh ?? false,
    });
  }

  @Post('official-answer/precache-top-matches')
  precacheTopMatchOfficialAnswers(@Body() body: PrecacheTopMatchOfficialAnswersDto) {
    return this.youtubeService.precacheTopMatchOfficialAnswers({
      query: body.query,
      maxResults: body.maxResults ?? 5,
    });
  }

  @Get('query-answer')
  queryAnswer(@Query() query: YoutubeQueryInsightQueryDto) {
    return this.youtubeService.getQueryInsight({
      topicQuery: query.topicQuery,
      generateIfMissing: query.generateIfMissing ?? true,
      forceRefresh: query.forceRefresh ?? false,
    });
  }

  @Post('query-answer/precache')
  precacheQueryAnswer(@Body() body: PrecacheQueryInsightDto) {
    return this.youtubeService.precacheQueryInsight({
      query: body.query,
    });
  }

  @Get('channel-comments-summary')
  channelCommentsSummary(@Query() query: YoutubeChannelCommentsSummaryQueryDto) {
    return this.youtubeService.getChannelCommentsSummary({
      channelId: query.channelId,
      topicQuery: query.topicQuery,
      maxVideos: query.maxVideos ?? 3,
      maxCommentsPerVideo: query.maxCommentsPerVideo ?? 100,
    });
  }

  @Put('search-overrides')
  saveSearchOverride(@Body() body: YoutubeSearchOverrideDto) {
    return this.youtubeService.saveSearchOverride({
      query: body.query,
      videoId: body.videoId,
      item: body.item,
      startTimestamp: body.startTimestamp ?? null,
      keepOnRefresh: body.keepOnRefresh ?? false,
    });
  }

  @Get('whitelist')
  listWhitelistEntries() {
    return this.youtubeService.listWhitelistEntries();
  }

  @Post('whitelist')
  addWhitelistEntry(@Body() body: AddYoutubeWhitelistEntryDto) {
    return this.youtubeService.addWhitelistEntry(body.entry);
  }

  @Put('whitelist/:id')
  updateWhitelistEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateYoutubeWhitelistEntryDto,
  ) {
    return this.youtubeService.updateWhitelistEntry(id, body.isEnabled);
  }

  @Put('whitelist')
  updateAllWhitelistEntries(@Body() body: UpdateAllYoutubeWhitelistEntriesDto) {
    return this.youtubeService.updateAllWhitelistEntries(body.isEnabled);
  }
}