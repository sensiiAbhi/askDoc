declare module 'mammoth' {
  export interface ParsingOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }
  export interface ParsingResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }
  export function extractRawText(options: ParsingOptions): Promise<ParsingResult>;
}
