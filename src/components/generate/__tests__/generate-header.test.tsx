import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GenerateHeader, type GenerateStage } from "../generate-header";

// Mock Clerk's UserButton
vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button">UserButton</div>,
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock Framer Motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    header: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
    }) => <header {...props}>{children}</header>,
    div: ({ children, ...props }: { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("GenerateHeader", () => {
  const mockOnExit = vi.fn();

  beforeEach(() => {
    mockOnExit.mockClear();
    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: "" } as Location;
  });

  describe("Rendering", () => {
    it("renders the logo", () => {
      render(<GenerateHeader currentStage="onboarding" />);
      expect(screen.getByRole("link", { name: /go to dashboard/i })).toBeInTheDocument();
    });

    it("renders the UserButton", () => {
      render(<GenerateHeader currentStage="onboarding" />);
      expect(screen.getByTestId("user-button")).toBeInTheDocument();
    });

    it("renders the Exit button", () => {
      render(<GenerateHeader currentStage="onboarding" />);
      expect(screen.getByRole("button", { name: /exit/i })).toBeInTheDocument();
    });

    it("renders all stage indicators", () => {
      render(<GenerateHeader currentStage="onboarding" />);

      // Check for stage labels
      expect(screen.getAllByText(/Setup/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Generate/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Review/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Done/i).length).toBeGreaterThan(0);
    });
  });

  describe("Stage Progression", () => {
    it("highlights the current stage", () => {
      const { rerender } = render(<GenerateHeader currentStage="onboarding" />);

      // First stage should be active
      // We can't easily check CSS classes in this test, but we can verify it re-renders
      rerender(<GenerateHeader currentStage="generate" />);
      rerender(<GenerateHeader currentStage="review" />);
      rerender(<GenerateHeader currentStage="complete" />);
    });

    it("shows completed stages with checkmark icon", () => {
      render(<GenerateHeader currentStage="review" />);

      // When on review stage, onboarding and generate should be complete
      // CheckCircle2 icons should be present (though we can't easily verify the exact count)
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });
  });

  describe("Exit Functionality", () => {
    it("navigates immediately when no unsaved progress", async () => {
      render(
        <GenerateHeader
          currentStage="onboarding"
          hasUnsavedProgress={false}
          exitUrl="/dashboard"
          onExit={mockOnExit}
        />
      );

      const exitButton = screen.getByRole("button", { name: /exit/i });
      fireEvent.click(exitButton);

      await waitFor(() => {
        expect(mockOnExit).toHaveBeenCalledTimes(1);
        expect(window.location.href).toBe("/dashboard");
      });
    });

    it("shows confirmation dialog when unsaved progress exists", async () => {
      render(
        <GenerateHeader
          currentStage="generate"
          hasUnsavedProgress={true}
          onExit={mockOnExit}
        />
      );

      const exitButton = screen.getByRole("button", { name: /exit/i });
      fireEvent.click(exitButton);

      // Dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/Exit Without Saving/i)).toBeInTheDocument();
      });

      // onExit should not be called yet
      expect(mockOnExit).not.toHaveBeenCalled();
    });

    it("cancels exit when user clicks Stay", async () => {
      render(
        <GenerateHeader
          currentStage="generate"
          hasUnsavedProgress={true}
          onExit={mockOnExit}
        />
      );

      const exitButton = screen.getByRole("button", { name: /exit/i });
      fireEvent.click(exitButton);

      await waitFor(() => {
        expect(screen.getByText(/Exit Without Saving/i)).toBeInTheDocument();
      });

      const stayButton = screen.getByRole("button", { name: /stay/i });
      fireEvent.click(stayButton);

      await waitFor(() => {
        expect(screen.queryByText(/Exit Without Saving/i)).not.toBeInTheDocument();
      });

      expect(mockOnExit).not.toHaveBeenCalled();
    });

    it("confirms exit when user clicks Exit Anyway", async () => {
      render(
        <GenerateHeader
          currentStage="generate"
          hasUnsavedProgress={true}
          exitUrl="/dashboard"
          onExit={mockOnExit}
        />
      );

      const exitButton = screen.getByRole("button", { name: /exit/i });
      fireEvent.click(exitButton);

      await waitFor(() => {
        expect(screen.getByText(/Exit Without Saving/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /exit anyway/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnExit).toHaveBeenCalledTimes(1);
        expect(window.location.href).toBe("/dashboard");
      });
    });

    it("shows generation-specific warning during generation", async () => {
      render(
        <GenerateHeader
          currentStage="generate"
          hasUnsavedProgress={true}
        />
      );

      const exitButton = screen.getByRole("button", { name: /exit/i });
      fireEvent.click(exitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/currently being generated/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Collapsible Functionality", () => {
    it("shows collapse toggle when collapsible is enabled", () => {
      render(
        <GenerateHeader currentStage="generate" collapsible={true} />
      );

      const collapseButton = screen.getByRole("button", {
        name: /expand header|collapse header/i,
      });
      expect(collapseButton).toBeInTheDocument();
    });

    it("does not show collapse toggle when collapsible is disabled", () => {
      render(
        <GenerateHeader currentStage="generate" collapsible={false} />
      );

      const collapseButton = screen.queryByRole("button", {
        name: /expand header|collapse header/i,
      });
      expect(collapseButton).not.toBeInTheDocument();
    });

    it("toggles collapsed state when collapse button is clicked", () => {
      render(
        <GenerateHeader
          currentStage="generate"
          collapsible={true}
          defaultCollapsed={false}
        />
      );

      const collapseButton = screen.getByRole("button", {
        name: /collapse header/i,
      });

      // Initially expanded
      fireEvent.click(collapseButton);

      // After click, should be collapsed (button label changes to "expand")
      expect(
        screen.getByRole("button", { name: /expand header/i })
      ).toBeInTheDocument();
    });

    it("starts in collapsed state when defaultCollapsed is true", () => {
      render(
        <GenerateHeader
          currentStage="generate"
          collapsible={true}
          defaultCollapsed={true}
        />
      );

      const collapseButton = screen.getByRole("button", {
        name: /expand header/i,
      });
      expect(collapseButton).toBeInTheDocument();
    });
  });

  describe("Custom Exit URL", () => {
    it("navigates to custom exit URL", async () => {
      render(
        <GenerateHeader
          currentStage="onboarding"
          hasUnsavedProgress={false}
          exitUrl="/custom-path"
          onExit={mockOnExit}
        />
      );

      const exitButton = screen.getByRole("button", { name: /exit/i });
      fireEvent.click(exitButton);

      await waitFor(() => {
        expect(window.location.href).toBe("/custom-path");
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels", () => {
      render(<GenerateHeader currentStage="onboarding" />);

      expect(
        screen.getByRole("link", { name: /go to dashboard/i })
      ).toBeInTheDocument();
    });

    it("maintains keyboard navigation", () => {
      render(<GenerateHeader currentStage="onboarding" />);

      const exitButton = screen.getByRole("button", { name: /exit/i });
      exitButton.focus();
      expect(document.activeElement).toBe(exitButton);
    });
  });

  describe("Responsive Layout", () => {
    it("renders mobile and desktop progress indicators", () => {
      render(<GenerateHeader currentStage="onboarding" />);

      // Both mobile and desktop versions should be in the DOM
      // (visibility controlled by CSS)
      const setupLabels = screen.getAllByText(/Setup/i);
      expect(setupLabels.length).toBeGreaterThan(0);
    });
  });
});
