# GenerateHeader Integration Guide

Complete guide for integrating the new `GenerateHeader` component into `/src/app/generate/page.tsx`.

## Overview

The `GenerateHeader` provides a persistent navigation header that:
- Shows current workflow stage (Onboarding → Generate → Review → Complete)
- Displays logo linking to dashboard
- Includes exit confirmation when there's unsaved progress
- Shows Clerk UserButton for account access
- Can collapse during generation to minimize distraction

## File Locations

Created files:
- `/src/components/generate/generate-header.tsx` - Main header component
- `/src/components/generate/index.ts` - Barrel export
- `/src/components/ui/alert-dialog.tsx` - Dialog component (dependency)
- `/src/components/generate/README.md` - Component documentation

## Integration Steps

### Step 1: Add Required Dependencies

First, ensure you have the required package:

```bash
npm install @radix-ui/react-alert-dialog
```

### Step 2: Update Generate Page

Add the header to the top of your generate page. Here's the integration pattern:

```tsx
// Add import at the top of /src/app/generate/page.tsx
import { GenerateHeader, type GenerateStage } from "@/components/generate";

// Inside your component, add state mapping
export default function GeneratePage() {
  const [pageState, setPageState] = useState<PageState>("onboarding");
  // ... existing state ...

  // Map pageState to GenerateStage
  const currentStage: GenerateStage = React.useMemo(() => {
    switch (pageState) {
      case "onboarding":
        return "onboarding";
      case "generating-blueprint":
        return "generate";
      case "review-blueprint":
        return "review";
      case "complete":
      case "error":
        return "complete";
      default:
        return "onboarding";
    }
  }, [pageState]);

  // Determine if there's unsaved progress
  const hasUnsavedProgress = React.useMemo(() => {
    return (
      pageState === "generating-blueprint" ||
      (pageState === "review-blueprint" && strategicBlueprint !== null)
    );
  }, [pageState, strategicBlueprint]);

  // Enable collapsing during generation
  const isCollapsible = pageState === "generating-blueprint";

  // Return statement - wrap everything with header
  return (
    <div className="min-h-screen flex flex-col">
      <GenerateHeader
        currentStage={currentStage}
        hasUnsavedProgress={hasUnsavedProgress}
        collapsible={isCollapsible}
        defaultCollapsed={false}
        exitUrl="/dashboard"
        onExit={() => {
          // Optional: Clear local storage or perform cleanup
          clearAllSavedData();
        }}
      />

      {/* Your existing page content */}
      <div className="flex-1">
        {/* All your existing conditional rendering */}
        {showResumePrompt && <ResumePrompt />}
        {pageState === "onboarding" && <OnboardingView />}
        {pageState === "generating-blueprint" && <GeneratingView />}
        {/* ... etc */}
      </div>
    </div>
  );
}
```

### Step 3: Update Layout Structure

Since the header is sticky, update your page structure:

**Before:**
```tsx
return (
  <div className="min-h-screen bg-background flex flex-col">
    {/* Content directly here */}
  </div>
);
```

**After:**
```tsx
return (
  <div className="min-h-screen flex flex-col">
    <GenerateHeader {...props} />
    <div className="flex-1">
      {/* Content here */}
    </div>
  </div>
);
```

### Step 4: Remove Background from Individual States

The header provides the background styling, so you can remove redundant backgrounds:

**Before:**
```tsx
if (pageState === "onboarding") {
  return (
    <div className="min-h-screen relative" style={{ background: 'rgb(7, 9, 14)' }}>
      <ShaderMeshBackground variant="hero" />
      <BackgroundPattern opacity={0.02} />
      {/* content */}
    </div>
  );
}
```

**After:**
```tsx
// Header is already at the top with proper background
if (pageState === "onboarding") {
  return (
    <div className="min-h-screen relative" style={{ background: 'rgb(7, 9, 14)' }}>
      <ShaderMeshBackground variant="hero" />
      <BackgroundPattern opacity={0.02} />
      {/* content */}
    </div>
  );
}
// OR if you want header to persist, structure like this:
```

### Step 5: Optional - Refactor Stage Indicator

The generate page currently shows stage indicators in individual states. You can now remove those since the header provides persistent progress tracking:

**Remove from individual states:**
```tsx
{/* OLD - can be removed */}
<motion.div className="flex items-center justify-center gap-4 mt-6">
  <div className="flex items-center gap-2">
    <div className="flex h-8 w-8 items-center justify-center rounded-full">1</div>
    <span>Onboarding</span>
  </div>
  {/* ... */}
</motion.div>
```

The header now handles all stage visualization.

## Complete Example

Here's a minimal working example:

```tsx
"use client";

import { useState, useMemo } from "react";
import { GenerateHeader, type GenerateStage } from "@/components/generate";
import { clearAllSavedData } from "@/lib/storage/local-storage";

type PageState = "onboarding" | "generating-blueprint" | "review-blueprint" | "complete";

export default function GeneratePage() {
  const [pageState, setPageState] = useState<PageState>("onboarding");
  const [strategicBlueprint, setStrategicBlueprint] = useState(null);

  // Map internal state to header stage
  const currentStage: GenerateStage = useMemo(() => {
    if (pageState === "onboarding") return "onboarding";
    if (pageState === "generating-blueprint") return "generate";
    if (pageState === "review-blueprint") return "review";
    return "complete";
  }, [pageState]);

  // Determine unsaved progress
  const hasUnsavedProgress = useMemo(() => {
    return (
      pageState === "generating-blueprint" ||
      (pageState === "review-blueprint" && strategicBlueprint !== null)
    );
  }, [pageState, strategicBlueprint]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Persistent Header */}
      <GenerateHeader
        currentStage={currentStage}
        hasUnsavedProgress={hasUnsavedProgress}
        collapsible={pageState === "generating-blueprint"}
        onExit={() => clearAllSavedData()}
      />

      {/* Main Content */}
      <div className="flex-1">
        {pageState === "onboarding" && (
          <OnboardingView onComplete={(data) => {
            setPageState("generating-blueprint");
            // start generation
          }} />
        )}

        {pageState === "generating-blueprint" && (
          <GeneratingView />
        )}

        {pageState === "review-blueprint" && (
          <ReviewView
            blueprint={strategicBlueprint}
            onApprove={() => setPageState("complete")}
          />
        )}

        {pageState === "complete" && (
          <CompleteView blueprint={strategicBlueprint} />
        )}
      </div>
    </div>
  );
}
```

## Visual Changes

### Before Integration
- No persistent navigation
- Stage indicators only shown in individual states
- No exit confirmation
- No user account access during generation

### After Integration
- ✅ Persistent header across all stages
- ✅ Continuous progress tracking
- ✅ Exit confirmation with unsaved progress warning
- ✅ UserButton always accessible
- ✅ Collapsible during generation
- ✅ Mobile-responsive layout

## Props Configuration Guide

### When to Use `hasUnsavedProgress`

```tsx
// Set to true when:
✅ User is in the middle of generation
✅ User has completed blueprint but hasn't approved
✅ User has made edits in review stage

// Set to false when:
❌ User just landed on onboarding
❌ User completed and approved blueprint
❌ User is viewing completed/shared blueprint
```

### When to Use `collapsible`

```tsx
// Enable during generation to minimize header distraction
collapsible={pageState === "generating-blueprint"}

// Keep expanded for other stages where user needs navigation context
```

### Custom Exit Behavior

```tsx
<GenerateHeader
  onExit={() => {
    // Clear local storage
    clearAllSavedData();

    // Track analytics
    trackEvent("blueprint_generation_exit");

    // Show toast notification
    toast.success("Progress saved");
  }}
/>
```

## Styling Customization

The header uses CSS variables for theming. To customize:

```tsx
// Override specific styles
<GenerateHeader
  className="border-b-2 bg-background/90"
  // ... other props
/>
```

Available CSS variables:
- `--accent-blue` - Active stage color
- `--text-foreground` - Primary text
- `--text-muted-foreground` - Secondary text
- `--border-default` - Border color
- `--bg-background` - Background color

## Testing

Test these scenarios:
1. ✅ Navigate through all stages (onboarding → generate → review → complete)
2. ✅ Click Exit with unsaved progress → dialog shows
3. ✅ Click "Stay" → stays on page
4. ✅ Click "Exit Anyway" → navigates to dashboard
5. ✅ Click Exit without unsaved progress → immediately navigates
6. ✅ Toggle collapse during generation
7. ✅ Logo click → navigates to dashboard
8. ✅ UserButton click → shows account menu
9. ✅ Responsive layout on mobile

## Troubleshooting

### Issue: Header not sticky
**Solution**: Ensure parent has proper layout:
```tsx
<div className="min-h-screen flex flex-col">
  <GenerateHeader /> {/* sticky header */}
  <div className="flex-1">{/* content */}</div>
</div>
```

### Issue: Exit dialog not showing
**Solution**: Verify `hasUnsavedProgress` prop is set correctly based on state.

### Issue: Progress indicator not updating
**Solution**: Ensure `currentStage` prop changes with pageState:
```tsx
const currentStage = useMemo(() => {
  // proper mapping here
}, [pageState]);
```

### Issue: UserButton not rendering
**Solution**: Ensure Clerk is properly configured and the page is wrapped with ClerkProvider.

## Migration Checklist

- [ ] Install `@radix-ui/react-alert-dialog`
- [ ] Import `GenerateHeader` component
- [ ] Add stage mapping logic
- [ ] Add unsaved progress detection
- [ ] Update page layout structure
- [ ] Add header to top of component tree
- [ ] Test exit flow with/without unsaved progress
- [ ] Test collapse/expand functionality
- [ ] Test on mobile devices
- [ ] Remove duplicate stage indicators (optional)
- [ ] Verify logo links to dashboard
- [ ] Verify UserButton functions correctly

## Support

For issues or questions:
- Component docs: `/src/components/generate/README.md`
- Example usage: This file
- Existing pattern: `/src/app/dashboard/page.tsx` (header reference)
