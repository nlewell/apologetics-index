"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
let ApiKeyGuard = class ApiKeyGuard {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        if (request.method === 'OPTIONS') {
            return true;
        }
        const expectedApiKey = this.configService.get('API_KEY');
        const providedApiKey = request.headers['x-api-key'];
        if (!expectedApiKey || typeof providedApiKey !== 'string') {
            throw new common_1.UnauthorizedException('Missing API key');
        }
        const expectedBuffer = Buffer.from(expectedApiKey);
        const providedBuffer = Buffer.from(providedApiKey);
        if (expectedBuffer.length !== providedBuffer.length ||
            !(0, crypto_1.timingSafeEqual)(expectedBuffer, providedBuffer)) {
            throw new common_1.UnauthorizedException('Invalid API key');
        }
        return true;
    }
};
exports.ApiKeyGuard = ApiKeyGuard;
exports.ApiKeyGuard = ApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ApiKeyGuard);
//# sourceMappingURL=api-key.guard.js.map