"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma.service");
const index_items_controller_1 = require("./index-items.controller");
const index_items_service_1 = require("./index-items.service");
const content_version_controller_1 = require("./content-version.controller");
const content_version_service_1 = require("./content-version.service");
const api_key_guard_1 = require("./api-key.guard");
const youtube_controller_1 = require("./youtube.controller");
const youtube_service_1 = require("./youtube.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forRoot({ isGlobal: true })],
        controllers: [
            app_controller_1.AppController,
            index_items_controller_1.IndexItemsController,
            content_version_controller_1.ContentVersionController,
            youtube_controller_1.YoutubeController,
        ],
        providers: [
            app_service_1.AppService,
            prisma_service_1.PrismaService,
            index_items_service_1.IndexItemsService,
            content_version_service_1.ContentVersionService,
            youtube_service_1.YoutubeService,
            {
                provide: core_1.APP_GUARD,
                useClass: api_key_guard_1.ApiKeyGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map