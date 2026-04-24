import type { ReactElement } from 'react';
import { GTM_ONBOARDING_QUESTIONNAIRE, type GtmOnboardingItem } from '@/lib/gtm/onboarding/questionnaire';

function renderQuestionItem(item: GtmOnboardingItem, sectionId: string): ReactElement {
  if (item.kind === 'subheading') {
    return (
      <h3 key={`${sectionId}-${item.text}`} className="pt-4 text-sm font-semibold text-foreground">
        {item.text}
      </h3>
    );
  }

  return (
    <div key={item.id} className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium leading-6 text-foreground">{item.prompt}</p>
        {item.optional ? (
          <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            Optional
          </span>
        ) : null}
      </div>
      {item.options ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.options.map((option) => (
            <span
              key={option}
              className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              {option}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function GtmPage(): ReactElement {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-8">
        <header className="border-b border-border pb-6">
          <p className="text-sm font-medium text-muted-foreground">GTM Brief Intake</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">AIGOS onboarding flow</h1>
        </header>

        <div className="grid gap-6">
          {GTM_ONBOARDING_QUESTIONNAIRE.map((section, index) => {
            const existingFieldChanges = 'existingFieldChanges' in section ? section.existingFieldChanges : undefined;

            return (
              <section key={section.id} className="border-t border-border py-8">
                <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6">
                  <div>
                    <div className="flex items-start gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div>
                        <h2 className="text-xl font-semibold tracking-normal text-foreground">{section.heading}</h2>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">{section.title}</p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{section.goal}</p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3">
                      {section.items.map((item) => renderQuestionItem(item, section.id))}
                    </div>

                    {existingFieldChanges ? (
                      <div className="mt-5 rounded-lg border border-border bg-background p-4">
                        <h3 className="text-sm font-semibold text-foreground">Existing fields changes</h3>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                          {existingFieldChanges.map((change) => (
                            <li key={change}>{change}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <aside className="rounded-lg border border-border bg-background p-4">
                    <h3 className="text-sm font-semibold text-foreground">Why this is the perfect setup</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                      {section.whyThisSetupWorks.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>

                    <h3 className="mt-5 text-sm font-semibold text-foreground">What it unlocks</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                      {section.unlocks.map((unlock) => (
                        <li key={unlock}>{unlock}</li>
                      ))}
                    </ul>
                  </aside>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
