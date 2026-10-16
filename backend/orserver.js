import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public"));

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
                    prompt: req.body.message,
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
