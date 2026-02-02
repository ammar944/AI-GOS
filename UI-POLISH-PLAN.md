# UI Polish Plan - AI-GOS (SaasLaunch)

## Current State
Already has solid foundation:
- ✅ Framer Motion with spring configs
- ✅ GlowCard, GlassCard, GradientBorder
- ✅ MagneticButton, gradient buttons
- ✅ OKLCH color system
- ✅ Motion utilities (fadeUp, stagger, etc.)
- ✅ Skeleton loaders in dashboard

## Improvements from Miana Design System

### Phase 1: Card Hover Effects
- [ ] Add hover lift to Card (scale 1.02 + shadow)
- [ ] Add hover lift to GlassCard
- [ ] Consistent hover on GlowCard

### Phase 2: Button Loading States
- [ ] Add loading prop to Button with spinner
- [ ] Ensure all async actions use loading state

### Phase 3: Animation Consistency
- [ ] Add CSS keyframe animations (shimmer, skeleton pulse)
- [ ] Ensure consistent transition timing (150-200ms)

### Phase 4: Page Polish
- [ ] Dashboard - full-height layout, internal scroll
- [ ] Generate page - loading states polish
- [ ] Blueprint view - card hover effects

### Phase 5: Micro-interactions
- [ ] Input focus animations
- [ ] Checkbox/switch animations
- [ ] Toast notifications

---

## CSS Animations to Add (from Miana)
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}
```

## Execution
Branch: `redesign/ui-polish-v2`
