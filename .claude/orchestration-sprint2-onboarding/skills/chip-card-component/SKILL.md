---
name: chip-card-component
description: AskUserCard interactive chip component patterns. Use when building the askUser tool card with tappable chips, multi-select, "Other" input, and Framer Motion animations.
---

## Target file
`src/components/journey/ask-user-card.tsx` — `'use client'`, named export, props interface suffixed `Props`.

---

## 1. Props & Result Types

```typescript
export type AskUserResult =
  | { fieldName: string; selectedLabel: string; selectedIndex: number }   // single-select
  | { fieldName: string; selectedLabels: string[]; selectedIndices: number[] } // multi-select
  | { fieldName: string; otherText: string };                              // "Other" free text

interface AskUserCardProps {
  fieldName: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  onSubmit: (result: AskUserResult) => void;
  disabled?: boolean;
  previousSelection?: AskUserResult; // for re-rendering answered state from history
}
```

---

## 2. State Machine: IDLE → SELECTING → OTHER_INPUT → SUBMITTED

```typescript
type ChipCardState = 'IDLE' | 'SELECTING' | 'OTHER_INPUT' | 'SUBMITTED';

const [cardState, setCardState] = useState<ChipCardState>('IDLE');
const [selectedChips, setSelectedChips] = useState<string[]>([]);
const [otherText, setOtherText] = useState('');
const [focusedIndex, setFocusedIndex] = useState(0);

const isSubmitted = cardState === 'SUBMITTED' || disabled;
const showOtherInput = cardState === 'OTHER_INPUT';
```

Transitions:
- `IDLE` → `SELECTING`: multi-select chip tapped
- `IDLE` / `SELECTING` → `OTHER_INPUT`: "Other" chip tapped
- Any → `SUBMITTED`: single-select tap (200ms delay then onSubmit), Done click, or Other text submit
- `SUBMITTED` + parent `disabled=true` → static render (no internal state needed)

Hydrate from history on mount:
```typescript
useEffect(() => {
  if (disabled && previousSelection) {
    if ('selectedLabel' in previousSelection) setSelectedChips([previousSelection.selectedLabel]);
    else if ('selectedLabels' in previousSelection) setSelectedChips(previousSelection.selectedLabels);
    else if ('otherText' in previousSelection) { setSelectedChips(['Other']); setOtherText(previousSelection.otherText); }
    setCardState('SUBMITTED');
  }
}, [disabled, previousSelection]);
```

---

## 3. Chip Styling (Design Tokens)

Shape rule: `const chipBorderRadius = options.some(o => o.description?.trim()) ? '12px' : '999px';`

**Default chip** (`style={{}}`):
```typescript
{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
  color: 'var(--text-secondary)', borderRadius: chipBorderRadius,
  padding: '10px 18px', minHeight: '40px', fontSize: '13px', fontWeight: 500,
  cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }
```

**Selected — single-select** (Framer Motion `animate` prop, raw RGB required):
```typescript
animate={isSelected ? {
  backgroundColor: 'rgb(54, 94, 255)',   // --accent-blue
  borderColor: 'rgb(54, 94, 255)',
  color: 'rgb(255, 255, 255)',
  boxShadow: '0 0 20px rgba(54, 94, 255, 0.15)',
  scale: [1, 1.05, 1],                   // 200ms pulse (D1)
} : { backgroundColor: 'rgb(12, 14, 19)', borderColor: 'rgb(31, 31, 31)',
     color: 'rgb(205, 208, 213)', boxShadow: '0 0 0px rgba(54,94,255,0)', scale: 1 }}
transition={{ duration: 0.15, ease: 'easeOut' }}
```

**Selected — multi-select** (inline style is fine, no animation needed):
```typescript
{ background: 'var(--accent-blue-subtle)', borderColor: 'rgba(54,94,255,0.6)',
  color: 'var(--accent-blue)' }
```

**Unselected after submit**: `opacity: 0.5, cursor: 'default', pointerEvents: 'none'`

**"Other" chip** (dashed, transparent, `--text-tertiary`, D3):
```typescript
{ borderStyle: 'dashed', background: 'transparent', borderColor: 'var(--border-default)',
  color: 'var(--text-tertiary)', borderRadius: chipBorderRadius, padding: '10px 18px',
  minHeight: '40px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '6px' }
```

Hover (all chips via `whileHover`):
```typescript
whileHover={{ scale: 1.03, boxShadow: '0 0 16px rgba(54, 94, 255, 0.15)' }}
```

With description — add `flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: '2px'` plus:
```tsx
<span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-tertiary)' }}>{opt.description}</span>
```

---

## 4. Animations (`src/lib/motion.ts` presets)

```typescript
import { springs, durations } from '@/lib/motion';
// springs.smooth = { type:'spring', stiffness:400, damping:30 }
// springs.snappy = { type:'spring', stiffness:500, damping:30 }
// durations.fast = 0.15, durations.normal = 0.3
```

**Card container entrance** (matches EditApprovalCard):
```typescript
<motion.div initial={{ opacity:0, y:10, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
  transition={{ ...springs.smooth, duration: 0.3 }} className="my-2">
```

**Chip staggered entrance**:
```typescript
const chipContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
const chipItemVariants: Variants = {
  hidden: { opacity:0, y:8, scale:0.95 },
  visible: { opacity:1, y:0, scale:1, transition: { duration:0.25, ease:[0.22,1,0.36,1] } },
};
// Wrap chips: <motion.div variants={chipContainerVariants} initial="hidden" animate="visible">
// Each chip:  <motion.button variants={chipItemVariants} ...>
```

**"Other" text input expand** (AnimatePresence):
```typescript
<AnimatePresence>
  {showOtherInput && (
    <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
      exit={{ height:0, opacity:0 }} transition={{ duration:0.2, ease:[0.22,1,0.36,1] }}
      className="overflow-hidden mt-2">
      {/* input */}
    </motion.div>
  )}
</AnimatePresence>
```

**Multi-select checkmark** (AnimatePresence inside chip):
```typescript
<AnimatePresence>
  {isSelected && (
    <motion.span initial={{ width:0, opacity:0 }} animate={{ width:16, opacity:1 }}
      exit={{ width:0, opacity:0 }} transition={{ duration:0.15 }}
      className="inline-flex items-center overflow-hidden">
      <Check className="w-3.5 h-3.5" />
    </motion.span>
  )}
</AnimatePresence>
```

**Done button entrance** (AnimatePresence):
```typescript
<AnimatePresence>
  {multiSelect && selectedChips.length > 0 && !disabled && (
    <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
      exit={{ opacity:0, y:-4 }} transition={{ duration: durations.fast, ease:'easeOut' }}
      className="flex justify-end mt-2">
      <MagneticButton onClick={handleDoneClick} className="h-9 rounded-full px-5 text-sm font-medium"
        style={{ background:'var(--accent-blue)', color:'#ffffff' }}>Done</MagneticButton>
    </motion.div>
  )}
</AnimatePresence>
```

---

## 5. Key Event Handlers

**Single-select** — 200ms delay then submit (D1):
```typescript
setSelectedChips([label]); setCardState('SUBMITTED');
setTimeout(() => onSubmit({ fieldName, selectedLabel: label, selectedIndex: index }), 200);
```

**Multi-select Done**:
```typescript
const regularChips = selectedChips.filter(c => c !== 'Other');
const indices = regularChips.map(l => options.findIndex(o => o.label === l));
// If Other selected AND otherText present, include 'Other' in selectedLabels
onSubmit({ fieldName, selectedLabels: regularChips, selectedIndices: indices });
```

**Other submit**:
```typescript
onSubmit({ fieldName, otherText: otherText.trim() });
```

---

## 6. Accessibility

**Single-select** — radiogroup pattern:
```tsx
<motion.div role="radiogroup" aria-label={`Select your ${fieldName}`} aria-disabled={isSubmitted}>
  <motion.button role="radio" aria-checked={isSelected}
    tabIndex={focusedIndex === i ? 0 : -1} // roving tabindex
    ref={el => { chipRefs.current[i] = el; }} ...>
```

**Multi-select** — group + checkbox:
```tsx
<motion.div role="group" aria-label={`Select your ${fieldName} (multiple allowed)`}>
  <motion.button role="checkbox" aria-checked={isSelected} tabIndex={0} ...>
```

**Roving tabindex keyboard nav** (single-select; Arrow keys move focus):
```typescript
const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
// onKeyDown on each chip:
case 'ArrowRight': case 'ArrowDown': {
  e.preventDefault(); const next = (index + 1) % totalChips;
  setFocusedIndex(next); chipRefs.current[next]?.focus(); break;
}
case 'ArrowLeft': case 'ArrowUp': {
  e.preventDefault(); const prev = (index - 1 + totalChips) % totalChips;
  setFocusedIndex(prev); chipRefs.current[prev]?.focus(); break;
}
case ' ': case 'Enter': { e.preventDefault(); handleChipClick(label, index); break; }
```

**Focus ring** (keyboard only):
```typescript
className="focus-visible:outline-2 focus-visible:outline-[rgb(54,94,255)] focus-visible:outline-offset-2"
```

**Screen reader live region**:
```tsx
<div aria-live="polite" className="sr-only">
  {isSubmitted && `Selected: ${selectedChips.join(', ')}${otherText ? `. Other: ${otherText}` : ''}`}
</div>
```

---

## 7. addToolOutput Result Structure (D8)

```typescript
// Single-select:  { fieldName: 'businessModel', selectedLabel: 'B2B SaaS', selectedIndex: 0 }
// Multi-select:   { fieldName: 'channels', selectedLabels: ['SEO', 'Paid'], selectedIndices: [0, 2] }
// Other:          { fieldName: 'businessModel', otherText: 'Consulting firm' }

// Parent call in journey/page.tsx:
addToolOutput({ tool: 'askUser', toolCallId, output: result });
```

---

## 8. Rendering in chat-message.tsx

Check `askUser` BEFORE the generic `input-available` catch-all (which would render a loading indicator):

```typescript
if (toolName === 'askUser' && input) {
  if (state === 'input-streaming') return <ToolLoadingIndicator key={key} toolName={toolName} args={input} />;
  if (state === 'input-available' || state === 'output-available') {
    const isAnswered = state === 'output-available';
    return (
      <AskUserCard key={key} fieldName={input.fieldName as string}
        options={input.options as Array<{ label: string; description?: string }>}
        multiSelect={input.multiSelect as boolean}
        onSubmit={(result) => { if (!isAnswered && toolCallId && onToolOutput) onToolOutput(toolCallId, result); }}
        disabled={isAnswered}
        previousSelection={isAnswered ? (output as AskUserResult | undefined) : undefined}
      />
    );
  }
}
```

Add `onToolOutput?: (toolCallId: string, output: unknown) => void` to `ChatMessageProps`.
