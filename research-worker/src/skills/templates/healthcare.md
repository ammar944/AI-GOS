# Healthcare / Medical Media Plan Template

> Source: Industry benchmark aggregates (2024–2025). Applies to healthcare providers,
> medical practices, telehealth platforms, medical devices, and healthcare SaaS.
> COMPLIANCE NOTE: Healthcare advertising carries significant legal and platform-policy risk.
> Always involve legal and compliance review before campaign launch.

---

## Compliance Requirements (Read First)

### HIPAA Compliance for Digital Advertising

- **Retargeting restriction**: Do NOT retarget based on health condition data. Pages that reveal a medical condition (e.g., "diabetes treatment," "depression therapy") should be excluded from retargeting pixel activation or the audience should not be used for targeting.
- **Meta pixel**: Transmitting health data (condition, symptoms, medications) via Meta Pixel may violate HIPAA. Use CAPI with PHI scrubbing or consult healthcare-specialized HIPAA-compliant pixel vendors.
- **Email retargeting**: Patient email lists cannot be shared with ad platforms without explicit HIPAA authorization from patients.
- **Google Customer Match**: Patient data requires BAA with Google before use.

### Ad Copy Restrictions

- No guaranteed outcomes ("cure," "eliminate," "fix")
- No before/after imagery implying guaranteed results
- "Individual results may vary" required for outcome claims
- No FDA drug claims without proper labeling
- Mental health ads: Cannot suggest diagnosis or treatment of clinical conditions without physician involvement
- Disability-related targeting is prohibited on Meta

### Special Ad Categories

- Some healthcare subcategories trigger Meta Special Ad Categories (see compliance.md)
- Google may require LegitScript certification for certain pharmaceutical, addiction treatment, or telehealth advertisers
- Pregnancy, fertility, and mental health categories have additional restrictions on Meta

---

## Platform Mix

| Platform           | Budget Share | Role                                              | Priority |
|--------------------|--------------|---------------------------------------------------|----------|
| Google Search      | 40% – 55%    | High-intent symptoms/conditions/service search    | Primary  |
| Meta Ads (FB/IG)   | 20% – 30%    | Awareness; condition-adjacent interest targeting  | Secondary|
| Google Display     | 10% – 15%    | Condition-adjacent content placement; retargeting | Secondary|
| YouTube            | 5% – 10%     | Educational video content; trust building         | Support  |
| LinkedIn           | 5% – 10%     | HCP (healthcare professional) targeting           | Support  |

**Adjust for vertical:**
- Direct-to-patient (telehealth, consumer health): Google Search + Meta dominant
- B2B medical device / health IT: LinkedIn primary (HCP + hospital admin targeting)
- Hospital / health system: Google Search + YouTube + Display for regional awareness

---

## Campaign Architecture

### Google Ads Structure

```
Account
├── Campaign: Brand Search
│   └── Ad Group: Practice/Brand name terms
│
├── Campaign: Condition / Symptom Search
│   ├── Ad Group: [Primary condition] treatment
│   ├── Ad Group: [Primary condition] doctor / specialist
│   ├── Ad Group: [Symptom] symptoms / what to do
│   └── Ad Group: [Condition] near me / in [city]
│
├── Campaign: Service Type Search
│   ├── Ad Group: [Specialty] doctor / clinic
│   ├── Ad Group: Telehealth / online appointment
│   └── Ad Group: Insurance-accepted options
│
└── Campaign: Remarketing (HIPAA-safe segments only)
    └── Ad Group: General website visitors (homepage only; NOT condition pages)
```

**HIPAA-safe retargeting approach**: Only retarget from pages that do NOT reveal a health condition (homepage, about, insurance, contact). Exclude condition-specific pages from remarketing audiences.

### Meta Ads Structure

```
Account
├── Campaign: Awareness — Condition-adjacent interests
│   ├── Ad Set: Related health/wellness interests (broad)
│   └── Ad Set: Demographic targeting (age/location relevant to condition)
│
├── Campaign: Lead Generation (appointment booking)
│   ├── Ad Set: Lead gen form (appointment request)
│   └── Ad Set: Click to landing page (appointment page)
│
└── Campaign: Safe Retargeting (homepage visitors only)
    └── Ad Set: Homepage + general service page visitors (30-day)
```

**Meta Audience Restrictions for Healthcare:**
- Cannot use: Health & wellness behaviors, health-related interests that imply condition
- Can use: Age, location, general wellness interests (exercise, healthy eating)
- Cannot target or exclude based on: Disability, medical condition, health behaviors

---

## Creative Strategy

### Compliant Messaging Angles

| Angle                    | Example                                                   | Compliance Notes                          |
|--------------------------|-----------------------------------------------------------|-------------------------------------------|
| Access / convenience     | "See a doctor from home — same day appointments"         | Safe; no condition claim                  |
| Provider credentials     | "Board-certified specialists in [specialty]"             | Safe; factual credential                  |
| Insurance accessibility  | "We accept [Insurance]. No referral needed."             | Safe; removes access barrier              |
| Empathy + action         | "If you're struggling with [symptom category], help is available" | Avoid implying diagnosis |
| Cost transparency        | "Know your price before your visit"                      | Safe; addresses patient concern           |
| Speed of access          | "New patients seen within 48 hours"                      | Safe; scheduling claim                    |
| Technology / innovation  | "Virtual care with the same quality as in-person"        | Safe; service comparison                  |

### Messaging to Avoid

- "Best" without third-party substantiation
- Specific treatment claims without FDA context
- Implied diagnosis ("If you have [condition], our drug works")
- Testimonials that promise specific medical outcomes
- Celebrity endorsements implying medical efficacy

### Ad Formats

| Format                  | Use Case                                                 | Notes                                         |
|-------------------------|----------------------------------------------------------|-----------------------------------------------|
| Google RSA              | Appointment booking; service search capture             | Compliance review all headlines               |
| Meta Lead Gen Form      | Appointment requests; consultation scheduling           | Keep form simple: name, phone, insurance      |
| YouTube (pre-roll)      | Educational content; physician introduction             | Doctor-facing content builds trust            |
| Display (condition-adjacent) | Awareness on WebMD-type content sites            | Google Health-related content targeting       |
| LinkedIn Sponsored Content | HCP targeting for medical devices / pharma         | Professional context; compliance-reviewed content |

---

## Targeting Guidelines

### Google Search Keywords

**High-intent (appointment/service seeking):**
- `[specialty] doctor near me`
- `[condition] specialist [city]`
- `[service type] appointment`
- `telemedicine [condition]`
- `[insurance] accepted [specialty]`

**Informational (earlier stage — consider if awareness goal):**
- `[symptom] treatment options`
- `[condition] diagnosis`
- Use these for content/display targeting; conversion rate is lower

**Negative Keywords for Healthcare:**
- `free` (if no free consultations offered)
- `home remedy`, `natural cure`, `DIY`
- Job-seeking terms
- Research/academic terms (`clinical trial`, `study`, `research paper`)

### Meta Audience Strategy (HIPAA-Safe)

**Approvable interest clusters:**
- Healthy lifestyle, wellness, fitness, nutrition (NOT condition-specific)
- Age + location demographics aligned with patient base
- Health insurance plan holders (behavior available in US)
- Employer-sponsored health benefits interest

**Lookalike audiences:**
- Source: Patient email list (requires HIPAA authorization + BAA with Meta)
- Alternative source: Appointment page visitors (HIPAA-safe general page)
- Caution: Lookalikes based on health-condition page visitors may violate HIPAA

### LinkedIn for B2B Healthcare

For medical devices, health IT, or pharmaceutical companies targeting healthcare professionals:
- Job titles: Physician, RN, NP, PA, Hospital Administrator, CMO, CNO
- Industry: Hospitals and Healthcare, Medical Practice
- Company size: Hospital systems (500+); solo/group practices (1–200)
- Seniority: Director+ for purchasing decisions

---

## Budget Guidelines

### Minimum Monthly Budget by Healthcare Segment

| Segment                      | Minimum Monthly Budget | Notes                                          |
|------------------------------|------------------------|------------------------------------------------|
| Medical / dental practice    | $2,000 – $5,000        | Google Search + Google LSA; local geo          |
| Telehealth platform          | $10,000 – $30,000      | Google Search + Meta; multi-state              |
| Mental health / therapy      | $3,000 – $8,000        | Google Search primary; compliant Meta          |
| Medical device (B2B)         | $10,000 – $30,000      | LinkedIn dominant for HCP targeting            |
| Health / wellness app        | $5,000 – $20,000       | Google UAC + Meta; app install campaigns       |
| Hospital / health system     | $30,000+               | Multi-platform; regional brand + service lines |

### Compliance Investment

Factor into budget planning:
- Legal review of ad copy: $500 – $2,000 per campaign (one-time setup)
- HIPAA-compliant analytics implementation: $2,000 – $10,000 (if retooling pixel)
- LegitScript certification (if required): $100 – $600/yr depending on category

---

## KPI Targets

### Primary KPIs

| Metric                      | Target Range (Industry Benchmark)          | Notes                                        |
|-----------------------------|-------------------------------------------|----------------------------------------------|
| New Patient CPL             | $30 – $100 (general practice)             | Mental health / dental can reach $50–$150    |
| Appointment Booking Rate    | 20% – 50% of leads                        | Varies by specialty and response speed       |
| Show Rate (scheduled appts) | 60% – 85%                                 | Reminder sequences improve show rate         |
| Patient LTV                 | $500 – $5,000+ (specialty-dependent)      | LTV justifies higher CPL for specialty care  |
| New Patient ROAS            | 5x – 15x (first-year LTV basis)           | Multi-visit conditions have highest ROAS     |

### Secondary KPIs

| Metric                      | Target                                    | Notes                                        |
|-----------------------------|-------------------------------------------|----------------------------------------------|
| Google Rating (local SEO)   | ≥ 4.5 stars                              | Patient reviews directly impact LSA ranking  |
| CTR (Google Search)         | 3% – 7%                                  | Trust signals in copy lift CTR               |
| Form Completion Rate        | 15% – 40%                                | Shorter forms perform better                 |
| Phone Call Conversion Rate  | 40% – 70% of call clicks                 | Enable call tracking; track booked vs. lost  |

### Attribution Note

Healthcare has a longer consideration cycle than consumer purchases. Patient may search, research, call to verify insurance, then book weeks later. Multi-touch attribution important — track all touchpoints from first search to first appointment.
