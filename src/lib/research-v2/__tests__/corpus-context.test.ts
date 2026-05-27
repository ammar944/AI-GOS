import { describe, expect, it } from "vitest";

import { buildCorpusContext } from "../corpus-context";

describe("buildCorpusContext", (): void => {
  it("includes uploaded document text before corpus dispatch", (): void => {
    const context = buildCorpusContext({
      websiteUrl: "https://www.airtable.com/",
      uploadedDocuments: [
        {
          id: "doc_1",
          fileName: "sales-call.transcript.txt",
          docKind: "client_briefing",
          sectionTags: ["positioningBuyerICP", "positioningCustomerPain"],
          tokenCount: 72,
          parsedMarkdown:
            "The sales call transcript says buyers ask for implementation governance and clear workflow ownership.",
        },
      ],
    });

    expect(context).toContain("websiteUrl: https://www.airtable.com/");
    expect(context).toContain("## Uploaded documents");
    expect(context).toContain("sales-call.transcript.txt");
    expect(context).toContain("implementation governance");
  });
});
