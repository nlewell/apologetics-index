"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const client_1 = require("@prisma/client");
const sync_1 = require("csv-parse/sync");
const prisma = new client_1.PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const csvPath = node_path_1.default.resolve(process.cwd(), 'data/raw/apologetic-index.csv');
function cleanValue(value) {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
}
function isValidUrl(value) {
    if (!value) {
        return true;
    }
    try {
        new URL(value);
        return true;
    }
    catch {
        return false;
    }
}
function rowToSourceKey(row) {
    const key = [
        row.generalTopic ?? '',
        row.subtopic ?? '',
        row.charge ?? '',
        row.shortResponseUrl ?? '',
        row.video1Length ?? '',
        row.video1Author ?? '',
        row.video1Timestamp ?? '',
    ]
        .join('|')
        .toLowerCase();
    return (0, node_crypto_1.createHash)('sha256').update(key).digest('hex');
}
function normalizeRow(row) {
    return {
        generalTopic: cleanValue(row['General Topic']),
        subtopic: cleanValue(row.Subtopic),
        charge: cleanValue(row.Charge),
        shortResponseUrl: cleanValue(row['Short response URL']),
        video1Length: cleanValue(row['Video 1 Length']),
        video1Author: cleanValue(row['Video 1 Author']),
        video1Timestamp: cleanValue(row['Video 1 timestamp where relevant answer appears in video']),
    };
}
function isCompletelyEmpty(row) {
    return (!row.generalTopic &&
        !row.subtopic &&
        !row.charge &&
        !row.shortResponseUrl &&
        !row.video1Length &&
        !row.video1Author &&
        !row.video1Timestamp);
}
async function main() {
    const csvRaw = await (0, promises_1.readFile)(csvPath, 'utf8');
    const parsedRows = (0, sync_1.parse)(csvRaw, {
        columns: true,
        skip_empty_lines: false,
        trim: true,
    });
    let skippedEmpty = 0;
    let skippedInvalid = 0;
    let imported = 0;
    for (const row of parsedRows) {
        const normalized = normalizeRow(row);
        if (isCompletelyEmpty(normalized)) {
            skippedEmpty += 1;
            continue;
        }
        if (!isValidUrl(normalized.shortResponseUrl)) {
            skippedInvalid += 1;
            continue;
        }
        const sourceKey = rowToSourceKey(normalized);
        if (!isDryRun) {
            await prisma.apologeticIndexItem.upsert({
                where: { sourceKey },
                update: {
                    generalTopic: normalized.generalTopic,
                    subtopic: normalized.subtopic,
                    charge: normalized.charge,
                    shortResponseUrl: normalized.shortResponseUrl,
                    video1Length: normalized.video1Length,
                    video1Author: normalized.video1Author,
                    video1Timestamp: normalized.video1Timestamp,
                },
                create: {
                    sourceKey,
                    generalTopic: normalized.generalTopic,
                    subtopic: normalized.subtopic,
                    charge: normalized.charge,
                    shortResponseUrl: normalized.shortResponseUrl,
                    video1Length: normalized.video1Length,
                    video1Author: normalized.video1Author,
                    video1Timestamp: normalized.video1Timestamp,
                },
            });
        }
        imported += 1;
    }
    console.log('Import complete');
    console.log(`CSV path: ${csvPath}`);
    console.log(`Dry run: ${isDryRun ? 'yes' : 'no'}`);
    console.log(`Imported rows: ${imported}`);
    console.log(`Skipped empty rows: ${skippedEmpty}`);
    console.log(`Skipped invalid URL rows: ${skippedInvalid}`);
}
main()
    .catch((error) => {
    if (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2021') {
        console.error('Database table not found. Run `npm run prisma:migrate:dev -- --name add_apologetic_index_item` first.');
    }
    else {
        console.error(error);
    }
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=import-apologetic-index.js.map