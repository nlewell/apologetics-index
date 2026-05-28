import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';

type CsvRow = {
  'General Topic': string;
  Subtopic: string;
  Charge: string;
  'Short response URL': string;
  'Video 1 Length': string;
  'Video 1 Author': string;
  'Video 1 timestamp where relevant answer appears in video': string;
};

type NormalizedRow = {
  generalTopic: string | null;
  subtopic: string | null;
  charge: string | null;
  shortResponseUrl: string | null;
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
    row.video1Length ?? '',
    row.video1Author ?? '',
    row.video1Timestamp ?? '',
  ]
    .join('|')
    .toLowerCase();

  return createHash('sha256').update(key).digest('hex');
}

function normalizeRow(row: CsvRow): NormalizedRow {
  return {
    generalTopic: cleanValue(row['General Topic']),
    subtopic: cleanValue(row.Subtopic),
    charge: cleanValue(row.Charge),
    shortResponseUrl: cleanValue(row['Short response URL']),
    video1Length: cleanValue(row['Video 1 Length']),
    video1Author: cleanValue(row['Video 1 Author']),
    video1Timestamp: cleanValue(
      row['Video 1 timestamp where relevant answer appears in video'],
    ),
  };
}

function isCompletelyEmpty(row: NormalizedRow): boolean {
  return (
    !row.generalTopic &&
    !row.subtopic &&
    !row.charge &&
    !row.shortResponseUrl &&
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
