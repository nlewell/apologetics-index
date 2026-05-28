# Data Staging

This folder is for temporary import data used during development.

## Structure

- `raw/`: Original source files copied as-is (do not edit manually).

## Current file

- `raw/apologetic-index.csv`

## Next step

Create an import script in `src/scripts/` that reads `data/raw/apologetic-index.csv`, validates rows, and inserts records via Prisma.

## Import commands

- Dry run (parse and validate only): `npm run import:apologetic-index:dry`
- Import to database: `npm run import:apologetic-index`

Before importing to database, run a migration for the new table:

- `npm run prisma:migrate:dev -- --name add_apologetic_index_item`
