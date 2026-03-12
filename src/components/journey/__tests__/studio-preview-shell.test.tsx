import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JourneyStudioPreviewDock } from '@/components/journey/studio-preview-dock';
import { JourneyStudioPreviewShell } from '@/components/journey/studio-preview-shell';

describe('JourneyStudioPreviewShell', () => {
  it('renders shell, masthead, and dock markers', () => {
    render(
      <JourneyStudioPreviewShell
        title="Strategy session"
        description="Premium preview"
        statusLabel="Live research"
        statusDetail="2 workers running"
        dock={(
          <JourneyStudioPreviewDock title="Proof Dock">
            <div>Dock content</div>
          </JourneyStudioPreviewDock>
        )}
      >
        <div>Main content</div>
      </JourneyStudioPreviewShell>,
    );

    expect(screen.getByTestId('journey-studio-shell')).toBeInTheDocument();
    expect(screen.getByTestId('journey-studio-masthead')).toBeInTheDocument();
    expect(screen.getByTestId('journey-studio-dock')).toBeInTheDocument();
    expect(screen.getByText('Strategy session')).toBeInTheDocument();
    expect(screen.getByText('Dock content')).toBeInTheDocument();
  });

  it('omits the status card when status props are not provided', () => {
    render(
      <JourneyStudioPreviewShell title="Strategy session">
        <div>Main content</div>
      </JourneyStudioPreviewShell>,
    );

    expect(screen.queryByText('Journey Studio')).toBeInTheDocument();
    expect(screen.queryByText('2 workers running')).not.toBeInTheDocument();
  });
});
