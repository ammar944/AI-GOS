# stages/05-quality-gate — Layer 2 (Stage Contract)

Stage C of the script pipeline. Deterministic. Zero AI tokens. Mechanical post-AI gate.

(Numbered 05 to preserve historical stage numbering; gap encodes that intermediate stages were collapsed.)

## Inputs

`QualityGateInput`:
- `script: Record<string, unknown>` — a single raw script from Stage B
- `platform: string` — `meta`, `google`, or `linkedin`
- `format: string` — `video`, `static`, or `email`

Reference data is loaded at runtime from `refs/`:
- `loadKillList()` — banned words/phrases per the brand voice rules
- `getCharLimit(platform, format, field)` — max-char constraints per platform/format

## Process

`runQualityGate(input)` runs a series of code-based checks:

1. **Char limits** — headline/body/cta against platform-format limits. Auto-fix by truncation when safe; fail when destructive.
2. **Kill-list** — flag any banned phrase. Severity depends on context (some auto-fix via substitution, others hard-fail).
3. **Dash hygiene** — em/en dashes stripped (delegated to `utils/post-process.sanitizeScript`).
4. **Required fields** — body, cta, headline must be non-empty.
5. **Confidence score normalization** — 0-100 scale clamped to 0-10.

Each check produces zero or more `Violation` records with severity `auto-fixed | warning | fail`. The script is mutated in place when an auto-fix applies.

## Checkpoints

- [ ] `passed` flag is `true` only when no `fail`-severity violations remain.
- [ ] Auto-fix counts in the report match what was actually mutated on the script.
- [ ] Kill-list checks are case-insensitive.
- [ ] Confidence score post-normalization is in `[0, 10]`.

## Outputs

`QualityReport`:
- `passed: boolean`
- `totalViolations`, `autoFixed`, `warnings`, `failures: number`
- `violations: Violation[]` (each with `check`, `severity`, `detail`, `field`, optional `original`/`fixed`)

The pipeline merges this report into the assembled script's `qualityGateViolations` and `qualityGateAutoFixes` fields.

## Forbidden

- Calling AI from this stage. Quality gate is mechanical by design.
- Skipping the kill-list check on the assumption "the AI already self-audited" — Stage B's self-audit is not authoritative.
- Failing silently — every violation MUST be recorded in the report.
