export interface DraftEvalFixture {
  company: string;
  url: string;
  context: string;
}

export const DRAFT_EVAL_FIXTURES: readonly DraftEvalFixture[] = [
  {
    company: 'Fellow',
    url: 'https://fellow.app',
    context:
      'Fellow sells meeting productivity software for managers and revenue teams. The context pack includes homepage messaging, meeting workflow claims, and gaps around market size, competitor pricing, and verbatim buyer language.',
  },
  {
    company: 'Airtable',
    url: 'https://airtable.com',
    context:
      'Airtable sells a collaborative app platform for operations teams. The context pack includes product positioning, template use cases, and gaps around ICP density, switching stories, intent demand, and channel performance proof.',
  },
];
