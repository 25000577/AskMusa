import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// Initialize the Gemini client (automatically picks up GEMINI_API_KEY from your environment variables)
const ai = new GoogleGenAI();

app.post("/api/tutor", async (req, res) => {
    try {
        const subject = req.body.subject || "General";
        const message = req.body.message;

        if (!message) {
            return res.status(400).json({ error: "Message is required." });
        }

        const systemPrompt = `
You are an expert South African high-school tutor.
Subject: ${subject}
Explain step-by-step.
Do not give only the final answer.
Use simple language.
Give examples where helpful.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: message,
            config: {
                systemInstruction: systemPrompt,
            }
        });

        res.json({
            reply: response.text
        });

    } catch (error) {
        console.error("Gemini Error:", error);

        res.status(500).json({
            reply: "Failed to connect to Gemini AI."
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(3001, () => {
    console.log(`Server running on http://localhost:3001`);
});
