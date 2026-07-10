import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = file.name;
    const fileType = file.type;

    let extractedText = '';

    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      const parser = new PDFParse({ data: buffer });
      const parsedData = await parser.getText();
      extractedText = parsedData.text;
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (
      fileType === 'text/plain' ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md')
    ) {
      extractedText = buffer.toString('utf-8');
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF, DOCX, TXT, or MD file.' },
        { status: 400 }
      );
    }

    // Clean up extracted text (remove excessive empty lines)
    const cleanedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanedText) {
      return NextResponse.json(
        { error: 'No text content could be extracted from the file. Make sure it is not empty or scanned without OCR.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: cleanedText,
      fileName,
      wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
    });
  } catch (error: any) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process document' },
      { status: 500 }
    );
  }
}
