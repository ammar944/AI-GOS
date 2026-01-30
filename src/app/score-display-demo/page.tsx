"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ScoreDisplay,
  SegmentedRing,
  GlowArc,
  GradientBar,
  Thermometer,
  LiquidFill,
  type ScoreVariant,
  type ScoreSize,
} from "@/components/ui/score-display";
import Link from "next/link";
import { ArrowLeft, Play, Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ScoreDisplayDemo() {
  const [score, setScore] = useState(7.4);
  const [max, setMax] = useState(10);
  const [size, setSize] = useState<ScoreSize>("lg");
  const [animated, setAnimated] = useState(true);
  const [key, setKey] = useState(0);

  const handleReplay = () => {
    setKey((prev) => prev + 1);
  };

  const variants: { name: string; variant: ScoreVariant; description: string }[] = [
    {
      name: "Segmented Ring",
      variant: "segmented-ring",
      description: "Segmented progress with clean fills. Balanced for overview scores.",
    },
    {
      name: "Glow Arc",
      variant: "glow-arc",
      description: "270-degree arc with a subtle gradient. Modern but understated.",
    },
    {
      name: "Gradient Bar",
      variant: "gradient-bar",
      description: "Horizontal bar with soft gradient. Great for comparisons.",
    },
    {
      name: "Thermometer",
      variant: "thermometer",
      description: "Vertical segmented fill. Compact for tight layouts.",
    },
    {
      name: "Liquid Fill",
      variant: "liquid-fill",
      description: "Liquid fill with a gentle wave. Adds motion without noise.",
    },
  ];

  const sampleScores = [
    { label: "Pain Relevance", score: 8.2 },
    { label: "Urgency", score: 7.0 },
    { label: "Differentiation", score: 6.5 },
    { label: "Tangibility", score: 8.5 },
    { label: "Proof", score: 7.3 },
    { label: "Pricing", score: 8.0 },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-default)] bg-[var(--bg-base)]/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/blueprint-preview" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              </Button>
              <div className="h-6 w-px bg-[var(--border-default)]" />
              <h1
                className="text-lg font-semibold"
                style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
              >
                Score Display Components
              </h1>
            </div>
            <Badge variant="outline" className="border-[var(--border-default)] text-[var(--text-secondary)]">
              Interactive Demo
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Controls */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-16">
          <Card className="bg-[var(--bg-surface)] border border-[var(--border-default)]">
            <CardHeader className="pb-4">
              <CardTitle
                className="text-xl font-bold"
                style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
              >
                Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Score Control */}
                <div>
                  <Label className="text-sm text-[var(--text-secondary)]">
                    Score: {score.toFixed(1)}
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max={max}
                    step="0.1"
                    value={score}
                    onChange={(e) => setScore(parseFloat(e.target.value))}
                    className="mt-3 w-full accent-[var(--accent-blue)]"
                  />
                </div>

                {/* Max Control */}
                <div>
                  <Label className="text-sm text-[var(--text-secondary)]">Max: {max}</Label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={max}
                    onChange={(e) => setMax(parseInt(e.target.value))}
                    className="mt-3 w-full accent-[var(--accent-blue)]"
                  />
                </div>

                {/* Size Control */}
                <div>
                  <Label className="text-sm text-[var(--text-secondary)]">Size</Label>
                  <Tabs
                    value={size}
                    onValueChange={(value) => setSize(value as ScoreSize)}
                    className="mt-3"
                  >
                    <TabsList variant="line" className="border-b border-[var(--border-default)]">
                      <TabsTrigger value="sm">Small</TabsTrigger>
                      <TabsTrigger value="md">Medium</TabsTrigger>
                      <TabsTrigger value="lg">Large</TabsTrigger>
                      <TabsTrigger value="xl">XL</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Animation Toggle */}
                <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border-default)] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    {animated ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    Animation
                  </div>
                  <Switch checked={animated} onCheckedChange={setAnimated} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--text-tertiary)]">
                  Use the sliders to explore variants.
                </div>
                <Button variant="outline" size="sm" onClick={handleReplay}>
                  Replay Animations
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <Separator className="my-10" />

        {/* All Variants Grid */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-16"
        >
          <h2
            className="text-2xl font-bold mb-8"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
          >
            All Variants
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {variants.map((item) => (
              <Card
                key={`${item.variant}-${key}`}
                className="bg-[var(--bg-surface)] border border-[var(--border-default)]"
              >
                <CardContent className="pt-8">
                  <div className="flex justify-center mb-6">
                  <ScoreDisplay
                    score={score}
                    max={max}
                    variant={item.variant}
                    size={size}
                    animated={animated}
                  />
                  </div>
                  <h3
                    className="text-lg font-semibold mb-2 text-center"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
                  >
                    {item.name}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] text-center leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* Size Comparison */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <h2
            className="text-2xl font-bold mb-8"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
          >
            Size Comparison (Segmented Ring)
          </h2>

          <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
            <div className="flex flex-wrap items-end justify-center gap-12">
              <SegmentedRing
                key={`sm-${key}`}
                score={score}
                max={max}
                label="Small"
                size="sm"
                animated={animated}
              />
              <SegmentedRing
                key={`md-${key}`}
                score={score}
                max={max}
                label="Medium"
                size="md"
                animated={animated}
              />
              <SegmentedRing
                key={`lg-${key}`}
                score={score}
                max={max}
                label="Large"
                size="lg"
                animated={animated}
              />
              <SegmentedRing
                key={`xl-${key}`}
                score={score}
                max={max}
                label="Extra Large"
                size="xl"
                animated={animated}
              />
            </div>
          </div>
        </motion.section>

        {/* Multi-Score Display with Gradient Bars */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-16"
        >
          <h2
            className="text-2xl font-bold mb-8"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
          >
            Use Case: Offer Analysis Scores
          </h2>

          <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Hero Score */}
              <div className="md:col-span-2 flex flex-col items-center p-6 rounded-xl bg-[var(--bg-elevated)]">
                <GlowArc
                  key={`hero-${key}`}
                  score={7.4}
                  max={10}
                  label="Overall Score"
                  size="xl"
                  animated={animated}
                />
              </div>

              {/* Sub-scores as gradient bars */}
              <div className="space-y-4">
                {sampleScores.slice(0, 3).map((item, i) => (
                  <GradientBar
                    key={`bar-1-${i}-${key}`}
                    score={item.score}
                    max={10}
                    label={item.label}
                    size="md"
                    animated={animated}
                  />
                ))}
              </div>
              <div className="space-y-4">
                {sampleScores.slice(3).map((item, i) => (
                  <GradientBar
                    key={`bar-2-${i}-${key}`}
                    score={item.score}
                    max={10}
                    label={item.label}
                    size="md"
                    animated={animated}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Alternative Layout: All Segmented Rings */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-16"
        >
          <h2
            className="text-2xl font-bold mb-8"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
          >
            Alternative Layout: All Segmented Rings
          </h2>

          <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
            <div className="flex flex-col md:flex-row items-center justify-center gap-12 mb-8">
              <SegmentedRing
                key={`overall-${key}`}
                score={7.4}
                max={10}
                label="Overall Score"
                size="xl"
                animated={animated}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {sampleScores.map((item, i) => (
                <SegmentedRing
                  key={`seg-${i}-${key}`}
                  score={item.score}
                  max={10}
                  label={item.label}
                  size="md"
                  animated={animated}
                />
              ))}
            </div>
          </div>
        </motion.section>

        {/* Code Examples */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2
            className="text-2xl font-bold mb-8"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
          >
            Usage Examples
          </h2>

          <div className="space-y-4">
            <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
              <h3
                className="text-base font-semibold mb-3"
                style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
              >
                Basic Usage
              </h3>
              <pre className="text-sm text-[var(--text-secondary)] overflow-x-auto">
                <code>{`<ScoreDisplay
  score={7.4}
  max={10}
  label="Overall Score"
  variant="segmented-ring"
  size="lg"
  animated={true}
/>`}</code>
              </pre>
            </div>

            <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
              <h3
                className="text-base font-semibold mb-3"
                style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
              >
                Direct Component Import
              </h3>
              <pre className="text-sm text-[var(--text-secondary)] overflow-x-auto">
                <code>{`import { GlowArc } from '@/components/ui/score-display';

<GlowArc
  score={8.5}
  max={10}
  label="Pain Relevance"
  size="md"
/>`}</code>
              </pre>
            </div>

            <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
              <h3
                className="text-base font-semibold mb-3"
                style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
              >
                Gradient Bar for Lists
              </h3>
              <pre className="text-sm text-[var(--text-secondary)] overflow-x-auto">
                <code>{`<GradientBar
  score={6.5}
  max={10}
  label="Differentiation"
  size="md"
  animated={true}
/>`}</code>
              </pre>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <div className="mt-16 py-8 border-t border-[var(--border-default)]">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            Premium score visualization components for AI-GOS. Built with Framer Motion and SVG.
          </p>
        </div>
      </div>
    </div>
  );
}
