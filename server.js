const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/generate', async (req, res) => {
    const userPrompt = req.body.prompt;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("Error: API Key is missing");
        return res.status(500).json({ error: { message: "API Key not configured on server." } });
    }

    // --- CHANGE: กลับมาใช้ v1beta (ถูกต้องแล้ว) และใช้ 1.5-flash ---
    let modelName = 'gemini-1.5-flash'; 
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let data = await response.json();

        // --- FALLBACK LOGIC: ถ้า 1.5-flash หาไม่เจอ ให้ลอง gemini-pro ---
        if (!response.ok && data.error && (data.error.code === 404 || data.error.message.includes('not found'))) {
            console.log("Model 1.5-flash not found, switching to gemini-pro...");
            modelName = 'gemini-pro';
            url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            data = await response.json();
        }

        if (!response.ok) {
            console.error("Gemini API Error:", JSON.stringify(data, null, 2));
            throw new Error(data.error?.message || 'Gemini API Error');
        }

        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
             console.error("AI blocked response:", JSON.stringify(data, null, 2));
             throw new Error("AI refused to generate content.");
        }

        res.json(data);

    } catch (error) {
        console.error("Server Internal Error:", error);
        res.status(500).json({ error: { message: error.message } });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
