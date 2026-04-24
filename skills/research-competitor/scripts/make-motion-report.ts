/**
 * Adds a progressive motion layer to an already-rendered competitor report.
 *
 * The input report remains the canonical static artifact. This script only
 * injects CSS and a small IntersectionObserver reveal script into a copy.
 *
 * Usage:
 *   npx tsx scripts/make-motion-report.ts <report.html> <report-motion.html>
 */
import * as fs from "fs";

const MOTION_CSS = `

/* -- motion layer ------------------------------------------------------- */
@media (prefers-reduced-motion: no-preference) {
  html.motion-ready body {
    overflow-x: hidden;
  }

  html.motion-ready .masthead-rule {
    animation: motion-scale-x 900ms cubic-bezier(.16, 1, .3, 1) both;
    transform-origin: left center;
  }

  html.motion-ready .masthead-rule::after {
    animation: motion-scale-x 900ms 180ms cubic-bezier(.16, 1, .3, 1) both;
    transform-origin: right center;
  }

  html.motion-ready .masthead-meta,
  html.motion-ready .title,
  html.motion-ready .subtitle,
  html.motion-ready .exec-summary,
  html.motion-ready .toc {
    animation: motion-rise 760ms cubic-bezier(.16, 1, .3, 1) both;
  }

  html.motion-ready .masthead-meta { animation-delay: 120ms; }
  html.motion-ready .title { animation-delay: 220ms; }
  html.motion-ready .subtitle { animation-delay: 320ms; }
  html.motion-ready .exec-summary { animation-delay: 430ms; }
  html.motion-ready .toc { animation-delay: 540ms; }

  html.motion-ready .stat {
    animation: motion-rise 620ms cubic-bezier(.16, 1, .3, 1) both;
    animation-delay: calc(560ms + (var(--motion-index, 0) * 80ms));
  }

  html.motion-ready .section {
    animation: motion-rise 680ms cubic-bezier(.16, 1, .3, 1) both;
    animation-delay: calc(120ms + (var(--motion-index, 0) * 48ms));
  }

  html.motion-ready .matrix tbody tr,
  html.motion-ready .pos-card,
  html.motion-ready .price-card,
  html.motion-ready .poster,
  html.motion-ready .review,
  html.motion-ready .arc,
  html.motion-ready .sov-grid > div,
  html.motion-ready .evidence-block {
    animation: motion-rise 560ms cubic-bezier(.16, 1, .3, 1) both;
    animation-delay: calc(220ms + (var(--motion-index, 0) * 26ms));
  }

  html.motion-ready .bar-seg {
    transform: scaleX(0);
    transform-origin: left center;
    animation: motion-bar 900ms cubic-bezier(.16, 1, .3, 1) both;
    animation-delay: calc(260ms + (var(--motion-index, 0) * 32ms));
  }

  html.motion-ready .poster:hover,
  html.motion-ready .price-card:hover,
  html.motion-ready .review:hover,
  html.motion-ready .pos-card:hover {
    transform: translate3d(0, -3px, 0);
    box-shadow: 0 16px 42px rgba(26, 26, 26, .08);
    transition:
      box-shadow 220ms ease,
      transform 220ms ease;
  }
}

@keyframes motion-rise {
  from {
    opacity: 0;
    transform: translate3d(0, 18px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes motion-scale-x {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

@keyframes motion-bar {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
`;

const MOTION_SCRIPT = `
<script>
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  const indexedSelectors = [
    ".section",
    ".stat",
    ".matrix tbody tr",
    ".pos-card",
    ".price-card",
    ".poster",
    ".review",
    ".arc",
    ".sov-grid > div",
    ".evidence-block",
    ".bar-seg"
  ];

  for (const selector of indexedSelectors) {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.style.setProperty("--motion-index", String(index));
    });
  }

  requestAnimationFrame(() => root.classList.add("motion-ready"));
})();
</script>
`;

export function buildMotionReport(html: string): string {
  if (!html.includes("</style>")) {
    throw new Error("Cannot build motion report: missing </style> tag");
  }
  if (!html.includes("</body>")) {
    throw new Error("Cannot build motion report: missing </body> tag");
  }

  const withMotionCss = html.replace("</style>", `${MOTION_CSS}\n</style>`);
  return withMotionCss.replace("</body>", `${MOTION_SCRIPT}\n</body>`);
}

export function writeMotionReport(inputPath: string, outputPath: string): void {
  const html = fs.readFileSync(inputPath, "utf-8");
  const motionHtml = buildMotionReport(html);
  fs.writeFileSync(outputPath, motionHtml);
  process.stdout.write(`[motion-report] wrote ${outputPath}\n`);
}

function main(): void {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    process.stderr.write(
      "Usage: make-motion-report.ts <report.html> <report-motion.html>\n",
    );
    process.exit(2);
  }

  writeMotionReport(inputPath, outputPath);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("make-motion-report.ts") || entry.endsWith("make-motion-report.js")) {
  main();
}
