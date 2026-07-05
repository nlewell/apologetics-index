# Getting Started with Mobile App

## Prerequisites

Ensure the backend is running:
```bash
cd /home/newell/workspace/apologetics-index/backend
npm run start:dev
```

Backend will be available at `http://localhost:3000/api`

## Install Dependencies

```bash
cd /home/newell/workspace/apologetics-index/mobile
npm install
```

## Configure API Target

The app now supports local vs remote backend switching via `.env`.

```bash
cd /home/newell/workspace/apologetics-index/mobile
```

Set these in `mobile/.env`:

```bash
EXPO_PUBLIC_API_TARGET=local
EXPO_PUBLIC_API_LOCAL_URL=http://localhost:3000/api
EXPO_PUBLIC_API_REMOTE_URL=https://3.22.98.75.nip.io/api
```

Use:

- `EXPO_PUBLIC_API_TARGET=local` to test against localhost
- `EXPO_PUBLIC_API_TARGET=remote` to test against deployed backend

If running on a physical device, replace localhost with your machine LAN IP.

## Run the App

```bash
npx expo start
```

### Option 1: Expo Go (Fastest)
1. Install Expo Go on your phone (iOS App Store or Google Play)
2. Scan the QR code from terminal with your phone's camera
3. Opens in Expo Go app automatically

### Option 2: iOS Simulator
```bash
# From the Expo CLI, press: i
# Or run directly:
npx expo start --ios
```

### Option 3: Android Emulator
```bash
# From the Expo CLI, press: a
# Or run directly:
npx expo start --android
```

## Features Implemented

### ✅ Phase 1 - Complete
- [x] Home screen with navigation
- [x] Topics list with pagination (15 items/page)
- [x] Topic detail view
- [x] Search functionality (real-time, 500ms debounce)
- [x] Responsive design
- [x] Error handling and retry
- [x] Pull-to-refresh

### 📋 Screens

1. **Home** - Landing page
   - Browse Topics button
   - Search button
   - Info section

2. **Browse Topics** - Paginated list
   - Search within current page
   - Previous/Next pagination
   - Tap to view details

3. **Topic Details** - Full item view
   - General topic & subtopic
   - Charge description
   - Response URL button (opens browser)
   - Video metadata
   - Created date & ID

4. **Search** - Full-text search
   - Search across all fields
   - Real-time results
   - Tap item to view details

## Architecture

```
Components:
- HomeScreen: Navigation hub
- IndexItemsScreen: Paginated list with pagination controls
- IndexItemDetailScreen: Item detail with URL/video handling
- SearchScreen: Global search interface

Hooks:
- useIndexItems: React Query hook for API calls

State Management:
- React Query for server state
- Local useState for pagination, search input
```

## API Endpoints Used

- `GET /api/index-items` - List with pagination & filters
  - Query params: `page`, `limit`, `q`, `generalTopic`, `subtopic`
  - Response: `{ meta: {...}, items: [...] }`

## Troubleshooting

### "Cannot reach server"
- Ensure backend is running: `npm run start:dev` from `/backend`
- Check backend port: should be `http://localhost:3000`
- If running on physical device, use device's LAN IP instead of localhost

### Blank screen after "Browse Topics"
- Check console logs in Expo
- Verify backend API is responding: `curl http://localhost:3000/api/index-items?limit=1`

### TypeScript errors
- Run: `npm run typecheck` (if available)
- Check: `tsconfig.json` is configured with strict: true

## Next Steps (Phase 2+)

- [ ] Filter by general topic dropdown
- [ ] Favorite/bookmark items
- [ ] Offline caching with AsyncStorage
- [ ] Dark mode support
- [ ] Share items
- [ ] Authentication & user profiles
- [ ] Push notifications
- [ ] Video player integration

## Project Structure

```
mobile/
├── App.tsx                    # Root component with navigation
├── SCREENS.md                 # Detailed screen documentation
├── app.json                   # Expo config
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── src/
    ├── screens/              # Screen components
    ├── components/           # Reusable UI components
    ├── hooks/               # Custom React hooks
    └── types/               # TypeScript type definitions
```

## Performance Tips

- App uses React Query caching (5-minute stale time)
- Search input debounced (500ms) to reduce API calls
- FlatList optimized for performance
- Consider `maxToRenderPerBatch` and `updateCellsBatchingPeriod` for large lists
