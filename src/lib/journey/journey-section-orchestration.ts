export interface AutoOpenSectionDecision {
  nextAutoOpenedSections: Set<string>;
  shouldOpen: boolean;
}

export interface WakeUpDispatchDecision {
  nextWokenSections: Set<string>;
  shouldWake: boolean;
}

export interface PendingSectionWakeUpsDrainResult {
  nextPendingSections: Set<string>;
  queuedSections: string[];
}

export function getAutoOpenSectionDecision(
  autoOpenedSections: ReadonlySet<string>,
  section: string,
): AutoOpenSectionDecision {
  const nextAutoOpenedSections = new Set(autoOpenedSections);
  if (nextAutoOpenedSections.has(section)) {
    return {
      nextAutoOpenedSections,
      shouldOpen: false,
    };
  }

  nextAutoOpenedSections.add(section);
  return {
    nextAutoOpenedSections,
    shouldOpen: true,
  };
}

export function getWakeUpDispatchDecision(
  wokenSections: ReadonlySet<string>,
  section: string,
): WakeUpDispatchDecision {
  const nextWokenSections = new Set(wokenSections);
  if (nextWokenSections.has(section)) {
    return {
      nextWokenSections,
      shouldWake: false,
    };
  }

  nextWokenSections.add(section);
  return {
    nextWokenSections,
    shouldWake: true,
  };
}

export function enqueuePendingSectionWakeUp(
  pendingSections: ReadonlySet<string>,
  section: string,
): Set<string> {
  const nextPendingSections = new Set(pendingSections);
  nextPendingSections.add(section);
  return nextPendingSections;
}

export function drainPendingSectionWakeUps(
  pendingSections: ReadonlySet<string>,
): PendingSectionWakeUpsDrainResult {
  return {
    nextPendingSections: new Set<string>(),
    queuedSections: [...pendingSections],
  };
}

export function resetTrackedSection(
  trackedSections: ReadonlySet<string>,
  section: string,
): Set<string> {
  const nextTrackedSections = new Set(trackedSections);
  nextTrackedSections.delete(section);
  return nextTrackedSections;
}
