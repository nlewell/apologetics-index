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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexItemsController = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const common_1 = require("@nestjs/common");
const index_items_service_1 = require("./index-items.service");
class ListIndexItemsQueryDto {
    page;
    limit;
    generalTopic;
    subtopic;
    q;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListIndexItemsQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ListIndexItemsQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListIndexItemsQueryDto.prototype, "generalTopic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListIndexItemsQueryDto.prototype, "subtopic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListIndexItemsQueryDto.prototype, "q", void 0);
let IndexItemsController = class IndexItemsController {
    indexItemsService;
    constructor(indexItemsService) {
        this.indexItemsService = indexItemsService;
    }
    listTopics() {
        return this.indexItemsService.listTopicCounts();
    }
    list(query) {
        return this.indexItemsService.list({
            page: query.page ?? 1,
            limit: query.limit ?? 20,
            generalTopic: query.generalTopic,
            subtopic: query.subtopic,
            q: query.q,
        });
    }
};
exports.IndexItemsController = IndexItemsController;
__decorate([
    (0, common_1.Get)('topics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], IndexItemsController.prototype, "listTopics", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ListIndexItemsQueryDto]),
    __metadata("design:returntype", void 0)
], IndexItemsController.prototype, "list", null);
exports.IndexItemsController = IndexItemsController = __decorate([
    (0, common_1.Controller)('index-items'),
    __metadata("design:paramtypes", [index_items_service_1.IndexItemsService])
], IndexItemsController);
//# sourceMappingURL=index-items.controller.js.map