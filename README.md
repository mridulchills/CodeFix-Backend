
# Python Code Helper Backend

This is a Node.js/Express backend that handles API calls to the Gemini API for generating and fixing Python code.

## Setup

1. Create a `.env` file with your Gemini API key:
   ```
   GEMINI_API_KEY=your-api-key-here
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the server:
   ```bash
   npm start
   ```

The server will start on http://localhost:5000

## API Endpoints

- `POST /api/generate` - Generate Python code from a description
- `POST /api/fix` - Fix existing Python code
- `GET /api/health` - Health check endpoint
