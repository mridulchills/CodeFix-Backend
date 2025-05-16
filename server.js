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

// Env validation
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set in your environment.');
  process.exit(1);
}

// Gemini Code-Execution endpoint
const MODEL   = 'gemini-2.0-flash';
const BASE    = 'https://generativelanguage.googleapis.com/v1beta2';
const KEY_QS  = `?key=${API_KEY}`;
const CODE_EP = `${BASE}/models/${MODEL}:generateCode${KEY_QS}`;

// Root / health routes
app.get('/', (_req, res) => {
  res.send('👋 Python-Code-Helper backend is alive');
});
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend service is running' });
});

// Helper to call Gemini generateCode
async function callGenerateCode(promptText, { temperature, topK, topP, maxOutputTokens }) {
  const body = {
    prompt: { text: promptText },
    temperature,
    topK,
    topP,
    maxOutputTokens,
    codeExecutionConfig: {}
  };

  const resp = await axios.post(CODE_EP, body, {
    headers: { 'Content-Type': 'application/json' }
  });
  return resp.data;
}

// POST /api/generate → generate new Python code + run it
app.post('/api/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const promptText = 
    `Generate and run Python code for this request: ${prompt}. ` +
    `Provide only the final code and its output; no extra explanations.`;

  try {
    const data = await callGenerateCode(promptText, {
      temperature:     0.2,
      topK:            40,
      topP:            0.95,
      maxOutputTokens: 8192
    });

    // Parse first run/candidate
    const run = (data.runs || data.candidates || [])[0] || {};

    const code   = run.executableCode?.code ?? run.text ?? '';
    const output = run.codeExecutionOutput?.stdout ?? '';

    res.json({ code: code.trim(), output: output.trim() });
  } catch (err) {
    console.error('Error generating via Gemini:', err.response?.data || err.message);
    res.status(500).json({
      error:   `Server error: ${err.message}`,
      details: err.response?.data
    });
  }
});

// POST /api/fix → fix & re-run existing Python code
app.post('/api/fix', async (req, res) => {
  const { code: userCode, error: errorMessage } = req.body;
  if (!userCode) {
    return res.status(400).json({ error: 'Code is required' });
  }

  const promptText =
    `Fix and run this Python code:\n\n${userCode}\n\n` +
    (errorMessage
      ? `Error message: ${errorMessage}\n\n`
      : `Identify and fix any issues in this code.\n\n`
    ) +
    `Provide only the corrected code and its output; no other text.`;

  try {
    const data = await callGenerateCode(promptText, {
      temperature:     0.1,
      topK:            40,
      topP:            0.95,
      maxOutputTokens: 8192
    });

    const run = (data.runs || data.candidates || [])[0] || {};

    const fixedCode = run.executableCode?.code ?? run.text ?? '';
    const output    = run.codeExecutionOutput?.stdout ?? '';

    res.json({ code: fixedCode.trim(), output: output.trim() });
  } catch (err) {
    console.error('Error fixing via Gemini:', err.response?.data || err.message);
    res.status(500).json({
      error:   `Server error: ${err.message}`,
      details: err.response?.data
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
