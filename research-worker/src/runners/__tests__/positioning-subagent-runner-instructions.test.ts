import { describe, expect, it } from 'vitest';

import { POSITIONING_SECTION_IDS } from '../positioning';
import { buildTypedArtifactClosingInstruction } from '../positioning-subagent-runner';

describe('positioning subagent closing instructions', () => {
  it('tells every Section to read the Section Context Pack first and respect the lookup budget', () => {
    for (const sectionId of POSITIONING_SECTION_IDS) {
      const instruction = buildTypedArtifactClosingInstruction(sectionId);

      expect(instruction).toContain('Read the Section Context Pack first');
      expect(instruction).toContain('maxExternalLookups: 2');
      expect(instruction).not.toContain('Run your evidence tools');
    }
  });
});
