# AI-GOS Design System

> A premium, crafted design language for AI-powered marketing automation.
> Inspired by Vercel, Stripe, Linear, and SaaSLaunch.

---

## Design Philosophy

### Core Principles

1. **Restraint over decoration** — Every element earns its place. No gratuitous effects.
2. **Motion with purpose** — Animations provide feedback and delight, never distract.
3. **Depth through subtlety** — Layers created with opacity and blur, not drop shadows.
4. **Typography does the work** — Let type hierarchy guide the eye, not color.
5. **Dark mode native** — Designed for dark first, not inverted from light.

### What We Avoid (AI Slop)

- Glassmorphism cards with heavy blur
- Rounded corners everywhere (16px+ radius)
- Blue/purple gradients on every surface
- Bouncing animations and excessive motion
- Generic icon sets (Lucide, Heroicons) as decoration
- Stats cards with icons in colored circles
- Floating action buttons with shadows

### What We Embrace

- Pure black backgrounds with subtle elevation
- Grain texture for analog warmth
- Gradient borders that animate
- Monospace type for data
- Single accent color used sparingly
- Magnetic, physics-based interactions
- Staggered, orchestrated animations

---

## Color System

### Background Hierarchy

```css
--bg-base: #000000;           /* Page background - pure black */
--bg-elevated: #0a0a0a;       /* Elevated surfaces */
--bg-card: #0d0d0d;           /* Card containers - NEW */
--bg-surface: #101010;        /* Component backgrounds - INCREASED */
--bg-hover: #161616;          /* Interactive hover states - INCREASED */
--bg-active: #1c1c1c;         /* Active/pressed states - INCREASED */
```

> **v2.1 Update:** Background values were increased to create better visual separation. The original values (#0c0c0c, #111111, #181818) blended too much with pure black, making content feel flat.

### Border System (Opacity-based)

```css
/* INCREASED for visibility - original values caused content to blend */
--border-subtle: rgba(255, 255, 255, 0.08);   /* was 0.04 */
--border-default: rgba(255, 255, 255, 0.12);  /* was 0.06 */
--border-hover: rgba(255, 255, 255, 0.18);    /* was 0.10 */
--border-focus: rgba(255, 255, 255, 0.22);    /* was 0.15 */
--border-strong: rgba(255, 255, 255, 0.28);   /* was 0.20 */
```

> **v2.1 Update:** Border opacities doubled to improve visibility. The original values were too subtle and caused cards/sections to disappear into the background.

### Shadow System (NEW in v2.1)

```css
/* Card shadow - subtle depth with inset highlight */
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.02);

/* Elevated shadow - for floating elements */
--shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.5);
```

> **Usage:** Apply `shadow-[var(--shadow-card)]` to cards and section containers. The inset highlight creates a subtle top edge that helps separate content from the background.

### Text Hierarchy

```css
--text-primary: #ffffff;              /* Headings, important content */
--text-secondary: #a0a0a0;            /* Body text */
--text-tertiary: #666666;             /* Labels, captions */
--text-quaternary: #444444;           /* Disabled, line numbers */
--text-muted: #333333;                /* Decorative text */
```

### Accent Colors

```css
/* Primary Blue */
--accent-blue: #3b82f6;
--accent-blue-hover: #60a5fa;
--accent-blue-subtle: rgba(59, 130, 246, 0.10);
--accent-blue-glow: rgba(59, 130, 246, 0.15);

/* Secondary Purple (for gradients) */
--accent-purple: #8b5cf6;
--accent-purple-subtle: rgba(139, 92, 246, 0.20);

/* Semantic */
--success: #22c55e;
--success-subtle: rgba(34, 197, 94, 0.10);
--warning: #f59e0b;
--error: #ef4444;
```

### Gradient Presets

```css
/* Primary button gradient */
--gradient-primary: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%);

/* Accent gradient (borders, highlights) */
--gradient-accent: linear-gradient(135deg, #3b82f6, #8b5cf6);

/* Text gradient */
--gradient-text: linear-gradient(180deg, #ffffff 0%, #888888 100%);

/* Subtle surface gradient */
--gradient-surface: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);

/* Animated border gradient */
--gradient-border-animated: linear-gradient(135deg, 
  rgba(59,130,246,0.5), 
  rgba(139,92,246,0.3), 
  rgba(59,130,246,0.1), 
  rgba(139,92,246,0.5)
);
```

---

## Typography

### Font Stack

```css
/* Primary - Geist Sans */
--font-sans: "Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

/* Monospace - Geist Mono */
--font-mono: "Geist Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
```

**CDN Import:**
```css
@import url('https://fonts.cdnfonts.com/css/geist-mono');
@import url('https://fonts.cdnfonts.com/css/geist-sans');
```

### Type Scale

| Name | Size | Weight | Letter Spacing | Line Height | Font |
|------|------|--------|----------------|-------------|------|
| Display | 32px | 700 | -0.03em | 1.2 | Sans |
| Heading 1 | 24px | 700 | -0.02em | 1.3 | Sans |
| Heading 2 | 18px | 600 | -0.01em | 1.4 | Sans |
| Heading 3 | 16px | 600 | -0.01em | 1.4 | Sans |
| Body | 15px | 400 | 0 | 1.6 | Sans |
| Body Small | 14px | 400 | 0 | 1.6 | Sans |
| Caption | 13px | 500 | 0.01em | 1.5 | Sans |
| Label | 12px | 600 | 0.08em | 1.4 | Sans (uppercase) |
| Overline | 11px | 600 | 0.10em | 1.2 | Sans (uppercase) |
| Code | 13px | 400 | 0 | 1.8 | Mono |
| Data | 42px | 700 | -0.03em | 1.1 | Mono |

### Gradient Text

```css
.gradient-text {
  background: linear-gradient(180deg, #ffffff 0%, #888888 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## Spacing System

Based on 4px grid:

```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-14: 56px;
--space-16: 64px;
```

### Component Spacing

| Component | Padding | Gap |
|-----------|---------|-----|
| Page | 48px horizontal | — |
| Section | 56px vertical | 64px |
| Card | 28-32px | — |
| Button (sm) | 10px 18px | 8px |
| Button (md) | 12px 24px | 10px |
| Button (lg) | 18px 36px | 10px |
| Input | 16px 0 (underline style) | — |
| Nav pill | 10px 18px | 4px |
| Modal | 24px | 16px |

---

## Border Radius

```css
--radius-sm: 6px;     /* Badges, small buttons */
--radius-md: 8px;     /* Buttons, inputs */
--radius-lg: 12px;    /* Cards, dropdowns */
--radius-xl: 16px;    /* Large cards, modals */
--radius-2xl: 20px;   /* Hero sections */
--radius-full: 9999px; /* Pills, avatars */
```

### Usage Guidelines

- **Buttons:** 8-12px
- **Cards:** 15-16px (inner content 1px less than wrapper)
- **Navigation pills:** 9-12px
- **Inputs:** 0 (underline style) or 6px
- **Modals:** 15-16px
- **Badges:** 6px

---

## Effects & Textures

### Film Grain Overlay

Applied globally at low opacity for analog warmth:

```jsx
const Grain = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1000,
    opacity: 0.03,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
  }} />
);
```

### Ambient Glow

Subtle blue radial gradient at top of page:

```css
.ambient-glow {
  position: fixed;
  top: -300px;
  left: 50%;
  transform: translateX(-50%);
  width: 1000px;
  height: 600px;
  background: radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 50%);
  pointer-events: none;
}
```

### Gradient Border Wrapper

For premium card effects with optional animation:

```jsx
const GradientBorder = ({ children, animate = false }) => (
  <div style={{
    position: 'relative',
    borderRadius: 16,
    padding: 1,
    background: animate 
      ? 'linear-gradient(135deg, rgba(59,130,246,0.5), rgba(139,92,246,0.3), rgba(59,130,246,0.1), rgba(139,92,246,0.5))'
      : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
    backgroundSize: animate ? '300% 300%' : '100% 100%',
    animation: animate ? 'gradientShift 8s ease infinite' : 'none',
  }}>
    <div style={{
      background: '#0a0a0a',
      borderRadius: 15,
      height: '100%',
    }}>
      {children}
    </div>
  </div>
);
```

```css
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

### Hover Glow Effect

Radial glow that appears on hover:

```jsx
<motion.div
  animate={{ opacity: hovered ? 1 : 0 }}
  transition={{ duration: 0.3 }}
  style={{
    position: 'absolute',
    inset: -20,
    background: 'radial-gradient(circle at center, rgba(59,130,246,0.15), transparent 70%)',
    borderRadius: 40,
    pointerEvents: 'none',
  }}
/>
```

### Button Glow

```css
.button-glow {
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 14px;
  filter: blur(20px);
  opacity: 0.4;
  z-index: -1;
}
```

---

## Animation System

### Framer Motion Springs

```javascript
const springs = {
  // Quick, snappy (buttons, toggles)
  snappy: { type: 'spring', stiffness: 500, damping: 30 },
  
  // Smooth, natural (cards, panels)
  smooth: { type: 'spring', stiffness: 400, damping: 30 },
  
  // Gentle, elegant (page transitions)
  gentle: { type: 'spring', stiffness: 300, damping: 35 },
  
  // Bouncy (attention-grabbing)
  bouncy: { type: 'spring', stiffness: 400, damping: 15 },
};
```

### Easing Curves

```javascript
const easings = {
  // Smooth deceleration
  out: [0.21, 0.45, 0.27, 0.9],
  
  // Smooth acceleration-deceleration
  inOut: [0.4, 0, 0.2, 1],
  
  // Quick start, slow end
  expo: [0.16, 1, 0.3, 1],
};
```

### Duration Guidelines

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Hover state | 200-300ms | ease-out |
| Button press | 100ms | spring (snappy) |
| Focus state | 300ms | ease-out |
| Panel slide | 250ms | spring (smooth) |
| Page transition | 400-600ms | spring (gentle) |
| Counter animation | 1500-2000ms | cubic-bezier out |
| Stagger delay | 100ms between items | — |

### Entrance Animations

```javascript
// Fade up (default)
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.21, 0.45, 0.27, 0.9] }
};

// Fade from side
const fadeLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.8, delay: 0.3 }
};

// Staggered children
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};
```

### Micro-interactions

#### Animated Counter

```javascript
const useCounter = (target, duration = 1500) => {
  const [value, setValue] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  
  return value;
};
```

#### Magnetic Button Effect

```javascript
const MagneticButton = ({ children }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const handleMouse = (e) => {
    const rect = e.target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.15);
    y.set((e.clientY - centerY) * 0.15);
  };
  
  return (
    <motion.button style={{ x, y }} onMouseMove={handleMouse} onMouseLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.button>
  );
};
```

#### Shine Sweep Effect

```jsx
<motion.div
  initial={{ x: '-100%' }}
  whileHover={{ x: '100%' }}
  transition={{ duration: 0.6 }}
  style={{
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
    pointerEvents: 'none',
  }}
/>
```

#### Pulse Ring (Active State)

```jsx
<motion.div
  animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
  transition={{ duration: 1.5, repeat: Infinity }}
  style={{
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: '#3b82f6',
  }}
/>
```

#### Line Expand on Hover

```jsx
<motion.div
  animate={{ width: hovered ? '100%' : '40%' }}
  transition={{ duration: 0.4, ease: [0.21, 0.45, 0.27, 0.9] }}
  style={{
    height: 1,
    background: 'linear-gradient(90deg, rgba(59,130,246,0.5), transparent)',
  }}
/>
```

---

## Component Patterns

### Primary Button

```jsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  style={{
    position: 'relative',
    padding: '18px 36px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    overflow: 'hidden',
  }}
>
  {/* Glow layer */}
  <div style={{
    position: 'absolute',
    inset: -2,
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    borderRadius: 14,
    filter: 'blur(20px)',
    opacity: 0.4,
    zIndex: -1,
  }} />
  
  {/* Shine sweep (on hover) */}
  <motion.div
    initial={{ x: '-100%' }}
    whileHover={{ x: '100%' }}
    transition={{ duration: 0.6 }}
    style={{
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
    }}
  />
  
  <span style={{ position: 'relative' }}>
    Generate Blueprint →
  </span>
</motion.button>
```

### Secondary Button

```jsx
<motion.button
  whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.15)' }}
  whileTap={{ scale: 0.98 }}
  style={{
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8,
    color: '#a0a0a0',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  }}
>
  Export
</motion.button>
```

### Floating Label Input

```jsx
const Input = ({ label, value, onChange }) => {
  const [focused, setFocused] = useState(false);
  const hasValue = value?.length > 0;
  
  return (
    <div style={{ position: 'relative', marginBottom: 28 }}>
      {/* Floating label */}
      <motion.label
        animate={{
          y: focused || hasValue ? -24 : 0,
          scale: focused || hasValue ? 0.85 : 1,
          color: focused ? '#3b82f6' : '#666',
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 16,
          fontSize: 14,
          fontWeight: 500,
          pointerEvents: 'none',
          transformOrigin: 'left',
        }}
      >
        {label}
      </motion.label>
      
      <input
        type="text"
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '16px 0',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: 16,
          outline: 'none',
        }}
      />
      
      {/* Gradient focus line */}
      <motion.div
        animate={{ scaleX: focused ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          transformOrigin: 'left',
        }}
      />
    </div>
  );
};
```

### Stat Card

```jsx
const StatCard = ({ value, label, icon, delay = 0 }) => {
  const counter = useCounter(parseInt(value), 2000);
  const [hovered, setHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay / 1000 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{ position: 'relative', padding: '32px 28px' }}
    >
      {/* Hover glow */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0 }}
        style={{
          position: 'absolute',
          inset: -20,
          background: 'radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      
      <div style={{ fontSize: 20, marginBottom: 16, opacity: 0.6 }}>{icon}</div>
      
      <div style={{
        fontSize: 42,
        fontWeight: 700,
        fontFamily: '"Geist Mono", monospace',
        letterSpacing: '-0.03em',
        background: 'linear-gradient(180deg, #fff, #a0a0a0)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 8,
      }}>
        {counter.toLocaleString()}
      </div>
      
      <div style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>{label}</div>
      
      {/* Expanding line accent */}
      <motion.div
        animate={{ width: hovered ? '100%' : '40%' }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 28,
          height: 1,
          background: 'linear-gradient(90deg, rgba(59,130,246,0.5), transparent)',
        }}
      />
    </motion.div>
  );
};
```

### Navigation Pill

```jsx
<nav style={{
  display: 'flex',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: 4,
}}>
  {items.map((item, i) => (
    <motion.button
      key={item}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      style={{
        padding: '10px 18px',
        background: isActive(i) ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: 'none',
        borderRadius: 9,
        color: isActive(i) ? '#fff' : '#666',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {item}
    </motion.button>
  ))}
</nav>
```

### Pipeline Progress

```jsx
const Pipeline = ({ stages, current }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    padding: '20px 24px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    gap: 8,
  }}>
    {stages.map((stage, i) => {
      const isComplete = i < current;
      const isActive = i === current;
      
      return (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            background: isActive 
              ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.1))'
              : isComplete ? 'rgba(34,197,94,0.1)' : 'transparent',
            borderRadius: 8,
            border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : isComplete ? 'rgba(34,197,94,0.2)' : 'transparent'}`,
          }}>
            {/* Status dot */}
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isComplete ? '#22c55e' : isActive ? '#3b82f6' : '#333',
              }} />
              
              {/* Pulse ring */}
              {isActive && (
                <motion.div
                  animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: '#3b82f6',
                  }}
                />
              )}
            </div>
            
            <span style={{
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isComplete ? '#22c55e' : isActive ? '#fff' : '#666',
              fontFamily: '"Geist Mono", monospace',
            }}>
              {stage}
            </span>
          </div>
          
          {/* Connection line */}
          {i < stages.length - 1 && (
            <div style={{
              width: 32,
              height: 2,
              background: '#222',
              borderRadius: 1,
              overflow: 'hidden',
            }}>
              <motion.div
                animate={{ x: isComplete ? '0%' : '-100%' }}
                transition={{ duration: 0.5 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#22c55e',
                }}
              />
            </div>
          )}
        </>
      );
    })}
  </div>
);
```

### Document Editor Window

```jsx
<GradientBorder animate={isStreaming}>
  <div style={{ borderRadius: 15, overflow: 'hidden' }}>
    {/* Window chrome */}
    <div style={{
      padding: '14px 20px',
      background: 'linear-gradient(180deg, #141414, #0a0a0a)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
        </div>
        
        {/* Filename tab */}
        <div style={{
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 6,
          fontSize: 12,
          color: '#666',
          fontFamily: '"Geist Mono", monospace',
        }}>
          blueprint.md
        </div>
      </div>
    </div>
    
    {/* Editor content with line numbers */}
    <div style={{ display: 'flex', minHeight: 450 }}>
      {/* Line numbers column */}
      <div style={{
        padding: '20px 20px',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        fontFamily: '"Geist Mono", monospace',
        fontSize: 12,
        color: '#333',
        textAlign: 'right',
        userSelect: 'none',
        background: 'rgba(255,255,255,0.01)',
      }}>
        {/* Line numbers */}
      </div>
      
      {/* Code content */}
      <div style={{
        flex: 1,
        padding: 20,
        fontFamily: '"Geist Mono", monospace',
        fontSize: 13,
        lineHeight: 1.8,
      }}>
        {/* Content with syntax highlighting */}
      </div>
    </div>
  </div>
</GradientBorder>
```

### Streaming Cursor

```jsx
<motion.span
  animate={{ opacity: [1, 0] }}
  transition={{ duration: 0.4, repeat: Infinity }}
  style={{
    display: 'inline-block',
    width: 10,
    height: 20,
    background: 'linear-gradient(180deg, #3b82f6, #8b5cf6)',
    borderRadius: 2,
    marginLeft: 2,
    verticalAlign: 'text-bottom',
    boxShadow: '0 0 20px rgba(59,130,246,0.5)',
  }}
/>
```

---

## Chat Panel

### Structure

```
┌─────────────────────────────────────┐
│  ✦ AI Editor                    ×  │  ← Header with icon + close
│  Refine your blueprint...          │
├─────────────────────────────────────┤
│                                     │
│  AI message bubble                  │  ← Left-aligned, subtle bg
│                                     │
│              User message bubble    │  ← Right-aligned, gradient bg
│                                     │
│  ● ● ● (typing)                    │  ← Animated gradient dots
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────┐ ┌──────┐  │  ← Input area
│  │ Describe changes... │ │ Send │  │
│  └─────────────────────┘ └──────┘  │
│                                     │
│  [Adjust budget] [Add channel] ... │  ← Quick suggestion pills
└─────────────────────────────────────┘
```

### Message Bubbles

```jsx
// AI message
<div style={{
  padding: '14px 18px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  borderBottomLeftRadius: 4,
  maxWidth: '85%',
}}>

// User message
<div style={{
  padding: '14px 18px',
  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  borderRadius: 16,
  borderBottomRightRadius: 4,
  maxWidth: '85%',
}}>
```

### Typing Indicator

```jsx
<div style={{ display: 'flex', gap: 6 }}>
  {[0, 1, 2].map(i => (
    <motion.div
      key={i}
      animate={{ 
        y: [0, -6, 0],
        opacity: [0.4, 1, 0.4],
      }}
      transition={{ 
        duration: 0.8,
        repeat: Infinity,
        delay: i * 0.15,
      }}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      }}
    />
  ))}
</div>
```

---

## Document Layout System (NEW in v2.1)

### Overview

A continuous-scroll document layout that eliminates click-to-expand friction. Users can read all content immediately with sticky navigation for wayfinding.

### Key Principles

1. **Zero friction** - All sections visible immediately, no clicking required
2. **Wayfinding** - Sticky sidebar navigation shows current position
3. **Visual hierarchy** - Cards create clear section separation on pure black
4. **Typography-driven** - Text hierarchy instead of color for visual weight

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  ▓ Reading Progress Bar (thin blue line at top)              │
├────────────────────────────────────────────┬─────────────────┤
│                                            │                 │
│  ┌─────────────────────────────────────┐   │  ┌───────────┐  │
│  │ Section 1: Industry & Market        │   │  │ ① Industry │  │
│  │ [Section Card with content]         │   │  │ ② ICP      │  │
│  │                                     │   │  │ ③ Offer    │  │
│  └─────────────────────────────────────┘   │  │ ④ Compete  │  │
│                                            │  │ ⑤ Synthesis│  │
│  ┌─────────────────────────────────────┐   │  ├───────────┤  │
│  │ Section 2: ICP Analysis             │   │  │ Progress   │  │
│  │ [Section Card with content]         │   │  │ ████░ 3/5  │  │
│  │                                     │   │  └───────────┘  │
│  └─────────────────────────────────────┘   │                 │
│                                            │  (Sticky Nav)   │
│  ...more sections...                       │                 │
│                                            │                 │
├────────────────────────────────────────────┴─────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Floating Action Bar: [3/5] | [Undo] [Redo] | [Approve →]│ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Reading Progress Bar

Thin progress indicator at top of viewport showing scroll position.

```tsx
<div className="fixed top-0 left-0 right-0 h-0.5 bg-[var(--border-subtle)] z-50">
  <div
    className="h-full bg-[var(--accent-blue)] transition-[width] duration-150"
    style={{ width: `${scrollProgress}%` }}
  />
</div>
```

### Section Card Container

Each section is wrapped in an elevated card for visual separation.

```tsx
<section
  className={cn(
    "scroll-mt-6 mb-6 rounded-xl",
    "bg-[var(--bg-card)] border border-[var(--border-default)]",
    "shadow-[var(--shadow-card)]",
    "p-6 md:p-8"
  )}
>
  {/* Section header with number and title */}
  {/* Content always visible - no collapse */}
</section>
```

**Key styling:**
- `bg-[var(--bg-card)]` (#0d0d0d) - Slightly elevated from pure black
- `border-[var(--border-default)]` - 12% white opacity border
- `shadow-[var(--shadow-card)]` - Subtle depth with inset highlight
- `rounded-xl` - 12px radius for cards

### Section Header Pattern

```tsx
<div className="flex items-start justify-between gap-4 mb-6">
  {/* Section number badge - monochrome */}
  <span className={cn(
    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
    isReviewed
      ? "bg-green-500/20 text-green-400 border border-green-500/30"  // Reviewed state
      : "bg-[var(--text-primary)] text-black"                        // Default: white/black
  )}>
    {sectionNumber}
  </span>

  {/* Title and status indicators */}
  <div>
    <h2 className="text-xl font-semibold text-[var(--text-primary)]">
      {sectionLabel}
    </h2>
    {/* Subtle text indicators instead of blue badges */}
    <span className="text-xs text-[var(--text-tertiary)]">
      <Pencil className="h-3 w-3" /> Modified
    </span>
  </div>
</div>
```

**Design decision:** Section numbers use white background with black text (monochrome) instead of blue. Blue is reserved for primary CTAs only.

### Sticky Section Navigation

```tsx
<nav className="sticky top-6 hidden xl:block">
  <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] shadow-[var(--shadow-card)]">
    {sections.map((section, i) => (
      <button
        className={cn(
          "flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-lg",
          "hover:bg-[var(--bg-hover)]",
          isActive
            ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
            : "text-[var(--text-tertiary)]"
        )}
      >
        <span className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
          isActive
            ? "bg-[var(--text-primary)] text-black"
            : isReviewed
            ? "bg-green-500/20 text-green-400"
            : "bg-[var(--border-default)]"
        )}>
          {i + 1}
        </span>
        <span className="truncate">{section.label}</span>
      </button>
    ))}

    {/* Progress bar */}
    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
      <div className="h-1.5 bg-[var(--border-subtle)] rounded-full">
        <div
          className="h-full bg-green-500 rounded-full"
          style={{ width: `${(reviewed / total) * 100}%` }}
        />
      </div>
    </div>
  </div>
</nav>
```

### SubSection Headers

Horizontal line decorators for subsection titles:

```tsx
<h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-3">
  <span className="h-px w-6 bg-[var(--border-hover)]" />
  {title}
  <span className="h-px flex-1 bg-[var(--border-subtle)]" />
</h3>
```

### Data Card Styling

Nested cards for data display within sections:

```tsx
<div className={cn(
  "p-4 rounded-lg",
  "bg-[var(--bg-surface)]",              /* Slightly lighter than section card */
  "border border-[var(--border-subtle)]"
)}>
  {content}
</div>
```

### Keyboard Navigation

Built-in keyboard shortcuts for power users:

| Key | Action |
|-----|--------|
| `j` | Jump to next section |
| `k` | Jump to previous section |
| `Ctrl+Z` | Undo edit |
| `Ctrl+Shift+Z` | Redo edit |

### Floating Action Bar

Fixed at bottom of viewport:

```tsx
<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
  <div className={cn(
    "flex items-center gap-3 px-4 py-3 rounded-full",
    "bg-[var(--bg-elevated)] border border-[var(--border-default)]",
    "shadow-lg shadow-black/20"
  )}>
    {/* Progress: 3/5 */}
    {/* Undo/Redo buttons */}
    {/* Primary CTA with accent blue */}
  </div>
</div>
```

### Color Usage in Document Layout

| Element | Color | Rationale |
|---------|-------|-----------|
| Section numbers | White on black | Monochrome, no blue |
| Reviewed state | Green (semantic) | Clear success indicator |
| Modified indicator | Gray text | Subtle, not prominent |
| Edit button (active) | White on black | Inverted, stands out |
| Primary CTA | Accent blue | Only place blue is used |
| Progress bar | Green | Semantic success color |

**Key principle:** Blue is used ONLY for the primary CTA button. All other interactive elements use monochrome (white/gray/black).

---

## Syntax Highlighting

For document content:

```javascript
const highlightLine = (line) => {
  // Section headers (ALL CAPS)
  if (line.match(/^[A-Z][A-Z\s]+$/)) {
    return { color: '#fff', fontWeight: 700, fontSize: 14 };
  }
  // Dividers
  if (line.startsWith('═') || line.startsWith('─')) {
    return { color: '#333' };
  }
  // Bullet points
  if (line.startsWith('•') || line.startsWith('□')) {
    return { color: '#a0a0a0' };
  }
  // Numbered items
  if (line.match(/^\d+\./)) {
    return { color: '#3b82f6' };
  }
  // Values (percentages, currency)
  if (line.includes('%') || line.includes('$')) {
    return { color: '#22c55e' };
  }
  // Default
  return { color: '#888' };
};
```

---

## Responsive Breakpoints

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

### Layout Adjustments

| Breakpoint | Main Grid | Stats Grid | Spacing |
|------------|-----------|------------|---------|
| < 768px | Single column | 2x2 | 24px |
| 768-1024px | Single column | 4x1 | 32px |
| > 1024px | Sidebar + Content | 4x1 | 48px |

---

## Accessibility

### Focus States

```css
:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

### Color Contrast

| Element | Foreground | Background | Ratio |
|---------|------------|------------|-------|
| Primary text | #ffffff | #000000 | 21:1 ✓ |
| Secondary text | #a0a0a0 | #000000 | 10.4:1 ✓ |
| Tertiary text | #666666 | #000000 | 5.7:1 ✓ |
| Accent on dark | #3b82f6 | #000000 | 5.1:1 ✓ |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Set up Geist fonts
- [ ] Configure color tokens as CSS variables
- [ ] Create grain texture overlay component
- [ ] Set up Framer Motion with spring presets
- [ ] Build base button components

### Phase 2: Core Components
- [ ] Floating label input
- [ ] Stat card with counter animation
- [ ] Navigation pill container
- [ ] Gradient border wrapper
- [ ] Pipeline progress indicator

### Phase 3: Document Editor
- [ ] Window chrome with traffic lights
- [ ] Line numbers column
- [ ] Syntax highlighting logic
- [ ] Streaming text with typewriter effect
- [ ] Gradient cursor with glow

### Phase 4: AI Chat
- [ ] Slide panel with backdrop
- [ ] Message bubble components
- [ ] Typing indicator animation
- [ ] Quick suggestion pills
- [ ] Input with send button

### Phase 5: Polish
- [ ] Page entrance animations
- [ ] Stagger delays for lists
- [ ] Hover glow effects
- [ ] Magnetic button interaction
- [ ] Shine sweep on primary buttons
- [ ] Empty states with animated icons

---

## File Structure

```
src/
├── styles/
│   ├── tokens.css              # CSS custom properties
│   ├── globals.css             # Base styles, fonts, resets
│   └── animations.css          # Keyframe animations
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── GradientBorder.tsx
│   │   ├── Grain.tsx
│   │   └── Badge.tsx
│   ├── stats/
│   │   └── StatCard.tsx
│   ├── pipeline/
│   │   └── Pipeline.tsx
│   ├── editor/
│   │   ├── DocumentEditor.tsx
│   │   ├── LineNumbers.tsx
│   │   └── StreamingCursor.tsx
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── MessageBubble.tsx
│   │   └── TypingIndicator.tsx
│   └── layout/
│       ├── Header.tsx
│       └── Navigation.tsx
├── hooks/
│   ├── useCounter.ts
│   ├── useTypewriter.ts
│   └── useMagnetic.ts
└── lib/
    ├── motion.ts               # Spring presets, variants
    └── syntax.ts               # Highlighting logic
```

---

## Changelog

### v2.1 (January 2026)
- **Background values increased** - Better visual separation from pure black
- **Border opacities doubled** - Cards/sections now visible
- **Added shadow system** - `--shadow-card` and `--shadow-elevated` for depth
- **Added `--bg-card`** - Explicit card background token
- **New Document Layout System** - Continuous scroll with sticky navigation
- **Reduced blue usage** - Blue now only for primary CTAs
- **SubSection line decorators** - Horizontal lines for visual hierarchy

### v1.0 (January 2026)
- Initial design system documentation

---

*Last updated: January 2026*
*Version: 2.1*
