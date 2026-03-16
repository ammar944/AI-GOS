# Mobile App Media Plan Template

> Source: Industry benchmark aggregates (2024–2025). Applies to iOS and Android app publishers
> across gaming, utility, productivity, health, and consumer apps. Adjust by monetization model:
> free-with-IAP, subscription, or paid app.

---

## Platform Mix

| Platform               | Budget Share | Role                                             | Priority |
|------------------------|--------------|--------------------------------------------------|----------|
| Google UAC / App Campaigns | 30% – 45% | iOS + Android installs; in-app events optimization | Primary |
| Meta Ads (App Install) | 25% – 35%    | Android primary; iOS requires SKAdNetwork/AAA    | Primary  |
| Apple Search Ads       | 15% – 25%    | High-intent App Store search capture             | Primary  |
| TikTok Ads             | 10% – 15%    | Gen Z/Millennial acquisition; video creative     | Secondary|
| Snapchat               | 5% – 10%     | 13–35 demographic; specific genre fit            | Optional |

**Platform Priority by OS:**
- iOS: Apple Search Ads + Meta (AAA/SKAN) + Google UAC (iOS)
- Android: Google UAC dominant + Meta + TikTok
- Cross-platform: Run all; allocate more to highest LTV OS per your data

---

## Campaign Architecture

### Google App Campaigns (UAC)

Google UAC is fully automated — you provide assets; Google handles bidding, placement, and audience.

```
Account
├── Campaign: App Install — Volume (Optimize for installs)
│   └── Asset Group: All creative assets (images, videos, HTML5)
│       Use when: < 10 in-app events tracked; build install volume first
│
├── Campaign: App Install — Target CPI (Optimize for CPI target)
│   └── Asset Group: Best-performing creative from volume campaign
│       Use when: 100+ installs/day achieved; set tCPI
│
└── Campaign: In-App Events (Optimize for key events)
    └── Asset Group: Event-optimized creative
        Use when: 10+ target in-app events/day; optimize for D7 retention or IAP
```

**In-App Event Optimization Priority (general guidance):**
1. Volume of events first: Optimize for registration / tutorial complete
2. Then optimize for engagement: Level complete, D3/D7 active, subscription start
3. Then optimize for revenue: First purchase, IAP, subscription renewal

### Apple Search Ads (ASA)

```
Account
├── Campaign: Brand Keywords (exact)
│   └── Protect brand; capture branded search
│
├── Campaign: Category Keywords (exact + broad)
│   └── Ad Group: Core category keywords
│   └── Ad Group: Competitor app names
│
├── Campaign: Discovery / Search Match
│   └── Ad Group: Search Match on (let Apple discover keywords)
│       Use keyword performance data to inform manual campaigns
│
└── Campaign: Today Tab (optional; larger budgets)
    └── Banner placement; awareness play
```

**ASA Bidding:**
- Start: Manual CPC; set bid at Apple's suggested bid
- Scale: Raise bids on keywords with ROAS > target; lower or pause below target
- CPT (cost per tap) in ASA is not the same as CPC — Apple charges per tap on the app store result

### Meta App Campaign

Post-iOS 14, Meta app install campaigns require SKAN (SKAdNetwork) compliance for iOS.

```
Account
├── Campaign: App Installs — Android (Volume)
│   ├── Ad Set: Broad audience (Advantage+ Audience)
│   └── Ad Set: Interest targeting (category-aligned)
│
├── Campaign: App Installs — Android (Value optimization)
│   └── Ad Set: Advantage+ Audience; optimize for purchase/subscription
│
└── Campaign: App Installs — iOS (SKAN / AAA)
    └── Campaign: iOS 14+ App Campaign
        └── Ad Set: AAA (App Ads for Apple)
            Note: Use on-device reporting; limited real-time visibility
```

### TikTok App Campaigns

```
Account
├── Campaign: App Install (Volume)
│   ├── Ad Group: Interest targeting (app category)
│   └── Ad Group: Behavioral — app users
│
└── Campaign: Retargeting (re-engagement)
    └── Ad Group: Lapsed users (past installs, no recent activity)
```

---

## Creative Strategy

### Video Creative Requirements for App Campaigns

Video is the primary format for app acquisition across all platforms.

| Platform   | Optimal Length  | Orientation | Key Elements                                           |
|------------|-----------------|-------------|--------------------------------------------------------|
| Google UAC | 15–30 sec       | 9:16, 1:1, 16:9| Show real gameplay/app UI; hook in first 3 sec      |
| Meta       | 7–30 sec        | 9:16 (primary)| UGC-style or screen recording often outperforms polished |
| Apple SA   | No video (text ads)| N/A      | App Store screenshots are primary asset               |
| TikTok     | 15–30 sec       | 9:16        | Native-feel; trending audio; fast-paced cuts          |

### Creative Angles for App Acquisition

1. **Gameplay / UI demo**: Show what the app actually does (screen recording with voice or text overlay)
2. **Problem → App solution**: Pain point in first 3 seconds; app solves it
3. **Social proof**: Rating badge, "10M+ downloads," user reviews read aloud
4. **Challenge/competition**: For games: show exciting moments, progression, rewards
5. **UGC testimonial**: Real user on camera talking about the app
6. **Feature highlight**: Specific feature that differentiates from competitors

### App Store Creative (ASO — affects paid too)

- **Icon**: A/B test with Apple Search Ads Custom Product Pages
- **Screenshots**: First 2–3 screenshots most critical; show value immediately
- **Preview video**: 15–30 sec app preview in App Store listing
- Custom Product Pages (iOS): Create variant pages for different ad audiences (match landing to ad message)

---

## Targeting Guidelines

### Google UAC Targeting

UAC does not expose manual audience settings — Google AI manages targeting. You influence it by:
- Asset quality: Upload 20+ images, 5+ videos of varying lengths and formats
- Event optimization: Signal which in-app event to optimize (the better the signal, the better targeting)
- Location: Country/region; language targeting
- Bidding strategy: Target CPI or maximize conversions

### Apple Search Ads Keyword Strategy

| Keyword Type          | Match Type | Strategy                                         |
|-----------------------|------------|--------------------------------------------------|
| Brand terms           | Exact      | Defend brand search; typically highest TTR       |
| Competitor app names  | Exact      | Conquest; often high CPI but captures switchers  |
| Category keywords     | Broad      | Discovery; monitor and move winners to Exact     |
| Use case keywords     | Exact      | Intent-specific; "meditation app", "budget tracker" |
| Search Match          | Auto       | Discovery mode; review weekly; harvest keywords  |

### Meta App Audience Strategy

- **Android**: Full Meta targeting capabilities apply; start broad with Advantage+
- **iOS post-SKAN**: AAA campaigns (Apple Advertising Attribution); extremely limited audience control
- **Lookalike**: Use your highest-LTV user CRM list as source for LAL
- **Retargeting**: Meta App Engagement campaigns for lapsed users (re-engagement)

**Audience size for app campaigns:**
- Android: 5M+ potential audience recommended for Advantage+ campaigns
- iOS: No manual audience control in AAA; broader is better

---

## Budget Guidelines

### Minimum Monthly Budget by App Type

| App Type                    | Minimum Monthly Budget | Notes                                          |
|-----------------------------|------------------------|------------------------------------------------|
| Gaming (casual / hyper-casual) | $10,000 – $50,000  | Volume-heavy; creative refresh every 1–2 weeks |
| Gaming (mid-core / strategy) | $20,000 – $100,000  | Higher LTV; can justify higher CPI             |
| Subscription app (utility)  | $5,000 – $20,000       | Google UAC + ASA + Meta balanced              |
| Fintech / banking app        | $10,000 – $40,000      | Higher CPI acceptable; high LTV/LTA           |
| Health / fitness app         | $5,000 – $20,000       | Jan–Feb peak; January resolution surge         |
| E-commerce app              | $5,000 – $20,000       | Retention through push also important          |

### Platform Budget Split Guidance

| Phase                  | UAC    | Meta   | ASA    | TikTok | Notes                                        |
|------------------------|--------|--------|--------|--------|----------------------------------------------|
| Launch / Testing       | 30%    | 30%    | 30%    | 10%    | Equal distribution; identify winners         |
| Growth                 | 40%    | 25%    | 25%    | 10%    | Double down on UAC if Android LTV is strong  |
| Scale (iOS-focused)    | 25%    | 20%    | 45%    | 10%    | ASA dominant for iOS quality signals         |
| Scale (Android-focused)| 50%    | 30%    | 10%    | 10%    | UAC dominant for Android volume              |

---

## KPI Targets

### Primary KPIs

| Metric                  | Target Range (Industry Benchmark)          | Notes                                         |
|-------------------------|--------------------------------------------|-----------------------------------------------|
| CPI (Cost per Install)  | $0.50 – $3 (gaming, casual)               | Hyper-casual: $0.30–$0.80; mid-core: $2–$5  |
| CPI (subscription app)  | $2 – $10                                   | Higher CPI justified by subscription LTV     |
| D1 Retention            | 25% – 45%                                 | Below 20% = onboarding problem               |
| D7 Retention            | 10% – 20%                                 | Benchmark varies by genre                    |
| D30 Retention           | 5% – 10%                                  | Strong retention = better LTV:CPI ratio      |
| Trial-to-Paid (subscription) | 15% – 40%                          | Paywall placement affects conversion         |
| ROAS D7                 | 30% – 60%                                 | Full ROAS recovery over 30–90 days           |
| ROAS D30                | 60% – 100%                                | At or above 100% = excellent                 |
| ROAS D90                | 100% – 200%+                              | Long-tail LTV drives ROAS over time          |

### Secondary KPIs

| Metric                  | Target                                     | Notes                                         |
|-------------------------|--------------------------------------------|-----------------------------------------------|
| TTR (Tap-through rate, ASA) | 5% – 15%                              | Below 5% = creative/listing mismatch         |
| Cost per Trial Start    | 2x – 4x CPI                               | Trial-to-paid conversion determines success   |
| Cost per Subscription   | Target ≤ 40% of LTV                        | Sustainable acquisition economics            |
| Re-engagement CPI       | 50% – 70% of new-user CPI                 | Cheaper to re-engage; but volume is limited  |
| App Store Conversion Rate | 50% – 80% (click to install from ASA)   | Store listing quality directly impacts         |

### Attribution for Mobile

Post-iOS 14 attribution is fragmented. Best approach:
- **MMP (Mobile Measurement Partner)**: AppsFlyer, Adjust, Branch — required for multi-platform attribution
- **SKAN**: Apple's privacy-preserving attribution; limited signal (conversion values 0–63)
- **Modeled attribution**: Meta and Google both model iOS installs; treat as directional
- **Incrementality testing**: Geo holdout experiments provide most reliable ROI signal for large budgets ($50K+/mo)
