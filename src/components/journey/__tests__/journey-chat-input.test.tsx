import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JourneyChatInput } from '@/components/journey/chat-input';

describe('JourneyChatInput', () => {
  it('submits input in the default variant', () => {
    const onSubmit = vi.fn();

    render(
      <JourneyChatInput
        onSubmit={onSubmit}
        isLoading={false}
      />,
    );

    const input = screen.getByPlaceholderText('Ask AIGOS to refine the strategy...');

    fireEvent.change(input, { target: { value: 'Tighten the ICP framing' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('Tighten the ICP framing');
    expect(screen.getByTestId('journey-chat-input')).toHaveAttribute('data-variant', 'default');
  });

  it('renders the studio variant marker and premium chrome', () => {
    render(
      <JourneyChatInput
        onSubmit={vi.fn()}
        isLoading={false}
        variant="studio"
      />,
    );

    const input = screen.getByTestId('journey-chat-input');

    expect(input).toHaveAttribute('data-variant', 'studio');
    expect(input).toHaveClass('journey-studio-chat-input');
    expect(screen.getByText('Ask')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('renders the paper variant marker and light chrome', () => {
    render(
      <JourneyChatInput
        onSubmit={vi.fn()}
        isLoading={false}
        variant="paper"
      />,
    );

    const input = screen.getByTestId('journey-chat-input');

    expect(input).toHaveAttribute('data-variant', 'paper');
    expect(screen.getByText('Intake')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
  });

  it('renders the premium variant marker and operator chrome', () => {
    render(
      <JourneyChatInput
        onSubmit={vi.fn()}
        isLoading={false}
        variant={'premium' as never}
      />,
    );

    const input = screen.getByTestId('journey-chat-input');

    expect(input).toHaveAttribute('data-variant', 'premium');
    expect(screen.getByText('Mode')).toBeInTheDocument();
    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('Directive')).toBeInTheDocument();
  });
});
