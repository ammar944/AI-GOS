"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Info, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoCardProps {
  title: string;
  description: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
  icon?: string;
}

const variantStyles = {
  default: {
    border: "border-border",
    icon: Sparkles,
    iconColor: "text-primary",
  },
  success: {
    border: "border-green-500/30",
    icon: CheckCircle,
    iconColor: "text-green-500",
  },
  warning: {
    border: "border-yellow-500/30",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
  },
  error: {
    border: "border-red-500/30",
    icon: AlertCircle,
    iconColor: "text-red-500",
  },
  info: {
    border: "border-blue-500/30",
    icon: Info,
    iconColor: "text-blue-500",
  },
};

export function InfoCard({ title, description, variant = "default" }: InfoCardProps) {
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <Card className={cn("w-full", styles.border)}>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <Icon className={cn("h-5 w-5", styles.iconColor)} />
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
