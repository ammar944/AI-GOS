# Env-var manifest (cutover)

## New required vars (set before next deploy)

- `BRAVE_SEARCH_API_KEY` - lab-engine search tool. Without it, every section's search returns `credentialGap`.

## New conditional vars

- `DEEPSEEK_API_KEY` - required ONLY if `LAB_ENGINE_PROVIDER=deepseek-direct`. Default provider is Anthropic.
- `MANAGED_AGENTS_WEBHOOK_SECRET` - required ONLY if `MANAGED_AGENTS_POSITIONING_ENABLED=true`.

## New optional vars (have defaults)

- `LAB_ENGINE_PROVIDER` (default: anthropic)
- `LAB_ENGINE_LIVE_TOOLS` (default: enabled)
- `WORKER_STALE_RUN_THRESHOLD_MIN` (default: 15)
- `RESEARCH_DEEP_PROGRAM_MODEL` (default: sonar-pro)
- `RESEARCH_JOURNEY_SECTION_MODEL` / `_MAX_TOKENS` / `_TIMEOUT_MS`
- `ANTHROPIC_PLATFORM_SKILL_IDS` / `RESEARCH_DEEP_PROGRAM_SKILL_IDS`
- `APP_BOOTSTRAP_ADMIN_EMAILS` / `APP_BOOTSTRAP_INTERNAL_EMAILS`

## Removed vars (safe to delete from env)

- `AHREFS_API_KEY`, `SEMRUSH_API_KEY` - legacy data sources, no longer called.
- `RESEARCH_COMPETITORS_MODEL`, `RESEARCH_ICP_MODEL`, `RESEARCH_INDUSTRY_MODEL`, `RESEARCH_KEYWORDS_MODEL`, `RESEARCH_OFFER_MODEL`, `RESEARCH_SYNTHESIS_MODEL`, and all `_FALLBACK_MODEL` / `_REPAIR_MODEL` / `_RESCUE_MODEL` / `_HEURISTIC_MODEL` siblings - replaced by unified `LAB_ENGINE_PROVIDER` switch.
- `INJECT_INDUSTRY_TEMPLATES` - legacy feature flag.
