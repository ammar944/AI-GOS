"use client";

import { z } from "zod";
import type { TamboComponent } from "@tambo-ai/react";

// Import Tambo-specific components
import { TamboStatCard } from "@/components/tambo/stat-card";
import { ProgressCard } from "@/components/tambo/progress-card";
import { DataChart } from "@/components/tambo/data-chart";
import { InfoCard } from "@/components/tambo/info-card";
import { TaskList } from "@/components/tambo/task-list";

// Define Tambo components with Zod schemas
export const tamboComponents: TamboComponent[] = [
  {
    name: "StatCard",
    description: "Displays a statistic with a label, value, and optional trend indicator. Use for KPIs, metrics, and numerical data.",
    component: TamboStatCard,
    propsSchema: z.object({
      label: z.string().describe("The label for the statistic"),
      value: z.string().describe("The value to display"),
      trend: z.enum(["up", "down", "neutral"]).optional().describe("Optional trend direction"),
      trendValue: z.string().optional().describe("Optional trend percentage or value"),
    }),
  },
  {
    name: "ProgressCard",
    description: "Shows progress towards a goal with a progress bar. Use for completion status, loading states, or goal tracking.",
    component: ProgressCard,
    propsSchema: z.object({
      title: z.string().describe("Title of the progress item"),
      current: z.number().describe("Current progress value"),
      total: z.number().describe("Total/target value"),
      description: z.string().optional().describe("Optional description"),
    }),
  },
  {
    name: "DataChart",
    description: "Renders data as a visual chart. Use for visualizing trends, comparisons, and distributions.",
    component: DataChart,
    propsSchema: z.object({
      title: z.string().describe("Chart title"),
      data: z.array(
        z.object({
          label: z.string(),
          value: z.number(),
          color: z.string().optional(),
        })
      ).describe("Array of data points with label and value"),
      type: z.enum(["bar", "horizontal-bar"]).default("bar").describe("Chart type"),
    }),
  },
  {
    name: "InfoCard",
    description: "Displays informational content with a title, description, and optional icon. Use for explanations, tips, or feature highlights.",
    component: InfoCard,
    propsSchema: z.object({
      title: z.string().describe("Card title"),
      description: z.string().describe("Card description or content"),
      variant: z.enum(["default", "success", "warning", "error", "info"]).default("default").describe("Visual variant"),
    }),
  },
  {
    name: "TaskList",
    description: "Shows a list of tasks with checkboxes for completion tracking. Use for to-do lists, checklists, or action items.",
    component: TaskList,
    propsSchema: z.object({
      title: z.string().describe("List title"),
      tasks: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          completed: z.boolean().default(false),
        })
      ).describe("Array of tasks"),
    }),
  },
];
