import { researchInputSchema } from "../artifacts/artifact-envelope";

// Notion research-input fixture for end-to-end lab-section testing without the
// live deepResearchProgram + onboarding pipeline. Facts are grounded in public
// sources observed 2026-05-25 (URLs on each source/excerpt). competitorAds carry
// grounded positioning from each rival's own site/comparison coverage rather than
// scraped ad creatives (creativeUrl/firstSeen/lastSeen left null, as in saaslaunch).
//
// Sources:
// - Notion pricing            https://www.notion.com/pricing
// - Notion AI / product       https://www.notion.com/product/ai
// - Notion AI agent platform  https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/
// - Notion G2 reviews (4.6/5) https://www.g2.com/products/notion/reviews
// - Coda vs Notion (Zapier)   https://zapier.com/blog/coda-vs-notion/
// - Notion template gallery   https://www.notion.com/templates
// - Connected AI workspace    https://www.gend.co/blog/notion-connected-ai-workspace
// - Notion pricing breakdown  https://get-alfred.ai/blog/notion-pricing

const rawNotionResearchInput = {
  runId: "run_notion_fixture",
  fixtureId: "notion",
  company: {
    id: "company_notion",
    name: "Notion",
    websiteUrl: "https://www.notion.com",
    category: "Connected AI workspace",
    description:
      "Notion is an all-in-one connected workspace combining notes, docs, wikis, projects, and databases, with an AI layer (Ask Notion, AI agents) that searches, summarizes, writes, and now executes work across the workspace.",
    stage: "Late-stage private / growth",
    targetCustomer:
      "Startups, SMB and mid-market teams, creators, and individual knowledge workers who want to consolidate a fragmented productivity tool stack into one workspace; increasingly enterprise teams adopting AI.",
  },
  onboarding: {
    primaryGoal:
      "Clarify Notion's strongest category and positioning wedge as it shifts from a flexible all-in-one workspace to a connected AI workspace and hub for AI agents.",
    targetSegments: [
      "Startup and SMB operations teams",
      "Creators and solo knowledge workers",
      "Mid-market product and engineering teams",
      "Enterprise knowledge-management buyers",
    ],
    keyOffers: [
      "All-in-one connected workspace (docs, wikis, projects, databases)",
      "Notion AI — Ask Notion, AI agents, enterprise search",
      "30,000+ template marketplace and creator ecosystem",
    ],
    distributionChannels: [
      "Product-led free tier and viral team adoption",
      "Template creator economy and affiliate marketplace",
      "Community, education, and content-led growth",
      "Enterprise sales for large accounts",
    ],
    constraints: [
      "Avoid generic 'note-taking app' framing — the category claim is the connected AI workspace",
      "Do not overstate autonomous agent capability beyond shipped features",
    ],
    notes:
      "Stress the 2026 pivot to an AI-agent hub, the buyer breadth from solo to enterprise, the perennial flexibility-vs-complexity tension, and the pricing change that folded AI into the Business plan.",
  },
  sources: [
    {
      id: "source_notion_pricing",
      title: "Notion Pricing Plans: Free, Plus, Business & Enterprise",
      url: "https://www.notion.com/pricing",
      publisher: "Notion Labs",
      observedAt: "2026-05-25T10:00:00.000Z",
    },
    {
      id: "source_notion_ai",
      title: "Meet your AI team — Notion AI",
      url: "https://www.notion.com/product/ai",
      publisher: "Notion Labs",
      observedAt: "2026-05-25T10:02:00.000Z",
    },
    {
      id: "source_techcrunch_agents",
      title: "Notion just turned its workspace into a hub for AI agents",
      url: "https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/",
      publisher: "TechCrunch",
      observedAt: "2026-05-25T10:04:00.000Z",
    },
    {
      id: "source_g2_reviews",
      title: "Notion Reviews 2026 — Pros, Cons & Ratings",
      url: "https://www.g2.com/products/notion/reviews",
      publisher: "G2",
      observedAt: "2026-05-25T10:06:00.000Z",
    },
    {
      id: "source_zapier_coda",
      title: "Coda vs. Notion: Which app is right for you?",
      url: "https://zapier.com/blog/coda-vs-notion/",
      publisher: "Zapier",
      observedAt: "2026-05-25T10:08:00.000Z",
    },
    {
      id: "source_notion_templates",
      title: "Choose from 30,000+ Notion templates — Notion Marketplace",
      url: "https://www.notion.com/templates",
      publisher: "Notion Labs",
      observedAt: "2026-05-25T10:10:00.000Z",
    },
    {
      id: "source_connected_workspace",
      title: "Connected AI Workspace: Why Teams Are Consolidating in Notion",
      url: "https://www.gend.co/blog/notion-connected-ai-workspace",
      publisher: "Gend",
      observedAt: "2026-05-25T10:12:00.000Z",
    },
    {
      id: "source_alfred_pricing",
      title: "Notion Pricing 2026: Free vs Plus vs Business (+ AI Cost Breakdown)",
      url: "https://get-alfred.ai/blog/notion-pricing",
      publisher: "Alfred",
      observedAt: "2026-05-25T10:14:00.000Z",
    },
  ],
  corpus: {
    excerpts: [
      {
        id: "excerpt_category_connected_workspace",
        sourceId: "source_connected_workspace",
        sourceUrl: "https://www.gend.co/blog/notion-connected-ai-workspace",
        title: "Category claim — the connected AI workspace",
        text: "Notion's positioning rests on a single claim: fragmentation kills productivity and AI potential. A connected AI workspace brings docs, projects, and team knowledge into one place, then layers AI on top to search, summarize, write, and automate — instead of juggling disconnected tools.",
        observedAt: "2026-05-25T10:12:00.000Z",
      },
      {
        id: "excerpt_ai_agent_platform_2026",
        sourceId: "source_techcrunch_agents",
        sourceUrl:
          "https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/",
        title: "2026 pivot — workspace becomes an AI-agent hub",
        text: "In May 2026 Notion launched a developer platform turning the workspace into a hub for AI agents, moving from a place where work is documented to one where work is executed, coordinated, and reviewed across both people and software agents. Notion reports customers have built over one million agents.",
        observedAt: "2026-05-25T10:04:00.000Z",
      },
      {
        id: "excerpt_pricing_tiers",
        sourceId: "source_notion_pricing",
        sourceUrl: "https://www.notion.com/pricing",
        title: "Pricing — Free, Plus, Business, Enterprise",
        text: "Notion's 2026 pricing has four tiers: Free at $0 per member, Plus at $12/user/month ($10 billed annually), Business at $24/user/month ($20 billed annually), and Enterprise with sales-negotiated pricing. Paid plans charge per member; guests are free but limited to invited pages.",
        observedAt: "2026-05-25T10:00:00.000Z",
      },
      {
        id: "excerpt_ai_bundling_change",
        sourceId: "source_alfred_pricing",
        sourceUrl: "https://get-alfred.ai/blog/notion-pricing",
        title: "AI moved into the Business plan",
        text: "In May 2025 Notion eliminated the separate $10/month AI add-on and folded full AI access — AI agents and Ask Notion — into the Business plan at $20/user/month billed annually. Teams that want the complete AI feature set must now be on Business or above rather than buying AI à la carte.",
        observedAt: "2026-05-25T10:14:00.000Z",
      },
      {
        id: "excerpt_icp_segments",
        sourceId: "source_connected_workspace",
        sourceUrl: "https://www.gend.co/blog/notion-connected-ai-workspace",
        title: "Buyer breadth — solo to enterprise",
        text: "Notion's adoption spans individual knowledge workers, students, and creators on the free tier through startup and SMB operations teams consolidating their stack, up to mid-market and enterprise teams adopting it for wikis, project hubs, and AI-assisted enterprise search across company knowledge.",
        observedAt: "2026-05-25T10:12:30.000Z",
      },
      {
        id: "excerpt_voc_pros",
        sourceId: "source_g2_reviews",
        sourceUrl: "https://www.g2.com/products/notion/reviews",
        title: "Voice of customer — what users praise",
        text: "On G2 Notion holds a 4.6/5 rating in Knowledge Management. Users consistently praise its flexibility and ability to customize a workspace for anything from notes to project management, a genuinely useful free tier, and native integrations with Slack, Google Drive, Figma, and Jira plus Zapier and Make.",
        observedAt: "2026-05-25T10:06:00.000Z",
      },
      {
        id: "excerpt_voc_cons",
        sourceId: "source_g2_reviews",
        sourceUrl: "https://www.g2.com/products/notion/reviews",
        title: "Voice of customer — recurring complaints",
        text: "The most common complaints are a steep learning curve — new team members often take about two weeks to get comfortable with databases, rollups, formulas, and relations — performance that lags noticeably on databases over 5,000 records or complex pages, and limited offline functionality compared with native apps.",
        observedAt: "2026-05-25T10:06:30.000Z",
      },
      {
        id: "excerpt_competitor_landscape",
        sourceId: "source_zapier_coda",
        sourceUrl: "https://zapier.com/blog/coda-vs-notion/",
        title: "Competitor landscape and contrasts",
        text: "Each rival beats Notion on one axis: Coda on docs-as-apps with deeper formulas and automation, ClickUp on best-in-class project management as an all-in-one work hub, Confluence on enterprise security, compliance, and Jira integration at thousands of users, Obsidian on local-first privacy and offline markdown, and Airtable/Anytype on structured relational data and ownership.",
        observedAt: "2026-05-25T10:08:00.000Z",
      },
      {
        id: "excerpt_demand_templates_intent",
        sourceId: "source_notion_templates",
        sourceUrl: "https://www.notion.com/templates",
        title: "Demand signals — templates and comparison intent",
        text: "Notion's official marketplace offers 30,000+ templates and anchors a large creator economy, with some creators earning over $2,000 monthly per template and one business-operations template reportedly grossing $500,000. High-intent search clusters include 'Notion templates', 'Notion AI', and comparison queries like 'Notion vs Obsidian', 'Notion vs Coda', and 'Notion alternatives'.",
        observedAt: "2026-05-25T10:10:00.000Z",
      },
      {
        id: "excerpt_offer_diagnostic_friction",
        sourceId: "source_alfred_pricing",
        sourceUrl: "https://get-alfred.ai/blog/notion-pricing",
        title: "Offer strength and friction points",
        text: "Notion's offer strength is consolidation — replacing several subscriptions with one flexible workspace and a useful free tier that drives bottom-up adoption. The friction points are onboarding complexity, performance at scale, weak offline support, and the 2025 change that gates full AI behind the $20/seat Business plan, raising effective cost for AI-seeking teams.",
        observedAt: "2026-05-25T10:14:30.000Z",
      },
    ],
  },
  competitorAds: [
    {
      id: "ad_coda_positioning",
      competitorName: "Coda",
      platform: "google" as const,
      headline: "Docs that bring words and data together",
      body: "Coda positions as docs-as-apps: documents, tables, and logic in one surface with formulas, buttons, and automations that go beyond Notion's database capabilities.",
      landingUrl: "https://coda.io/",
      firstSeen: null,
      lastSeen: null,
      creativeUrl: null,
      sourceUrl: "https://zapier.com/blog/coda-vs-notion/",
      angle: "Docs-as-apps with deeper formula and automation power",
    },
    {
      id: "ad_clickup_positioning",
      competitorName: "ClickUp",
      platform: "google" as const,
      headline: "One app to replace them all",
      body: "ClickUp positions as an all-in-one work hub — docs, projects, chat, whiteboards, dashboards, and AI — with best-in-class project-management automations and workflows.",
      landingUrl: "https://clickup.com/",
      firstSeen: null,
      lastSeen: null,
      creativeUrl: null,
      sourceUrl: "https://clickup.com/",
      angle: "All-in-one tool that replaces the whole stack, PM-first",
    },
    {
      id: "ad_confluence_positioning",
      competitorName: "Confluence",
      platform: "linkedin" as const,
      headline: "The connected workspace for enterprise teams",
      body: "Confluence positions around enterprise security, compliance, native Jira integration, and the ability to scale to thousands of users without performance issues.",
      landingUrl: "https://www.atlassian.com/software/confluence",
      firstSeen: null,
      lastSeen: null,
      creativeUrl: null,
      sourceUrl: "https://www.atlassian.com/software/confluence",
      angle: "Enterprise-grade knowledge base with Jira and compliance",
    },
    {
      id: "ad_obsidian_positioning",
      competitorName: "Obsidian",
      platform: "meta" as const,
      headline: "Your second brain, stored locally",
      body: "Obsidian positions around local-first, markdown-based knowledge management with full data ownership, 100% offline access, and bidirectional linking with graph view.",
      landingUrl: "https://obsidian.md/",
      firstSeen: null,
      lastSeen: null,
      creativeUrl: null,
      sourceUrl: "https://learn.g2.com/obsidian-vs-notion",
      angle: "Local-first, private, offline-first connected notes",
    },
    {
      id: "ad_airtable_positioning",
      competitorName: "Airtable",
      platform: "google" as const,
      headline: "Build next-gen apps on connected data",
      body: "Airtable positions as a connected-data platform — relational databases, interfaces, and automations for teams that need structured data over freeform documents.",
      landingUrl: "https://www.airtable.com/",
      firstSeen: null,
      lastSeen: null,
      creativeUrl: null,
      sourceUrl: "https://www.airtable.com/",
      angle: "Structured relational data and app-building over notes",
    },
  ],
};

export const notionResearchInput = researchInputSchema.parse(
  rawNotionResearchInput,
);
