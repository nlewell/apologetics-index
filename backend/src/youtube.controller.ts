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

  @Get('search')
  search(@Query() query: YoutubeSearchQueryDto) {
    return this.youtubeService.search(
      query.q,
      query.maxResults ?? 5,
      query.debug ?? false,
      query.forceRefresh ?? false,
    );
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