# Blueprint View Route

## Overview

The `/blueprint/view` route provides a dedicated page for viewing saved strategic blueprints without restarting the generation flow. This allows users to quickly access and share their completed blueprints.

## File Structure

```
/src/app/blueprint/view/
├── page.tsx          # Main blueprint view page
└── README.md         # This file
```

## Features

### 1. Protected Route
- Checks for Clerk authentication
- Redirects unauthenticated users to `/sign-in`
- Ensures only authorized users can access blueprints

### 2. Blueprint Loading
- Loads blueprint from localStorage using `getStrategicBlueprint()`
- Redirects to `/generate` if no blueprint exists
- Shows loading spinner during initial load

### 3. Header Navigation
- Sticky header with back to dashboard button
- Page title with blueprint icon
- Primary actions: Export PDF, Share
- Responsive design for mobile and desktop

### 4. Action Cards
- Info section with blueprint title and description
- Secondary actions: Edit, New Blueprint
- Share link display with copy functionality
- Error handling for share failures

### 5. Blueprint Display
- Uses `PolishedBlueprintView` component
- Card-based layout with all 5 sections
- Smooth animations on page load
- Responsive max-width container

## Component Architecture

```tsx
BlueprintViewPage (Client Component)
├── Authentication Check (useUser + useEffect)
├── Header (Sticky)
│   ├── Back to Dashboard Button
│   ├── Page Title
│   └── Actions (Export, Share)
├── Action Cards (GradientBorder)
│   ├── Info Section
│   ├── Secondary Actions (Edit, New Blueprint)
│   ├── Share Link Display (conditional)
│   └── Error Display (conditional)
└── Blueprint Content
    └── PolishedBlueprintView
```

## User Flows

### Primary Flow
1. User navigates to `/blueprint/view`
2. System checks authentication
3. System loads blueprint from localStorage
4. Blueprint is displayed with actions

### Export PDF Flow
1. User clicks "Export" button
2. PDF generation starts (html2canvas + jsPDF)
3. Temporary DOM element created with blueprint content
4. PDF rendered and downloaded as `Strategic-Blueprint-{date}.pdf`

### Share Flow
1. User clicks "Share" button
2. API call to `/api/blueprints` (POST)
3. Share URL generated and displayed
4. User can copy link to clipboard
5. Link remains visible until page refresh

### Edit Flow
1. User clicks "Edit" button
2. Checks for saved onboarding data in localStorage
3. Navigates to `/generate` with data intact
4. User resumes from review step

### New Blueprint Flow
1. User clicks "New Blueprint" button
2. Navigates to `/generate`
3. User starts fresh generation flow

## Data Flow

### Input
- **localStorage**: Strategic blueprint data
- **localStorage**: Onboarding data (for edit flow)
- **Clerk**: User authentication state

### Output
- **PDF File**: Exported blueprint
- **Share URL**: Public share link
- **Navigation**: Redirects to other routes

## Styling

The page follows the SaaSLaunch design system:

- **Background**: Dark theme with shader mesh
- **Cards**: Gradient borders with elevated surfaces
- **Buttons**: Magnetic interaction with hover states
- **Typography**:
  - Headings: Instrument Sans
  - Body: Inter
  - Mono: SF Mono
- **Colors**:
  - Primary accent: `var(--accent-blue)`
  - Text: `var(--text-heading)`, `var(--text-secondary)`, `var(--text-tertiary)`
  - Borders: `var(--border-default)`, `var(--border-subtle)`

## Dependencies

### Core
- `react` - Component framework
- `next/navigation` - Router and navigation
- `@clerk/nextjs` - Authentication

### UI Components
- `@/components/strategic-blueprint/polished-blueprint-view`
- `@/components/ui/magnetic-button`
- `@/components/ui/gradient-border`
- `@/components/ui/sl-background`

### Libraries
- `framer-motion` - Animations
- `lucide-react` - Icons
- `html2canvas` - PDF rendering
- `jspdf` - PDF generation

### Utilities
- `@/lib/storage/local-storage` - Data persistence
- `@/lib/motion` - Animation config

## Error Handling

### No Blueprint
- Redirects to `/generate` if blueprint not found
- Prevents empty state from rendering

### Share Errors
- Displays error message below action cards
- Red border and background for visibility
- Does not block other actions

### Export Errors
- Shows browser alert with error message
- Logs detailed error to console
- Resets export state to allow retry

## Performance

### Optimizations
- Client-side rendering for instant interactions
- Lazy loading of PDF libraries (html2canvas, jspdf)
- Conditional rendering of share link and errors
- Single blueprint load on mount

### Bundle Size
- PDF libraries loaded on-demand
- Total page weight: ~50KB (without libs)
- PDF libraries: ~500KB (loaded on first export)

## Testing

### Manual Testing Checklist
- [ ] Unauthenticated user redirects to sign-in
- [ ] User without blueprint redirects to generate
- [ ] Blueprint loads and displays correctly
- [ ] Export PDF downloads file successfully
- [ ] Share creates and displays link
- [ ] Copy link copies to clipboard
- [ ] Edit navigates to generate with data
- [ ] New Blueprint navigates to generate
- [ ] Back to Dashboard navigates correctly
- [ ] Responsive design works on mobile
- [ ] Loading state shows spinner
- [ ] Share errors display correctly

### Edge Cases
- Browser without clipboard API (uses fallback)
- localStorage disabled (redirects to generate)
- Network error during share (shows error)
- PDF generation timeout (shows alert)

## Future Enhancements

### Potential Features
1. **Version History**: Track blueprint changes over time
2. **Collaboration**: Share edit access with team
3. **Templates**: Save blueprints as reusable templates
4. **Analytics**: Track blueprint views and shares
5. **Export Options**: Word, Markdown, JSON formats
6. **Print View**: Optimized print stylesheet
7. **Annotations**: Add notes and highlights
8. **Comparison**: Compare multiple blueprints
9. **Archive**: Save multiple blueprints
10. **Search**: Full-text search within blueprint

### Technical Improvements
1. Server-side rendering with database storage
2. Real-time collaboration with WebSockets
3. Progressive Web App support
4. Offline mode with service workers
5. Better PDF rendering (server-side)
6. Image optimization for sharing
7. SEO meta tags for shared links
8. Analytics integration
9. Error boundary for graceful failures
10. Accessibility improvements (ARIA labels, keyboard nav)

## Related Files

- `/src/app/generate/page.tsx` - Generation flow
- `/src/app/dashboard/page.tsx` - Dashboard with blueprint card
- `/src/components/strategic-blueprint/polished-blueprint-view.tsx` - Blueprint display
- `/src/lib/storage/local-storage.ts` - Data persistence
- `/api/blueprints` - Share API endpoint
