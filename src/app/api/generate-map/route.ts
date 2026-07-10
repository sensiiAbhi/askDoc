import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function generateMindMap(text: string, fileName: string): Promise<any> {
  const prompt = `Analyze the following text from a document named "${fileName}" and generate an interactive mind map representing the hierarchical tree of main concepts and subtopics.
Return ONLY valid JSON that matches the following structure:
{
  "topic": "Main Subject or Document Title",
  "description": "A very brief 1-sentence description summarizing this main topic",
  "children": [
    {
      "topic": "Key Subtopic 1",
      "description": "Brief 1-sentence description of this subtopic",
      "children": [
        {
          "topic": "Important Detail A",
          "description": "Brief description of Detail A"
        },
        {
          "topic": "Important Detail B",
          "description": "Brief description of Detail B"
        }
      ]
    }
  ]
}

Limit the mind map to a maximum of 4 main subtopics, and 2-3 details per subtopic, to keep it clean, highly readable, and fit on screen. Do not include any markdown format tags like \`\`\`json or trailing commas. Output ONLY valid, parsable JSON.

Text to analyze:
${text.slice(0, 15000)}
`;

  const modelsToTry = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest'
  ];

  for (const model of modelsToTry) {
    try {
      console.log(`Attempting mind map generation with model: ${model}`);
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        if (parsed && parsed.topic) {
          console.log(`Successfully generated mind map using model: ${model}`);
          return parsed;
        }
      }
    } catch (err: any) {
      console.warn(`Model ${model} failed to generate mind map:`, err.message || err);
    }
  }

  // Fallback if all API calls fail
  console.warn('All Gemini models failed to generate mind map. Using local fallback.');
  return {
    topic: fileName.replace(/\.[^/.]+$/, ""),
    description: "Overview of the uploaded document.",
    children: [
      {
        topic: "Document Content",
        description: "Document loaded successfully. You can ask questions in the chat panel.",
        children: [
          {
            topic: "Ready",
            description: "Click here to ask: Summarize this document in 3 bullet points."
          }
        ]
      }
    ]
  };
}

export async function POST(req: NextRequest) {
  try {
    const { text, fileName } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text content provided' }, { status: 400 });
    }

    const mindMap = await generateMindMap(text, fileName || 'Document');
    return NextResponse.json({ mindMap });
  } catch (error: any) {
    console.error('Error generating mind map:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate concept map' },
      { status: 500 }
    );
  }
}
