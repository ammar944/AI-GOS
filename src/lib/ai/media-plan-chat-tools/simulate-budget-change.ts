// Simulate Budget Change Tool
// Read-only what-if budget analysis — does NOT modify the media plan
// Returns side-by-side comparison of current vs proposed CAC model numbers

import { z } from 'zod';
import { tool } from 'ai';
import type { MediaPlanOutput } from '@/lib/media-plan/types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import type { BudgetSimulationResult, SimulatedCACSnapshot } from './types';
import { computeCACModel } from '@/lib/media-plan/validation';
import { deriveOfferPrice, deriveRetentionMultiplier } from './validation-cascade';

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
      const offerPrice = deriveOfferPrice(onboardingData);
      const retentionMultiplier = deriveRetentionMultiplier(onboardingData);
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

      const proposedCACModel = computeCACModel({
        monthlyBudget: proposedMonthlyBudget,
        targetCPL: cacModel.targetCPL,
        leadToSqlRate: cacModel.leadToSqlRate,
        sqlToCustomerRate: cacModel.sqlToCustomerRate,
        offerPrice,
        retentionMultiplier,
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

      const result: BudgetSimulationResult = {
        current: currentSnapshot,
        proposed: proposedSnapshot,
        proposedMonthlyBudget,
        delta: {
          budgetChange: proposedMonthlyBudget - currentBudget,
          budgetChangePercent: Math.round(
            ((proposedMonthlyBudget - currentBudget) / currentBudget) * 100,
          ),
          leadsDelta:
            proposedCACModel.expectedMonthlyLeads - cacModel.expectedMonthlyLeads,
          customersDelta:
            proposedCACModel.expectedMonthlyCustomers -
            cacModel.expectedMonthlyCustomers,
          cacDelta: proposedCACModel.targetCAC - cacModel.targetCAC,
        },
      };

      return result;
    },
  });
}
