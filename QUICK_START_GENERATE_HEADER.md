# GenerateHeader Quick Start Guide

5-minute integration guide to add the GenerateHeader to your `/generate` page.

## Step 1: Verify Dependencies (30 seconds)

The required dependency is already installed:
```bash
# Already added: @radix-ui/react-alert-dialog@^1.1.15
```

## Step 2: Import Component (15 seconds)

Add to the top of `/src/app/generate/page.tsx`:

```tsx
import { GenerateHeader, type GenerateStage } from "@/components/generate";
```

## Step 3: Add State Mapping (2 minutes)

Add these helper functions inside your component:

```tsx
export default function GeneratePage() {
  // ... your existing state ...
  const [pageState, setPageState] = useState<PageState>("onboarding");
  const [strategicBlueprint, setStrategicBlueprint] = useState(null);

  // ADD THIS: Map pageState to GenerateStage
  const currentStage = React.useMemo((): GenerateStage => {
    if (pageState === "onboarding") return "onboarding";
    if (pageState === "generating-blueprint") return "generate";
    if (pageState === "review-blueprint") return "review";
    return "complete";
  }, [pageState]);

  // ADD THIS: Detect unsaved progress
  const hasUnsavedProgress = React.useMemo(() => {
    return (
      pageState === "generating-blueprint" ||
      (pageState === "review-blueprint" && strategicBlueprint !== null)
    );
  }, [pageState, strategicBlueprint]);

  // ... rest of component ...
}
```

## Step 4: Update Layout (2 minutes)

Change your return statement from:

```tsx
// OLD
return (
  <div className="min-h-screen bg-background">
    {/* your content */}
  </div>
);
```

To:

```tsx
// NEW
return (
  <div className="min-h-screen flex flex-col bg-background">
    <GenerateHeader
      currentStage={currentStage}
      hasUnsavedProgress={hasUnsavedProgress}
      collapsible={pageState === "generating-blueprint"}
      exitUrl="/dashboard"
      onExit={() => clearAllSavedData()}
    />

    <div className="flex-1">
      {/* your existing content */}
      {showResumePrompt && <ResumePrompt />}
      {pageState === "onboarding" && <OnboardingView />}
      {/* ... etc */}
    </div>
  </div>
);
```

## Step 5: Test (30 seconds)

```bash
npm run dev
```

Visit `http://localhost:3000/generate` and verify:
- [ ] Header appears at top
- [ ] Logo links to dashboard
- [ ] Progress indicator shows current stage
- [ ] Exit button works
- [ ] UserButton appears
- [ ] Exit confirmation shows when generating

## Complete Example

Here's a minimal working integration:

```tsx
"use client";

import { useState, useMemo } from "react";
import { GenerateHeader, type GenerateStage } from "@/components/generate";
import { clearAllSavedData } from "@/lib/storage/local-storage";
// ... your other imports

type PageState = "onboarding" | "generating-blueprint" | "review-blueprint" | "complete";

export default function GeneratePage() {
  const [pageState, setPageState] = useState<PageState>("onboarding");
  const [strategicBlueprint, setStrategicBlueprint] = useState(null);

  // Map state to header stage
  const currentStage = useMemo((): GenerateStage => {
    if (pageState === "onboarding") return "onboarding";
    if (pageState === "generating-blueprint") return "generate";
    if (pageState === "review-blueprint") return "review";
    return "complete";
  }, [pageState]);

  // Detect unsaved progress
  const hasUnsavedProgress = useMemo(() => (
    pageState === "generating-blueprint" ||
    (pageState === "review-blueprint" && strategicBlueprint !== null)
  ), [pageState, strategicBlueprint]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* NEW: Persistent Header */}
      <GenerateHeader
        currentStage={currentStage}
        hasUnsavedProgress={hasUnsavedProgress}
        collapsible={pageState === "generating-blueprint"}
        exitUrl="/dashboard"
        onExit={() => clearAllSavedData()}
      />

      {/* Existing Content */}
      <div className="flex-1">
        {/* ... your existing page content ... */}
      </div>
    </div>
  );
}
```

## Customization Options

### Disable Exit Confirmation
```tsx
<GenerateHeader
  hasUnsavedProgress={false}  // Always exit immediately
  // ... other props
/>
```

### Disable Collapse
```tsx
<GenerateHeader
  collapsible={false}  // Always expanded
  // ... other props
/>
```

### Custom Exit Handler
```tsx
<GenerateHeader
  onExit={() => {
    // Custom logic before exit
    trackEvent("blueprint_exit");
    clearAllSavedData();
  }}
  // ... other props
/>
```

### Custom Exit URL
```tsx
<GenerateHeader
  exitUrl="/custom-path"
  // ... other props
/>
```

## Troubleshooting

### Header not showing?
- Check import path: `@/components/generate`
- Verify component is in return statement

### Exit dialog not appearing?
- Set `hasUnsavedProgress={true}` when needed
- Check console for errors

### UserButton not rendering?
- Ensure page is wrapped with `<ClerkProvider>`
- Check Clerk configuration

### Mobile layout broken?
- Verify Tailwind is configured correctly
- Check `md:` breakpoint styles are working

## Next Steps

1. **Test all stages**: Navigate through onboarding → generate → review → complete
2. **Test exit flow**: Try exiting with and without unsaved progress
3. **Test mobile**: Check responsive layout on different screen sizes
4. **Test collapse**: Toggle collapse during generation
5. **Verify accessibility**: Tab through all interactive elements

## Files Reference

- Component: `/src/components/generate/generate-header.tsx`
- Documentation: `/src/components/generate/README.md`
- Integration Guide: `/GENERATE_HEADER_INTEGRATION.md`
- Visual Guide: `/GENERATE_HEADER_VISUAL_GUIDE.md`
- Tests: `/src/components/generate/__tests__/generate-header.test.tsx`
- Examples: `/src/components/generate/generate-header.example.tsx`

## Need Help?

Detailed documentation available:
- 📖 Full docs: `cat /src/components/generate/README.md`
- 🎨 Visual guide: `cat /GENERATE_HEADER_VISUAL_GUIDE.md`
- 🔧 Integration: `cat /GENERATE_HEADER_INTEGRATION.md`

## That's it!

You now have a professional, persistent navigation header for your generate page workflow. The header provides:

✅ Progress tracking across all stages
✅ Exit confirmation for unsaved work
✅ User account access
✅ Collapsible mode during generation
✅ Mobile-responsive layout
✅ Accessibility compliance

Total integration time: ~5 minutes
