import { GoogleGenAI } from "@google/genai";
import { AIRenderParams } from "./types";

export async function callGemini(params: AIRenderParams, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  
  const mappedContents = params.history 
    ? [...params.history.map(c => ({ role: c.role, parts: [{ text: c.parts[0].text }] })), { role: 'user', parts: [{ text: params.userPrompt }] }]
    : [{ role: 'user', parts: [{ text: params.userPrompt }] }];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: mappedContents,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: params.temperature || 0.7,
    },
  });
  
  return response.text || '';
}
