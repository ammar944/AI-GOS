export interface ManualPrefillPreset {
  label: string;
  values: Record<string, string>;
}

function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const withProtocol = value.startsWith('http') ? value : `https://${value}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0] || null;
  }
}

export function getManualPrefillPreset(input: {
  websiteUrl?: string | null;
  companyName?: string | null;
}): ManualPrefillPreset | null {
  const host = normalizeHost(input.websiteUrl);
  const companyName = input.companyName?.trim().toLowerCase() ?? '';

  if (
    host === 'saaslaunch.net' ||
    host === 'saslaunch.net' ||
    companyName === 'saaslaunch' ||
    companyName.includes('saaslaunch')
  ) {
    return {
      label: 'SaaSLaunch',
      values: {
        businessModel: 'B2B SaaS demand generation agency',
        productDescription:
          'Done-for-you paid media, creative strategy, and pipeline-focused growth systems for B2B SaaS teams.',
        topCompetitors: 'Hey Digital, Sales Captain, Growth Marketing Pro',
        primaryIcpDescription:
          'Seed to Series B B2B SaaS companies with lean internal marketing teams that need pipeline growth without hiring a full in-house demand gen team.',
        pricingTiers:
          'Retainer-based. Launch Pad: $4,000/mo, Pipeline Engine: $7,500/mo, Scale Partner: $12,000+/mo.',
        monthlyAdBudget: '$10,000-$30,000/mo',
        goals:
          'Generate more qualified demos, improve pipeline attribution, and lower CAC.',
        uniqueEdge:
          'SaaS-specialized growth systems tied directly to pipeline outcomes instead of vanity metrics.',
      },
    };
  }

  return null;
}
