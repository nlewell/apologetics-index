import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & {
      headers: Record<string, string | string[] | undefined>;
      method?: string;
    }>();

    if (request.method === 'OPTIONS') {
      return true;
    }

    const expectedApiKey = this.configService.get<string>('API_KEY');
    const providedApiKey = request.headers['x-api-key'];

    if (!expectedApiKey || typeof providedApiKey !== 'string') {
      throw new UnauthorizedException('Missing API key');
    }

    const expectedBuffer = Buffer.from(expectedApiKey);
    const providedBuffer = Buffer.from(providedApiKey);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}