const express = require("express");

const app = express();
app.use(express.json());

app.post("/api/tutor", async (req, res) => {
    try {
        const response = await fetch(
            "http://localhost:11434/api/generate",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama3:latest",
                    prompt: `
You are an expert South African high-school tutor.

Subject: ${req.body.subject || "General"}
Question: ${req.body.message}

Explain step-by-step.
Do not give only the final answer.
Use simple language.
Give examples where helpful.
`,
                    stream: false
                })
            }
        );

        const data = await response.json();

        res.json({
            reply: data.response
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            reply: "Failed to connect to Ollama."
        });
    }
});