import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JourneyChatInput } from '@/components/journey/chat-input';

// Mock SlashCommandPalette to avoid importing the full chat module
vi.mock('@/components/chat/slash-command-palette', () => ({
  SlashCommandPalette: ({
    commands,
    isOpen,
    selectedIndex,
    onSelect,
  }: {
    commands: { name: string; description: string }[];
    isOpen: boolean;
    selectedIndex: number;
    onSelect: (cmd: { name: string; description: string }) => void;
  }) =>
    isOpen ? (
      <ul data-testid="slash-palette">
        {commands.map((cmd, i) => (
          <li
            key={cmd.name}
            data-selected={i === selectedIndex}
            onClick={() => onSelect(cmd)}
          >
            {cmd.name}
          </li>
        ))}
      </ul>
    ) : null,
}));

// Mock PromptInput components to render simple HTML equivalents for testing
vi.mock('@/components/ai-elements/prompt-input', () => {
  const React = require('react');
  return {
    PromptInput: ({ onSubmit, children }: { onSubmit: (msg: { text: string; files: unknown[] }) => void; children: React.ReactNode }) => {
      const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const text = (formData.get('message') as string) || '';
        onSubmit({ text, files: [] });
      };
      return <form onSubmit={handleSubmit}>{children}</form>;
    },
    PromptInputBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PromptInputTextarea: React.forwardRef(
      (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>, ref: React.Ref<HTMLTextAreaElement>) => (
        <textarea ref={ref} name="message" {...props} />
      )
    ),
    PromptInputFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PromptInputTools: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PromptInputSubmit: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type="submit" aria-label="Submit" {...props} />
    ),
  };
});

function renderInput(props: Partial<React.ComponentProps<typeof JourneyChatInput>> = {}) {
  const defaultProps = {
    onSubmit: vi.fn(),
    isLoading: false,
    ...props,
  };
  return { ...render(<JourneyChatInput {...defaultProps} />), ...defaultProps };
}

function getTextarea() {
  return screen.getByPlaceholderText('Ask AIGOS to refine the strategy...') as HTMLTextAreaElement;
}

describe('JourneyChatInput', () => {
  // --- Submit behavior ---

  it('submits on Enter (no shift)', () => {
    const { onSubmit } = renderInput();
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: 'Tighten the ICP framing' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('Tighten the ICP framing');
  });

  it('does NOT submit on Shift+Enter', () => {
    const { onSubmit } = renderInput();
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears input after submit', () => {
    renderInput();
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(textarea.value).toBe('');
  });

  it('does not submit empty or whitespace-only input', () => {
    const { onSubmit } = renderInput();
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  // --- Disabled / loading states ---

  it('disables textarea when disabled=true', () => {
    renderInput({ disabled: true });
    expect(getTextarea()).toBeDisabled();
  });

  it('does not submit when disabled=true', () => {
    const { onSubmit } = renderInput({ disabled: true });
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: 'Should not send' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit when isLoading=true', () => {
    const { onSubmit } = renderInput({ isLoading: true });
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: 'Should not send' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  // --- Slash command palette ---

  it('opens slash palette when typing /', () => {
    renderInput();
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: '/' } });

    expect(screen.getByTestId('slash-palette')).toBeInTheDocument();
  });

  it('arrow keys navigate the palette', () => {
    renderInput();
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: '/' } });

    // First item selected by default
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveAttribute('data-selected', 'true');

    // Arrow down
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    const updatedItems = screen.getAllByRole('listitem');
    expect(updatedItems[1]).toHaveAttribute('data-selected', 'true');

    // Arrow up back
    fireEvent.keyDown(textarea, { key: 'ArrowUp' });
    const reUpdatedItems = screen.getAllByRole('listitem');
    expect(reUpdatedItems[0]).toHaveAttribute('data-selected', 'true');
  });

  it('Enter selects a slash command', () => {
    renderInput();
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: '/' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // Should have inserted the command name
    expect(textarea.value).toBe('/research ');
    // Palette should close
    expect(screen.queryByTestId('slash-palette')).not.toBeInTheDocument();
  });

  it('Escape closes the palette and clears input', () => {
    renderInput();
    const textarea = getTextarea();

    fireEvent.change(textarea, { target: { value: '/re' } });
    expect(screen.getByTestId('slash-palette')).toBeInTheDocument();

    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(screen.queryByTestId('slash-palette')).not.toBeInTheDocument();
    expect(textarea.value).toBe('');
  });

  // --- File upload ---

  it('calls onFileUpload when a valid file is selected', () => {
    const onFileUpload = vi.fn();
    renderInput({ onFileUpload });

    const fileInput = screen.getByLabelText('Upload niche document') as HTMLInputElement;
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 }); // 1KB

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onFileUpload).toHaveBeenCalledWith(file);
  });

  it('rejects files over 3MB', () => {
    const onFileUpload = vi.fn();
    renderInput({ onFileUpload });

    const fileInput = screen.getByLabelText('Upload niche document') as HTMLInputElement;
    const file = new File([''], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 4 * 1024 * 1024 }); // 4MB

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(onFileUpload).not.toHaveBeenCalled();
  });

  it('does not render upload button when onFileUpload is not provided', () => {
    renderInput();
    expect(screen.queryByLabelText('Upload niche document')).not.toBeInTheDocument();
  });

  // --- Rendering ---

  it('renders with data-testid', () => {
    renderInput();
    expect(screen.getByTestId('journey-chat-input')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderInput({ className: 'max-w-none' });
    expect(screen.getByTestId('journey-chat-input')).toHaveClass('max-w-none');
  });
});
