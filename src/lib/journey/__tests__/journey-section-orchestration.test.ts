import { describe, expect, it } from 'vitest';
import {
  drainPendingSectionWakeUps,
  enqueuePendingSectionWakeUp,
  getAutoOpenSectionDecision,
  getWakeUpDispatchDecision,
  resetTrackedSection,
} from '../journey-section-orchestration';

describe('getAutoOpenSectionDecision', () => {
  it('opens a review section once across queued, realtime, and flush transitions', () => {
    const queued = getAutoOpenSectionDecision(new Set<string>(), 'industryMarket');
    const realtime = getAutoOpenSectionDecision(
      queued.nextAutoOpenedSections,
      'industryMarket',
    );
    const flushed = getAutoOpenSectionDecision(
      realtime.nextAutoOpenedSections,
      'industryMarket',
    );

    expect(queued.shouldOpen).toBe(true);
    expect(realtime.shouldOpen).toBe(false);
    expect(flushed.shouldOpen).toBe(false);
  });

  it('allows the same section to auto-open again after an explicit reset', () => {
    const initial = getAutoOpenSectionDecision(new Set<string>(), 'industryMarket');
    const reset = resetTrackedSection(initial.nextAutoOpenedSections, 'industryMarket');
    const reopened = getAutoOpenSectionDecision(reset, 'industryMarket');

    expect(reopened.shouldOpen).toBe(true);
  });
});

describe('pending section wake-ups', () => {
  it('dedupes repeated pending wake-up sections before flush', () => {
    const pendingOnce = enqueuePendingSectionWakeUp(new Set<string>(), 'keywordIntel');
    const pendingTwice = enqueuePendingSectionWakeUp(pendingOnce, 'keywordIntel');
    const drained = drainPendingSectionWakeUps(pendingTwice);

    expect(drained.queuedSections).toEqual(['keywordIntel']);
    expect(drained.nextPendingSections.size).toBe(0);
  });
});

describe('getWakeUpDispatchDecision', () => {
  it('dispatches a hidden wake-up once per section until the section is reset', () => {
    const first = getWakeUpDispatchDecision(new Set<string>(), 'keywordIntel');
    const duplicate = getWakeUpDispatchDecision(first.nextWokenSections, 'keywordIntel');
    const reset = resetTrackedSection(duplicate.nextWokenSections, 'keywordIntel');
    const rerun = getWakeUpDispatchDecision(reset, 'keywordIntel');

    expect(first.shouldWake).toBe(true);
    expect(duplicate.shouldWake).toBe(false);
    expect(rerun.shouldWake).toBe(true);
  });
});
