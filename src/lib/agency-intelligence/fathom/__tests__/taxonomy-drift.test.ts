import { describe, it, expect } from 'vitest';
import { FathomSignalType, FathomSignalSeverity } from '../../contracts';
// The uploader is a .mjs script; it exports its mirrored taxonomy precisely so
// this guard can pin it. allowJs is on and scripts/ is excluded as a tsc root,
// so this import resolves for inference without type-checking the script body.
import {
  VALID_SIGNAL_TYPES,
  VALID_SEVERITIES,
} from '../../../../../scripts/zz-upload-fathom-signals.mjs';

// Drift guard: the uploader (.mjs) mirrors the canonical Fathom taxonomy because
// it cannot import the TS Zod enums at runtime. The Zod enums in turn mirror the
// DB CHECK constraints in 20260619_account_health_cockpit_fathom.sql. If anyone
// edits one without the others, this fails — that exact drift made the uploader
// reject EVERY insert against the live schema (and wipe rows before failing).
describe('Fathom taxonomy drift guard (uploader .mjs ↔ contracts.ts ↔ migration)', () => {
  it('uploader VALID_SIGNAL_TYPES == FathomSignalType', () => {
    expect([...VALID_SIGNAL_TYPES].sort()).toEqual([...FathomSignalType.options].sort());
  });

  it('uploader VALID_SEVERITIES == FathomSignalSeverity', () => {
    expect([...VALID_SEVERITIES].sort()).toEqual([...FathomSignalSeverity.options].sort());
  });
});
