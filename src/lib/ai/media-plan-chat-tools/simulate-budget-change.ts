// Simulate Budget Change Tool
// Read-only what-if budget analysis — does NOT modify the media plan
// Returns side-by-side comparison of current vs proposed CAC model numbers

import { z } from 'zod';
import { tool } from 'ai';
import type { MediaPlanOutput } from '@/lib/media-plan/types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import type { BudgetSimulationResult, SimulatedCACSnapshot } from './types';
import { computeCACModel } from '@/lib/media-plan/validation';

export function createSimulateBudgetChangeTool(
  mediaPlan: MediaPlanOutput,
  onboardingData: OnboardingFormData,
) {
  return tool({
    description:
      'Simulate what would happen if the monthly budget changed. Returns a side-by-side comparison ' +
      'of current vs proposed CAC model numbers (leads, SQLs, customers, CAC, LTV:CAC ratio). ' +
      'This is read-only — it does NOT modify the media plan. Use this when the user asks ' +
      '"what if I increased/decreased budget to $X?" or "how would $X/month change my numbers?"',
    inputSchema: z.object({
      proposedMonthlyBudget: z
        .number()
        .positive()
        .describe('The proposed new monthly budget in dollars'),
    }),
    execute: async ({ proposedMonthlyBudget }) => {
      const cacModel = mediaPlan.performanceModel.cacModel;
      const currentBudget = mediaPlan.budgetAllocation.totalMonthlyBudget;

      const currentSnapshot: SimulatedCACSnapshot = {
        monthlyBudget: currentBudget,
        expectedMonthlyLeads: cacModel.expectedMonthlyLeads,
        expectedMonthlySQLs: cacModel.expectedMonthlySQLs,
        expectedMonthlyCustomers: cacModel.expectedMonthlyCustomers,
        targetCAC: cacModel.targetCAC,
        estimatedLTV: cacModel.estimatedLTV,
        ltvToCacRatio: cacModel.ltvToCacRatio,
      };

      // Reverse the sqrt distribution used inside computeCACModel to recover
      // the single leadToCustomerRate from the two-stage split on the existing
      // plan. Preserves the original plan's anchors (currentCac, avgCustomerLtv)
      // so this read-only simulation never fabricates new LTV/CAC values.
      const leadToCustomerRate =
        cacModel.leadToSqlRate !== null && cacModel.sqlToCustomerRate !== null
          ? (cacModel.leadToSqlRate / 100) * (cacModel.sqlToCustomerRate / 100) * 100
          : null;

      // Onboarding data is intentionally unused here — the plan's own cacModel
      // is the source of truth for CAC/LTV anchors, because baseline metrics
      // were already resolved at generation time.
      void onboardingData;

      const { cacModel: proposedCACModel } = computeCACModel({
        monthlyBudget: proposedMonthlyBudget,
        targetCPL: cacModel.targetCPL,
        leadToCustomerRate,
        currentCac: cacModel.targetCAC,
        avgCustomerLtv: cacModel.estimatedLTV,
      });

      const proposedSnapshot: SimulatedCACSnapshot = {
        monthlyBudget: proposedMonthlyBudget,
        expectedMonthlyLeads: proposedCACModel.expectedMonthlyLeads,
        expectedMonthlySQLs: proposedCACModel.expectedMonthlySQLs,
        expectedMonthlyCustomers: proposedCACModel.expectedMonthlyCustomers,
        targetCAC: proposedCACModel.targetCAC,
        estimatedLTV: proposedCACModel.estimatedLTV,
        ltvToCacRatio: proposedCACModel.ltvToCacRatio,
      };

      const safeDelta = (a: number | null, b: number | null): number | null =>
        a !== null && b !== null ? a - b : null;

      const result: BudgetSimulationResult = {
        current: currentSnapshot,
        proposed: proposedSnapshot,
        proposedMonthlyBudget,
        delta: {
          budgetChange: proposedMonthlyBudget - currentBudget,
          budgetChangePercent: Math.round(
            ((proposedMonthlyBudget - currentBudget) / currentBudget) * 100,
          ),
          leadsDelta: safeDelta(
            proposedCACModel.expectedMonthlyLeads,
            cacModel.expectedMonthlyLeads,
          ),
          customersDelta: safeDelta(
            proposedCACModel.expectedMonthlyCustomers,
            cacModel.expectedMonthlyCustomers,
          ),
          cacDelta: safeDelta(proposedCACModel.targetCAC, cacModel.targetCAC),
        },
      };

      return result;
    },
  });
}
