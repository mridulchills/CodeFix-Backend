// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Env vars
const API_KEY = process.env.GEMINI_API_KEY;
// Correct Gemini REST endpoint for code execution
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta2/models/gemini-pro:generate";

//
// POST /api/generate
//   → Generate and execute Python code via Gemini
//
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const payload = {
      contents: [
        { parts: [{ text: `Generate and run Python code for this request: ${prompt}. Provide only the final code and its output; no extra explanations.` }] }
      ],
      config: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        tools: [{ codeExecution: {} }]
      }
    };

    const response = await axios.post(
      GEMINI_API_URL,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        }
      }
    );

    const parts = response.data?.candidates?.[0]?.content?.parts || [];
    let code = "", output = "";
    for (const p of parts) {
      if (p.executableCode?.code)      code   += p.executableCode.code   + "\n";
      if (p.codeExecutionResult?.output) output += p.codeExecutionResult.output + "\n";
    }
    if (!code && parts[0]?.text) {
      code = parts[0].text;
    }

    return res.json({
      code: code.trim(),
      output: output.trim()
    });

  } catch (err) {
    console.error('Error generating via Gemini:', err.response?.data || err.message);
    return res.status(500).json({
      error:   `Server error: ${err.message}`,
      details: err.response?.data
    });
  }
});

//
// POST /api/fix
//   → Fix and re-run existing Python code
//
app.post('/api/fix', async (req, res) => {
  try {
    const { code: userCode, error: errorMessage } = req.body;
    if (!userCode) {
      return res.status(400).json({ error: "Code is required" });
    }

    const payload = {
      contents: [
        { parts: [{ text:
            `Fix and run this Python code:\n\n${userCode}\n\n` +
            (errorMessage
              ? `Error message: ${errorMessage}\n\n`
              : `Identify and fix any issues in this code.\n\n`
            ) +
            `Provide only the corrected code and its output; no other text.`
        }] }
      ],
      config: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        tools: [{ codeExecution: {} }]
      }
    };

    const response = await axios.post(
      GEMINI_API_URL,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        }
      }
    );

    const parts = response.data?.candidates?.[0]?.content?.parts || [];
    let fixedCode = "", output = "";
    for (const p of parts) {
      if (p.executableCode?.code)      fixedCode += p.executableCode.code + "\n";
      if (p.codeExecutionResult?.output) output    += p.codeExecutionResult.output + "\n";
    }
    if (!fixedCode && parts[0]?.text) {
      fixedCode = parts[0].text;
    }

    return res.json({
      code:   fixedCode.trim(),
      output: output.trim()
    });

  } catch (err) {
    console.error('Error fixing via Gemini:', err.response?.data || err.message);
    return res.status(500).json({
      error:   `Server error: ${err.message}`,
      details: err.response?.data
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend service is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
