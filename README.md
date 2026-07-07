# Clarifying Faith and Reason

Monorepo with a React Native mobile app and a NestJS API.

## Project Structure

- `mobile/`: Expo React Native app (TypeScript)
- `backend/`: NestJS API (TypeScript, Prisma)
- `docker-compose.yml`: Local PostgreSQL service

## Prerequisites

- Node.js 20+
- npm 10+
- Docker (for local PostgreSQL)

## Quick Start

### 1) Start PostgreSQL

```bash
docker compose up -d
```

### 2) Configure backend env

```bash
cd backend
cp .env.example .env
```

### 3) Apply Prisma migration

```bash
cd backend
npm run prisma:migrate:dev -- --name init
```

### 4) Run backend API

```bash
cd backend
npm run start:dev
```

API will be available at `http://localhost:3000/api`.

### 4.1) Query imported index items

After migrating and importing CSV data, use:

```bash
curl "http://localhost:3000/api/index-items?page=1&limit=20"
```

Optional filters:

- `generalTopic`
- `subtopic`
- `q` (searches charge + topic fields)

### 4.2) Check content version (for mobile sync)

```bash
curl "http://localhost:3000/api/content-version"
```

Returns:

- `version` (derived from row count + latest update timestamp)
- `totalItems`
- `lastUpdatedAt`

### 5) Run mobile app

```bash
cd mobile
export EXPO_PUBLIC_API_URL="http://localhost:3000/api"
npm run start
```

For a physical device, replace `localhost` with your machine IP (for example `http://172.17.184.167:3000/api`).

Use Expo Go or Android/iOS simulator to open the app.

## Suggested Learning Path

### Phase 1

- React fundamentals (state, props, effects, component architecture)
- React Native basics (core components, navigation, styling)
- Expo workflow (dev server, device testing, build basics)

### Phase 2

- NestJS modules/controllers/services
- Prisma models and migrations
- PostgreSQL data modeling and query patterns

### Phase 3

- Authentication (JWT + refresh tokens)
- Offline-first mobile data (AsyncStorage + React Query persistence)
- Sync strategy for static content (manual refresh + data versioning)

### Phase 4

- Deployment and CI/CD (GitHub Actions)

## Production Operations

The repository includes scripts designed for low-memory production hosts.

### Deploy backend safely on production

Run this directly on the production host:

```bash
cd /home/ubuntu/app
./scripts/remote-deploy.sh
```

Defaults are memory-safe:

- Skips `npm ci`
- Skips build
- Skips migrations
- Pulls latest git commit and restarts systemd service
- Runs health check at `http://127.0.0.1:3000/api`

Optional toggles:

```bash
INSTALL_DEPS=1 BUILD_APP=1 RUN_MIGRATIONS=1 ./scripts/remote-deploy.sh
```

Use this only when you intentionally need dependency reinstall/build/migration.

### Database maintenance

The script below supports table status and safe cleanup operations:

```bash
./scripts/db-maintenance.sh status
./scripts/db-maintenance.sh clear-cache
./scripts/db-maintenance.sh clear-index
./scripts/db-maintenance.sh clear-all-data
```

Destructive operations require typing `YES` unless `--yes` is supplied.

Examples:

```bash
./scripts/db-maintenance.sh clear-cache --yes
ASSUME_YES=1 ./scripts/db-maintenance.sh clear-index
```

By default, the script reads `backend/.env`. You can override with:

```bash
ENV_FILE=/path/to/.env ./scripts/db-maintenance.sh status
```
