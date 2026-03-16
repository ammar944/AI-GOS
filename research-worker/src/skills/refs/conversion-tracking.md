# Conversion Tracking Implementation Guide

> Source: Google Ads Help, Meta Business Help Center, LinkedIn Campaign Manager, GA4 documentation
> (2024–2025). Implementation details may change — always reference official platform docs.

---

## Google Ads Conversion Tracking

### Setup Overview

Google Ads conversion tracking requires two components:
1. **Global site tag (gtag.js)** or **Google Tag Manager (GTM)** — fires on every page
2. **Event snippet** — fires on the specific conversion event (thank-you page, button click, form submit)

### Conversion Action Types

| Type                   | Use Case                                     | Implementation Method                        |
|------------------------|----------------------------------------------|----------------------------------------------|
| Website (page view)    | Thank-you / confirmation page                | Event snippet on destination URL             |
| Website (click)        | Button click, form submit, download          | Tag Manager trigger on click event           |
| Phone calls (from ads) | Click-to-call from search ads                | Auto via Google forwarding number             |
| Phone calls (on site)  | Dynamic number insertion on website          | Google tag + phone snippet                   |
| App installs           | Mobile app downloads                         | Firebase + Google Analytics integration       |
| Import from GA4        | GA4 goals imported into Google Ads           | Link GA4 property in Google Ads settings     |

### Implementation: Thank-You Page Conversion

```html
<!-- Place global site tag in <head> of every page -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-CONVERSION_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-CONVERSION_ID');
</script>

<!-- Place event snippet on thank-you page only -->
<script>
  gtag('event', 'conversion', {
    'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL',
    'value': 1.0,        // Optional: order value
    'currency': 'USD',   // Optional: currency
    'transaction_id': '' // Optional: order ID for dedup
  });
</script>
```

### Enhanced Conversions

Enhanced conversions send hashed first-party data (email, phone, name) with conversion events for better matching after iOS 14 / privacy changes.

- **Setup**: Enable in Google Ads > Tools > Conversions > Enhanced conversions
- **Data**: Hash user-provided data with SHA-256 before sending
- **Impact**: Typically recovers 5–15% of unattributed conversions

### Google Ads Conversion Settings

| Setting              | Recommended Value                                         |
|----------------------|-----------------------------------------------------------|
| Attribution model    | Data-driven (if ≥ 300 conv/month); else last-click        |
| Conversion window    | 30 days for lead gen; 7–30 days for e-commerce            |
| View-through window  | 1 day for display; 3 days for video                       |
| Count                | "One" for lead gen (one lead per click); "Every" for purchase |
| Primary vs. secondary| Primary = bidding signal; Secondary = reporting only      |

---

## Meta Pixel & Conversions API (CAPI)

### Meta Pixel Setup

The Meta Pixel is a JavaScript snippet placed in the `<head>` of every page. It tracks:
- PageView (automatic)
- Standard events (manually triggered)
- Custom events (manually triggered)

```html
<!-- Meta Pixel Base Code — place in <head> of all pages -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'PIXEL_ID');
fbq('track', 'PageView');
</script>
```

### Standard Meta Events

| Event Name            | Trigger                                              | Parameters (key ones)                          |
|-----------------------|------------------------------------------------------|------------------------------------------------|
| `PageView`            | Every page load (automatic with base code)          | —                                              |
| `ViewContent`         | Product/service page view                           | `content_ids`, `content_type`, `value`         |
| `Search`              | Site search performed                               | `search_string`                                |
| `AddToCart`           | Product added to cart                               | `content_ids`, `value`, `currency`             |
| `InitiateCheckout`    | User begins checkout                                | `num_items`, `value`, `currency`               |
| `AddPaymentInfo`      | Payment information entered                         | `value`, `currency`                            |
| `Purchase`            | Transaction completed                               | `value`, `currency`, `order_id`                |
| `Lead`                | Form submission / sign-up                           | `value`, `currency`                            |
| `CompleteRegistration`| Registration form completed                        | `status`                                       |
| `Contact`             | Contact form / phone call                           | —                                              |
| `Schedule`            | Appointment booked                                  | —                                              |
| `Subscribe`           | Newsletter / subscription sign-up                  | `value`, `predicted_ltv`                       |
| `StartTrial`          | Free trial initiated                                | `value`, `predicted_ltv`, `currency`           |

### Conversions API (CAPI)

Server-side event sending that bypasses browser-based signal loss (ITP, ad blockers, iOS restrictions). Redundant with Pixel for deduplication.

**Implementation approach**:
1. Send events from your server (not browser) directly to Meta's Graph API
2. Include `event_id` parameter in both Pixel and CAPI calls — Meta deduplicates automatically
3. Pass as much first-party data as possible: `em` (hashed email), `ph` (hashed phone), `fbc`, `fbp`

**Deduplication**: Use identical `event_id` in both Pixel and CAPI. Meta counts the event once.

**Match quality**: Meta provides a "match quality" score (0–10) for CAPI events. Aim for 6+. Include `em`, `ph`, `fbc`, `external_id` to improve score.

**CAPI Gateway / Partner Integration**: Meta offers CAPI via partners (Shopify, Segment, etc.) for easier implementation without direct API coding.

---

## LinkedIn Insight Tag

### Setup

Single JavaScript tag placed on all pages of your website. Enables:
- Website demographics (company size, industry, job title of visitors)
- Conversion tracking
- Retargeting audiences (LinkedIn matched audiences)

```html
<!-- LinkedIn Insight Tag — place in <head> or <body> of all pages -->
<script type="text/javascript">
_linkedin_partner_id = "YOUR_PARTNER_ID";
window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
window._linkedin_data_partner_ids.push(_linkedin_partner_id);
</script><script type="text/javascript">
(function(l) {
if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
window.lintrk.q=[]}
var s = document.getElementsByTagName("script")[0];
var b = document.createElement("script");
b.type = "text/javascript";b.async = true;
b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
s.parentNode.insertBefore(b, s);})(window.lintrk);
</script>
```

### LinkedIn Conversion Tracking

| Type                   | Implementation                                       |
|------------------------|------------------------------------------------------|
| URL-based              | Fires when user visits a specific URL (thank-you page) |
| Event-specific         | JavaScript `window.lintrk('track', { conversion_id: ID })` |
| Lead Gen Form submit   | Automatic within LinkedIn — no code required         |

---

## GA4 Event Tracking

### GA4 Measurement Model

GA4 uses an event-based model (vs. session-based UA). Every interaction is an event.

### Automatic Events (No Code)

| Event                  | Trigger                                              |
|------------------------|------------------------------------------------------|
| `page_view`            | Every page load                                      |
| `first_visit`          | First time user visits                               |
| `session_start`        | Start of a new session                               |
| `scroll`               | User scrolls 90% of page                             |
| `click`                | Outbound link clicks                                 |
| `video_start/complete` | YouTube embedded videos                              |
| `file_download`        | PDF, XLS, DOC, etc. link clicks                      |

### Enhanced Measurement Events (Toggle in GA4 settings)

| Event                    | Trigger                                            |
|--------------------------|----------------------------------------------------|
| `scroll`                 | 90% page depth                                     |
| `outbound_click`         | Links to external domains                          |
| `site_search`            | Site search queries                                |
| `video_engagement`       | YouTube embedded video progress                    |
| `file_download`          | File link clicks                                   |
| `form_interaction`       | Form starts/submits (if using standard form elements)|

### Recommended Custom Events for Lead Gen

```javascript
// Form submission
gtag('event', 'generate_lead', {
  'currency': 'USD',
  'value': 50,    // Estimated lead value
  'form_name': 'demo_request'
});

// Free trial signup
gtag('event', 'sign_up', {
  'method': 'email',
  'plan_type': 'free_trial'
});

// Demo booked (Calendly / booking widget)
gtag('event', 'schedule', {
  'event_type': 'demo',
  'value': 200
});
```

### GA4 → Google Ads Import

1. Link GA4 property in Google Ads (Tools → Data Manager → GA4)
2. Import GA4 conversion events into Google Ads as conversion actions
3. Set GA4 conversions as "Primary" or "Secondary" in Google Ads
4. GA4 attribution model applies to imported conversions

---

## UTM Parameter Standards

UTM parameters are the universal attribution layer across all platforms and analytics tools.

### UTM Parameter Definitions

| Parameter        | Purpose                                    | Example Values                              |
|------------------|--------------------------------------------|---------------------------------------------|
| `utm_source`     | Platform / origin                          | `google`, `facebook`, `linkedin`, `email`  |
| `utm_medium`     | Channel type                               | `cpc`, `paid_social`, `email`, `organic`   |
| `utm_campaign`   | Campaign name / theme                      | `brand-search-q1-2025`, `retarget-30day`   |
| `utm_content`    | Ad variant / creative differentiator       | `headline-a`, `video-15s`, `carousel-1`    |
| `utm_term`       | Keyword (Search ads)                       | `crm-software`, `best-accounting-app`       |

### UTM Naming Convention

Use a consistent naming convention across all campaigns. Recommended format:

```
utm_source: [platform] — google | facebook | instagram | linkedin | tiktok | email
utm_medium: [channel] — cpc | paid_social | display | video | email | organic
utm_campaign: [brand/product]-[objective]-[audience]-[period]
utm_content: [format]-[variant]
utm_term: [keyword] (Google Search only; auto-populated with ValueTrack)
```

**Example URLs:**
- Google Search: `?utm_source=google&utm_medium=cpc&utm_campaign=saas-demo-cold-q1&utm_content=rsa-v1&utm_term={keyword}`
- Meta Prospecting: `?utm_source=facebook&utm_medium=paid_social&utm_campaign=saas-demo-cold-q1&utm_content=video-30s-a`
- LinkedIn Retargeting: `?utm_source=linkedin&utm_medium=paid_social&utm_campaign=saas-demo-retarget-30d&utm_content=carousel-casestudy`

### ValueTrack Parameters (Google Ads — auto-populated)

| Parameter             | What It Inserts                                  |
|-----------------------|--------------------------------------------------|
| `{keyword}`           | The keyword that triggered the ad                |
| `{matchtype}`         | Match type: e, p, b (exact, phrase, broad)       |
| `{adposition}`        | Ad position on page                              |
| `{device}`            | Device: m, t, c (mobile, tablet, computer)       |
| `{network}`           | Network: g, s, d (search, partners, display)     |
| `{campaignid}`        | Numeric campaign ID                              |
| `{adgroupid}`         | Numeric ad group ID                              |
| `{creative}`          | Numeric ad ID                                    |

---

## Attribution Models Comparison

| Model              | How It Works                                    | Best For                               | Limitation                               |
|--------------------|-------------------------------------------------|----------------------------------------|------------------------------------------|
| Last-click         | 100% credit to last touchpoint before conversion| Understanding bottom-funnel channels   | Ignores awareness/consideration phase    |
| First-click        | 100% credit to first touchpoint                 | Understanding discovery channels       | Ignores nurture and closing touchpoints  |
| Linear             | Equal credit to all touchpoints                 | Balanced view of customer journey      | Does not weight by influence             |
| Time-decay         | More credit to touchpoints closer to conversion | Short sales cycles                     | De-values early awareness too aggressively|
| Position-based     | 40% first, 40% last, 20% middle                 | When both acquisition and close matter | Arbitrary weighting                      |
| Data-driven        | ML-based; credit proportional to incremental lift| Best accuracy (requires volume)       | Requires ≥ 300 conversions/month per action|

### Attribution Recommendation by Stage

| Account Maturity    | Recommended Model                                         |
|---------------------|-----------------------------------------------------------|
| New account (< 100 conv/mo) | Last-click — most predictable for optimization |
| Growing (100–300 conv/mo)   | Position-based or time-decay                   |
| Mature (300+ conv/mo)       | Data-driven attribution                        |
| Multi-touch reporting       | Use GA4 path reports alongside platform data   |

> **Important**: Never compare CPA across platforms using different attribution windows. Align all
> platforms to the same window (e.g., 7-day click) for apple-to-apple comparison. Platform-native
> attribution always over-counts vs. GA4 (de-duplicated) view.
