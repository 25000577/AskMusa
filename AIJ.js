const response = await fetch(
    "http://localhost:11434/api/generate",
    {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({
            message: message
        })
    }
);

const data = await response.json();