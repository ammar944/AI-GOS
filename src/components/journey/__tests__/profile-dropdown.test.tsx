import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProfileDropdown } from '../profile-dropdown';
import type { BusinessProfile } from '@/lib/profiles/business-profiles';

const mockProfile: BusinessProfile = {
  id: 'prof-1',
  userId: 'user-1',
  sessionId: 'sess-1',
  companyName: 'Acme Corp',
  websiteUrl: 'https://acme.com',
  headquarters: 'San Francisco',
  businessModel: 'B2B SaaS',
  industryVertical: 'Marketing Tech',
  productDescription: 'Marketing automation',
  valueProp: 'Save time',
  uniqueEdge: 'AI-powered',
  pricingTiers: '$99/mo',
  monthlyAdBudget: '$15,000',
  primaryIcp: 'VP Marketing',
  jobTitles: 'VP Marketing, CMO',
  companySize: '50-200',
  geography: 'North America',
  topCompetitors: 'HubSpot, Marketo',
  goals: 'Pipeline growth',
  allFields: { companyName: 'Acme Corp', businessModel: 'B2B SaaS' },
  createdAt: '2026-03-20T00:00:00Z',
  updatedAt: '2026-03-25T00:00:00Z',
};

describe('ProfileDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no profiles exist', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ profiles: [] }),
    });
    const onSelect = vi.fn();
    const { container } = render(<ProfileDropdown onSelect={onSelect} />);

    await waitFor(() => {
      // Loading state clears, no profiles → null render
      expect(container.querySelector('.animate-spin')).toBeNull();
    });

    // Should not show dropdown trigger
    expect(screen.queryByText('Select a saved profile')).toBeNull();
  });

  it('shows loading state while fetching', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    const onSelect = vi.fn();
    render(<ProfileDropdown onSelect={onSelect} />);
    expect(screen.getByText('Loading profiles...')).toBeInTheDocument();
  });

  it('renders dropdown with profile when fetch succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ profiles: [mockProfile] }),
    });
    const onSelect = vi.fn();
    render(<ProfileDropdown onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Select a saved profile')).toBeInTheDocument();
    });
  });

  it('calls onSelect with full profile when profile is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ profiles: [mockProfile] }),
    });
    const onSelect = vi.fn();
    render(<ProfileDropdown onSelect={onSelect} />);

    // Wait for profiles to load
    await waitFor(() => {
      expect(screen.getByText('Select a saved profile')).toBeInTheDocument();
    });

    // Open dropdown
    fireEvent.click(screen.getByText('Select a saved profile'));

    // Click profile option
    fireEvent.click(screen.getByText('Acme Corp'));

    expect(onSelect).toHaveBeenCalledWith(mockProfile);
  });

  it('falls back gracefully on fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const onSelect = vi.fn();
    const { container } = render(<ProfileDropdown onSelect={onSelect} />);

    await waitFor(() => {
      expect(container.querySelector('.animate-spin')).toBeNull();
    });

    // No profiles → nothing rendered
    expect(screen.queryByText('Select a saved profile')).toBeNull();
  });
});
