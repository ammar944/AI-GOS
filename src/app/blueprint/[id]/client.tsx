"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Download,
  Share2,
  Wand2,
  ArrowLeft,
  Loader2,
  Check,
  Link2,
  FileText,
  Calendar,
} from "lucide-react";
import { PolishedBlueprintView } from "@/components/strategic-blueprint/polished-blueprint-view";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { GradientBorder } from "@/components/ui/gradient-border";
import { ShaderMeshBackground, BackgroundPattern } from "@/components/ui/sl-background";
import { easings, durations } from "@/lib/motion";
import { createRoot } from "react-dom/client";
import PdfMarkdownContent from "@/components/strategic-blueprint/pdf-markdown-content";
import type { BlueprintRecord } from "@/lib/actions/blueprints";

interface Props {
  blueprint: BlueprintRecord;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

export function BlueprintViewClient({ blueprint }: Props) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const strategicBlueprint = blueprint.output;

  // Export PDF handler
  const handleExportPDF = async () => {
    if (!strategicBlueprint) return;

    setIsExporting(true);

    try {
      const [html2canvasModule, jspdfModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jspdfModule;

      const date = new Date().toISOString().split("T")[0];
      const filename = `${blueprint.title.replace(/[^a-zA-Z0-9]/g, "-")}-${date}.pdf`;

      // Create a temporary container for the PDF content
      const container = document.createElement("div");
      container.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 850px;
        background: #ffffff;
      `;
      document.body.appendChild(container);

      // Render the PdfMarkdownContent component into the container
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(<PdfMarkdownContent strategicBlueprint={strategicBlueprint} />);
        setTimeout(resolve, 300);
      });

      const content = container.firstElementChild as HTMLElement;
      if (!content) {
        throw new Error("Failed to render PDF content");
      }

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      root.unmount();
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      let pageNumber = 0;

      while (heightLeft > 0) {
        if (pageNumber > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position -= pageHeight;
        pageNumber++;
      }

      pdf.save(filename);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert(`PDF export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Share blueprint
  const handleShare = async () => {
    if (!strategicBlueprint) return;

    setIsSharing(true);
    setShareError(null);

    try {
      const response = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint: strategicBlueprint }),
      });

      const result = await response.json();

      if (result.success) {
        setShareUrl(result.shareUrl);
      } else {
        setShareError(result.error?.message || "Failed to create share link");
      }
    } catch {
      setShareError("Failed to create share link");
    } finally {
      setIsSharing(false);
    }
  };

  // Copy share link to clipboard
  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  // Create new blueprint
  const handleNewBlueprint = () => {
    router.push("/generate");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Back to Dashboard */}
            <MagneticButton
              className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
              onClick={() => router.push("/dashboard")}
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                background: "transparent",
                fontFamily: "var(--font-sans), Inter, sans-serif",
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </MagneticButton>

            {/* Title */}
            <div className="hidden md:flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              <h1
                className="text-lg font-semibold truncate max-w-[300px]"
                style={{
                  color: "var(--text-heading)",
                  fontFamily: "var(--font-heading), 'Instrument Sans', sans-serif",
                }}
              >
                {blueprint.title}
              </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <MagneticButton
                className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                onClick={handleExportPDF}
                disabled={isExporting}
                style={{
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                  background: "transparent",
                  fontFamily: "var(--font-sans), Inter, sans-serif",
                }}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export"}</span>
              </MagneticButton>

              <MagneticButton
                className="h-9 px-4 rounded-md text-sm font-medium flex items-center gap-2 transition-all duration-200 hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                onClick={handleShare}
                disabled={isSharing || !!shareUrl}
                style={{
                  border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)",
                  background: "transparent",
                  fontFamily: "var(--font-sans), Inter, sans-serif",
                }}
              >
                {isSharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : shareUrl ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isSharing ? "Sharing..." : shareUrl ? "Shared" : "Share"}
                </span>
              </MagneticButton>
            </div>
          </div>
        </div>
      </header>

      {/* Background */}
      <ShaderMeshBackground variant="page" />
      <BackgroundPattern opacity={0.02} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* Action Cards Row */}
        <motion.div
          className="mx-auto max-w-5xl mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.normal, ease: easings.out }}
        >
          <GradientBorder>
            <div className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Left: Info */}
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{
                      color: "var(--text-heading)",
                      fontFamily: "var(--font-heading), 'Instrument Sans', sans-serif",
                    }}
                  >
                    {blueprint.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                    <p
                      className="text-sm"
                      style={{
                        color: "var(--text-tertiary)",
                        fontFamily: "var(--font-sans), Inter, sans-serif",
                      }}
                    >
                      Generated {formatDate(blueprint.created_at)}
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <MagneticButton
                    className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-2"
                    onClick={handleNewBlueprint}
                    style={{
                      background: "var(--gradient-primary)",
                      color: "white",
                      fontFamily: "var(--font-display), 'Cabinet Grotesk', sans-serif",
                    }}
                  >
                    <Wand2 className="h-4 w-4" />
                    New Blueprint
                  </MagneticButton>
                </div>
              </div>

              {/* Share Link Display */}
              {shareUrl && (
                <motion.div
                  className="mt-6 p-4 rounded-lg"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                  }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="h-4 w-4" style={{ color: "var(--accent-blue)" }} />
                    <span
                      className="font-medium text-sm"
                      style={{
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-sans), Inter, sans-serif",
                      }}
                    >
                      Shareable Link
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2 text-sm rounded-md font-mono"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                    <MagneticButton
                      className="h-9 px-4 rounded-md text-sm font-medium"
                      onClick={handleCopyLink}
                      style={{
                        background: "var(--gradient-primary)",
                        color: "white",
                        fontFamily: "var(--font-display), 'Cabinet Grotesk', sans-serif",
                      }}
                    >
                      {shareCopied ? (
                        <span className="flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          Copied
                        </span>
                      ) : (
                        "Copy"
                      )}
                    </MagneticButton>
                  </div>
                  <p
                    className="text-xs mt-2"
                    style={{
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-sans), Inter, sans-serif",
                    }}
                  >
                    Anyone with this link can view this blueprint
                  </p>
                </motion.div>
              )}

              {/* Share Error Display */}
              {shareError && (
                <motion.div
                  className="mt-4 p-3 rounded-lg"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgb(239, 68, 68)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <p
                    className="text-sm"
                    style={{
                      color: "rgb(239, 68, 68)",
                      fontFamily: "var(--font-sans), Inter, sans-serif",
                    }}
                  >
                    {shareError}
                  </p>
                </motion.div>
              )}
            </div>
          </GradientBorder>
        </motion.div>

        {/* Blueprint Content */}
        <motion.div
          className="mx-auto max-w-5xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: durations.normal, ease: easings.out }}
        >
          <PolishedBlueprintView strategicBlueprint={strategicBlueprint} />
        </motion.div>
      </main>
    </div>
  );
}
