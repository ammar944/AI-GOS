/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DocumentHeader } from '../document-header';

describe('DocumentHeader', () => {
  it('renders eyebrow, company name, lede, and meta row', () => {
    render(
      <DocumentHeader
        companyName="monday.com"
        companyUrl="monday.com"
        lede="A work-OS company sitting at the top of a crowded category."
        generatedAt={new Date('2026-05-20T12:00:00Z')}
        sectionsComplete={6}
        sectionsTotal={6}
        sourcesCount={47}
        modelLabel="Managed Agents · Claude Sonnet 4.5"
      />
    );
    expect(screen.getByText(/Pre-Pitch Positioning Audit/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'monday.com' })).toBeInTheDocument();
    expect(screen.getByText(/work-OS company/i)).toBeInTheDocument();
    expect(screen.getByText(/6 sections · 47 sources/i)).toBeInTheDocument();
    expect(screen.getByText(/Managed Agents/i)).toBeInTheDocument();
  });

  it('renders without a dispatch button or progress chips', () => {
    const { container } = render(
      <DocumentHeader
        companyName="monday.com"
        companyUrl="monday.com"
        lede="x"
        generatedAt={new Date()}
        sectionsComplete={6}
        sectionsTotal={6}
        sourcesCount={0}
        modelLabel="x"
      />
    );
    expect(container.querySelector('button')).toBeNull();
  });
});
