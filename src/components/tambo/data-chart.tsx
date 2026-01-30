"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface DataChartProps {
  title: string;
  data: DataPoint[];
  type?: "bar" | "horizontal-bar";
}

export function DataChart({ title, data, type = "bar" }: DataChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));

  const defaultColors = [
    "oklch(0.62 0.19 255)", // primary
    "oklch(0.7 0.15 180)",  // teal
    "oklch(0.65 0.2 330)",  // pink
    "oklch(0.75 0.15 85)",  // yellow
    "oklch(0.6 0.2 145)",   // green
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {type === "horizontal-bar" ? (
          <div className="space-y-4">
            {data.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono font-medium">{item.value}</span>
                </div>
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: item.color || defaultColors[index % defaultColors.length],
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / maxValue) * 100}%` }}
                    transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {data.map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <motion.div
                  className="w-full rounded-t-md"
                  style={{
                    backgroundColor: item.color || defaultColors[index % defaultColors.length],
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${(item.value / maxValue) * 100}%` }}
                  transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
                />
                <span className="text-xs text-muted-foreground text-center truncate w-full">
                  {item.label}
                </span>
                <span className="text-xs font-mono font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
