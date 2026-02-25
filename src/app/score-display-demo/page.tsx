"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ScoreDisplay,
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
                Score Display Component
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
                  Use the sliders to explore the component.
                </div>
                <Button variant="outline" size="sm" onClick={handleReplay}>
                  Replay Animations
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <Separator className="my-10" />

        {/* Live Preview */}
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
            Live Preview
          </h2>

          <div className="p-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex justify-center">
            <ScoreDisplay
              key={`preview-${key}`}
              score={score}
              max={max}
              label="Score"
              size={size}
              animated={animated}
            />
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
            Size Comparison
          </h2>

          <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
            <div className="flex flex-wrap items-end justify-center gap-12">
              <ScoreDisplay key={`sm-${key}`} score={score} max={max} label="Small" size="sm" animated={animated} />
              <ScoreDisplay key={`md-${key}`} score={score} max={max} label="Medium" size="md" animated={animated} />
              <ScoreDisplay key={`lg-${key}`} score={score} max={max} label="Large" size="lg" animated={animated} />
              <ScoreDisplay key={`xl-${key}`} score={score} max={max} label="Extra Large" size="xl" animated={animated} />
            </div>
          </div>
        </motion.section>

        {/* Use Case: Offer Analysis */}
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
            <div className="flex flex-col items-center gap-8">
              <ScoreDisplay
                key={`overall-${key}`}
                score={7.4}
                max={10}
                label="Overall Score"
                size="xl"
                animated={animated}
              />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {sampleScores.map((item, i) => (
                  <ScoreDisplay
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
          </div>
        </motion.section>

        {/* Code Example */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2
            className="text-2xl font-bold mb-8"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-heading)" }}
          >
            Usage
          </h2>

          <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
            <pre className="text-sm text-[var(--text-secondary)] overflow-x-auto">
              <code>{`import { ScoreDisplay } from '@/components/ui/score-display';

<ScoreDisplay
  score={7.4}
  max={10}
  label="Overall Score"
  size="lg"
  animated={true}
/>`}</code>
            </pre>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <div className="mt-16 py-8 border-t border-[var(--border-default)]">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            Score visualization component for AI-GOS. Built with Framer Motion and SVG.
          </p>
        </div>
      </div>
    </div>
  );
}
