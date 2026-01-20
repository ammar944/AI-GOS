# SaaSLaunch Design Language

> Extracted directly from the SaaSLaunch Framer project via MCP  
> For use in AI-GOS and related applications

---

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Spacing & Layout](#spacing--layout)
4. [Border Radius](#border-radius)
5. [Effects & Backgrounds](#effects--backgrounds)
6. [Component Patterns](#component-patterns)
7. [CSS Variables](#css-variables)
8. [Tailwind Configuration](#tailwind-configuration)

---

## Color System

### Background Colors

The background palette uses **dark blue-black tones**, not pure black. This gives depth and a premium feel.

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `rgb(7, 9, 14)` | Main page background |
| `bg-card` | `rgb(12, 14, 19)` | Card surfaces, elevated elements |
| `bg-card-blue` | `rgba(51, 136, 255, 0.09)` | Cards with blue tint |
| `bg-black` | `rgb(0, 0, 0)` | Pure black (rare) |
| `bg-900` | `rgb(10, 13, 20)` | Darkest surface |

### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| `text-heading` | `rgb(252, 252, 250)` | Headings, primary text (warm white) |
| `text-white` | `rgb(255, 255, 255)` | Pure white |
| `text-gray-300` | `rgb(205, 208, 213)` | Body text, descriptions |
| `text-gray-600` | `rgb(49, 53, 63)` | Muted text |
| `text-gray-700` | `rgb(32, 35, 45)` | Very muted text |

### Accent Colors

**Important:** The primary accent is **BLUE**, not orange.

| Token | Value | Usage |
|-------|-------|-------|
| `accent-primary` | `rgb(54, 94, 255)` | Primary buttons, links, highlights |
| `accent-secondary` | `rgb(0, 62, 161)` | Deeper blue for contrast |
| `accent-highlight` | `rgb(0, 111, 255)` | Bright blue for emphasis |
| `accent-cyan` | `rgb(80, 248, 228)` | Cyan/teal for metrics, highlights |
| `accent-pink` | `rgb(255, 202, 226)` | Pink accent (secondary) |

### Border Colors

| Token | Value | Usage |
|-------|-------|-------|
| `border-line` | `rgb(31, 31, 31)` | Default borders, dividers |
| `border-subtle` | `rgba(255, 255, 255, 0.08)` | Subtle borders, separators |

### Shader/Gradient Colors

Used for the animated mesh background effect:

| Token | Value |
|-------|-------|
| `shader-1` | `rgb(54, 94, 255)` |
| `shader-2` | `rgb(20, 68, 215)` |
| `shader-3` | `rgb(112, 234, 255)` |
| `shader-4` | `rgb(0, 0, 0)` |

---

## Typography

### Font Families

| Token | Font | Usage |
|-------|------|-------|
| `font-display` | Cabinet Grotesk | Buttons, special headings |
| `font-heading` | Instrument Sans | Main headings, titles |
| `font-body` | Inter | Body text, descriptions |

### Font Stack (CSS)

```css
--font-display: "Cabinet Grotesk", sans-serif;
--font-heading: "Instrument Sans", sans-serif;
--font-body: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
```

### Framer Font Selectors

For reference when working with Framer:

| Font | Selector |
|------|----------|
| Cabinet Grotesk Medium | `FS;Cabinet Grotesk-medium` |
| Cabinet Grotesk Regular | `FS;Cabinet Grotesk-regular` |
| Instrument Sans 500 | `GF;Instrument Sans-500` |
| Inter Regular | `Inter` |
| Inter Medium | `Inter-Medium` |

### Text Styles

#### Body Text
```css
font-family: Inter;
font-size: 16px;
line-height: 1.6em;
letter-spacing: -0.02em;
```

#### Headings
```css
font-family: "Instrument Sans", sans-serif;
font-weight: 500;
letter-spacing: -0.02em;
line-height: 1.1;
```

### Type Scale

| Level | Size | Weight |
|-------|------|--------|
| H1 | `clamp(2.5rem, 5vw, 3.5rem)` | 500 |
| H2 | `clamp(1.75rem, 4vw, 2.5rem)` | 500 |
| H3 | `1.125rem` | 500 |
| Body | `1rem` (16px) | 400/500 |
| Small | `0.875rem` (14px) | 400/500 |
| Caption | `0.75rem` (12px) | 500 |

---

## Spacing & Layout

### Section Padding

| Context | Value |
|---------|-------|
| Default | `30px 64px` |
| Large | `100px 64px` |
| Extra Large | `120px 64px` |
| Mobile | `30px 24px` |

### Gap Scale

| Token | Value |
|-------|-------|
| `gap-xs` | `5px` |
| `gap-sm` | `10px` |
| `gap-md` | `16px` |
| `gap-lg` | `24px` |
| `gap-xl` | `32px` |
| `gap-2xl` | `48px` |
| `gap-3xl` | `56px` |
| `gap-4xl` | `64px` |

### Max Widths

| Token | Value | Usage |
|-------|-------|-------|
| `max-content` | `1200px` | Main content container |
| `max-wide` | `1400px` | Wide sections |
| `max-text` | `800px` | Text blocks |
| `max-narrow` | `700px` | Narrow text |

### Container

```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 64px;
}

@media (max-width: 768px) {
  .container {
    padding: 0 24px;
  }
}
```

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | `0px` | Sharp corners |
| `radius-sm` | `8px` | Cards, small elements |
| `radius-md` | `12px` | Medium elements |
| `radius-lg` | `16px` | Large cards, testimonials |
| `radius-xl` | `20px` | CTA boxes |
| `radius-2xl` | `32px` | Large containers |
| `radius-full` | `999px` | Pill buttons, tags |

---

## Effects & Backgrounds

### Shader Mesh Background

The hero uses an animated shader effect. CSS approximation:

```css
.shader-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 800px;
  opacity: 0.8;
  overflow: hidden;
  pointer-events: none;
}

.shader-background::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(
      ellipse 80% 50% at 50% 0%,
      rgba(54, 94, 255, 0.4) 0%,
      rgba(20, 68, 215, 0.2) 40%,
      transparent 70%
    ),
    radial-gradient(
      ellipse 60% 40% at 70% 20%,
      rgba(112, 234, 255, 0.15) 0%,
      transparent 50%
    );
  animation: shaderPulse 8s ease-in-out infinite;
}

@keyframes shaderPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
}
```

### Background Pattern

A subtle grid pattern at 2% opacity:

```css
.bg-pattern {
  position: fixed;
  inset: 0;
  opacity: 0.02;
  background-image: 
    linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
}
```

### Gradient Overlays

Used throughout at 40% opacity:

```css
.gradient-overlay {
  position: absolute;
  width: 100%;
  height: 740px;
  background: radial-gradient(
    ellipse 50% 50% at 50% 50%,
    rgba(54, 94, 255, 0.15) 0%,
    transparent 70%
  );
  opacity: 0.4;
  pointer-events: none;
}
```

### Glass Effect (Navigation)

```css
.nav {
  background: rgba(7, 9, 14, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgb(31, 31, 31);
}
```

---

## Component Patterns

### Primary Button

Pill-shaped with gradient background:

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%);
  color: white;
  font-family: "Cabinet Grotesk", sans-serif;
  font-weight: 500;
  font-size: 0.9375rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(54, 94, 255, 0.4);
}
```

### Secondary Button

```css
.btn-secondary {
  padding: 12px 20px;
  border-radius: 999px;
  background: transparent;
  color: rgb(252, 252, 250);
  border: 1px solid rgb(31, 31, 31);
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: rgb(54, 94, 255);
  color: rgb(54, 94, 255);
}
```

### Tag/Badge

```css
.tag {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(51, 136, 255, 0.09);
  color: rgb(54, 94, 255);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
```

### Card

```css
.card {
  background: rgb(12, 14, 19);
  border-radius: 8px;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-4px);
  transition: transform 0.3s ease;
}
```

### Testimonial Card

With gradient border effect:

```css
.testimonial-card {
  background: transparent;
  border-radius: 16px;
  padding: 32px;
  position: relative;
}

.testimonial-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(54, 94, 255, 0.2) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(54, 94, 255, 0.1) 100%
  );
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

### Divider

```css
.divider {
  height: 1px;
  background: rgb(31, 31, 31);
}
```

---

## CSS Variables

Copy this into your `globals.css`:

```css
:root {
  /* Background Colors */
  --sl-bg-primary: rgb(7, 9, 14);
  --sl-bg-card: rgb(12, 14, 19);
  --sl-bg-card-blue: rgba(51, 136, 255, 0.09);
  --sl-bg-black: rgb(0, 0, 0);
  --sl-bg-900: rgb(10, 13, 20);

  /* Text Colors */
  --sl-text-heading: rgb(252, 252, 250);
  --sl-text-white: rgb(255, 255, 255);
  --sl-text-gray-300: rgb(205, 208, 213);
  --sl-text-gray-600: rgb(49, 53, 63);
  --sl-text-gray-700: rgb(32, 35, 45);

  /* Accent Colors */
  --sl-accent-primary: rgb(54, 94, 255);
  --sl-accent-secondary: rgb(0, 62, 161);
  --sl-accent-highlight: rgb(0, 111, 255);
  --sl-accent-cyan: rgb(80, 248, 228);
  --sl-accent-pink: rgb(255, 202, 226);

  /* Border Colors */
  --sl-border-line: rgb(31, 31, 31);
  --sl-border-subtle: rgba(255, 255, 255, 0.08);

  /* Typography */
  --sl-font-display: "Cabinet Grotesk", sans-serif;
  --sl-font-heading: "Instrument Sans", sans-serif;
  --sl-font-body: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;

  /* Border Radius */
  --sl-radius-sm: 8px;
  --sl-radius-md: 12px;
  --sl-radius-lg: 16px;
  --sl-radius-xl: 20px;
  --sl-radius-2xl: 32px;
  --sl-radius-full: 999px;

  /* Spacing */
  --sl-gap-xs: 5px;
  --sl-gap-sm: 10px;
  --sl-gap-md: 16px;
  --sl-gap-lg: 24px;
  --sl-gap-xl: 32px;
  --sl-gap-2xl: 48px;

  /* Max Widths */
  --sl-max-content: 1200px;
  --sl-max-wide: 1400px;
  --sl-max-text: 800px;
}
```

---

## Tailwind Configuration

Add to your `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      colors: {
        'sl-bg': {
          DEFAULT: 'rgb(7, 9, 14)',
          card: 'rgb(12, 14, 19)',
          'card-blue': 'rgba(51, 136, 255, 0.09)',
          black: 'rgb(0, 0, 0)',
          900: 'rgb(10, 13, 20)',
        },
        'sl-text': {
          heading: 'rgb(252, 252, 250)',
          white: 'rgb(255, 255, 255)',
          300: 'rgb(205, 208, 213)',
          600: 'rgb(49, 53, 63)',
          700: 'rgb(32, 35, 45)',
        },
        'sl-accent': {
          DEFAULT: 'rgb(54, 94, 255)',
          secondary: 'rgb(0, 62, 161)',
          highlight: 'rgb(0, 111, 255)',
          cyan: 'rgb(80, 248, 228)',
          pink: 'rgb(255, 202, 226)',
        },
        'sl-border': {
          DEFAULT: 'rgb(31, 31, 31)',
          subtle: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        'sl-display': ['"Cabinet Grotesk"', 'sans-serif'],
        'sl-heading': ['"Instrument Sans"', 'sans-serif'],
        'sl-body': ['"Inter"', 'sans-serif'],
      },
      borderRadius: {
        'sl-sm': '8px',
        'sl-md': '12px',
        'sl-lg': '16px',
        'sl-xl': '20px',
        'sl-2xl': '32px',
        'sl-full': '999px',
      },
      maxWidth: {
        'sl-content': '1200px',
        'sl-wide': '1400px',
        'sl-text': '800px',
        'sl-narrow': '700px',
      },
      backgroundImage: {
        'sl-gradient-accent': 'linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)',
        'sl-gradient-mesh': `
          radial-gradient(ellipse 80% 50% at 50% 0%, rgba(54, 94, 255, 0.4) 0%, rgba(20, 68, 215, 0.2) 40%, transparent 70%),
          radial-gradient(ellipse 60% 40% at 70% 20%, rgba(112, 234, 255, 0.15) 0%, transparent 50%)
        `,
      },
    },
  },
};

export default config;
```

---

## Quick Reference

### Tailwind Classes

```html
<!-- Backgrounds -->
<div class="bg-sl-bg">Page background</div>
<div class="bg-sl-bg-card">Card background</div>

<!-- Text -->
<h1 class="text-sl-text-heading font-sl-heading">Heading</h1>
<p class="text-sl-text-300 font-sl-body">Body text</p>

<!-- Accent -->
<span class="text-sl-accent">Highlighted text</span>
<span class="text-sl-accent-cyan">Metric value</span>

<!-- Borders -->
<div class="border border-sl-border">Default border</div>

<!-- Buttons -->
<button class="bg-sl-gradient-accent text-white rounded-sl-full px-5 py-3">
  Primary Button
</button>

<!-- Cards -->
<div class="bg-sl-bg-card rounded-sl-sm p-6">
  Card content
</div>
```

---

## Notes

1. **Blue, not orange**: The primary accent is blue (`rgb(54, 94, 255)`), not orange as might appear from images.

2. **Blue undertones**: Backgrounds have subtle blue undertones (`rgb(7, 9, 14)` vs pure `#000`).

3. **Warm white**: Heading text uses warm white (`rgb(252, 252, 250)`) for a softer feel.

4. **Pill buttons**: All buttons use `border-radius: 999px` for the pill shape.

5. **40% overlays**: Gradient overlays consistently use `opacity: 0.4`.

6. **Cabinet Grotesk**: This is a premium font. You may need to purchase it or substitute with a similar geometric sans-serif.
