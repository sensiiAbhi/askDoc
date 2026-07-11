import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini API client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('Warning: GEMINI_API_KEY is not defined in the environment.');
}
const ai = new GoogleGenAI({ apiKey });

function retrieveRelevantContext(documentText: string, query: string, maxTokens: number = 30000): string {
  const characterLimit = maxTokens * 4; 
  if (documentText.length <= characterLimit) {
    return documentText;
  }

  console.log(`Document text length (${documentText.length} chars) exceeds characterLimit (${characterLimit}). Applying Local RAG context retriever...`);

  // 1. Chunk document by paragraphs
  const paragraphs = documentText.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length > 2000) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmed;
    } else {
      currentChunk += (currentChunk ? "\n" : "") + trimmed;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // 2. Extract query keywords
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'to', 'of', 'in', 'for', 'or', 'about', 'from', 'this', 'that', 'these', 'those', 'with', 'by']);
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term));

  const fallbackTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);

  // 3. Score chunks
  const scoredChunks = chunks.map((chunk, index) => {
    let score = 0;
    const chunkLower = chunk.toLowerCase();

    const terms = queryTerms.length > 0 ? queryTerms : fallbackTerms;
    for (const term of terms) {
      const regex = new RegExp('\\b' + term + '\\b', 'gi');
      const matches = chunkLower.match(regex);
      if (matches) {
        score += matches.length * 2.0; 
      }
      if (chunkLower.includes(term)) {
        score += 0.5;
      }
    }

    // Boost early chunks for summary queries
    const isSummaryQuery = /summary|summarize|overview|outline|main/i.test(query);
    if (isSummaryQuery) {
      const positionFactor = Math.max(0, 1 - (index / chunks.length));
      score += positionFactor * 6.0; 
    }

    return { chunk, index, score };
  });

  // Sort by score descending
  scoredChunks.sort((a, b) => b.score - a.score);

  // Select top chunks within character limit
  const selectedChunks: typeof scoredChunks = [];
  let currentLength = 0;

  for (const item of scoredChunks) {
    if (currentLength + item.chunk.length > characterLimit) {
      if (selectedChunks.length === 0) {
        selectedChunks.push(item);
      }
      break;
    }
    selectedChunks.push(item);
    currentLength += item.chunk.length;
  }

  // Sort back to sequential reading order
  selectedChunks.sort((a, b) => a.index - b.index);

  console.log(`Local RAG: Retrieved ${selectedChunks.length} chunks out of ${chunks.length} total chunks.`);
  return selectedChunks.map(item => item.chunk).join('\n\n[...]\n\n');
}

export async function POST(req: NextRequest) {
  try {
    const { documentText, question, history } = await req.json();

    if (!documentText) {
      return NextResponse.json({ error: 'No document context provided' }, { status: 400 });
    }
    if (!question) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 });
    }

    // Retrieve relevant context to prevent free tier token overflow
    const relevantContext = retrieveRelevantContext(documentText, question);

    const systemInstruction = `You are a professional, friendly, and helpful document assistant.
Your goal is to answer questions about the uploaded document as accurately as possible.
Follow these rules:
1. Answer the question based on the provided document context.
2. If the document doesn't contain the information needed to answer the question, state that clearly (e.g., "I couldn't find information about that in the document"), but feel free to explain relevant concepts briefly if it helps clarify what is in the document.
3. Keep your answers concise, structured (use bullet points or headers if appropriate), and easy to read.
4. If the user asks for a summary of the document, provide a clean, high-level summary.`;

    const chatHistory = Array.isArray(history) ? history : [];
    
    // Prepare contents array for the request
    const contents: any[] = [];
    
    // Format conversation history to match Gemini API's expected format
    chatHistory.forEach((msg: any) => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || msg.text || '' }],
      });
    });

    const contextPrompt = `Document Content:
"""
${relevantContext}
"""

Use the above document content to answer the user's question.

Question: ${question}`;

    contents.push({
      role: 'user',
      parts: [{ text: contextPrompt }],
    });

    // Request answer from Gemini with sequential fallback support
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ];

    let response;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        console.log(`Attempting generation with model: ${model}`);
        response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.2, // Lower temperature for more factual, document-aligned answers
          }
        });
        console.log(`Successfully generated answer using model: ${model}`);
        break;
      } catch (err: any) {
        console.warn(`Model ${model} failed:`, err.message || err);
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error('All Gemini generation models failed');
    }

    const answer = response.text || "I couldn't generate an answer. Please try again.";

    return NextResponse.json({ text: answer });
  } catch (error: any) {
    console.error('Error during chat completion:', error);
    
    // Extract a clean human-readable message from Google GenAI API error
    let errorMessage = 'Failed to generate answer from Gemini';
    if (error?.message) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error?.message) {
          errorMessage = parsed.error.message;
        } else {
          errorMessage = error.message;
        }
      } catch (_) {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
