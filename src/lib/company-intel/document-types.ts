// Document Upload Configuration
// Defines supported document types, MIME types, and parsing constraints

export type DocumentType = 'niche_demographic' | 'client_briefing';

export interface DocumentTypeConfig {
  label: string;
  description: string;
  acceptedMimeTypes: string[];
  acceptedExtensions: string[];
  maxFileSizeBytes: number;
}

export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, DocumentTypeConfig> = {
  niche_demographic: {
    label: 'Niche & Demographic Document',
    description: 'Strategic context document covering ICP, market analysis, competitive landscape, and positioning (20-40+ pages)',
    acceptedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ],
    acceptedExtensions: ['.pdf', '.docx', '.txt', '.md'],
    maxFileSizeBytes: 3 * 1024 * 1024, // 3MB (stays under Vercel 4.5MB after base64)
  },
  client_briefing: {
    label: 'Client Briefing Sheet',
    description: 'Execution details covering budget, targets, assets, compliance, and campaign specifics',
    acceptedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ],
    acceptedExtensions: ['.pdf', '.docx', '.txt', '.md'],
    maxFileSizeBytes: 3 * 1024 * 1024,
  },
};

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  wordCount: number;
  fileName: string;
  fileType: string;
}

export const ACCEPTED_FILE_EXTENSIONS = '.pdf,.docx,.txt,.md';
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];
