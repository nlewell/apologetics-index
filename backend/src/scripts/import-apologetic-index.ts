import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';

type CsvRow = Record<string, string | undefined>;

type NormalizedRow = {
  generalTopic: string | null;
  subtopic: string | null;
  charge: string | null;
  shortResponseUrl: string | null;
  shortResponseLength: string | null;
  shortResponseAuthor: string | null;
  longResponseUrl: string | null;
  longResponseLength: string | null;
  debateUrl: string | null;
  articleUrl: string | null;
  video1Length: string | null;
  video1Author: string | null;
  video1Timestamp: string | null;
};

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const csvPath = path.resolve(process.cwd(), 'data/raw/apologetic-index.csv');

function cleanValue(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readColumn(row: CsvRow, keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof row[key] === 'string') {
      return row[key];
    }
  }

  return undefined;
}

function isValidUrl(value: string | null): boolean {
  if (!value) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function rowToSourceKey(row: NormalizedRow): string {
  const key = [
    row.generalTopic ?? '',
    row.subtopic ?? '',
    row.charge ?? '',
    row.shortResponseUrl ?? '',
    row.shortResponseLength ?? '',
    row.shortResponseAuthor ?? '',
    row.longResponseUrl ?? '',
    row.longResponseLength ?? '',
    row.debateUrl ?? '',
    row.articleUrl ?? '',
    row.video1Length ?? '',
    row.video1Author ?? '',
    row.video1Timestamp ?? '',
  ]
    .join('|')
    .toLowerCase();

  return createHash('sha256').update(key).digest('hex');
}

function normalizeRow(row: CsvRow): NormalizedRow {
  const shortResponseUrl = cleanValue(
    readColumn(row, ['Short response URL', 'Short Response URL']),
  );
  const shortResponseLength = cleanValue(
    readColumn(row, ['Short response Length', 'Short response length']),
  );
  const shortResponseAuthor = cleanValue(
    readColumn(row, ['Short response Author', 'Short response author']),
  );
  const longResponseUrl = cleanValue(
    readColumn(row, ['Response in long video', 'Long response URL']),
  );
  const longResponseLength = cleanValue(
    readColumn(row, ['Response in long video length', 'Long response length']),
  );
  const debateUrl = cleanValue(
    readColumn(row, ['Debate on topic', 'Debate URL']),
  );
  const articleUrl = cleanValue(
    readColumn(row, ['Article discussing topic', 'Article URL']),
  );

  const legacyVideoLength = cleanValue(readColumn(row, ['Video 1 Length']));
  const legacyVideoAuthor = cleanValue(readColumn(row, ['Video 1 Author']));
  const legacyVideoTimestamp = cleanValue(
    readColumn(row, ['Video 1 timestamp where relevant answer appears in video']),
  );

  return {
    // Some CSV exports leave the first column header blank.
    generalTopic: cleanValue(readColumn(row, ['General Topic', 'Topic', ''])),
    subtopic: cleanValue(readColumn(row, ['Subtopic'])),
    charge: cleanValue(readColumn(row, ['Charge'])),
    shortResponseUrl,
    shortResponseLength,
    shortResponseAuthor,
    longResponseUrl,
    longResponseLength,
    debateUrl,
    articleUrl,
    video1Length: legacyVideoLength ?? longResponseLength,
    video1Author: legacyVideoAuthor,
    video1Timestamp: legacyVideoTimestamp,
  };
}

function isCompletelyEmpty(row: NormalizedRow): boolean {
  return (
    !row.generalTopic &&
    !row.subtopic &&
    !row.charge &&
    !row.shortResponseUrl &&
    !row.shortResponseLength &&
    !row.shortResponseAuthor &&
    !row.longResponseUrl &&
    !row.longResponseLength &&
    !row.debateUrl &&
    !row.articleUrl &&
    !row.video1Length &&
    !row.video1Author &&
    !row.video1Timestamp
  );
}

async function main() {
  const csvRaw = await readFile(csvPath, 'utf8');
  const parsedRows = parse(csvRaw, {
    columns: true,
    skip_empty_lines: false,
    trim: true,
    relax_column_count: true,
  }) as CsvRow[];

  let skippedEmpty = 0;
  let skippedInvalid = 0;
  let imported = 0;

  for (const row of parsedRows) {
    const normalized = normalizeRow(row);

    if (isCompletelyEmpty(normalized)) {
      skippedEmpty += 1;
      continue;
    }

    if (
      !isValidUrl(normalized.shortResponseUrl) ||
      !isValidUrl(normalized.longResponseUrl)
    ) {
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
          shortResponseLength: normalized.shortResponseLength,
          shortResponseAuthor: normalized.shortResponseAuthor,
          longResponseUrl: normalized.longResponseUrl,
          longResponseLength: normalized.longResponseLength,
          debateUrl: normalized.debateUrl,
          articleUrl: normalized.articleUrl,
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
          shortResponseLength: normalized.shortResponseLength,
          shortResponseAuthor: normalized.shortResponseAuthor,
          longResponseUrl: normalized.longResponseUrl,
          longResponseLength: normalized.longResponseLength,
          debateUrl: normalized.debateUrl,
          articleUrl: normalized.articleUrl,
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
  .catch((error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2021'
    ) {
      console.error(
        'Database table not found. Run `npm run prisma:migrate:dev -- --name add_apologetic_index_item` first.',
      );
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
