# SaaSLaunch Design System

> **Extracted from:** Framer Project - Ayaan - LP [3rd] (copy)  
> **Last Updated:** February 2026  
> **Purpose:** AI-GOS Platform Design Alignment

## Overview

This design system captures the actual visual language of SaaSLaunch. It emphasizes premium dark-mode aesthetics with a blue-based accent system, subtle depth through shadows and overlays, and sophisticated typography using Cabinet Grotesk and Inter.

### Core Principles

1. **Restraint over decoration** - Minimal ornamentation, purposeful design
2. **Depth through subtlety** - Layered shadows, low-opacity overlays
3. **Typography-driven hierarchy** - Clear typographic scale, intentional spacing
4. **Film grain aesthetic** - 2% opacity background patterns for texture
5. **No AI slop** - Avoid glassmorphism, excessive rounded corners, gradient abuse

---

## 🎨 Color Palette

### Background Colors

```typescript
background: {
  primary: 'rgb(7, 9, 14)',      // Main desktop background - dark blue-black
  card: 'rgb(12, 14, 19)',       // Card backgrounds
  cardBlue: 'rgba(51, 136, 255, 0.09)', // Card with blue tint
  black: 'rgb(0, 0, 0)',         // Pure black
  dark900: 'rgb(10, 13, 20)',    // 900 shade
}
```

**Key Insight:** Backgrounds are NOT pure black (#000000) - they have a subtle blue undertone (`rgb(7, 9, 14)`).

### Text Colors

```typescript
text: {
  heading: 'rgb(252, 252, 250)', // Near-white for headings (slightly warm)
  white: 'rgb(255, 255, 255)',   // Pure white
  gray300: 'rgb(205, 208, 213)', // Light gray for body text
  gray600: 'rgb(49, 53, 63)',    // Medium gray
  gray700: 'rgb(32, 35, 45)',    // Darker gray
}
```

### Accent Colors

```typescript
accent: {
  primary: 'rgb(54, 94, 255)',   // PRIMARY BLUE - main accent color
  secondary: 'rgb(0, 62, 161)',  // Deeper blue
  highlight: 'rgb(0, 111, 255)', // Bright blue
  cyan: 'rgb(80, 248, 228)',     // Cyan/teal accent
  pink: 'rgb(255, 202, 226)',    // Pink accent
}
```

**CRITICAL:** The primary accent is **BLUE** `rgb(54, 94, 255)` - NOT orange or any other color.

### Border Colors

```typescript
border: {
  line: 'rgb(31, 31, 31)',           // Primary border line
  subtle: 'rgba(255, 255, 255, 0.08)', // Subtle white borders (8% opacity)
}
```

### Shader/Gradient Colors

Used in animated background effects:

```typescript
shader: {
  color1: 'rgb(54, 94, 255)',   // Primary shader (blue)
  color2: 'rgb(20, 68, 215)',   // Secondary shader
  color3: 'rgb(0, 0, 0)',       // Black
  color4: 'rgb(112, 234, 255)', // Cyan highlight
}
```

---

## 📝 Typography

### Font Families

```typescript
fontFamily: {
  display: '"Cabinet Grotesk", sans-serif',  // Headings, buttons, emphasis
  body: '"Inter", sans-serif',               // Body text, paragraphs
  heading: '"Instrument Sans", sans-serif',  // Alternative headings
}
```

### Font Loading (Framer Selectors)

```typescript
framerFonts: {
  cabinetMedium: 'FS;Cabinet Grotesk-medium',
  cabinetRegular: 'FS;Cabinet Grotesk-regular',
  instrumentSans500: 'GF;Instrument Sans-500',
  interRegular: 'Inter',
  interMedium: 'Inter-Medium',
}
```

### Type Scale

| Style | Font | Size | Weight | Line Height | Letter Spacing | Use Case |
|-------|------|------|--------|-------------|----------------|----------|
| **H1** | Cabinet Grotesk | 40px | Bold (700) | 1em | -0.04em | Page titles |
| **H2** | Cabinet Grotesk | 32px | Semibold (600) | 1em | -0.03em | Section titles |
| **H3** | Instrument Sans | 22px | Semibold (600) | 1.2em | -0.01em | Subsections |
| **H4** | Cabinet Grotesk | 15px | Medium (500) | 1em | -0.01em | Card titles |
| **Body** | Inter | 16px | Regular (400) | 1.6em | -0.02em | Main content |
| **Button** | Cabinet Grotesk | 14px | Semibold (600) | 1em | -0.01em | CTAs, links |

### Base Text Style

```css
body {
  font-family: "Inter", sans-serif;
  font-size: 16px;
  line-height: 1.6em;
  letter-spacing: -0.02em;
  color: rgb(205, 208, 213);
}
```

---

## 📐 Spacing & Layout

### Section Padding

```typescript
section: {
  default: '30px 64px',   // Standard sections
  large: '100px 64px',    // Hero, feature sections
  xlarge: '120px 64px',   // Major landing sections
}
```

### Gap System

```typescript
gap: {
  xs: '5px',
  sm: '10px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '56px',
  '4xl': '64px',
}
```

### Container Max Widths

```typescript
maxWidth: {
  content: '1200px',  // Default content width
  wide: '1400px',     // Wide layouts
  text: '800px',      // Readable text width
  narrow: '700px',    // Narrow text columns
}
```

---

## 🔲 Border Radius

```typescript
borderRadius: {
  none: '0px',
  sm: '8px',      // Small cards, inputs
  md: '12px',     // Medium cards
  lg: '16px',     // Large cards, panels
  xl: '20px',     // Extra large surfaces
  '2xl': '32px',  // Hero elements
  '3xl': '35px',
  full: '999px',  // Pill buttons
  round: '9999px', // Perfect circles
}
```

**Pattern:** Cards use `16px`, buttons use `999px` (pill shape).

---

## ✨ Effects

### Gradient Overlays

```typescript
gradientOverlay: {
  opacity: 0.4,  // 40% opacity for depth
}
```

### Background Pattern

```typescript
bgPattern: {
  opacity: 0.02,  // Very subtle - "film grain" effect
  url: 'https://framerusercontent.com/images/ldf53R2pKtKErtQpdz1GxxWt2I.svg',
}
```

### Shader Lines (Animated Background)

```typescript
shaderLines: {
  opacity: 0.8,
  speed: 0.15,
  bandWidth: 0.15,
  flow: 'out-in',
  colorMode: 'spectrum',
  blendMode: 'additive',
}
```

---

## 🎯 Component Patterns

### Primary Button

```css
.button-primary {
  background: rgb(54, 94, 255);
  color: white;
  border-radius: 999px;
  padding: 12px 20px;
  font-family: "Cabinet Grotesk", sans-serif;
  font-weight: 500;
  font-size: 14px;
  letter-spacing: -0.01em;
}
```

### Card

```css
.card {
  background: rgb(12, 14, 19);
  border-radius: 16px;
  padding: 32px;
  border: 1px solid rgb(31, 31, 31);
}
```

### Card with Blue Tint

```css
.card-blue {
  background: rgba(51, 136, 255, 0.09);
  border-radius: 16px;
  padding: 32px;
}
```

### Testimonial Card

```css
.testimonial-card {
  background: transparent;
  border-radius: 16px;
  padding: 32px;
  /* Add shadow overlay element for depth */
  position: relative;
}
```

---

## 💻 Implementation

### CSS Variables

Add to `globals.css`:

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
  --sl-font-body: "Inter", sans-serif;
  --sl-font-heading: "Instrument Sans", sans-serif;

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

### Tailwind Configuration

Extend your `tailwind.config.ts`:

```javascript
export default {
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
        'sl-body': ['"Inter"', 'sans-serif'],
        'sl-heading': ['"Instrument Sans"', 'sans-serif'],
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
    },
  },
}
```

### TypeScript Constants

```typescript
export const colors = {
  background: {
    primary: 'rgb(7, 9, 14)',
    card: 'rgb(12, 14, 19)',
    cardBlue: 'rgba(51, 136, 255, 0.09)',
    black: 'rgb(0, 0, 0)',
    dark900: 'rgb(10, 13, 20)',
  },
  text: {
    heading: 'rgb(252, 252, 250)',
    white: 'rgb(255, 255, 255)',
    gray300: 'rgb(205, 208, 213)',
    gray600: 'rgb(49, 53, 63)',
    gray700: 'rgb(32, 35, 45)',
  },
  accent: {
    primary: 'rgb(54, 94, 255)',
    secondary: 'rgb(0, 62, 161)',
    highlight: 'rgb(0, 111, 255)',
    cyan: 'rgb(80, 248, 228)',
    pink: 'rgb(255, 202, 226)',
  },
  border: {
    line: 'rgb(31, 31, 31)',
    subtle: 'rgba(255, 255, 255, 0.08)',
  },
} as const;
```

---

## 🚫 What to Avoid

### Anti-Patterns (AI Slop)

❌ **Avoid These:**
- Glassmorphism effects (`backdrop-filter: blur()`)
- Excessive rounded corners (> 32px on cards)
- Gradient abuse (multi-color gradients everywhere)
- Overly saturated colors
- Pure black backgrounds (#000000 without blue undertone)
- Orange accents (the accent is BLUE!)

✅ **Do This Instead:**
- Subtle depth through shadows and overlays
- Consistent border radius (16px for cards, 999px for buttons)
- Restrained use of gradients (40% opacity overlays)
- Muted color palette with blue accents
- Blue-tinted dark backgrounds
- Blue as primary accent color

---

## 📊 Design Tokens Summary

### Quick Reference

| Token | Value | Usage |
|-------|-------|-------|
| Primary BG | `rgb(7, 9, 14)` | Main background |
| Card BG | `rgb(12, 14, 19)` | Cards, panels |
| Primary Accent | `rgb(54, 94, 255)` | CTAs, links, focus states |
| Body Text | `rgb(205, 208, 213)` | Paragraphs, descriptions |
| Heading Text | `rgb(252, 252, 250)` | Titles, headings |
| Border | `rgb(31, 31, 31)` | Dividers, outlines |
| Card Radius | `16px` | Standard card corners |
| Button Radius | `999px` | Pill-shaped buttons |
| Display Font | Cabinet Grotesk | Headings, buttons |
| Body Font | Inter | Paragraphs, UI text |

---

## 🎨 Usage Examples

### Hero Section

```tsx
<section className="bg-sl-bg py-24 px-16">
  <div className="max-w-sl-content mx-auto">
    <h1 className="font-sl-display text-5xl font-bold leading-none tracking-tight text-sl-text-heading">
      Build SaaS Faster
    </h1>
    <p className="font-sl-body text-sl-text-300 text-base mt-6 leading-relaxed tracking-tight">
      Ship production-ready features in hours, not weeks.
    </p>
    <button className="mt-8 bg-sl-accent px-5 py-3 rounded-sl-full font-sl-display font-medium text-sm text-white">
      Get Started
    </button>
  </div>
</section>
```

### Feature Card

```tsx
<div className="bg-sl-bg-card rounded-sl-lg p-8 border border-sl-border">
  <h3 className="font-sl-heading text-xl font-semibold text-sl-text-heading">
    AI-Powered Research
  </h3>
  <p className="font-sl-body text-sl-text-300 mt-4 leading-relaxed">
    Transform briefs into strategic blueprints in under 2 minutes.
  </p>
</div>
```

---

## 📚 References

- **Framer Project:** Ayaan - LP [3rd] (copy)
- **Inspiration:** Vercel, Stripe, Linear design systems
- **Font Sources:** Cabinet Grotesk (custom), Inter (Google Fonts), Instrument Sans (Google Fonts)

---

## 🔄 Version History

- **v1.0** (Feb 2026) - Initial extraction from Framer MCP
- Documented actual color values (correcting earlier blue/orange confusion)
- Established component patterns and usage guidelines
