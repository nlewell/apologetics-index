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
exports.ContentSpreadsheetController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const content_spreadsheet_service_1 = require("./content-spreadsheet.service");
class ImportSpreadsheetDto {
    csv;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportSpreadsheetDto.prototype, "csv", void 0);
let ContentSpreadsheetController = class ContentSpreadsheetController {
    contentSpreadsheetService;
    constructor(contentSpreadsheetService) {
        this.contentSpreadsheetService = contentSpreadsheetService;
    }
    export() {
        return this.contentSpreadsheetService.exportCsv();
    }
    import(body) {
        return this.contentSpreadsheetService.importCsv(body.csv);
    }
};
exports.ContentSpreadsheetController = ContentSpreadsheetController;
__decorate([
    (0, common_1.Get)('export'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContentSpreadsheetController.prototype, "export", null);
__decorate([
    (0, common_1.Post)('import'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ImportSpreadsheetDto]),
    __metadata("design:returntype", void 0)
], ContentSpreadsheetController.prototype, "import", null);
exports.ContentSpreadsheetController = ContentSpreadsheetController = __decorate([
    (0, common_1.Controller)('content-spreadsheet'),
    __metadata("design:paramtypes", [content_spreadsheet_service_1.ContentSpreadsheetService])
], ContentSpreadsheetController);
//# sourceMappingURL=content-spreadsheet.controller.js.map