import {
  buildUploadedDocumentContextBlock,
  type UploadedDocumentContext,
} from "./uploaded-document-context";

export function buildCorpusContext({
  uploadedDocuments = [],
  websiteUrl,
}: {
  uploadedDocuments?: readonly UploadedDocumentContext[];
  websiteUrl: string;
}): string {
  const baseContext = `websiteUrl: ${websiteUrl}\nWebsite: ${websiteUrl}`;
  const uploadedDocumentContext =
    buildUploadedDocumentContextBlock(uploadedDocuments);

  return uploadedDocumentContext
    ? `${baseContext}\n\n${uploadedDocumentContext}`
    : baseContext;
}
