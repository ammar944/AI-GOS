import { fireEvent, render, screen } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WelcomeState } from '../welcome-state';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  },
}));

vi.mock('@/components/journey/chat-input', () => ({
  JourneyChatInput: ({
    onSubmit,
    isLoading,
    placeholder,
  }: {
    onSubmit: (msg: string) => void;
    isLoading: boolean;
    placeholder?: string;
  }) => (
    <div data-testid="chat-input">
      <input
        placeholder={placeholder}
        disabled={isLoading}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit((e.target as HTMLInputElement).value);
        }}
      />
    </div>
  ),
}));

describe('WelcomeState', () => {
  it('renders headline and capability chips', () => {
    render(<WelcomeState onSubmit={vi.fn()} isLoading={false} />);

    expect(screen.getByText(/market analysis/i)).toBeInTheDocument();
    expect(screen.getByText('ICP Analysis')).toBeInTheDocument();
    expect(screen.getByText('Market Intel')).toBeInTheDocument();
    expect(screen.getByText('Competitor Audit')).toBeInTheDocument();
    expect(screen.getByText('Media Plan')).toBeInTheDocument();
  });

  it('renders the chat input', () => {
    render(<WelcomeState onSubmit={vi.fn()} isLoading={false} />);

    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/company name and website/i)).toBeInTheDocument();
  });

  it('calls onSubmit when user enters text', () => {
    const onSubmit = vi.fn();
    render(<WelcomeState onSubmit={onSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText(/company name and website/i);
    fireEvent.change(input, { target: { value: 'TechFlow — techflow.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('TechFlow — techflow.com');
  });

  it('disables input when loading', () => {
    render(<WelcomeState onSubmit={vi.fn()} isLoading />);

    const input = screen.getByPlaceholderText(/company name and website/i);
    expect(input).toBeDisabled();
  });
});
