# Research: Interactive Chip/Option Card UI Patterns

**Date**: 2026-02-27
**Domain**: Frontend interactive chip selection for AskUserCard component
**Sprint**: AI-GOS v2 Sprint 2 (Conversational Onboarding)
**Status**: Complete

---

## Summary

This document covers best practices for building the `AskUserCard` component -- an inline chat card that presents tappable option chips for categorical questions during conversational onboarding. It covers single-select (immediate submit), multi-select (toggle + confirm), the "Other" expanding text input, disabled/answered state, accessibility (ARIA roles, keyboard navigation), Framer Motion animation patterns, touch target sizing, and how to integrate with the existing codebase patterns.

---

## 1. Chat UI Chip Patterns (Industry Analysis)

### 1.1 How Leading Chat UIs Handle Selection

**Claude (Anthropic):** Uses suggestion chips at the bottom of the chat for pre-filled prompts. Chips are simple text pills with rounded corners, disappear after selection. No multi-select support in the suggestion pattern.

**ChatGPT (OpenAI):** Uses "suggested prompts" on the welcome screen as cards with brief descriptions. Inline quick actions appear as small pill buttons beneath responses. The inline display mode embeds app content directly in the conversation flow with model-generated suggestions for next steps.

**Chatbot Quick Replies (Industry Standard):** Facebook Messenger calls them "quick_replies", Telegram calls them "inline_keyboard", Kik calls them "suggested_responses". The common pattern across all platforms:
- Rendered as a horizontal row of tappable pills below the bot message
- Single-select: tap immediately sends the selection
- Chips disappear or become disabled after selection
- Selected value appears as the user's reply message in the chat

### 1.2 Key Design Principles from Chat UI Research

1. **Button count**: 5 buttons max to encourage user activity without overwhelming
2. **Button text**: Keep brief -- no more than 20 characters per chip label
3. **Specificity**: Specific action buttons work better than generic yes/no options
4. **Inline rendering**: Cards appear directly in the conversation flow, not in overlays or popovers
5. **Immediate feedback**: Selection should feel instant -- brief highlight animation, then submit
6. **Post-selection state**: Chips become static/disabled; selected chip remains highlighted

### 1.3 Chip UI Design Variants (from Mobbin analysis of 4,600+ components)

| Variant | Use Case | Relevance to AskUserCard |
|---------|----------|--------------------------|
| **Filter chips** | Toggle filtering, multi-select | High -- marketing channels question |
| **Suggestion chips** | Narrowing user intent, dynamically generated | High -- all askUser questions |
| **Input chips** | Converting text to structured tokens | Medium -- "Other" free text extraction |
| **Action chips** | Triggering actions with trailing icons | Low -- not needed for onboarding |

**Most common chip style**: Filled chips with accent color for selected state. Outline style is a strong alternative for unselected state.

---

## 2. Design System Section 5.9 Chip Specs (Inferred from Codebase)

The Design System .docx references "Section 5.9" for chip styling with these properties. Synthesized from the sprint-2 spec and existing design tokens:

### 2.1 Visual Specifications

```
Shape:           pill (border-radius: 999px)
Background:      var(--bg-surface) with 1px border var(--border-default)
Hover:           var(--bg-hover) with accent-blue glow (box-shadow: 0 0 12px var(--accent-blue-glow))
Selected:        var(--accent-blue) background, white text
Disabled:        opacity 0.5, cursor: not-allowed
Font:            13px, font-weight 500 (medium), var(--font-body) [DM Sans]
Padding:         10px 18px (slightly larger than standard buttons for touch targets)
Min height:      40px (touch target)
Gap between:     8px horizontal, 8px vertical (flex-wrap)
```

### 2.2 Design Token Mapping

| Property | Token | Value |
|----------|-------|-------|
| Chip background (default) | `--bg-surface` | `rgb(12, 14, 19)` |
| Chip background (hover) | `--bg-hover` | `rgb(20, 23, 30)` |
| Chip background (selected) | `--accent-blue` | `rgb(54, 94, 255)` |
| Chip border (default) | `--border-default` | `rgb(31, 31, 31)` |
| Chip border (hover) | `--accent-blue` | `rgb(54, 94, 255)` at 40% opacity |
| Chip text (default) | `--text-secondary` | `rgb(205, 208, 213)` |
| Chip text (selected) | white | `#ffffff` |
| Chip text (disabled) | `--text-tertiary` | `rgb(100, 105, 115)` |
| Description text | `--text-tertiary` | `rgb(100, 105, 115)` |
| Glow shadow | `--accent-blue-glow` | `rgba(54, 94, 255, 0.15)` |
| Subtle accent bg | `--accent-blue-subtle` | `rgba(51, 136, 255, 0.09)` |

### 2.3 Container Specs (Wrapping all chips)

```
Layout:          flex-wrap row
Max width:       100% of message content area
Entrance:        staggered fadeUp (each chip delayed by ~50ms)
```

---

## 3. Component Architecture

### 3.1 Props Interface (from PRD)

```typescript
interface AskUserCardProps {
  question: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
  fieldName: string;
  onSelect: (result: { selected: string[]; freeText?: string }) => void;
  disabled?: boolean; // true after user has answered
}
```

### 3.2 Internal State Machine

The component has four distinct states:

```
IDLE          -> User sees chips, can interact
SELECTING     -> (multi-select only) User is toggling chips
OTHER_INPUT   -> "Other" chip tapped, text input expanded
SUBMITTED     -> Selection sent, chips become static/disabled
```

State transitions:

```
Single-select flow:
  IDLE -> tap chip -> immediate submit -> SUBMITTED

Multi-select flow:
  IDLE -> tap chip -> SELECTING -> tap more chips -> tap "Done" -> SUBMITTED

"Other" flow:
  IDLE -> tap "Other" -> OTHER_INPUT -> type text -> submit -> SUBMITTED
```

### 3.3 Component Composition

```
<AskUserCard>
  <ChipGroup>                    // flex-wrap container
    <Chip />                     // individual option (motion.button)
    <Chip />
    <Chip />
    <OtherChip />               // special "Other" option
  </ChipGroup>
  <OtherTextInput />            // conditionally rendered below chips
  <MultiSelectConfirm />        // "Done" button, only in multi-select mode
</AskUserCard>
```

---

## 4. Single-Select Pattern: Immediate Submit with Highlight

### 4.1 Behavior

Per PRD: "Single-select: tap immediately submits." However, a brief visual feedback is needed before the submission fires.

**Recommended pattern** (answering PRD Q1):
1. User taps a chip
2. Chip immediately shows selected state (accent-blue background, scale pulse)
3. After ~200ms animation completes, `onSelect()` fires
4. All chips transition to disabled/static state
5. Selected chip stays highlighted; unselected chips dim

### 4.2 Implementation Pattern

```typescript
const handleSingleSelect = (label: string) => {
  setSelectedChips([label]);
  // Brief delay for visual feedback before submitting
  setTimeout(() => {
    onSelect({ selected: [label] });
  }, 200);
};
```

### 4.3 Why 200ms Delay?

- **Too fast (0ms)**: User sees no feedback, feels broken -- "did it register?"
- **Too slow (500ms+)**: Feels laggy, frustrating for repeated interactions over 8 questions
- **200ms sweet spot**: Matches human perception threshold for "instant" (Nielsen, Usability Engineering). Long enough to see the color change and scale pulse, short enough to feel immediate.

---

## 5. Multi-Select Pattern: Toggle + Confirm

### 5.1 Behavior

For the marketing channels question (`multiSelect: true`):
1. Chips toggle on/off independently (checkbox-like behavior)
2. Selected chips get accent-blue background, checkmark icon
3. "Done" button appears below chips after first selection
4. "Done" button submits all selected values
5. Tapping "Other" adds it to selection AND expands text input

### 5.2 Visual State Per Chip (Multi-Select)

| State | Background | Border | Text | Icon |
|-------|-----------|--------|------|------|
| Unselected | `--bg-surface` | `--border-default` | `--text-secondary` | None |
| Hover | `--bg-hover` | `--accent-blue` at 40% | `--text-primary` | None |
| Selected | `--accent-blue-subtle` | `--accent-blue` at 60% | `--accent-blue` | Checkmark (left) |
| Disabled (post-submit) | `--bg-surface` at 50% opacity | `--border-default` | `--text-tertiary` | Checkmark if was selected |

### 5.3 "Done" Button

```
Appearance:     pill shape, accent-blue background, white text
Label:          "Done" or "Continue" (after at least 1 selection)
Position:       Below the chip row, right-aligned
Animation:      fade-in when first chip is selected
Disabled:       true when no chips selected
```

---

## 6. "Other" Option: Expanding Text Input

### 6.1 Behavior

1. "Other" is always the last chip in the list
2. Visually distinct: dashed border or muted style to differentiate from options
3. On tap: text input slides in below the chips (AnimatePresence)
4. Input has a submit button (Send icon)
5. On submit: `onSelect({ selected: ["Other"], freeText: "user input text" })`

### 6.2 "Other" Chip Visual Differentiation

```
Border style:    dashed (1px dashed var(--border-default))
Background:      transparent
Text:            var(--text-tertiary)
Icon:            Plus sign or ellipsis ("...")
Hover:           same glow as regular chips
```

### 6.3 Expanding Input Animation

```typescript
<AnimatePresence>
  {showOtherInput && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <input
        type="text"
        placeholder="Tell us more..."
        autoFocus
        className="..."
      />
    </motion.div>
  )}
</AnimatePresence>
```

### 6.4 Multi-Select + Other Combo

When `multiSelect: true` and user taps "Other":
- "Other" chip toggles selected (like any other chip)
- Text input expands below
- User can ALSO have other chips selected simultaneously
- "Done" button submits all: `{ selected: ["Google Ads", "Other"], freeText: "TikTok Ads" }`

---

## 7. Disabled/Answered State

### 7.1 After Submission

Once the user submits (single-select tap, multi-select Done, or Other text submit):

1. **All chips become static** -- no hover effects, no tap handlers
2. **Selected chips stay highlighted** -- accent-blue border/background persists
3. **Unselected chips dim** -- opacity 0.4, `--text-tertiary` text
4. **"Other" text input becomes read-only** if it was used
5. **"Done" button disappears** (AnimatePresence exit)
6. **Cursor changes** to `default` (not pointer) on all chips

### 7.2 Implementation

```typescript
// disabled prop comes from parent when tool result has been submitted
{disabled ? (
  // Static rendering -- no motion, no handlers
  <div className="flex flex-wrap gap-2 opacity-70">
    {options.map(opt => (
      <div
        key={opt.label}
        className={cn(
          'chip-static',
          selectedChips.includes(opt.label) && 'chip-selected'
        )}
      >
        {opt.label}
      </div>
    ))}
  </div>
) : (
  // Interactive rendering -- motion.button, tap handlers
  <div className="flex flex-wrap gap-2" role={multiSelect ? 'group' : 'radiogroup'}>
    {options.map(opt => (
      <motion.button ... />
    ))}
  </div>
)}
```

---

## 8. Framer Motion Animation Patterns

### 8.1 Chip Entrance (Staggered)

Each chip animates in with a staggered delay from the left:

```typescript
const chipContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,  // 50ms between each chip
      delayChildren: 0.1,     // 100ms initial delay after card appears
    },
  },
};

const chipVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.22, 1, 0.36, 1],  // matches existing fadeInUp in chat-message.tsx
    },
  },
};

// Usage:
<motion.div variants={chipContainerVariants} initial="hidden" animate="visible">
  {options.map(opt => (
    <motion.button key={opt.label} variants={chipVariants}>
      {opt.label}
    </motion.button>
  ))}
</motion.div>
```

### 8.2 Chip Selection (Tap Feedback)

```typescript
<motion.button
  whileHover={{
    scale: 1.03,
    boxShadow: '0 0 16px var(--accent-blue-glow)',
  }}
  whileTap={{ scale: 0.96 }}
  animate={isSelected ? {
    backgroundColor: 'rgb(54, 94, 255)',
    borderColor: 'rgb(54, 94, 255)',
    color: '#ffffff',
    transition: { duration: 0.15, ease: 'easeOut' },
  } : {
    backgroundColor: 'rgb(12, 14, 19)',
    borderColor: 'rgb(31, 31, 31)',
    color: 'rgb(205, 208, 213)',
    transition: { duration: 0.15, ease: 'easeOut' },
  }}
  transition={springs.snappy}
>
```

### 8.3 Selection Confirmation Pulse (Single-Select)

When a single-select chip is tapped, show a brief "success pulse" before submitting:

```typescript
const pulseVariants = {
  idle: { scale: 1 },
  selected: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};
```

### 8.4 Multi-Select Checkmark Entrance

When a chip becomes selected in multi-select mode, a small checkmark icon slides in:

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

### 8.5 Card Entrance (Wrapping Container)

The entire AskUserCard should animate in matching the existing pattern from `edit-approval-card.tsx`:

```typescript
<motion.div
  initial={{ opacity: 0, y: 10, scale: 0.97 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ ...springs.smooth, duration: 0.3 }}
  className="my-2"
>
```

### 8.6 "Done" Button Entrance

```typescript
<AnimatePresence>
  {selectedChips.length > 0 && !disabled && (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <MagneticButton ...>Done</MagneticButton>
    </motion.div>
  )}
</AnimatePresence>
```

### 8.7 Disabled Transition

When chips become disabled after submission:

```typescript
<motion.div
  animate={disabled ? { opacity: 0.7 } : { opacity: 1 }}
  transition={{ duration: 0.3 }}
>
```

### 8.8 Using Existing Motion Utilities

The codebase already defines these in `src/lib/motion.ts`:

| Utility | Value | Use For |
|---------|-------|---------|
| `springs.snappy` | stiffness: 500, damping: 30 | Chip whileTap, whileHover |
| `springs.smooth` | stiffness: 400, damping: 30 | Card entrance |
| `springs.gentle` | stiffness: 300, damping: 35 | "Other" input expand |
| `staggerContainer` | staggerChildren: 0.1 | Can override to 0.05 for chips |
| `staggerItem` | opacity 0 -> 1, y 20 -> 0 | Chip entrance (adjust y to 8) |
| `scaleIn` | opacity 0 -> 1, scale 0.95 -> 1 | Chip entrance variant |

---

## 9. Accessibility

### 9.1 ARIA Roles

**Single-select chips** should use the **radiogroup** pattern:

```html
<div role="radiogroup" aria-label="Select your business model" aria-required="true">
  <button role="radio" aria-checked="false" tabindex="0">B2B SaaS</button>
  <button role="radio" aria-checked="false" tabindex="-1">B2C / DTC</button>
  <button role="radio" aria-checked="false" tabindex="-1">Marketplace</button>
  <button role="radio" aria-checked="false" tabindex="-1">Other</button>
</div>
```

**Multi-select chips** should use the **group** pattern with checkbox semantics:

```html
<div role="group" aria-label="Select your marketing channels (multiple allowed)">
  <button role="checkbox" aria-checked="false" tabindex="0">Google Ads</button>
  <button role="checkbox" aria-checked="true" tabindex="0">Meta</button>
  <button role="checkbox" aria-checked="false" tabindex="0">LinkedIn</button>
  <button role="checkbox" aria-checked="false" tabindex="0">Other</button>
</div>
```

### 9.2 Keyboard Navigation

**Radiogroup pattern (single-select):**

| Key | Action |
|-----|--------|
| `Tab` | Moves focus into the group (lands on the focused/checked radio) |
| `Arrow Down` / `Arrow Right` | Move focus to next chip, wrap at end |
| `Arrow Up` / `Arrow Left` | Move focus to previous chip, wrap at start |
| `Space` | Selects the focused chip (triggers submit) |
| `Enter` | Selects the focused chip (triggers submit) |
| `Tab` (again) | Moves focus out of the group |

**Important**: In a radiogroup, only ONE chip has `tabindex="0"` (the currently checked one, or the first one if none checked). All others have `tabindex="-1"`. This is called "roving tabindex".

**Group pattern (multi-select):**

| Key | Action |
|-----|--------|
| `Tab` | Moves focus to the first unchecked chip (or first chip) |
| `Arrow Down` / `Arrow Right` | Move focus to next chip |
| `Arrow Up` / `Arrow Left` | Move focus to previous chip |
| `Space` | Toggles the focused chip checked/unchecked |
| `Enter` | Submits the current selection (equivalent to "Done") |
| `Tab` (again) | Moves focus to the "Done" button |

### 9.3 Focus Management Implementation

```typescript
const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
const [focusedIndex, setFocusedIndex] = useState(0);

const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
  const total = options.length + 1; // +1 for "Other"

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault();
    const next = (index + 1) % total;
    setFocusedIndex(next);
    chipRefs.current[next]?.focus();
  }

  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = (index - 1 + total) % total;
    setFocusedIndex(prev);
    chipRefs.current[prev]?.focus();
  }

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    handleChipClick(index);
  }
};
```

### 9.4 Screen Reader Announcements

- **Group label**: `aria-label` on the container describing the question
- **Chip state**: `aria-checked` reflecting selection state
- **Description**: `aria-describedby` pointing to the description text for each option
- **Live region**: After submission, announce "Selection submitted: [values]" via `aria-live="polite"`
- **Required indicator**: `aria-required="true"` on the radiogroup if the field is required

```typescript
// Live region for submission confirmation
<div aria-live="polite" className="sr-only">
  {disabled && `Selected: ${selectedChips.join(', ')}`}
</div>
```

### 9.5 Focus Visibility

```css
/* Ensure focus ring is visible for keyboard users */
.chip:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}
```

Framer Motion's `whileHover` and `whileTap` are pointer-only. Keyboard focus states must be handled separately with CSS `:focus-visible`.

### 9.6 Disabled State Accessibility

```html
<!-- After submission, chips are aria-disabled, not removed -->
<div role="radiogroup" aria-label="Business model" aria-disabled="true">
  <button role="radio" aria-checked="true" aria-disabled="true" tabindex="-1">B2B SaaS</button>
  <button role="radio" aria-checked="false" aria-disabled="true" tabindex="-1">B2C / DTC</button>
</div>
```

Do NOT use `display: none` or `visibility: hidden` on the chips after submission. Keep them visible and `aria-disabled` so screen readers can still report what was selected.

---

## 10. Touch Target Sizing

### 10.1 WCAG Standards

| Standard | Level | Minimum Size | Notes |
|----------|-------|--------------|-------|
| WCAG 2.5.8 | AA | 24x24 CSS px | Minimum target size |
| WCAG 2.5.5 | AAA | 44x44 CSS px | Enhanced target size |
| Apple HIG | -- | 44x44 points | iOS Human Interface Guidelines |
| Material Design | -- | 48x48 dp | Google Android guidelines |
| Microsoft Fluent | -- | 44x44 pixels | Fluent Design System |

### 10.2 Recommended Sizes for AskUserCard Chips

**Target: 44px minimum height** (AAA compliance, matching Apple HIG).

```
Chip min-height:     40px (content) + padding = ~44px effective touch target
Chip padding:        10px 18px (vertical horizontal)
Chip gap:            8px (ensures adequate spacing between targets)
Chip font-size:      13px label, 11px description
```

**Research finding**: Targets smaller than 44x44px have error rates 3x higher than properly sized targets (University of Maryland, 2023). Sites with proper target sizes see 28% reduction in touch errors.

### 10.3 Spacing Between Chips

WCAG 2.5.8 allows targets smaller than 24x24px if they have sufficient spacing (24px offset from adjacent targets). Our 8px gap with 40px+ chip height provides ample spacing.

For sticky menus or dense chip layouts, aim for 44-48px boxes with at least 8px spacing between them.

### 10.4 Mobile Considerations

```css
/* On mobile viewports, increase touch targets */
@media (max-width: 640px) {
  .chip {
    min-height: 44px;
    padding: 12px 20px;
    font-size: 14px;  /* slightly larger for readability */
  }
}
```

---

## 11. Existing Codebase Patterns to Follow

### 11.1 EditApprovalCard (Reference Component)

Located at `/src/components/chat/edit-approval-card.tsx`, this is the closest existing pattern:

**What to reuse:**
- `GradientBorder` wrapper component for the card container
- `MagneticButton` for the "Done" button in multi-select
- `motion.div` entrance animation: `initial={{ opacity: 0, y: 10, scale: 0.97 }}`
- `springs.smooth` from `@/lib/motion`
- Inline styling using CSS variables (not Tailwind color classes)

**What differs:**
- EditApprovalCard uses approve/reject buttons; AskUserCard uses chip selection
- EditApprovalCard uses `addToolApprovalResponse()`; AskUserCard uses `addToolResult()`
- No ARIA radiogroup/group roles in EditApprovalCard (it's a binary choice)

### 11.2 Chat Message Integration Point

Located at `/src/components/journey/chat-message.tsx`, the `renderToolPart()` function handles tool part rendering.

**Integration plan:**
```typescript
// In renderToolPart(), add case for askUser tool:
if (toolName === 'askUser' && (state === 'input-available' || state === 'output-available')) {
  const isAnswered = state === 'output-available';
  return (
    <AskUserCard
      key={key}
      question={input.question}
      options={input.options}
      multiSelect={input.multiSelect}
      fieldName={input.fieldName}
      onSelect={(result) => {
        // Only for input-available state
        if (!isAnswered) {
          addToolResult({ toolCallId, result: JSON.stringify(result) });
        }
      }}
      disabled={isAnswered}
      selectedValues={isAnswered ? output?.selected : undefined}
    />
  );
}
```

### 11.3 Styling Approach

Match the existing codebase pattern:
- Use `style={{}}` for CSS variable references (not Tailwind utility classes for colors)
- Use Tailwind for layout utilities (`flex`, `gap-2`, `items-center`, `rounded-full`)
- Use `cn()` from `@/lib/utils` for conditional classes
- Use `'use client'` directive
- Named export (not default export)
- Props interface suffixed with `Props`

---

## 12. Complete Chip Visual Spec

### 12.1 Default State

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  min-height: 40px;
  border-radius: 999px;           /* pill shape */
  background: var(--bg-surface);   /* rgb(12, 14, 19) */
  border: 1px solid var(--border-default);  /* rgb(31, 31, 31) */
  color: var(--text-secondary);    /* rgb(205, 208, 213) */
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
```

### 12.2 Hover State

```css
.chip:hover {
  background: var(--bg-hover);           /* rgb(20, 23, 30) */
  border-color: rgba(54, 94, 255, 0.4); /* accent-blue at 40% */
  box-shadow: 0 0 12px var(--accent-blue-glow);  /* rgba(54, 94, 255, 0.15) */
  color: var(--text-primary);            /* rgb(252, 252, 250) */
}
```

### 12.3 Selected State

```css
.chip-selected {
  background: var(--accent-blue);   /* rgb(54, 94, 255) */
  border-color: var(--accent-blue);
  color: #ffffff;
  box-shadow: 0 0 20px var(--accent-blue-glow);
}
```

### 12.4 Multi-Select Selected (Subtle Variant)

```css
.chip-multi-selected {
  background: var(--accent-blue-subtle);         /* rgba(51, 136, 255, 0.09) */
  border-color: rgba(54, 94, 255, 0.6);
  color: var(--accent-blue);                     /* rgb(54, 94, 255) */
}
```

### 12.5 Disabled/Answered State

```css
.chip-disabled {
  opacity: 0.5;
  cursor: default;
  pointer-events: none;
}

.chip-disabled.chip-selected,
.chip-disabled.chip-multi-selected {
  opacity: 0.8;  /* keep selected chips more visible */
}
```

### 12.6 "Other" Chip (Special Variant)

```css
.chip-other {
  border-style: dashed;
  background: transparent;
  color: var(--text-tertiary);        /* rgb(100, 105, 115) */
}

.chip-other:hover {
  color: var(--text-secondary);
  border-color: rgba(54, 94, 255, 0.3);
}
```

### 12.7 Focus-Visible Ring

```css
.chip:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}
```

### 12.8 Description Text (Below Label)

For options with descriptions, render as two lines:

```
[Label text]               <- 13px, font-weight 500
[Description text]         <- 11px, --text-tertiary, font-weight 400
```

If descriptions are present, switch chip layout to vertical:

```css
.chip-with-description {
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 10px 16px;
  border-radius: 12px;   /* rounded rectangle instead of pill for vertical layout */
}
```

**Decision point**: If all descriptions are short (under ~40 chars), keep pill shape with descriptions as tooltip/title. If descriptions are meaningful, use the rounded-rectangle variant.

---

## 13. Recommended Implementation Approach

### 13.1 File Structure

```
src/components/journey/ask-user-card.tsx    <- Main component
```

Single file, no need to split into sub-components. The component is self-contained:
- Internal state for selectedChips, showOtherInput, otherText
- Chip rendering with Framer Motion
- Keyboard navigation handler
- ARIA attributes

### 13.2 Dependencies

```typescript
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { MagneticButton } from '@/components/ui/magnetic-button';
```

No new dependencies needed. All required packages are already in the project.

### 13.3 Key Implementation Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Chip shape when descriptions present | Pill for label-only, rounded-rect for descriptions | Pill gets too wide with long descriptions |
| Single-select submit delay | 200ms | Visual feedback without feeling slow |
| "Other" chip position | Always last | Consistent, predictable placement |
| Multi-select "Done" position | Below chips, right-aligned | Follows conversation flow direction |
| Animation library | Framer Motion (existing) | Already in project, matches all other components |
| Layout animation for selection | `animate` prop, not `layoutId` | `layoutId` is overkill for simple color/scale changes |
| Focus management | Roving tabindex | WAI-ARIA radiogroup pattern, well-supported |
| Description rendering | Inline below label text | Keeps chips compact, tooltip alternative for very short descriptions |

### 13.4 Edge Cases to Handle

1. **Empty options array**: Should not happen (Zod schema enforces min 2), but render nothing gracefully
2. **Very long option labels**: Truncate with ellipsis at ~40 chars, full text in title attribute
3. **Rapid double-tap** (single-select): Debounce to prevent double submission
4. **"Other" with empty text**: Disable submit button until text has content
5. **Keyboard submission during animation**: Queue the submit, don't swallow it
6. **Page reload while chips are interactive**: Chips should re-render in disabled state if tool result already exists in message history
7. **Screen reader announces**: Verify VoiceOver and NVDA announce chip label + checked state

---

## 14. References

### Chat UI Patterns
- [Mobbin Chip UI Design Glossary](https://mobbin.com/glossary/chip) -- 4,600+ chip examples analyzed
- [16 Chat UI Design Patterns That Work in 2025](https://bricxlabs.com/blogs/message-screen-ui-deisgn)
- [Chatbot UI Examples from Product Designers](https://www.eleken.co/blog-posts/chatbot-ui-examples)
- [OpenAI UI Guidelines](https://developers.openai.com/apps-sdk/concepts/ui-guidelines/)
- [AI UI Patterns (patterns.dev)](https://www.patterns.dev/react/ai-ui-patterns/)

### Framer Motion
- [Motion Layout Animations](https://motion.dev/docs/react-layout-animations)
- [Advanced Animation Patterns (Maxime Heckel)](https://blog.maximeheckel.com/posts/advanced-animation-patterns-with-framer-motion/)
- [Framer Motion Gestures](https://www.framer.com/motion/gestures/)
- [AnimatePresence Documentation](https://motion.dev/docs/react-animate-presence)
- [Everything about Layout Animations (Maxime Heckel)](https://blog.maximeheckel.com/posts/framer-motion-layout-animations/)

### Accessibility
- [ARIA radiogroup role (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/radiogroup_role)
- [Radio Group Pattern (WAI-ARIA APG)](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- [Checkbox Pattern (WAI-ARIA APG)](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
- [WCAG 2.5.8 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG 2.5.5 Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)

### Touch Targets
- [Accessible Target Sizes Cheatsheet (Smashing Magazine)](https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/)
- [Designing Better Target Sizes (Ahmad Shadeed)](https://ishadeed.com/article/target-size/)
- [All Accessible Touch Target Sizes (LogRocket)](https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/)

### Component Libraries (Pattern Reference)
- [Material UI React Chip](https://mui.com/material-ui/react-chip/)
- [HeroUI Chip Component](https://www.heroui.com/docs/components/chip)
- [PrimeReact Chips](https://primereact.org/chips/)
