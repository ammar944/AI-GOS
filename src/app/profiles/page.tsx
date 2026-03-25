import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Compass, Globe, MapPin, Target, DollarSign, Users, Building2 } from 'lucide-react';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { getUserProfiles } from '@/lib/profiles/business-profiles';

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export default async function ProfilesPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const profiles = await getUserProfiles(userId);

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl w-full px-8 py-10">
          {/* Header */}
          <div className="mb-10">
            <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
              Business Profiles
            </h1>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Saved business profiles from your research journeys
            </p>
          </div>

          {profiles.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center mb-4">
                <Building2 className="size-7 text-[var(--text-tertiary)]" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                No profiles yet
              </h2>
              <p className="text-sm text-[var(--text-tertiary)] max-w-sm mb-6">
                Complete a research journey and your business profile will be saved automatically.
              </p>
              <Link
                href="/journey"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Compass className="size-4" />
                Start a Journey
              </Link>
            </div>
          ) : (
            /* Profile cards */
            <div className="grid grid-cols-1 gap-4">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 transition-colors hover:border-[var(--border-hover)]"
                >
                  {/* Top row: company name + date */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-lg font-bold shrink-0">
                        {profile.companyName?.[0]?.toUpperCase() ?? 'B'}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">
                          {profile.companyName ?? 'Unnamed'}
                        </h3>
                        {profile.industryVertical && (
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            {profile.industryVertical}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--text-quaternary)] shrink-0">
                      {formatDate(profile.updatedAt)}
                    </span>
                  </div>

                  {/* Detail grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {profile.websiteUrl && (
                      <DetailItem icon={Globe} label="Website" value={profile.websiteUrl} />
                    )}
                    {profile.headquarters && (
                      <DetailItem icon={MapPin} label="Location" value={profile.headquarters} />
                    )}
                    {profile.primaryIcp && (
                      <DetailItem icon={Target} label="ICP" value={profile.primaryIcp} />
                    )}
                    {profile.monthlyAdBudget && (
                      <DetailItem icon={DollarSign} label="Budget" value={profile.monthlyAdBudget} />
                    )}
                    {profile.geography && (
                      <DetailItem icon={MapPin} label="Geography" value={profile.geography} />
                    )}
                    {profile.businessModel && (
                      <DetailItem icon={Users} label="Model" value={profile.businessModel} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="size-3.5 text-[var(--text-quaternary)] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-quaternary)]">{label}</p>
        <p className="text-xs text-[var(--text-secondary)] truncate">{value}</p>
      </div>
    </div>
  );
}
