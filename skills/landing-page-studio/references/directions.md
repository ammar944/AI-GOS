# Direction Catalogue

Last updated: 2026-05-01

Directions define the visual and narrative approach for a landing page variant.
Each `full` pipeline run produces one HTML file per direction selected by the
direction planner (T4). The planner picks 3 from 5 disjoint families, ensuring
maximum visual distance between variants.

## How Directions Work

The direction planner reads your BrandSpec and selects 3 directions from different
families so each variant feels like it came from a different design studio. You then
pick one and optionally tweak it using `tweak-text` (copy edits) or `tweak-regen`
(section regeneration).

Direction slugs correspond to the `id` field in `references/directions.json`.

---

## Family 1: Editorial

Magazine-grade typography, dense paragraphs, refined whitespace, strong vertical rhythm.
Ink-on-paper gravitas. Favored by Stripe, media brands, and editorial-first SaaS.

### editorial-linear-stripe

**Name:** Editorial / Linear-Stripe
**Layout:** Text-forward single column, ruled dividers
**Mood:** Authoritative, refined, magazine-grade
**Best for:** B2B SaaS that wants to project intellectual seriousness; documentation-heavy products; financial tools
**Font style:** serif-forward or sans-led (never display)
**Exemplars:** Stripe, Basecamp, The Atlantic

The anchor variant for the Editorial family. Lead with a large typographic headline
(no decorative hero image), generous line-height, and a near-black/off-white palette.
Sections separate with ruled horizontal lines. Every image is an editorial insert —
captioned, bordered, purposeful.

---

### editorial-stripe-press

**Name:** Editorial / Stripe-Press
**Layout:** Book-chapter hierarchy, serif-led, numbered sections
**Mood:** Scholarly, depth-signaling, intellectual
**Best for:** Products that sell on depth of knowledge; research platforms; API documentation products
**Font style:** serif-forward (serif heading + sans body)
**Exemplars:** Stripe Press, Substack, Lenny's Newsletter

Book-publishing aesthetic applied to SaaS. Social proof appears as pull-quotes with
full attribution, not logo rows. Palette is near-monochromatic with a single accent ink color.

---

### editorial-apple-newsroom

**Name:** Editorial / Apple-Newsroom
**Layout:** Single-column narrative, large image per section
**Mood:** High-production, precise, premium
**Best for:** Consumer products with strong visual identity; product launch pages; hardware/software announcements
**Font style:** sans-led (geometric sans, large sizes)
**Exemplars:** Apple Newsroom, WWDC, Craft Docs

Precision typography at large display sizes, narrow measure body text (60-70ch),
generous vertical spacing between sections. Navigation is suppressed to a minimal sticky header.

---

## Family 2: Bento

Modular card grid with asymmetric tiles, soft borders, and mixed content types per cell.
The canonical modern SaaS layout — dashboard-like, feature-rich, scannable.

### bento-notion-vercel

**Name:** Bento / Notion-Vercel
**Layout:** 12-column CSS grid, cards of varying widths
**Mood:** Productive, feature-rich, dashboard-like
**Best for:** Productivity tools, project management, workspace SaaS, developer platforms
**Font style:** sans-led
**Exemplars:** Notion, Vercel, Linear, Raycast

The anchor variant for the Bento family. Each card has a single clear purpose (metric,
feature, quote, image). Light background, dark text, one accent color for interactive cells.
Asymmetry is the point — never make all cells the same size.

---

### bento-vercel-edge

**Name:** Bento / Vercel-Edge
**Layout:** Dark-mode bento with glowing accent borders
**Mood:** Developer-native, technical, high-performance
**Best for:** Developer tools, CLIs, infrastructure products, API platforms
**Font style:** mono-accent (monospace for technical cells, sans for narrative)
**Exemplars:** Vercel, Railway, Fly.io, Turbo

Near-black background with glow effects on card borders. Includes a code snippet cell
with syntax highlighting. One animated cell (e.g. terminal typing) — rest are static.

---

### bento-linear-cards

**Name:** Bento / Linear-Cards
**Layout:** Tight 8px grid, product UI screenshots as card content
**Mood:** Precise, systematic, product-forward
**Best for:** Issue trackers, project tools, B2B productivity SaaS, ops platforms
**Font style:** sans-led or mono-accent for UI labels
**Exemplars:** Linear, Height, Shortcut, Plane

8px grid throughout. Cells filled with actual UI crops or wireframe mockups. Neutral
palette with one electric accent. Cards borderless but differentiated by background shade.

---

## Family 3: Hero-art

Large hero illustration or abstract art occupies the viewport above the fold.
Generous vertical rhythm, soft gradients, and human warmth. Favored by AI and creative tools.

### hero-art-lovable-anthropic

**Name:** Hero-art / Lovable-Anthropic
**Layout:** Full-viewport hero visual, text-focused below the fold
**Mood:** Warm, friendly, creative, expansive
**Best for:** AI tools, creative products, no-code tools, consumer-facing SaaS
**Font style:** sans-led or serif-led (soft weights)
**Exemplars:** Lovable, Anthropic, Midjourney, Notion AI

60-80% of the viewport is the hero visual (illustration, gradient blob, or abstract art).
Pastel or soft gradient palette. Organic shapes for section dividers. Never use a dark
background or hard-edged grid in the hero zone.

---

### hero-art-anthropic-claude

**Name:** Hero-art / Anthropic-Claude
**Layout:** Centered hero, single abstract visual, everything centered
**Mood:** Premium, considered, calm authority
**Best for:** AI assistants, research tools, professional AI products
**Font style:** serif-led (heavy serif headline)
**Exemplars:** Anthropic, Claude.ai, Perplexity, Elicit

Warm off-white background. Centered headline at large scale over a single abstract art
piece. CTA row is one primary + one ghost button, centered. No logo clouds or testimonial
carousels above the fold.

---

### hero-art-vercel-ai

**Name:** Hero-art / Vercel-AI
**Layout:** Dark hero with ambient animated gradient mesh
**Mood:** Technical yet polished, developer-premium
**Best for:** AI infrastructure, model APIs, developer-facing AI products
**Font style:** sans-led (geometric sans, large white type)
**Exemplars:** Vercel AI SDK, Replicate, Together AI, Groq

Dark hero (#0d0d0d) with a subtle animated gradient mesh. Animation is ambient — opacity
under 0.4 for the gradient layer. A product demo GIF or still appears in the first
scroll-stop section below the dark hero.

---

## Family 4: Brutalist

Raw geometry, sans-serif weights, exposed structure. No ornament — function as form.
Thick borders, grid lines, and strict 2-3 color palettes.

### brutalist-arena

**Name:** Brutalist / Are.na
**Layout:** Exposed grid, thick borders, strict 2-3 color palette
**Mood:** Raw, intellectual, design-confident
**Best for:** Design tools, research platforms, creative studios, arts-adjacent SaaS
**Font style:** mono-accent or sans-led (geometric or monospace only)
**Exemplars:** Are.na, Pentagram, Koto Studio, Minimalissimo

The anchor variant for the Brutalist family. Borders are 3-6px solid. Border-radius is 0.
No gradients, no drop shadows. Images replaced by pure type or geometric illustration.

---

### brutalist-bold-sans

**Name:** Brutalist / Bold-Sans
**Layout:** Oversized display type as hero, asymmetric column splits
**Mood:** Aggressive, confident, brand-statement
**Best for:** Consumer brands, fashion-adjacent, high-attitude product launches
**Font style:** sans-led (uppercase, heavy weight, single typeface)
**Exemplars:** Wired, Nike campaigns, A24

Type IS the hero — 120-200px display at the top. Ultra-high contrast (pure black on white).
Section breaks are hard cuts — no transitions, no wave dividers. All headings uppercase.

---

### brutalist-mono-grid

**Name:** Brutalist / Mono-Grid
**Layout:** Monospace type, exposed column lines, tabular structure
**Mood:** Terminal, systematic, anti-decorative
**Best for:** Developer CLIs, open-source projects, hacker-culture products
**Font style:** mono-accent (monospace for ALL text)
**Exemplars:** Hacker News, charm.sh, Pika CLI

Monospace type throughout. Grid is exposed with thin 1px lines. Content structured as
tabular rows even when non-tabular. Everything left-aligned with strict indent steps.
No images, no icons as decoration.

---

## Family 5: Eastern-typographic

Vertical and horizontal type rhythm inspired by Japanese graphic design tradition.
Generous negative space, restrained palette. The absence of visual noise IS the design.

### eastern-kenya-hara

**Name:** Eastern-typographic / Kenya-Hara
**Layout:** Breathing space, alternating type rhythms, restrained palette
**Mood:** Zen, minimal, considered luxury
**Best for:** Wellness, meditation, premium consumer, design-sophisticate audience
**Font style:** sans-led (refined, not geometric — humanist weights)
**Exemplars:** Muji, Kenya Hara design office, Uniqlo (editorial), 21_21 Design Sight

The anchor variant. Near-white background (#f9f7f4). One accent color used sparingly
(max one element per section). Empty space is structural, not a gap to fill. No shadows,
no gradients, no decorative elements.

---

### eastern-muji-editorial

**Name:** Eastern-typographic / Muji-Editorial
**Layout:** Warm neutrals, narrow columns, large margins
**Mood:** Craft, handmade, material-quality
**Best for:** Artisan products, premium consumer goods, design-forward SaaS, wellness
**Font style:** serif-forward (gentle serif heading — Cormorant or Libre Baskerville)
**Exemplars:** Muji global, Aesop, Toast (clothing), Kinfolk

Warm neutral backgrounds (linen, cream: #f5f0e8 range). Serif headings. Photography of
physical materials or hands-on process. Hairline borders as the only structural decoration.
Max font weight 500.

---

### eastern-tokyo-type

**Name:** Eastern-typographic / Tokyo-Type
**Layout:** Extreme scale contrast, full-bleed / tight column alternation
**Mood:** High-energy, bold, East Asian typographic tradition
**Best for:** Fashion, streetwear, music, cultural products, entertainment SaaS
**Font style:** sans-led (condensed, East Asian proportions)
**Exemplars:** Beams Japan, Comme des Garçons web, Tokyo Midtown

Extreme type scale contrast: 120px+ display next to 12px body. High-contrast dark palette
with 1-2 neon accent colors. Red rule lines as typographic markers. Alternates between
full-bleed sections and tightly constrained text columns.

---

## Adding Custom Directions

Custom directions are not yet supported in v1. The direction picker selects from the
15 built-in directions defined in `references/directions.json`. To add a direction,
add an entry to that file following the existing schema (id, name, family, summary,
do[], dont[], exemplar_brands[]) and ensure it belongs to one of the 5 existing families
or a new disjoint family.
