import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Controller, Get, Query } from '@nestjs/common';
import { IndexItemsService } from './index-items.service';

class ListIndexItemsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  generalTopic?: string;

  @IsOptional()
  @IsString()
  subtopic?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

@Controller('index-items')
export class IndexItemsController {
  constructor(private readonly indexItemsService: IndexItemsService) {}

  @Get('topics')
  listTopics() {
    return this.indexItemsService.listTopicCounts();
  }

  @Get()
  list(@Query() query: ListIndexItemsQueryDto) {
    return this.indexItemsService.list({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      generalTopic: query.generalTopic,
      subtopic: query.subtopic,
      q: query.q,
    });
  }
}
