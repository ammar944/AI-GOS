// Type declaration for pdf-parse/lib/pdf-parse.js
// The main index.js has a debug wrapper that reads test files on import,
// so we import the underlying parser directly.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    text: string;
    version: string | null;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;

  export = pdfParse;
}
