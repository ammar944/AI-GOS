/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTable } from '../data-table';

interface Row {
  name: string;
  score: number;
}

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'score', header: 'Score', numeric: true },
    {
      key: 'custom',
      header: 'Custom',
      render: (row: Row) => `custom:${row.name}`,
    },
  ] as const;

  const rows: Row[] = [
    { name: 'Alpha', score: 10 },
    { name: 'Beta', score: 20 },
  ];

  it('renders column headers with scope="col"', () => {
    render(<DataTable columns={[...columns]} rows={rows} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
    headers.forEach((header) => {
      expect(header).toHaveAttribute('scope', 'col');
    });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('applies numeric alignment classes to numeric columns', () => {
    const { container } = render(<DataTable columns={[...columns]} rows={rows} />);
    const scoreHeader = screen.getByText('Score').closest('th');
    expect(scoreHeader?.className).toContain('text-right');

    const scoreCell = container.querySelector('tbody tr td:nth-child(2)');
    expect(scoreCell?.className).toContain('text-right');
    expect(scoreCell?.className).toContain('tabular-nums');
  });

  it('renders custom cell output via render callback', () => {
    render(<DataTable columns={[...columns]} rows={rows} />);
    expect(screen.getByText('custom:Alpha')).toBeInTheDocument();
  });

  it('shows emptyLabel when rows are empty', () => {
    render(
      <DataTable columns={[...columns]} rows={[]} emptyLabel="Nothing here" />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('applies rowTestId to each row', () => {
    render(
      <DataTable
        columns={[...columns]}
        rows={rows}
        rowTestId={(row) => `row-${row.name}`}
      />,
    );
    expect(screen.getByTestId('row-Alpha')).toBeInTheDocument();
    expect(screen.getByTestId('row-Beta')).toBeInTheDocument();
  });
});
