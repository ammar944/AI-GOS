# Task: GTM-014 — Stop generated agent/runtime state from dirtying Git

## Senior engineering decision

After GTM-013, the cleanup report exists:

```text
/Users/ammar/Dev-Projects/AI-GOS-main/.ai-flow/cleanup-report.md
```

The report shows the dirty worktree is mixed: real product work, worker work, skill rewrites, generated agent state, and prototype artifacts.

The next step should **not** be broad cleanup or feature work. The next step is to stop the repo from getting dirtier every time agents/dev tooling run.

This is the lowest-risk cleanup slice:

> Add ignore policy for generated runtime state and untrack already tracked generated state, without deleting files or touching product source.

---

## Goal

Reduce future Git noise by making generated state invisible to Git:

- root `.omc/**`
- `research-worker/.omc/**`
- transient `.ai-flow` runtime logs/prompts
- generated output folders such as `output/**` and `skills/landing-page/output/**`

Preserve the cleanup report and current task handoff.

---

## Current evidence

Current `.gitignore` already ignores:

```gitignore
skills/**/node_modules/
skills/**/runs/
skills/**/.omc/
```

But it does **not** ignore root `.omc/`, `research-worker/.omc/`, `.ai-flow` runtime files, or generated output directories.

Current visible generated-state examples:

```text
.omc/project-memory.json
.omc/state/*.jsonl
.omc/sessions/*.json
.omc/state/checkpoints/*.json
research-worker/.omc/state/*.jsonl
research-worker/.omc/sessions/*.json
.ai-flow/*
output/example-dealflow-01/**
skills/landing-page/output/**
```

---

## Hard constraints

Do not delete files.

Do not run:

```bash
git clean -fd
git reset --hard
git restore .
git checkout -- .
rm -rf <anything>
```

Do not touch product source:

```text
src/**
research-worker/src/**
skills/** except generated output ignore paths
package.json
tsconfig.json
```

Do not stage broad paths.

---

## Scope

### In scope

Modify only:

```text
.gitignore
.ai-flow/current-task.md
.ai-flow/cleanup-report.md
```

Possible index-only action after review:

```bash
git rm --cached -r .omc research-worker/.omc
```

Important: `git rm --cached` removes tracked generated files from Git index only. It should not delete local files. Use `--cached` only.

### Out of scope

- No source cleanup.
- No landing-page prototype decision.
- No skill rewrites.
- No worker source commits.
- No deletion of output artifacts yet.
- No package script changes.

---

## Implementation steps

### Step 1 — Patch `.gitignore`

Add a clearly labeled section near the local runtime artifacts section:

```gitignore
# Agent/runtime local state
.omc/
research-worker/.omc/

# AIGOS local flow transient artifacts
.ai-flow/codex-prompt.md
.ai-flow/implementation-log.md
.ai-flow/verification.log

# Generated local outputs
/output/
skills/landing-page/output/
```

Do **not** ignore all of `.ai-flow/` because we want to preserve:

```text
.ai-flow/current-task.md
.ai-flow/cleanup-report.md
```

### Step 2 — Verify ignore behavior

Run:

```bash
git check-ignore -v \
  .omc/sessions/example.json \
  research-worker/.omc/sessions/example.json \
  .ai-flow/codex-prompt.md \
  .ai-flow/implementation-log.md \
  .ai-flow/verification.log \
  output/example-dealflow-01/brand-spec.json \
  skills/landing-page/output/codex-nexone-proof-of-concept.html
```

Expected: each path matches the new `.gitignore` rule.

Also verify these are **not** ignored:

```bash
git check-ignore -v .ai-flow/current-task.md .ai-flow/cleanup-report.md || true
```

Expected: no ignore output for those two report/task files.

### Step 3 — Identify tracked generated state

Run:

```bash
git ls-files .omc research-worker/.omc
```

If tracked files appear, untrack only those generated-state paths:

```bash
git rm --cached -r .omc research-worker/.omc
```

Do **not** delete local files. Use only `--cached`.

### Step 4 — Review exact diff/index

Run:

```bash
git diff -- .gitignore
git diff --cached --stat
git status --short -- .gitignore .omc research-worker/.omc .ai-flow output skills/landing-page/output
```

Expected:

- `.gitignore` modified.
- Tracked `.omc` / `research-worker/.omc` files staged as removed from index only if they were tracked.
- Untracked generated `.omc`, output, and ignored `.ai-flow` runtime files should stop appearing in status after ignore rules.
- `.ai-flow/current-task.md` and `.ai-flow/cleanup-report.md` remain visible unless committed.

### Step 5 — Commit only cleanup-control files/index removals

If the diff is correct:

```bash
git add .gitignore .ai-flow/current-task.md .ai-flow/cleanup-report.md
# If needed, git rm --cached already staged generated-state untracking.
git commit -m "chore: ignore generated agent runtime state"
```

Do not stage anything else.

---

## Acceptance criteria

- `.gitignore` ignores root `.omc/` and `research-worker/.omc/`.
- `.gitignore` ignores transient `.ai-flow` logs/prompts but not `.ai-flow/current-task.md` or `.ai-flow/cleanup-report.md`.
- `.gitignore` ignores generated output folders.
- Already tracked `.omc`/`research-worker/.omc` generated files are untracked from Git index if present.
- No local files are deleted.
- No product source files are edited.
- Commit contains only `.gitignore`, optional `.ai-flow` report/task docs, and optional index removals for generated state.

---

## Final handoff format

```markdown
## GTM-014 Result

Commit:
- [hash] chore: ignore generated agent runtime state

Changed:
- .gitignore rules added for [list]
- tracked generated state untracked from index: yes/no
- cleanup report preserved: yes/no

Verification:
- git check-ignore results: pass/fail
- git status focused check: [summary]

Non-actions confirmed:
- no local files deleted
- no product source edited
- no broad staging

Remaining cleanup buckets:
- AIGOS workflow tooling reproducibility
- worker GTM event/schema slice
- landing-page prototype decision
- skills split by folder
- src legacy/prototype triage
```

---

## Head-of-engineering summary

This is the first real cleanup action because it is reversible, low-risk, and prevents recurring noise. After this, the repo becomes calmer and we can safely make owner decisions on real code slices.
