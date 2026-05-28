# Mobile App - Screen Structure

Complete Phase 1 implementation with home screen, topics list, detail view, and search functionality.

## Architecture

```
src/
├── screens/              # Screen components
│   ├── HomeScreen.tsx           # Navigation hub with Browse/Search buttons
│   ├── IndexItemsScreen.tsx     # Paginated list with search
│   ├── IndexItemDetailScreen.tsx # Single item detail view
│   └── SearchScreen.tsx         # Full-text search across all fields
├── components/           # Reusable UI components
│   └── IndexItemCard.tsx        # Card component for list items
├── hooks/               # Custom hooks
│   └── useIndexItems.ts  # React Query hooks for API calls
└── types/               # TypeScript types
    ├── index.ts          # API response and data types
    └── navigation.ts     # React Navigation type definitions
```

## Screens

### HomeScreen
- **Route**: `Home`
- **Purpose**: Landing page with navigation options
- **Features**:
  - "Browse Topics" button → IndexItemsScreen
  - "Search" button → SearchScreen
  - Info section about the app
- **Header**: Hidden for full-screen experience

### IndexItemsScreen
- **Route**: `IndexItems`
- **Purpose**: Browse all apologetic index items
- **Features**:
  - **Search input** with 500ms debounce
  - **Pagination**: Previous/Next buttons with page info
  - **Responsive list**: 15 items per page (configurable via `limit` state)
  - **Pull-to-refresh**: Refetch current page
  - **Tap item**: Navigate to detail screen
  - **Error handling**: Retry button on failed requests
- **Query Parameters**: 
  - `page`: Current page (1-indexed)
  - `limit`: Items per page
  - `q`: Search query (multi-field)

### IndexItemDetailScreen
- **Route**: `IndexItemDetail`
- **Props**: `item: IndexItem` (passed from IndexItemsScreen or SearchScreen)
- **Purpose**: View full details of a single item
- **Features**:
  - **Topic & Subtopic**: Header section
  - **Charge section**: Full text if available
  - **Response URL button**: Opens link in browser
  - **Video details**: Author, length, timestamp
  - **Metadata**: Created date, source key
  - **Back button**: Returns to previous screen

### SearchScreen
- **Route**: `Search`
- **Purpose**: Full-text search across all fields
- **Features**:
  - Auto-focused input field
  - Real-time search with 500ms debounce
  - Up to 50 results per search
  - "No results" message if query is empty or no matches
  - Tap item to view details

## API Integration

### useIndexItems Hook
```typescript
// Returns paginated data from backend
const { data, isLoading, isError, error, refetch } = useIndexItems({
  page: 1,
  limit: 20,
  q: 'DNA', // Optional: search query
  generalTopic: 'Book of Mormon', // Optional: filter by topic
  subtopic: 'DNA evidence', // Optional: filter by subtopic
});

// Response shape:
{
  meta: { page, limit, total, totalPages },
  items: [IndexItem, ...]
}
```

### Axios Configuration
- **Base URL**: `http://localhost:3000/api`
- **Timeout**: 10 seconds
- **Caching**: 5-minute stale time, 10-minute garbage collection

## Navigation Flow

```
Home
├─ "Browse Topics" → IndexItems
│   ├─ Item tap → IndexItemDetail ← Back to IndexItems
│   └─ Search input (page reset on query change)
└─ "Search" → Search
    └─ Item tap → IndexItemDetail ← Back to Search
```

## Styling

- **Color scheme**: Tailwind-inspired (grays, blues, purples)
- **Components**: Native RN components (no external UI library)
- **Responsive**: Adapts to screen size using flex layout
- **Accessibility**: Touch targets ≥44pt, clear contrast, readable fonts

## Running the App

```bash
cd /home/newell/workspace/apologetics-index/mobile

# Start Expo dev server
npx expo start

# Scan QR code with Expo Go (iOS/Android)
# Or press 'i' (iOS simulator) or 'a' (Android emulator)
```

## Notes

- API calls use React Query for caching and background refetching
- Search queries are debounced to reduce unnecessary API calls
- Pagination resets when search query changes
- All screens use SafeAreaView for proper notch/safe area handling
- TypeScript strict mode ensures type safety end-to-end
