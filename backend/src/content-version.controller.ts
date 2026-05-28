import { Controller, Get } from '@nestjs/common';
import { ContentVersionService } from './content-version.service';

@Controller('content-version')
export class ContentVersionController {
  constructor(private readonly contentVersionService: ContentVersionService) {}

  @Get()
  getVersion() {
    return this.contentVersionService.getContentVersion();
  }
}
