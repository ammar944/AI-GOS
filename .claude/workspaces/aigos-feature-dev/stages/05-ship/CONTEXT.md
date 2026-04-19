# Stage 05 — Ship

## Inputs

- Verified build from 04-verify.

## Process

1. Commit changes with a clear message. Reference the feature slug.
2. Open PR (or push to `main` if your flow is trunk-based). PR description includes:
   - 01-discover success criteria (as a checklist)
   - Screenshots / curl output from 04-verify
   - Any follow-ups flagged during build
3. Deploy (Vercel auto-deploys on merge; worker needs `cd research-worker && railway up`).
4. Monitor for 10 minutes after deploy — watch logs, error rates, user traffic.
5. Document: if anything non-obvious was learned, append to `.claude/rules/learned-patterns.md`.

## Checkpoints

- [ ] Commit message references feature slug.
- [ ] PR description has success-criteria checklist.
- [ ] Deploy completed without errors.
- [ ] 10-minute monitor window clean.
- [ ] Learned patterns captured.

## Audit

Record:
- Deploy timestamp
- PR URL
- Any post-deploy issues (and whether they became new features)

## Outputs

- Deployed code.
- Updated `learned-patterns.md` if applicable.
- Feature closed in notes file.

## Forbidden

- Shipping without the 04-verify gate passing.
- Deploying and walking away — watch for at least 10 minutes.
- Letting a new pattern die without capturing it.
