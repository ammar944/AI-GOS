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

  it('keeps clamped cells as real table cells: 4 columns render 4 tds and no td carries line-clamp', () => {
    // Regression: line-clamp on the <td> sets display:-webkit-box, which
    // destroys table-cell display; CSS table fixup then merges adjacent
    // cells into one anonymous cell (stacked text, empty trailing columns).
    interface WideRow {
      name: string;
      positioning: string;
      pricing: string;
      source: string;
    }
    const wideColumns = [
      { key: 'name', header: 'Name' },
      { key: 'positioning', header: 'Positioning', wrap: 'clamp' as const, clampLines: 3 },
      { key: 'pricing', header: 'Pricing', wrap: 'clamp' as const, clampLines: 2 },
      { key: 'source', header: 'Source' },
    ];
    const wideRows: WideRow[] = [
      {
        name: 'Notion',
        positioning: 'All-in-one workspace for notes and docs.',
        pricing: '$10/seat/month (Plus)',
        source: 'notion.so',
      },
    ];

    const { container } = render(
      <DataTable columns={wideColumns} rows={wideRows} />,
    );

    const cells = container.querySelectorAll('tbody tr td');
    expect(cells).toHaveLength(4);
    cells.forEach((cell) => {
      expect(cell.className).not.toContain('line-clamp');
    });
    // The clamp lives on an inner div, content intact.
    expect(
      container.querySelector('tbody td div.line-clamp-3'),
    ).toHaveTextContent('All-in-one workspace for notes and docs.');
    expect(screen.getByText('notion.so')).toBeInTheDocument();
  });

  it('scrubs default-rendered string cells so trust markers never print raw', () => {
    const markedColumns = [{ key: 'note', header: 'Note' }];
    const markedRows = [{ note: 'Serves 500k [unverified] brands today.' }];

    render(<DataTable columns={markedColumns} rows={markedRows} />);

    expect(
      screen.getByText('Serves 500k brands today.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\[unverified\]/)).not.toBeInTheDocument();
  });
});
