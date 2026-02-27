# Fix #8 & #9: Chat Panel Width + Message Animations

## Fix #8: Chat Panel Width (440px → 340px)

### Current Implementation
**File**: `src/components/journey/journey-layout.tsx` (line 32)
```tsx
style={{
  width: isCentered ? '100%' : '440px',
  maxWidth: isCentered ? '720px' : '440px',
}}
```

### Design Token Already Exists
**File**: `src/app/globals.css` (line 231)
```css
--chat-width: 340px;
```

### Fix
Replace `440px` with `var(--chat-width)`:
```tsx
width: isCentered ? '100%' : 'var(--chat-width)',
maxWidth: isCentered ? '720px' : 'var(--chat-width)',
```

---

## Fix #9: Message Entrance Animations

### Current State
- `chat-message.tsx` has NO animation classes
- Messages appear instantly

### Available Infrastructure

1. **framer-motion** (`^12.26.1`) — already in deps, used in blueprint-preview
2. **tw-animate-css** (`^1.4.0`) — Tailwind animation utilities
3. **Custom keyframes** in globals.css:
   ```css
   @keyframes stream-fade-in {
     from { opacity: 0; transform: translateY(2px); }
     to { opacity: 1; transform: translateY(0); }
   }
   ```

### Existing Pattern (blueprint-preview)
```typescript
const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};
```

### Recommended: Framer Motion
Wrap ChatMessage with `motion.div`:
```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
>
  <ChatMessage ... />
</motion.div>
```

### Component Structure
- `UserMessage` accepts `className` prop — can receive animation classes
- `AssistantMessage` accepts `className` prop — same
- Messages rendered in `journey/page.tsx` (lines 70-102)

### Timing
- 300-500ms duration (matches existing codebase patterns)
- Cubic-bezier `[0.22, 1, 0.36, 1]` easing
- Subtle upward translate (12-24px)
