import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini API client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('Warning: GEMINI_API_KEY is not defined in the environment.');
}
const ai = new GoogleGenAI({ apiKey });

export async function POST(req: NextRequest) {
  try {
    const { documentText, question, history } = await req.json();

    if (!documentText) {
      return NextResponse.json({ error: 'No document context provided' }, { status: 400 });
    }
    if (!question) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 });
    }

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
    // Each element is { role: 'user' | 'model', parts: [{ text: string }] }
    chatHistory.forEach((msg: any) => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || msg.text || '' }],
      });
    });

    // For the current query, we provide the document context alongside the question.
    // If it's the first message, we embed the document context. If history exists, we can still provide the context or keep it in the first message.
    // To ensure the model always has reference to the document even after multiple messages, we append the document text at the end or refer to it.
    const contextPrompt = `Document Content:
"""
${documentText}
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
