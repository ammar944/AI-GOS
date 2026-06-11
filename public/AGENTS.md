# AGENTS.md - public

## Purpose

- Owns browser-served static assets such as icons, manifest files, images, and static SVGs.

## Ownership

- Static files here are served as-is by Next.js.

## Local Contracts

- Preserve filenames referenced by HTML metadata, manifests, components, or CSS.
- Inspect actual assets before replacing them.
- Do not place secrets, private docs, or generated proof artifacts here.
- `sl-analytics.v1.js` is the public SaaSLaunch landing tracker. It must not collect form values, raw personal identifiers, secrets, or non-UTM query parameters; server-side validation remains authoritative.

## Work Guidance

- Prefer optimized assets with stable dimensions.
- Update references and browser verification when replacing user-visible assets.

## Verification

- Run browser verification for user-visible asset changes.
- Run `git diff --check` for metadata/text changes.

## Child DOX Index

- No child `AGENTS.md` files yet.
