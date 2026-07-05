import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Controller, Get, Query } from '@nestjs/common';
import { YoutubeService } from './youtube.service';

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
}

@Controller('youtube')
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) {}

  @Get('search')
  search(@Query() query: YoutubeSearchQueryDto) {
    return this.youtubeService.search(query.q, query.maxResults ?? 5, query.debug ?? false);
  }
}