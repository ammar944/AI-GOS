---
name: Old Onboarding Wizard (Main Branch)
description: Complete structure of the step-based wizard UI that existed on main branch before v2 journey redesign
type: reference
---

# Old Onboarding Wizard Structure (Main Branch)

## Overview
The old onboarding wizard on `main` branch is a **step-by-step form wizard** with 9 sequential steps, horizontal progress tracking, and back/forward navigation. This is the predecessor to the current conversational chat-based journey interface on the `redesign/v2-command-center` branch.

**Key Difference from V2**: V2 is conversational (chat agent), old wizard is structured/linear (step-by-step form).

---

## 9-Step Architecture

### Steps (in order)
1. **Business Basics** - Company name, website URL
2. **ICP (Ideal Customer Profile)** - Industry, job titles, company size, geography, buying triggers, best channels
3. **Product & Offer** - Pricing model, funnel type, features, benefits
4. **Market & Competition** - TAM, competitors, competitive advantages
5. **Customer Journey** - Customer stages, pain points, messaging
6. **Brand & Positioning** - Brand voice, positioning statement, differentiators
7. **Assets & Proof** - Case studies, testimonials, certifications
8. **Budget & Targets** - Monthly budget, monthly/annual targets, payback period tolerance
9. **Compliance** - Industry certifications, regulations, data privacy

### Step Configuration (9 items)
**File**: `src/components/onboarding/onboarding-wizard.tsx` (lines 51-96)

```typescript
const STEPS: {
  id: OnboardingStep;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
}[] = [
  { id: "business_basics", title: "Business Basics", shortTitle: "Business", icon: <Building2 /> },
  { id: "icp", title: "Ideal Customer", shortTitle: "ICP", icon: <Users /> },
  { id: "product_offer", title: "Product & Offer", shortTitle: "Product", icon: <Package /> },
  { id: "market_competition", title: "Market & Competition", shortTitle: "Market", icon: <TrendingUp /> },
  { id: "customer_journey", title: "Customer Journey", shortTitle: "Journey", icon: <Route /> },
  { id: "brand_positioning", title: "Brand & Positioning", shortTitle: "Brand", icon: <Sparkles /> },
  { id: "assets_proof", title: "Assets & Proof", shortTitle: "Assets", icon: <FileCheck /> },
  { id: "budget_targets", title: "Budget & Targets", shortTitle: "Budget", icon: <Target /> },
  { id: "compliance", title: "Compliance", shortTitle: "Compliance", icon: <Shield /> },
];
```

---

## Main Component: OnboardingWizard

**File**: `src/components/onboarding/onboarding-wizard.tsx` (880 lines)

### Props Interface
```typescript
interface OnboardingWizardProps {
  initialData?: Partial<OnboardingFormData>;
  initialStep?: number;              // Resume from step N
  onComplete: (data: OnboardingFormData) => void;
  onStepChange?: (step: number, data: Partial<OnboardingFormData>) => void;
}
```

### State Management
```typescript
const [currentStep, setCurrentStep] = useState(startStep);
const [completedSteps, setCompletedSteps] = useState<Set<number>>();  // Tracks which steps user hit "Continue" on
const [highestStepReached, setHighestStepReached] = useState(startStep);  // Max step user navigated to
const [formData, setFormData] = useState<OnboardingFormData>();
const progress = ((currentStep + 1) / STEPS.length) * 100;  // For progress bar
```

### Navigation Methods
```typescript
goToNextStep()      // Mark current as completed, advance
goToPreviousStep()  // Go back (no "undo" of completion)
goToStep(stepIndex) // Jump to any step <= highestStepReached
```

### Form Data Updates
```typescript
updateFormData<K>(section: K, data: OnboardingFormData[K])
bulkUpdateFormData(prefilled: Partial<OnboardingFormData>)  // AI prefill
clearAllFields()    // Reset to defaults
```

---

## UI Layout

### Progress Header (Lines 355-435)
Two distinct sections:

#### 1. **Step Counter + Progress Bar**
```
Step 1 of 9                                      25% complete
[======>                                      ]
```
- Linear gradient blue progress bar (SaaSLaunch theme: `rgb(54, 94, 255)`)
- Animated with `motion.div` (Framer Motion)

#### 2. **Desktop Step Indicators** (md:block, hidden on mobile)
Horizontal stepper with:
- **Step circles** with icons (Building2, Users, Package, etc.)
- **Connector lines** between steps (blue when completed, gray when pending)
- **Animations**: Current step pulses, completed steps show checkmarks
- **Click to navigate**: Can jump to any visited step (up to highestStepReached)
- **Visual states**:
  - **isCurrentNew** (white): First time at this step
  - **isCurrentRevisiting** (blue): Went back to a previous step
  - **showCheckmark** (blue): Completed, moved past it
  - **isVisitedAhead** (blue): Jumped forward, now back to it
  - **isFuture** (gray): Not yet reached

#### 3. **Mobile Step Indicators** (md:hidden)
Horizontal scrollable pill buttons:
- Current step name + "Step X of 9"
- Horizontal scroll if >5 steps
- Gradient fade on right edge to show scrollability
- Same click-to-navigate behavior as desktop

### Form Card (Lines 437-451)
Wrapped in `GradientBorder` component:
- Animated entry with Framer Motion `fadeUp` variant
- Dark background: `var(--bg-elevated)`
- 6px-8px padding

---

## Step Components (9 files)

Each step is a separate component with same pattern:

**File**: `src/components/onboarding/step-{name}.tsx`

### Step Component Pattern
```typescript
interface StepProps {
  initialData?: Partial<{SectionData}>;
  onSubmit: (data: {SectionData}) => void;  // Called when user hits "Continue"
  onBack?: () => void;
  wizardFormData?: OnboardingFormData;       // Full wizard state (for context)
  onPrefillAll?: (data: Partial<OnboardingFormData>) => void;  // AI prefill
  onClearAll?: () => void;  // Clear all fields (Step 1 only)
}
```

### Step Components List
| Step | File | Key Fields |
|------|------|-----------|
| 1 | step-business-basics.tsx | businessName, websiteUrl |
| 2 | step-icp.tsx | primaryIcpDescription, industryVertical, jobTitles, companySize[], geography, bestClientSources[] |
| 3 | step-product-offer.tsx | pricingModel, funnelType, keyFeatures[], benefits[] |
| 4 | step-market-competition.tsx | tam, competitors, competitiveAdvantages |
| 5 | step-customer-journey.tsx | stages[], painPoints[], messaging |
| 6 | step-brand-positioning.tsx | brandVoice, positioningStatement, differentiators |
| 7 | step-assets-proof.tsx | caseStudies[], testimonials[], certifications[] |
| 8 | step-budget-targets.tsx | monthlyBudget, monthlyTargets, annualTargets, paybackPeriod |
| 9 | step-compliance.tsx | certifications[], regulations[], dataPrivacy |

### Step 1 Unique Features
**File**: `src/components/onboarding/step-business-basics.tsx`

- **AutoFillPanel** component
- **DocumentUploadPanel** component for CSV/DOC prefill
- **"Clear all fields" button** (only on Step 1)

---

## Integration Points

### Entry Routes
- `/onboarding` - Redirects based on status (auth → complete → /dashboard OR → /onboarding/edit)
- `/onboarding/edit` - Edit existing profile with wizard (shows Step 1 onward)

**File**: `src/app/onboarding/edit/page.tsx` (server component)
**File**: `src/app/onboarding/edit/client.tsx` (client wrapper)

### Client Component (EditOnboardingClient)
```typescript
// src/app/onboarding/edit/client.tsx
export function EditOnboardingClient({ initialData }: Props) {
  const handleStepChange = async (step: number, data: OnboardingFormData) => {
    // Persist to Supabase on each step
    await persistOnboardingData({
      businessBasics, icpData, productOffer, ...
      currentStep: Math.min(step + 1, 8)  // Save resume position
    });
  };

  const handleComplete = (data: OnboardingFormData) => {
    saveOnboardingData(data);  // Save to localStorage
    router.push("/generate");  // Redirect to blueprint generation
  };

  return <OnboardingWizard initialData={initialData} onComplete={handleComplete} />;
}
```

### Persistence
- **Supabase** (`user_profiles.onboarding_data`): Full form data + `currentStep` for resume
- **localStorage**: Saved when wizard completes

---

## Type System

**File**: `src/lib/onboarding/types.ts`

### Core Type
```typescript
export type OnboardingStep = 
  | "business_basics"
  | "icp"
  | "product_offer"
  | "market_competition"
  | "customer_journey"
  | "brand_positioning"
  | "assets_proof"
  | "budget_targets"
  | "compliance";

export interface OnboardingFormData {
  businessBasics: BusinessBasicsData;
  icp: ICPData;
  productOffer: ProductOfferData;
  marketCompetition: MarketCompetitionData;
  customerJourney: CustomerJourneyData;
  brandPositioning: BrandPositioningData;
  assetsProof: AssetsProofData;
  budgetTargets: BudgetTargetsData;
  compliance: ComplianceData;
}

export const DEFAULT_ONBOARDING_DATA: OnboardingFormData = { /* all sections with empty defaults */ };
```

---

## Supporting Components

### JourneyStepper (Different from Wizard Stepper)
**File**: `src/components/journey/journey-stepper.tsx`

Simple 4-phase progress (Discovery → Validation → Strategy → Launch):
```typescript
type StepperPhase = 'discovery' | 'validation' | 'strategy' | 'launch';

// Renders as dots with labels (simpler than wizard stepper)
```
**Used in**: Dashboard/generation flow (not the wizard itself).

---

## Key Features

### 1. **Smart Step Navigation**
- Can ONLY jump forward to steps you've already reached (`highestStepReached`)
- Can go BACK unlimited times without losing progress
- Completed steps marked with checkmarks
- Revisiting step shows blue highlight (not white like new steps)

### 2. **AI Prefill**
- **AutoFillPanel** (Step 1): Ask Claude to fill all 9 steps from website URL
- **Result**: `bulkUpdateFormData()` merges AI response into current data (only non-empty values)
- **Per-step suggestions**: Separate endpoint `POST /api/onboarding/suggest` (Perplexity for research, Claude for analysis)

### 3. **Document Upload**
- **DocumentUploadPanel** (Step 1): Upload CSV/DOC for bulk prefill
- Extracted with `POST /api/onboarding/extract-document`

### 4. **Persistent Resume**
- Saves `currentStep` to Supabase after each step
- User can close, leave, return → wizard resumes at exact step
- `initialStep` prop passed from server-side data fetch

### 5. **SaaSLaunch Design Token**
- Colors: `rgb(54, 94, 255)` (primary blue), `rgb(20, 23, 30)` (background)
- Font: `var(--font-sans)` (body), `var(--font-heading)` (headings)
- Animations: Framer Motion `fadeUp`, `staggerContainer`

---

## Migration to V2 (Journey Chat)

The old wizard was **fully replaced** with conversational journey on `redesign/v2-command-center`:

| Old (Wizard) | New (Journey Chat) |
|---|---|
| 9-step structured form | Conversational chat (asks questions as needed) |
| "Continue" button flow | Natural language back-and-forth |
| Wizard stepper UI | `JourneyStepper` (4 phases: discovery/validation/strategy/launch) |
| Per-step AI suggestions | Per-request system prompt injection |
| Supabase `user_profiles.onboarding_data` | Supabase `journey_sessions` table |
| `/onboarding/edit` route | `/journey` route with chat UI |

---

## Files Changed/Removed on V2

- **Wizard component**: Still exists on main, NOT imported on redesign branch
- **Step components**: All 9 files exist on main, removed on v2 branch
- **Types**: `src/lib/onboarding/types.ts` exists on main (comprehensive), v2 uses different schema
- **Routes**: `/onboarding/edit` exists on main; v2 has `/journey` instead
- **Hooks**: `src/hooks/use-onboarding.ts`, `use-step-suggestion.ts` on main; v2 uses different hooks

---

## Confidence Level
**HIGH** — Traced full component tree, read TypeScript interfaces, confirmed step configuration and navigation logic in source code.
