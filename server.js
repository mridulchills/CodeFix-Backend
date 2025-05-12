
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Get API key from environment variable
const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

// Route for generating code
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    
    // Prepare the request to Gemini API
    const payload = {
      contents: [
        {
          parts: [
            {
              text: `Generate Python code for the following request: ${prompt}. Provide only the code, with no explanations before or after.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };
    
    // Make the request to Gemini API
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${API_KEY}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    
    // Extract code from Gemini response
    if (response.data.candidates && response.data.candidates[0]?.content?.parts) {
      let generatedText = response.data.candidates[0].content.parts[0].text;
      
      // Try to extract just the code if it has markdown code blocks
      const codeBlockMatch = generatedText.match(/```(?:python)?([\s\S]*?)```/);
      const code = codeBlockMatch && codeBlockMatch[1] 
        ? codeBlockMatch[1].trim() 
        : generatedText.trim();
      
      return res.json({ code });
    } else {
      return res.status(500).json({ error: "Unexpected API response format" });
    }
  } catch (error) {
    console.error('Error generating code:', error);
    return res.status(500).json({ 
      error: `Server error: ${error.message}`,
      details: error.response ? error.response.data : null
    });
  }
});

// Route for fixing code
app.post('/api/fix', async (req, res) => {
  try {
    const { code, error: errorMessage } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }
    
    // Prepare the request to Gemini API
    const payload = {
      contents: [
        {
          parts: [
            {
              text: `Fix the following Python code:\n\n${code}\n\n` +
                    `${errorMessage ? `Error message: ${errorMessage}` : 'Identify and fix any issues in this code.'}` +
                    `\n\nProvide only the corrected code with no explanations before or after.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };
    
    // Make the request to Gemini API
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${API_KEY}`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );
    
    // Extract code from Gemini response
    if (response.data.candidates && response.data.candidates[0]?.content?.parts) {
      let fixedText = response.data.candidates[0].content.parts[0].text;
      
      // Try to extract just the code if it has markdown code blocks
      const codeBlockMatch = fixedText.match(/```(?:python)?([\s\S]*?)```/);
      const fixedCode = codeBlockMatch && codeBlockMatch[1] 
        ? codeBlockMatch[1].trim() 
        : fixedText.trim();
      
      return res.json({ code: fixedCode });
    } else {
      return res.status(500).json({ error: "Unexpected API response format" });
    }
  } catch (error) {
    console.error('Error fixing code:', error);
    return res.status(500).json({ 
      error: `Server error: ${error.message}`,
      details: error.response ? error.response.data : null
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend service is running' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
