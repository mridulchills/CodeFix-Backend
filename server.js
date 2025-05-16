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
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set in your environment.');
  process.exit(1);
}

// Base Gemini endpoint & model
const MODEL = 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const makeUrl = (action) =>
  `${BASE_URL}/models/${MODEL}:${action}?key=${API_KEY}`;

// Helper: post to Gemini
async function callGemini(action, contents, toolsConfig) {
  const url = makeUrl(action);
  const payload = {
    contents,
    config: {
      ...toolsConfig,
      tools: [{ codeExecution: {} }],
    },
  };

  const resp = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' }
  });

  return resp.data?.candidates?.[0]?.content?.parts || [];
}

// POST /api/generate
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Build the `contents` array for Gemini
    const contents = [
      {
        parts: [
          {
            text: `Generate and run Python code for this request: ${prompt}. ` +
                  `Provide only the final code and its output; no extra explanations.`
          }
        ]
      }
    ];

    const parts = await callGemini('generateContent', contents, {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192
    });

    // Parse out code + output
    let code = '', output = '';
    for (const p of parts) {
      if (p.executableCode?.code)       code   += p.executableCode.code   + '\n';
      if (p.codeExecutionResult?.output) output += p.codeExecutionResult.output + '\n';
      if (p.text && !code)              code    = p.text;
    }

    res.json({ code: code.trim(), output: output.trim() });
  } catch (err) {
    console.error('Error generating via Gemini:', err.response?.data || err.message);
    res.status(500).json({
      error:   `Server error: ${err.message}`,
      details: err.response?.data
    });
  }
});

// POST /api/fix
app.post('/api/fix', async (req, res) => {
  try {
    const { code: userCode, error: errorMessage } = req.body;
    if (!userCode) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const promptText = [
      `Fix and run this Python code:\n\n${userCode}\n\n`,
      errorMessage
        ? `Error message: ${errorMessage}\n\n`
        : `Identify and fix any issues in this code.\n\n`,
      `Provide only the corrected code and its output; no other text.`
    ].join('');

    const contents = [
      {
        parts: [{ text: promptText }]
      }
    ];

    const parts = await callGemini('generateContent', contents, {
      temperature: 0.1,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192
    });

    // Parse out fixedCode + output
    let fixedCode = '', output = '';
    for (const p of parts) {
      if (p.executableCode?.code)       fixedCode += p.executableCode.code + '\n';
      if (p.codeExecutionResult?.output) output    += p.codeExecutionResult.output + '\n';
      if (p.text && !fixedCode)         fixedCode  = p.text;
    }

    res.json({ code: fixedCode.trim(), output: output.trim() });
  } catch (err) {
    console.error('Error fixing via Gemini:', err.response?.data || err.message);
    res.status(500).json({
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
