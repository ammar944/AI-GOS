# AskUserCard Chip Component -- Implementation Guide

**Date**: 2026-02-27
**Author**: Second-wave research agent
**Depends on**: DISCOVERY.md (authority), chip-ui-patterns.md, ai-sdk-tool-patterns.md
**Target file**: `src/components/journey/ask-user-card.tsx`
**Status**: Ready for implementation

---

## 1. Component Architecture

### 1.1 File Location & Conventions

```
src/components/journey/ask-user-card.tsx
```

Following codebase conventions:
- `'use client'` directive at top
- Named export: `export function AskUserCard(...)`
- Props interface suffixed with `Props`: `AskUserCardProps`
- `cn()` utility from `@/lib/utils` for conditional classes
- Framer Motion imported from `'framer-motion'`
- CSS variable references via `style={{}}` for design tokens, Tailwind for layout utilities

### 1.2 Props Interface

```typescript
interface AskUserCardProps {
  /** The question the agent is asking (not rendered by the card -- text appears in the message above) */
  fieldName: string;
  /** Options for the user to choose from */
  options: Array<{ label: string; description?: string }>;
  /** Whether the user can select multiple options */
  multiSelect: boolean;
  /** Callback when user submits their selection. Receives structured JSON for addToolOutput. */
  onSubmit: (result: AskUserResult) => void;
  /** Whether the card is in answered/disabled state (output-available) */
  disabled?: boolean;
  /** Previously selected values (for re-rendering answered state from message history) */
  previousSelection?: AskUserResult;
}
```

### 1.3 Result Type

```typescript
type AskUserResult =
  | { fieldName: string; selectedLabel: string; selectedIndex: number }           // single-select
  | { fieldName: string; selectedLabels: string[]; selectedIndices: number[] }    // multi-select
  | { fieldName: string; otherText: string };                                      // "Other" free text
```

This matches D8 from DISCOVERY.md exactly.

### 1.4 Parent-Child Relationship

```
journey/page.tsx
  └── useChat() hook provides: addToolOutput, messages
  └── <ChatMessage> for each message
        └── renderToolPart(part, key, onToolApproval, onToolOutput)
              └── if toolName === 'askUser' && state === 'input-available':
                    <AskUserCard
                      fieldName={input.fieldName}
                      options={input.options}
                      multiSelect={input.multiSelect}
                      onSubmit={(result) => onToolOutput(toolCallId, result)}
                      disabled={false}
                    />
              └── if toolName === 'askUser' && state === 'output-available':
                    <AskUserCard
                      fieldName={input.fieldName}
                      options={input.options}
                      multiSelect={input.multiSelect}
                      onSubmit={() => {}} // noop
                      disabled={true}
                      previousSelection={output}
                    />
```

---

## 2. Exact Prop Flow (AI SDK Tool Call to User Interaction)

### 2.1 End-to-End Data Flow

```
Step 1: Agent calls askUser tool
  Server streamText -> tool call emitted -> streamed to client

Step 2: AI SDK processes tool part
  message.parts receives: {
    type: 'tool-askUser',
    toolCallId: 'call_abc123',
    state: 'input-streaming', // then transitions to 'input-available'
    input: {
      question: 'What type of business do you run?',
      options: [
        { label: 'B2B SaaS', description: 'Software sold to businesses' },
        { label: 'B2C / DTC', description: 'Direct to consumer products' },
        { label: 'Marketplace', description: 'Two-sided platform' },
      ],
      multiSelect: false,
      fieldName: 'businessModel',
    },
  }

Step 3: chat-message.tsx renderToolPart detects state
  state === 'input-streaming' -> show ToolLoadingIndicator (existing)
  state === 'input-available' -> render AskUserCard (NEW)

Step 4: AskUserCard renders interactive chips
  User sees pill-shaped buttons for each option + "Other"

Step 5: User taps a chip (e.g., "B2B SaaS")
  AskUserCard internal:
    1. Sets selectedChips state -> ['B2B SaaS']
    2. For single-select: 200ms animation delay, then calls onSubmit()
    3. onSubmit receives: { fieldName: 'businessModel', selectedLabel: 'B2B SaaS', selectedIndex: 0 }

Step 6: Parent calls addToolOutput
  journey/page.tsx:
    addToolOutput({
      tool: 'askUser',
      toolCallId: 'call_abc123',
      output: { fieldName: 'businessModel', selectedLabel: 'B2B SaaS', selectedIndex: 0 },
    })

Step 7: SDK updates part state
  Part transitions: input-available -> output-available
  sendAutomaticallyWhen fires (sees complete tool calls) -> new server round trip

Step 8: Card re-renders in disabled state
  AskUserCard receives disabled=true, previousSelection containing the selection
  Chips become static, selected chip highlighted, unselected dimmed
```

### 2.2 Integration into renderToolPart (chat-message.tsx)

The existing `renderToolPart` function needs a new parameter for `onToolOutput` and a new case for `askUser`. Here is the exact insertion point:

```typescript
// In renderToolPart(), BEFORE the loading states check at the top:

function renderToolPart(
  part: Record<string, unknown>,
  key: string,
  onToolApproval?: (approvalId: string, approved: boolean) => void,
  onToolOutput?: (toolCallId: string, output: unknown) => void, // NEW PARAM
): React.ReactNode {
  const toolName = (part.type as string).replace('tool-', '');
  const state = part.state as string;
  const input = part.input as Record<string, unknown> | undefined;
  const output = part.output as Record<string, unknown> | undefined;
  const toolCallId = part.toolCallId as string | undefined;

  // ── askUser tool (interactive, no execute) ──
  // Must be checked BEFORE the generic loading states because
  // askUser in 'input-available' should render chips, NOT the loading indicator
  if (toolName === 'askUser' && input) {
    if (state === 'input-streaming') {
      return <ToolLoadingIndicator key={key} toolName={toolName} args={input} />;
    }
    if (state === 'input-available' || state === 'output-available') {
      const isAnswered = state === 'output-available';
      return (
        <AskUserCard
          key={key}
          fieldName={input.fieldName as string}
          options={input.options as Array<{ label: string; description?: string }>}
          multiSelect={input.multiSelect as boolean}
          onSubmit={(result) => {
            if (!isAnswered && toolCallId && onToolOutput) {
              onToolOutput(toolCallId, result);
            }
          }}
          disabled={isAnswered}
          previousSelection={isAnswered ? (output as AskUserResult | undefined) : undefined}
        />
      );
    }
  }

  // ... existing loading states, error states, output-available switch, etc.
}
```

**Critical**: The `askUser` check MUST come before the generic `input-available` catch-all on line 281 of the current `chat-message.tsx`, because that catch-all renders `ToolLoadingIndicator` for ALL tools in `input-available` state. The `askUser` tool needs to render chips instead.

### 2.3 Wiring in journey/page.tsx

```typescript
// In journey/page.tsx, destructure addToolOutput from useChat:
const { messages, sendMessage, addToolApprovalResponse, addToolOutput, status, error, setMessages } = useChat({
  transport,
  sendAutomaticallyWhen: (options) =>
    lastAssistantMessageIsCompleteWithToolCalls(options) ||
    lastAssistantMessageIsCompleteWithApprovalResponses(options),
  // ...
});

// Pass both callbacks down to ChatMessage:
<ChatMessage
  key={message.id}
  messageId={message.id}
  role={message.role as 'user' | 'assistant'}
  parts={message.parts}
  isStreaming={isThisMessageStreaming}
  onToolApproval={(approvalId, approved) =>
    addToolApprovalResponse({ id: approvalId, approved })
  }
  onToolOutput={(toolCallId, output) =>
    addToolOutput({ tool: 'askUser', toolCallId, output })
  }
/>
```

ChatMessage props interface needs extending:
```typescript
interface ChatMessageProps {
  // ... existing props
  onToolOutput?: (toolCallId: string, output: unknown) => void; // NEW
}
```

---

## 3. CSS / Styling Specification

All colors reference CSS variables from `src/app/globals.css`. Use `style={{}}` for CSS variable references per codebase convention.

### 3.1 Chip Default State (Label-Only = Pill, With Description = Rounded Rect)

**Pill chip (no description -- `border-radius: 999px` per D2):**
```typescript
style={{
  background: 'var(--bg-surface)',        // rgb(12, 14, 19)
  border: '1px solid var(--border-default)', // rgb(31, 31, 31)
  color: 'var(--text-secondary)',          // rgb(205, 208, 213)
  borderRadius: '999px',                   // pill per D2
  padding: '10px 18px',
  minHeight: '40px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
}}
```

**Rounded-rect chip (with description -- `border-radius: 12px` per D2):**
```typescript
style={{
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-secondary)',
  borderRadius: '12px',                    // rounded rect per D2
  padding: '10px 16px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'flex-start',
  textAlign: 'left' as const,
  gap: '2px',
}}
// Description text inside:
<span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-tertiary)' }}>
  {description}
</span>
```

**Detection logic:**
```typescript
const hasDescriptions = options.some((opt) => opt.description && opt.description.trim() !== '');
const chipBorderRadius = hasDescriptions ? '12px' : '999px';
```

### 3.2 Chip Hover State

Handled via Framer Motion `whileHover` (not CSS) so it works with motion.button:
```typescript
whileHover={{
  scale: 1.03,
  boxShadow: '0 0 16px rgba(54, 94, 255, 0.15)',  // --accent-blue-glow
}}
```

Additional hover styling via `animate` prop or inline state:
```typescript
// The hover background/border is handled by Framer Motion animate:
// On hover: bg -> var(--bg-hover), border -> accent-blue at 40%
// Using whileHover for the interactive parts, CSS transition for color
```

### 3.3 Chip Selected State (Single-Select)

Solid accent-blue background with white text and glow (per D1):
```typescript
// When isSelected && !multiSelect:
style: {
  background: 'var(--accent-blue)',          // rgb(54, 94, 255)
  borderColor: 'var(--accent-blue)',
  color: '#ffffff',
  boxShadow: '0 0 20px var(--accent-blue-glow)', // rgba(54, 94, 255, 0.15)
}
```

### 3.4 Chip Selected State (Multi-Select -- Subtle Variant)

Subtle accent background with accent text and checkmark:
```typescript
// When isSelected && multiSelect:
style: {
  background: 'var(--accent-blue-subtle)',    // rgba(51, 136, 255, 0.09)
  borderColor: 'rgba(54, 94, 255, 0.6)',
  color: 'var(--accent-blue)',                // rgb(54, 94, 255)
}
```

### 3.5 Chip Disabled/Submitted State

After submission, all chips become static:
```typescript
// Unselected chip (disabled):
style: {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-tertiary)',              // rgb(100, 105, 115)
  opacity: 0.5,
  cursor: 'default',
  pointerEvents: 'none' as const,
}

// Selected chip (disabled) -- stays more visible:
style: {
  background: 'var(--accent-blue-subtle)',    // or solid accent-blue for single-select
  border: '1px solid rgba(54, 94, 255, 0.6)',
  color: 'var(--accent-blue)',
  opacity: 0.8,                               // dimmed but still prominent
  cursor: 'default',
  pointerEvents: 'none' as const,
}
```

### 3.6 "Other" Chip (Dashed Border per D3)

```typescript
style={{
  borderStyle: 'dashed',
  background: 'transparent',
  borderColor: 'var(--border-default)',       // rgb(31, 31, 31)
  color: 'var(--text-tertiary)',              // rgb(100, 105, 115)
  borderRadius: chipBorderRadius,             // matches other chips
  padding: '10px 18px',
  minHeight: '40px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  userSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
}}
```

### 3.7 "Done" Button (Multi-Select Confirm)

Uses MagneticButton matching EditApprovalCard pattern:
```typescript
<MagneticButton
  onClick={handleDoneClick}
  className="h-9 rounded-full px-5 text-sm font-medium"
  style={{
    background: 'var(--accent-blue)',
    color: '#ffffff',
  }}
>
  Done
</MagneticButton>
```

### 3.8 "Other" Text Input

```typescript
style={{
  background: 'var(--bg-input)',              // #0e1017
  border: '1px solid var(--border-default)',  // rgb(31, 31, 31)
  borderRadius: '12px',
  padding: '10px 14px',
  paddingRight: '40px',                       // room for submit button
  color: 'var(--text-primary)',               // rgb(252, 252, 250)
  fontSize: '13px',
  width: '100%',
  outline: 'none',
}}
// Focus state adds:
// borderColor: 'var(--border-focus)' -> rgb(54, 94, 255)
// boxShadow: '0 0 0 3px var(--accent-blue-glow)'
```

### 3.9 Focus-Visible Ring (Keyboard Users Only)

Applied via className (not Framer Motion -- pointer-only):
```typescript
className={cn(
  'focus-visible:outline-2 focus-visible:outline-offset-2',
)}
// Plus inline style for the outline color:
// outline-color: var(--accent-blue)
```

Or as a CSS class in globals.css if needed (but prefer inline for component isolation).

---

## 4. Animation Specifications

All animations use existing `src/lib/motion.ts` presets where possible. Import:
```typescript
import { springs, durations } from '@/lib/motion';
```

### 4.1 Card Container Entrance

Matches EditApprovalCard pattern exactly:
```typescript
<motion.div
  initial={{ opacity: 0, y: 10, scale: 0.97 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ ...springs.smooth, duration: 0.3 }}
  className="my-2"
>
  {/* chip group inside */}
</motion.div>
```

### 4.2 Chip Staggered Entrance

Custom variants that extend the existing `staggerContainer` / `staggerItem` pattern but with tighter values for chips (50ms stagger instead of 100ms, 8px y-offset instead of 20px):

```typescript
const chipContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,  // 50ms between each chip
      delayChildren: 0.1,      // 100ms after card appears
    },
  },
};

const chipItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.22, 1, 0.36, 1], // matches fadeInUp ease in chat-message.tsx
    },
  },
};

// Usage:
<motion.div
  variants={chipContainerVariants}
  initial="hidden"
  animate="visible"
  className="flex flex-wrap gap-2"
  role={multiSelect ? 'group' : 'radiogroup'}
  aria-label={`Select ${fieldName}`}
>
  {options.map((opt, index) => (
    <motion.button
      key={opt.label}
      variants={chipItemVariants}
      // ... chip props
    >
      {opt.label}
    </motion.button>
  ))}
</motion.div>
```

### 4.3 Selection Highlight Animation (200ms Glow per D1)

Single-select: chip pulses on selection before submitting.

```typescript
const pulseVariants: Variants = {
  idle: { scale: 1 },
  selected: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

// On the selected chip's motion.button:
<motion.button
  animate={isSelected ? 'selected' : 'idle'}
  variants={pulseVariants}
  // The color transition is handled by the animate prop:
  style={isSelected ? selectedStyle : defaultStyle}
>
```

For color transitions, use Framer Motion's `animate` prop with raw values (not CSS variables, because Framer Motion can't interpolate CSS variable strings):

```typescript
animate={isSelected ? {
  backgroundColor: 'rgb(54, 94, 255)',    // --accent-blue
  borderColor: 'rgb(54, 94, 255)',
  color: 'rgb(255, 255, 255)',
  boxShadow: '0 0 20px rgba(54, 94, 255, 0.15)',
  scale: [1, 1.05, 1],                    // pulse
} : {
  backgroundColor: 'rgb(12, 14, 19)',     // --bg-surface
  borderColor: 'rgb(31, 31, 31)',         // --border-default
  color: 'rgb(205, 208, 213)',            // --text-secondary
  boxShadow: '0 0 0px rgba(54, 94, 255, 0)',
  scale: 1,
}}
transition={{ duration: 0.15, ease: 'easeOut' }}
```

### 4.4 Fade Out of Unselected Chips (Single-Select Post-Submit)

After single-select submission, unselected chips fade to dimmed state:

```typescript
// On unselected chips when disabled:
<motion.div
  animate={{
    opacity: 0.4,
    scale: 0.98,
  }}
  transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
>
```

### 4.5 "Other" Text Input Expand Animation

Uses AnimatePresence for mount/unmount animation:

```typescript
<AnimatePresence>
  {showOtherInput && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1],  // matches chip entrance easing
      }}
      className="overflow-hidden mt-2"
    >
      <div className="relative">
        <input
          type="text"
          autoFocus
          placeholder="Tell us more..."
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && otherText.trim()) {
              handleOtherSubmit();
            }
          }}
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '10px 40px 10px 14px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            width: '100%',
            outline: 'none',
          }}
        />
        <button
          onClick={handleOtherSubmit}
          disabled={!otherText.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg"
          style={{
            background: otherText.trim() ? 'var(--accent-blue)' : 'transparent',
            color: otherText.trim() ? '#ffffff' : 'var(--text-quaternary)',
            transition: 'all 0.15s ease',
          }}
          aria-label="Submit other text"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

### 4.6 Submit Transition (Chips Become Static)

After `onSubmit` fires, the card transitions from interactive to static via the `disabled` prop changing to `true`. The parent re-renders when the tool part state changes from `input-available` to `output-available`.

The transition is handled by wrapping the entire chip group in a motion.div:

```typescript
<motion.div
  animate={{ opacity: disabled ? 0.7 : 1 }}
  transition={{ duration: 0.3 }}
>
  {/* chips */}
</motion.div>
```

### 4.7 Multi-Select Checkmark Entrance

When toggling a chip in multi-select mode, a checkmark icon slides in:

```typescript
<AnimatePresence>
  {isSelected && (
    <motion.span
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 16, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="inline-flex items-center overflow-hidden"
    >
      <Check className="w-3.5 h-3.5" />
    </motion.span>
  )}
</AnimatePresence>
```

### 4.8 "Done" Button Entrance/Exit

```typescript
<AnimatePresence>
  {multiSelect && selectedChips.length > 0 && !disabled && (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: durations.fast, ease: 'easeOut' }}  // 0.15s
      className="flex justify-end mt-2"
    >
      <MagneticButton
        onClick={handleDoneClick}
        className="h-9 rounded-full px-5 text-sm font-medium"
        style={{ background: 'var(--accent-blue)', color: '#ffffff' }}
      >
        Done
      </MagneticButton>
    </motion.div>
  )}
</AnimatePresence>
```

---

## 5. State Machine

### 5.1 States

```typescript
type ChipCardState = 'IDLE' | 'SELECTING' | 'OTHER_INPUT' | 'SUBMITTED';
```

| State | Description | User Can... |
|-------|-------------|-------------|
| `IDLE` | Chips rendered, none selected | Tap any chip |
| `SELECTING` | Multi-select: at least one chip toggled | Toggle more chips, tap "Done" |
| `OTHER_INPUT` | "Other" chip tapped, text input expanded | Type text, submit, or cancel |
| `SUBMITTED` | Selection sent via onSubmit, waiting for disabled prop | Nothing (brief ~200ms window) |

### 5.2 State Transitions

```
                        ┌──────────────────┐
                        │       IDLE       │
                        └──────┬───────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
          (single-select) (multi-select) (tap "Other")
                 │             │             │
                 │      ┌──────▼──────┐      │
                 │      │  SELECTING  │      │
                 │      └──────┬──────┘      │
                 │             │             │
                 │      (tap "Done" or       │
                 │       tap "Other")     ┌──▼──────────┐
                 │             │          │ OTHER_INPUT  │
                 │             │          └──────┬───────┘
                 │             │                 │
                 │             │          (submit text)
                 │             │                 │
                 ▼             ▼                 ▼
              ┌────────────────────────────────────┐
              │           SUBMITTED                 │
              └────────────────────────────────────┘
                               │
                    (parent sets disabled=true)
                               │
                     ┌─────────▼──────────┐
                     │ STATIC (via props) │
                     └────────────────────┘
```

### 5.3 React State Implementation

```typescript
// Internal state:
const [cardState, setCardState] = useState<ChipCardState>('IDLE');
const [selectedChips, setSelectedChips] = useState<string[]>([]);
const [otherText, setOtherText] = useState('');
const [focusedIndex, setFocusedIndex] = useState(0);

// Derived state:
const showOtherInput = cardState === 'OTHER_INPUT';
const isSubmitted = cardState === 'SUBMITTED' || disabled;

// Initialize from previousSelection when disabled (history re-render):
useEffect(() => {
  if (disabled && previousSelection) {
    if ('selectedLabel' in previousSelection) {
      setSelectedChips([previousSelection.selectedLabel]);
    } else if ('selectedLabels' in previousSelection) {
      setSelectedChips(previousSelection.selectedLabels);
    } else if ('otherText' in previousSelection) {
      setSelectedChips(['Other']);
      setOtherText(previousSelection.otherText);
    }
    setCardState('SUBMITTED');
  }
}, [disabled, previousSelection]);
```

### 5.4 Event Handlers

```typescript
const handleChipClick = useCallback((label: string, index: number) => {
  if (isSubmitted) return;

  // "Other" chip
  if (label === 'Other') {
    if (multiSelect) {
      // Toggle Other in multi-select
      const isCurrentlySelected = selectedChips.includes('Other');
      if (isCurrentlySelected) {
        setSelectedChips((prev) => prev.filter((c) => c !== 'Other'));
        setCardState(selectedChips.length > 1 ? 'SELECTING' : 'IDLE');
        setOtherText('');
      } else {
        setSelectedChips((prev) => [...prev, 'Other']);
        setCardState('OTHER_INPUT');
      }
    } else {
      // Single-select "Other" -> show text input
      setSelectedChips(['Other']);
      setCardState('OTHER_INPUT');
    }
    return;
  }

  if (multiSelect) {
    // Toggle chip
    setSelectedChips((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]
    );
    setCardState('SELECTING');
  } else {
    // Single-select: immediate submit with animation delay
    setSelectedChips([label]);
    setCardState('SUBMITTED');
    setTimeout(() => {
      onSubmit({ fieldName, selectedLabel: label, selectedIndex: index });
    }, 200); // D1: 200ms highlight animation
  }
}, [isSubmitted, multiSelect, selectedChips, fieldName, onSubmit]);

const handleDoneClick = useCallback(() => {
  if (isSubmitted || selectedChips.length === 0) return;

  setCardState('SUBMITTED');

  // Build result
  const regularChips = selectedChips.filter((c) => c !== 'Other');
  const indices = regularChips.map((label) =>
    options.findIndex((opt) => opt.label === label)
  );

  if (selectedChips.includes('Other') && otherText.trim()) {
    // Multi-select with "Other"
    onSubmit({
      fieldName,
      selectedLabels: [...regularChips, 'Other'],
      selectedIndices: [...indices, options.length], // Other is virtual index
    });
  } else {
    onSubmit({
      fieldName,
      selectedLabels: regularChips,
      selectedIndices: indices,
    });
  }
}, [isSubmitted, selectedChips, otherText, options, fieldName, onSubmit]);

const handleOtherSubmit = useCallback(() => {
  if (!otherText.trim()) return;
  setCardState('SUBMITTED');
  onSubmit({ fieldName, otherText: otherText.trim() });
}, [otherText, fieldName, onSubmit]);
```

---

## 6. Accessibility

### 6.1 ARIA Roles

**Single-select** uses the WAI-ARIA **radiogroup** pattern:

```tsx
<motion.div
  role="radiogroup"
  aria-label={`Select your ${fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
  aria-required="true"
  aria-disabled={isSubmitted}
>
  {options.map((opt, i) => (
    <motion.button
      key={opt.label}
      role="radio"
      aria-checked={selectedChips.includes(opt.label)}
      aria-disabled={isSubmitted}
      tabIndex={focusedIndex === i ? 0 : -1}  // roving tabindex
      // ...
    />
  ))}
</motion.div>
```

**Multi-select** uses the **group** pattern with checkbox semantics:

```tsx
<motion.div
  role="group"
  aria-label={`Select your ${fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()} (multiple allowed)`}
  aria-disabled={isSubmitted}
>
  {options.map((opt, i) => (
    <motion.button
      key={opt.label}
      role="checkbox"
      aria-checked={selectedChips.includes(opt.label)}
      aria-disabled={isSubmitted}
      tabIndex={0}  // all checkboxes are tabbable
      // ...
    />
  ))}
</motion.div>
```

### 6.2 Keyboard Navigation

```typescript
const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
  const totalChips = options.length + 1; // +1 for "Other"

  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown': {
      e.preventDefault();
      const next = (index + 1) % totalChips;
      setFocusedIndex(next);
      chipRefs.current[next]?.focus();
      break;
    }
    case 'ArrowLeft':
    case 'ArrowUp': {
      e.preventDefault();
      const prev = (index - 1 + totalChips) % totalChips;
      setFocusedIndex(prev);
      chipRefs.current[prev]?.focus();
      break;
    }
    case ' ':
    case 'Enter': {
      e.preventDefault();
      if (index < options.length) {
        handleChipClick(options[index].label, index);
      } else {
        handleChipClick('Other', index);
      }
      break;
    }
  }
}, [options, handleChipClick]);
```

### 6.3 Screen Reader Announcements

```tsx
{/* Live region for submission confirmation */}
<div aria-live="polite" className="sr-only">
  {isSubmitted && selectedChips.length > 0 &&
    `Selected: ${selectedChips.join(', ')}${otherText ? `. Other: ${otherText}` : ''}`
  }
</div>
```

### 6.4 Description Association

If options have descriptions, associate them via `aria-describedby`:

```tsx
<motion.button
  role="radio"
  aria-checked={isSelected}
  aria-describedby={opt.description ? `${fieldName}-${i}-desc` : undefined}
>
  <span>{opt.label}</span>
  {opt.description && (
    <span
      id={`${fieldName}-${i}-desc`}
      style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
    >
      {opt.description}
    </span>
  )}
</motion.button>
```

### 6.5 Focus-Visible Ring

Handled via Tailwind utility classes (works for keyboard, not pointer):
```typescript
className="focus-visible:outline-2 focus-visible:outline-[rgb(54,94,255)] focus-visible:outline-offset-2"
```

---

## 7. Full Component Code Skeleton

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Check, Plus, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs, durations } from '@/lib/motion';
import { MagneticButton } from '@/components/ui/magnetic-button';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChipCardState = 'IDLE' | 'SELECTING' | 'OTHER_INPUT' | 'SUBMITTED';

/** Structured result matching D8 from DISCOVERY.md */
export type AskUserResult =
  | { fieldName: string; selectedLabel: string; selectedIndex: number }
  | { fieldName: string; selectedLabels: string[]; selectedIndices: number[] }
  | { fieldName: string; otherText: string };

interface AskUserCardProps {
  fieldName: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  onSubmit: (result: AskUserResult) => void;
  disabled?: boolean;
  previousSelection?: AskUserResult;
}

// ─── Animation Variants ──────────────────────────────────────────────────────

const chipContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const chipItemVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// ─── Color Constants (raw RGB for Framer Motion interpolation) ───────────────

const COLORS = {
  bgSurface: 'rgb(12, 14, 19)',
  bgHover: 'rgb(20, 23, 30)',
  bgInput: 'rgb(14, 16, 23)',
  borderDefault: 'rgb(31, 31, 31)',
  borderFocus: 'rgb(54, 94, 255)',
  textPrimary: 'rgb(252, 252, 250)',
  textSecondary: 'rgb(205, 208, 213)',
  textTertiary: 'rgb(100, 105, 115)',
  accentBlue: 'rgb(54, 94, 255)',
  accentBlueSubtle: 'rgba(51, 136, 255, 0.09)',
  accentBlueBorder: 'rgba(54, 94, 255, 0.6)',
  accentBlueGlow: 'rgba(54, 94, 255, 0.15)',
  white: 'rgb(255, 255, 255)',
  noShadow: '0 0 0px rgba(54, 94, 255, 0)',
  selectedGlow: '0 0 20px rgba(54, 94, 255, 0.15)',
  hoverGlow: '0 0 16px rgba(54, 94, 255, 0.15)',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AskUserCard({
  fieldName,
  options,
  multiSelect,
  onSubmit,
  disabled = false,
  previousSelection,
}: AskUserCardProps) {
  // ── State ──
  const [cardState, setCardState] = useState<ChipCardState>('IDLE');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [otherText, setOtherText] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // ── Derived ──
  const isSubmitted = cardState === 'SUBMITTED' || disabled;
  const showOtherInput = cardState === 'OTHER_INPUT';
  const hasDescriptions = options.some((opt) => opt.description?.trim());
  const chipBorderRadius = hasDescriptions ? '12px' : '999px';

  // Total chips = options + "Other"
  const totalChips = options.length + 1;

  // ── Hydrate from previous selection (message history re-render) ──
  useEffect(() => {
    if (disabled && previousSelection) {
      if ('selectedLabel' in previousSelection) {
        setSelectedChips([previousSelection.selectedLabel]);
      } else if ('selectedLabels' in previousSelection) {
        setSelectedChips(previousSelection.selectedLabels);
      } else if ('otherText' in previousSelection) {
        setSelectedChips(['Other']);
        setOtherText(previousSelection.otherText);
      }
      setCardState('SUBMITTED');
    }
  }, [disabled, previousSelection]);

  // ── Handlers ──

  const handleChipClick = useCallback(
    (label: string, index: number) => {
      if (isSubmitted) return;

      // "Other" chip
      if (label === 'Other') {
        if (multiSelect) {
          const wasSelected = selectedChips.includes('Other');
          if (wasSelected) {
            setSelectedChips((prev) => prev.filter((c) => c !== 'Other'));
            setOtherText('');
            setCardState(
              selectedChips.filter((c) => c !== 'Other').length > 0
                ? 'SELECTING'
                : 'IDLE'
            );
          } else {
            setSelectedChips((prev) => [...prev, 'Other']);
            setCardState('OTHER_INPUT');
          }
        } else {
          setSelectedChips(['Other']);
          setCardState('OTHER_INPUT');
        }
        return;
      }

      if (multiSelect) {
        setSelectedChips((prev) =>
          prev.includes(label)
            ? prev.filter((c) => c !== label)
            : [...prev, label]
        );
        setCardState('SELECTING');
      } else {
        // Single-select: immediate submit with 200ms feedback delay (D1)
        setSelectedChips([label]);
        setCardState('SUBMITTED');
        setTimeout(() => {
          onSubmit({ fieldName, selectedLabel: label, selectedIndex: index });
        }, 200);
      }
    },
    [isSubmitted, multiSelect, selectedChips, fieldName, onSubmit]
  );

  const handleDoneClick = useCallback(() => {
    if (isSubmitted || selectedChips.length === 0) return;
    setCardState('SUBMITTED');

    const regularChips = selectedChips.filter((c) => c !== 'Other');
    const indices = regularChips.map((label) =>
      options.findIndex((opt) => opt.label === label)
    );

    if (selectedChips.includes('Other') && otherText.trim()) {
      onSubmit({
        fieldName,
        selectedLabels: [...regularChips, 'Other'],
        selectedIndices: [...indices, options.length],
      });
    } else if (regularChips.length === 1) {
      onSubmit({
        fieldName,
        selectedLabel: regularChips[0],
        selectedIndex: indices[0],
      });
    } else {
      onSubmit({
        fieldName,
        selectedLabels: regularChips,
        selectedIndices: indices,
      });
    }
  }, [isSubmitted, selectedChips, otherText, options, fieldName, onSubmit]);

  const handleOtherSubmit = useCallback(() => {
    if (!otherText.trim()) return;
    setCardState('SUBMITTED');

    if (multiSelect && selectedChips.filter((c) => c !== 'Other').length > 0) {
      // Multi-select with regular chips + Other text
      const regularChips = selectedChips.filter((c) => c !== 'Other');
      const indices = regularChips.map((label) =>
        options.findIndex((opt) => opt.label === label)
      );
      onSubmit({
        fieldName,
        selectedLabels: [...regularChips, 'Other'],
        selectedIndices: [...indices, options.length],
      });
    } else {
      onSubmit({ fieldName, otherText: otherText.trim() });
    }
  }, [otherText, multiSelect, selectedChips, options, fieldName, onSubmit]);

  // ── Keyboard navigation ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          e.preventDefault();
          const next = (index + 1) % totalChips;
          setFocusedIndex(next);
          chipRefs.current[next]?.focus();
          break;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          e.preventDefault();
          const prev = (index - 1 + totalChips) % totalChips;
          setFocusedIndex(prev);
          chipRefs.current[prev]?.focus();
          break;
        }
        case ' ':
        case 'Enter': {
          e.preventDefault();
          if (index < options.length) {
            handleChipClick(options[index].label, index);
          } else {
            handleChipClick('Other', index);
          }
          break;
        }
      }
    },
    [totalChips, options, handleChipClick]
  );

  // ── Chip style helpers ──

  const getChipAnimateProps = (label: string, isOther: boolean) => {
    const isSelected = selectedChips.includes(label);

    if (isSubmitted) {
      // Static disabled state
      return isSelected
        ? {
            backgroundColor: multiSelect ? COLORS.accentBlueSubtle : COLORS.accentBlue,
            borderColor: multiSelect ? COLORS.accentBlueBorder : COLORS.accentBlue,
            color: multiSelect ? COLORS.accentBlue : COLORS.white,
            opacity: 0.8,
          }
        : {
            backgroundColor: COLORS.bgSurface,
            borderColor: COLORS.borderDefault,
            color: COLORS.textTertiary,
            opacity: 0.4,
          };
    }

    if (isOther && !isSelected) {
      return {
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderColor: COLORS.borderDefault,
        color: COLORS.textTertiary,
        opacity: 1,
      };
    }

    if (isSelected && !multiSelect) {
      // Single-select: solid blue
      return {
        backgroundColor: COLORS.accentBlue,
        borderColor: COLORS.accentBlue,
        color: COLORS.white,
        boxShadow: COLORS.selectedGlow,
        scale: [1, 1.05, 1],
        opacity: 1,
      };
    }

    if (isSelected && multiSelect) {
      // Multi-select: subtle blue
      return {
        backgroundColor: COLORS.accentBlueSubtle,
        borderColor: COLORS.accentBlueBorder,
        color: COLORS.accentBlue,
        opacity: 1,
      };
    }

    // Default unselected
    return {
      backgroundColor: COLORS.bgSurface,
      borderColor: COLORS.borderDefault,
      color: COLORS.textSecondary,
      opacity: 1,
    };
  };

  // ── Render ──

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...springs.smooth, duration: 0.3 }}
      className="my-2"
    >
      {/* Chip group */}
      <motion.div
        variants={chipContainerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap gap-2"
        role={multiSelect ? 'group' : 'radiogroup'}
        aria-label={`Select ${fieldName.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`}
        aria-required="true"
        aria-disabled={isSubmitted || undefined}
      >
        {/* Option chips */}
        {options.map((opt, index) => {
          const isSelected = selectedChips.includes(opt.label);
          return (
            <motion.button
              key={opt.label}
              ref={(el) => { chipRefs.current[index] = el; }}
              variants={chipItemVariants}
              role={multiSelect ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              aria-disabled={isSubmitted || undefined}
              aria-describedby={opt.description ? `${fieldName}-${index}-desc` : undefined}
              tabIndex={multiSelect ? 0 : focusedIndex === index ? 0 : -1}
              onClick={() => handleChipClick(opt.label, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => setFocusedIndex(index)}
              disabled={isSubmitted}
              animate={getChipAnimateProps(opt.label, false)}
              whileHover={
                !isSubmitted
                  ? { scale: 1.03, boxShadow: COLORS.hoverGlow }
                  : undefined
              }
              whileTap={!isSubmitted ? { scale: 0.96 } : undefined}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'inline-flex items-center gap-1.5',
                'focus-visible:outline-2 focus-visible:outline-offset-2',
                hasDescriptions && 'flex-col items-start text-left',
              )}
              style={{
                border: '1px solid',
                borderRadius: chipBorderRadius,
                padding: hasDescriptions ? '10px 16px' : '10px 18px',
                minHeight: '40px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isSubmitted ? 'default' : 'pointer',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                outlineColor: COLORS.accentBlue,
              }}
            >
              {/* Multi-select checkmark */}
              {multiSelect && (
                <AnimatePresence>
                  {isSelected && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 16, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="inline-flex items-center overflow-hidden"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              )}
              <span>{opt.label}</span>
              {opt.description && (
                <span
                  id={`${fieldName}-${index}-desc`}
                  style={{
                    fontSize: '11px',
                    fontWeight: 400,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {opt.description}
                </span>
              )}
            </motion.button>
          );
        })}

        {/* "Other" chip -- always last (D3) */}
        <motion.button
          ref={(el) => { chipRefs.current[options.length] = el; }}
          variants={chipItemVariants}
          role={multiSelect ? 'checkbox' : 'radio'}
          aria-checked={selectedChips.includes('Other')}
          aria-disabled={isSubmitted || undefined}
          tabIndex={multiSelect ? 0 : focusedIndex === options.length ? 0 : -1}
          onClick={() => handleChipClick('Other', options.length)}
          onKeyDown={(e) => handleKeyDown(e, options.length)}
          onFocus={() => setFocusedIndex(options.length)}
          disabled={isSubmitted}
          animate={getChipAnimateProps('Other', true)}
          whileHover={
            !isSubmitted
              ? { scale: 1.03, boxShadow: COLORS.hoverGlow }
              : undefined
          }
          whileTap={!isSubmitted ? { scale: 0.96 } : undefined}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            borderStyle: 'dashed',
            border: '1px dashed',
            borderRadius: chipBorderRadius,
            padding: '10px 18px',
            minHeight: '40px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: isSubmitted ? 'default' : 'pointer',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            outlineColor: COLORS.accentBlue,
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Other</span>
        </motion.button>
      </motion.div>

      {/* "Other" expanding text input (D3) */}
      <AnimatePresence>
        {showOtherInput && !isSubmitted && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden mt-2"
          >
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Tell us more..."
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && otherText.trim()) {
                    e.preventDefault();
                    if (multiSelect) {
                      // In multi-select, Enter on Other input = same as Done
                      handleDoneClick();
                    } else {
                      handleOtherSubmit();
                    }
                  }
                }}
                className="w-full focus-visible:outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '12px',
                  padding: '10px 40px 10px 14px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
                aria-label="Enter other option"
              />
              <button
                onClick={multiSelect ? handleDoneClick : handleOtherSubmit}
                disabled={!otherText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all"
                style={{
                  background: otherText.trim() ? 'var(--accent-blue)' : 'transparent',
                  color: otherText.trim() ? '#ffffff' : 'var(--text-quaternary)',
                }}
                aria-label="Submit"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Read-only "Other" text when submitted */}
      {isSubmitted && otherText && (
        <div
          className="mt-2 px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-tertiary)',
          }}
        >
          &quot;{otherText}&quot;
        </div>
      )}

      {/* Multi-select "Done" button */}
      <AnimatePresence>
        {multiSelect &&
          selectedChips.length > 0 &&
          !isSubmitted &&
          cardState !== 'OTHER_INPUT' && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: durations.fast, ease: 'easeOut' }}
              className="flex justify-end mt-2"
            >
              <MagneticButton
                onClick={handleDoneClick}
                className="h-9 rounded-full px-5 text-sm font-medium"
                style={{ background: 'var(--accent-blue)', color: '#ffffff' }}
              >
                Done
              </MagneticButton>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Screen reader announcement */}
      <div aria-live="polite" className="sr-only">
        {isSubmitted &&
          selectedChips.length > 0 &&
          `Selected: ${selectedChips.join(', ')}${otherText ? `. Other: ${otherText}` : ''}`}
      </div>
    </motion.div>
  );
}
```

---

## 8. Edge Cases & Guards

| Edge Case | Handling |
|-----------|----------|
| Empty options array | Render nothing (`if (options.length === 0) return null;`) |
| Long option labels (>40 chars) | Truncate with `text-ellipsis` + `title` attribute on hover |
| Rapid double-tap (single-select) | `cardState === 'SUBMITTED'` check in `handleChipClick` prevents re-entry |
| "Other" with empty text | Submit button disabled via `disabled={!otherText.trim()}` |
| Page reload with existing tool result | `previousSelection` prop hydrates the disabled state |
| Malformed tool input (missing fields) | Parent renderToolPart should catch errors and render fallback |
| Very many options (>8) | flex-wrap handles layout; consider max-height + scroll if needed |

---

## 9. Files to Modify (Summary)

| File | Change | Details |
|------|--------|---------|
| `src/components/journey/ask-user-card.tsx` | **CREATE** | This entire component |
| `src/components/journey/chat-message.tsx` | **MODIFY** | Add `onToolOutput` prop, add askUser case in `renderToolPart` BEFORE generic loading states, pass `onToolOutput` through `renderMessageParts` |
| `src/app/journey/page.tsx` | **MODIFY** | Destructure `addToolOutput` from `useChat`, update `sendAutomaticallyWhen`, pass `onToolOutput` to `ChatMessage` |

---

## 10. Dependencies

All already in the project -- no new packages needed:

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Check, Plus, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs, durations } from '@/lib/motion';
import { MagneticButton } from '@/components/ui/magnetic-button';
```

---

## 11. Testing Checklist

- [ ] Single-select: tap chip -> 200ms highlight -> submits -> chips disabled
- [ ] Multi-select: toggle multiple chips -> "Done" appears -> submit -> chips disabled
- [ ] "Other" (single-select): tap -> text input expands -> type + enter -> submits
- [ ] "Other" (multi-select): tap Other + regular chips -> text input -> "Done" -> submits all
- [ ] Disabled state: chips render correctly from message history (output-available)
- [ ] Keyboard: Tab into group, Arrow keys navigate, Space/Enter selects
- [ ] Screen reader: announces role, checked state, label
- [ ] Staggered entrance animation plays on first render
- [ ] No flash/jump when transitioning from input-available to output-available
- [ ] Mobile: chips wrap properly, touch targets >= 40px height
