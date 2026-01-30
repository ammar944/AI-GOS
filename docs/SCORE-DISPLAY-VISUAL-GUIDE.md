# Score Display Components - Visual Guide

## Quick Start

```bash
# View the interactive demo
open http://localhost:3000/score-display-demo
```

## Component Overview

### Import Options

```tsx
// Option 1: Main component with variant prop
import { ScoreDisplay } from '@/components/ui/score-display';

<ScoreDisplay variant="segmented-ring" score={7.4} max={10} />

// Option 2: Direct component import
import { SegmentedRing, GlowArc, GradientBar } from '@/components/ui/score-display';

<SegmentedRing score={7.4} max={10} label="Overall Score" />
```

---

## Variant Comparison

### 1. Segmented Ring (Recommended for Hero Displays)

**Visual:** Circular ring with 12 discrete glowing segments

**Best For:**
- Main/hero score displays
- Overall ratings
- High-impact visual moments

**Sizes:** sm (80px), md (96px), lg (128px), xl (160px)

**Props:**
```tsx
score: number        // The current score value
max?: number        // Maximum score (default: 10)
label?: string      // Optional label below the gauge
size?: ScoreSize    // 'sm' | 'md' | 'lg' | 'xl'
animated?: boolean  // Enable entrance animations (default: true)
```

**Example:**
```tsx
<SegmentedRing
  score={7.4}
  max={10}
  label="Overall Score"
  size="xl"
  animated={true}
/>
```

**Animation:** Segments fill one-by-one with stagger effect (0.04s delay each)

---

### 2. Glow Arc (Recommended for Premium Feel)

**Visual:** 270-degree arc with gradient trail and pulsing endpoint

**Best For:**
- Premium score displays
- Dashboard hero metrics
- Feature highlights

**Unique Features:**
- Animated gradient stroke
- Glowing endpoint that pulses
- Sophisticated arc sweep

**Example:**
```tsx
<GlowArc
  score={8.5}
  max={10}
  label="Pain Relevance"
  size="lg"
/>
```

**Animation:** Arc draws from start to end with elastic easing (1.5s duration)

---

### 3. Gradient Bar (Recommended for Lists)

**Visual:** Horizontal pill-shaped bar with shimmer effect

**Best For:**
- Multiple scores in a list
- Comparing metrics side-by-side
- Compact layouts

**Unique Features:**
- Shimmer animation on fill
- Glowing endpoint dot
- Label and value on same row

**Example:**
```tsx
<GradientBar
  score={6.5}
  max={10}
  label="Differentiation"
  size="md"
/>
```

**Animation:** Fills left-to-right with shimmer pass (1.5s fill + 2s shimmer repeat)

---

### 4. Thermometer (Unique Vertical)

**Visual:** Vertical pill with segmented fill

**Best For:**
- Sidebar displays
- Unique visual differentiation
- Temperature/level metaphors

**Unique Features:**
- Bottom-up segment fill
- Shimmer overlay
- Compact width

**Example:**
```tsx
<Thermometer
  score={7.0}
  max={10}
  label="Urgency"
  size="md"
/>
```

**Animation:** Segments fill bottom-to-top with stagger (0.08s delay each)

---

### 5. Liquid Fill (Playful Premium)

**Visual:** Circle with animated wave fill

**Best For:**
- Playful yet premium contexts
- Progress/completion metrics
- Memorable visual moments

**Unique Features:**
- Wave path animation
- Liquid gradient
- Mix-blend-mode score text

**Example:**
```tsx
<LiquidFill
  score={8.2}
  max={10}
  label="Tangibility"
  size="lg"
/>
```

**Animation:** Liquid rises from bottom (2s ease-out)

---

## Layout Patterns

### Pattern 1: Hero + Supporting Bars

**Use Case:** Offer Analysis section in Blueprint

```tsx
<div className="grid md:grid-cols-2 gap-8">
  {/* Hero Score */}
  <div className="md:col-span-2 flex justify-center">
    <GlowArc score={7.4} max={10} label="Overall Score" size="xl" />
  </div>

  {/* Sub-scores */}
  <div className="space-y-4">
    <GradientBar score={8} max={10} label="Pain Relevance" />
    <GradientBar score={7} max={10} label="Urgency" />
    <GradientBar score={6} max={10} label="Differentiation" />
  </div>
  <div className="space-y-4">
    <GradientBar score={8} max={10} label="Tangibility" />
    <GradientBar score={7} max={10} label="Proof" />
    <GradientBar score={8} max={10} label="Pricing" />
  </div>
</div>
```

**Visual Hierarchy:**
```
┌─────────────────────────────────┐
│      [LARGE GLOW ARC]           │
│       Overall: 7.4              │
├──────────────┬──────────────────┤
│ Pain: ████▓▓│ Tang: ████▓▓     │
│ Urg:  ███▓▓▓│ Proof: ███▓▓▓    │
│ Diff: ██▓▓▓▓│ Price: ████▓▓    │
└──────────────┴──────────────────┘
```

---

### Pattern 2: All Segmented Rings

**Use Case:** When you want consistent visual language

```tsx
<div className="flex flex-col items-center gap-12">
  {/* Hero */}
  <SegmentedRing score={7.4} size="xl" label="Overall" />

  {/* Grid of sub-scores */}
  <div className="grid grid-cols-3 gap-6">
    <SegmentedRing score={8} size="md" label="Pain" />
    <SegmentedRing score={7} size="md" label="Urgency" />
    <SegmentedRing score={6} size="md" label="Diff" />
    <SegmentedRing score={8} size="md" label="Tang" />
    <SegmentedRing score={7} size="md" label="Proof" />
    <SegmentedRing score={8} size="md" label="Price" />
  </div>
</div>
```

**Visual Hierarchy:**
```
        [LARGE RING]
         Overall: 7.4

[md]  [md]  [md]  [md]  [md]  [md]
8.0   7.0   6.0   8.0   7.0   8.0
```

---

### Pattern 3: Compact Sidebar

**Use Case:** Limited width layouts

```tsx
<div className="space-y-6">
  <Thermometer score={8.2} size="sm" label="Score 1" />
  <Thermometer score={7.0} size="sm" label="Score 2" />
  <Thermometer score={6.5} size="sm" label="Score 3" />
</div>
```

---

## Size Guidelines

| Size | Dimensions | Best For | Typical Use |
|------|-----------|----------|-------------|
| `sm` | 80-96px | Compact lists, sidebars | Supporting metrics |
| `md` | 96-112px | Grid layouts, cards | Standard scores |
| `lg` | 128-144px | Section headers, features | Primary displays |
| `xl` | 160-192px | Hero sections, landing | Hero metrics |

---

## Color System

All components use the brand gradient by default:

```tsx
// Primary gradient (blue to cyan)
from: "rgb(54, 94, 255)"   // --accent-blue
to:   "rgb(80, 248, 228)"   // --accent-cyan
```

**Glow effects:** `rgba(54, 94, 255, 0.6)` with blur

**Background:** `rgba(54, 94, 255, 0.05)` with `0.2` border

---

## Animation Timings

| Component | Duration | Easing | Delay |
|-----------|----------|--------|-------|
| Segmented Ring | 0.3s per segment | Cubic bezier [0.22, 1, 0.36, 1] | 0.04s stagger |
| Glow Arc | 1.5s | Cubic bezier [0.22, 1, 0.36, 1] | 0.3s (center text) |
| Gradient Bar | 1.5s | Cubic bezier [0.22, 1, 0.36, 1] | Shimmer loops |
| Thermometer | 0.4s per segment | Cubic bezier [0.22, 1, 0.36, 1] | 0.08s stagger |
| Liquid Fill | 2s | Ease out | 0.5s (center text) |

**Pulsing effects:** 2s ease-in-out infinite

---

## Accessibility

All components include:

```tsx
<div
  role="meter"
  aria-valuenow={score}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-label={`${label}: ${score} out of ${max}`}
>
```

**Screen reader friendly:** Announces actual values, not just visuals

**Reduced motion:** Set `animated={false}` or respect `prefers-reduced-motion`

---

## Migration from ScoreGauge

### Before (Old Component):
```tsx
<ScoreGauge
  score={7.4}
  max={10}
  label="Overall Score"
  size="lg"
/>
```

### After (New Component):
```tsx
<ScoreDisplay
  score={7.4}
  max={10}
  label="Overall Score"
  variant="segmented-ring"
  size="lg"
/>
```

**Or use direct import:**
```tsx
<SegmentedRing
  score={7.4}
  max={10}
  label="Overall Score"
  size="lg"
/>
```

---

## Performance Tips

1. **Static displays:** Set `animated={false}` if rendering many scores
2. **Lazy loading:** Import components dynamically for below-fold content
3. **Memoization:** Wrap in `React.memo()` if score rarely changes
4. **GPU acceleration:** All animations use CSS transforms (automatic)

```tsx
import dynamic from 'next/dynamic';

const ScoreDisplay = dynamic(
  () => import('@/components/ui/score-display').then(mod => mod.ScoreDisplay),
  { ssr: false }
);
```

---

## Troubleshooting

### Animations not working
- Ensure Framer Motion is installed: `npm install framer-motion`
- Check `animated` prop is `true`
- Verify CSS variables are defined in globals.css

### SVG rendering issues
- Some browsers require explicit `xmlns` on SVG elements
- Ensure viewBox is set correctly
- Check for CSS conflicts with `overflow: hidden`

### Gradient not showing
- Verify gradient IDs are unique if multiple instances on page
- Check `background-clip` support (needs `-webkit-` prefix)
- Ensure CSS variables are loaded

---

## Next Steps

1. Visit `/score-display-demo` to see all variants live
2. Replace `ScoreGauge` in `/src/app/blueprint-preview/page.tsx`
3. Choose variant based on use case and context
4. Customize colors/sizes as needed
5. Test accessibility with screen reader

---

## File Locations

**Component:**
`/Users/ammar/Dev-Projects/AI-GOS-main/src/components/ui/score-display.tsx`

**Demo Page:**
`/Users/ammar/Dev-Projects/AI-GOS-main/src/app/score-display-demo/page.tsx`

**Documentation:**
`/Users/ammar/Dev-Projects/AI-GOS-main/docs/SCORE-VISUALIZATION-RESEARCH.md`
`/Users/ammar/Dev-Projects/AI-GOS-main/docs/SCORE-DISPLAY-VISUAL-GUIDE.md`

---

*Last Updated: 2026-01-28*
