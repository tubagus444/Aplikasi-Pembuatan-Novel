import { GoogleGenAI } from "@google/genai";
import { AIRenderParams } from "./types";

const MAX_HISTORY_TURNS = 10;

export async function callGemini(params: AIRenderParams, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  const history = params.history || [];
  const cleanedHistory = history.slice(-MAX_HISTORY_TURNS);

  const mappedContents = [
    ...cleanedHistory.map(c => ({ 
      role: c.role === 'model' ? 'model' : 'user', 
      parts: [{ text: c.parts[0].text }] 
    })), 
    { role: 'user', parts: [{ text: params.userPrompt }] }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: mappedContents,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature || 0.7,
      maxOutputTokens: params.maxTokens || 4000,
    },
  });
  
  return response.text || '';
}
