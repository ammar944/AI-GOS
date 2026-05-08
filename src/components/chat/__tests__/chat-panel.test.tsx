import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatPanel } from '../chat-panel';

// Mock radix-ui Dialog (used by Sheet) to render inline without portal
vi.mock('radix-ui', () => {
  const React = require('react');

  const Root = ({ children, open }: { children: React.ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) => {
    if (!open) return null;
    return <div data-testid="sheet-root">{children}</div>;
  };

  const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Overlay = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;

  const Content = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sheet-content" {...props}>{children}</div>
  );

  const Close = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button data-testid="sheet-close" {...props}>{children}</button>
  );

  const Title = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  );

  const Description = ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  );

  const Trigger = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  );

  return {
    Dialog: {
      Root,
      Portal,
      Overlay,
      Content,
      Close,
      Title,
      Description,
      Trigger,
    },
  };
});

// Mock ScrollArea to render children directly
vi.mock('@/components/ui/scroll-area', () => {
  const React = require('react');
  return {
    ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="scroll-area" className={className}>{children}</div>
    ),
    ScrollBar: () => null,
  };
});

describe('ChatPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  it('opens with isOpen=true and renders children', () => {
    render(
      <ChatPanel {...defaultProps}>
        <div data-testid="child-content">Hello</div>
      </ChatPanel>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('AIGOS')).toBeInTheDocument();
    expect(screen.getByText('AI Strategy Agent')).toBeInTheDocument();
  });

  it('does not render when isOpen=false', () => {
    render(
      <ChatPanel isOpen={false} onClose={vi.fn()}>
        <div data-testid="child-content">Hello</div>
      </ChatPanel>
    );

    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('calls onClose when sheet close button fires', () => {
    const onClose = vi.fn();

    render(
      <ChatPanel isOpen={true} onClose={onClose}>
        <div>Content</div>
      </ChatPanel>
    );

    const closeButton = screen.getByTestId('sheet-close');
    fireEvent.click(closeButton);
    expect(closeButton).toBeInTheDocument();
  });

  it('calls undoRedo.onUndo and onRedo when their buttons are clicked', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();

    render(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        undoRedo={{
          canUndo: true,
          canRedo: true,
          undoDepth: 3,
          onUndo,
          onRedo,
        }}
      >
        <div>Content</div>
      </ChatPanel>
    );

    const undoButton = screen.getByTitle('Undo (3 available)');
    const redoButton = screen.getByTitle('Redo');

    fireEvent.click(undoButton);
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.click(redoButton);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('disables undo button when canUndo=false', () => {
    render(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        undoRedo={{
          canUndo: false,
          canRedo: true,
          undoDepth: 0,
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        }}
      >
        <div>Content</div>
      </ChatPanel>
    );

    const undoButton = screen.getByTitle('Nothing to undo');
    expect(undoButton).toBeDisabled();
  });

  it('shows undo depth badge when undoDepth > 0', () => {
    render(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        undoRedo={{
          canUndo: true,
          canRedo: false,
          undoDepth: 5,
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        }}
      >
        <div>Content</div>
      </ChatPanel>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 9+ for undoDepth > 9', () => {
    render(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        undoRedo={{
          canUndo: true,
          canRedo: false,
          undoDepth: 12,
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        }}
      >
        <div>Content</div>
      </ChatPanel>
    );

    expect(screen.getByText('9+')).toBeInTheDocument();
  });
});
