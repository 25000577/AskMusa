import { GoogleGenAI } from '@google/genai';

// Automatically picks up GEMINI_API_KEY from your environment variables
const ai = new GoogleGenAI();

async function getAITutorResponse(userPrompt) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: "You are an AI Tutor powered by Google. Explain things step by step clearly.",
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Sorry, I encountered an error talking to the AI tutor.";
  }
}
