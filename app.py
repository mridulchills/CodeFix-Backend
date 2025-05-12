
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Get API key from environment variable
API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent"

@app.route('/api/generate', methods=['POST'])
def generate_code():
    try:
        data = request.json
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400
            
        # Prepare the request to Gemini API
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"Generate Python code for the following request: {prompt}. "
                                    f"Provide only the code, with no explanations before or after."
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 8192,
            }
        }
        
        # Make the request to Gemini API
        response = requests.post(
            f"{GEMINI_API_URL}?key={API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            return jsonify({"error": f"API request failed with status {response.status_code}", "details": response.text}), 500
            
        result = response.json()
        
        # Extract code from Gemini response
        if result.get("candidates") and result["candidates"][0].get("content", {}).get("parts"):
            generated_text = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Try to extract just the code if it has markdown code blocks
            import re
            code_block_match = re.search(r"```(?:python)?([\s\S]*?)```", generated_text)
            if code_block_match and code_block_match.group(1):
                code = code_block_match.group(1).strip()
            else:
                code = generated_text.strip()
                
            return jsonify({"code": code})
        else:
            return jsonify({"error": "Unexpected API response format"}), 500
            
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/fix', methods=['POST'])
def fix_code():
    try:
        data = request.json
        code = data.get('code')
        error = data.get('error', '')
        
        if not code:
            return jsonify({"error": "Code is required"}), 400
            
        # Prepare the request to Gemini API
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"Fix the following Python code:\n\n{code}\n\n"
                                    f"{f'Error message: {error}' if error else 'Identify and fix any issues in this code.'}"
                                    f"\n\nProvide only the corrected code with no explanations before or after."
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": 8192,
            }
        }
        
        # Make the request to Gemini API
        response = requests.post(
            f"{GEMINI_API_URL}?key={API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            return jsonify({"error": f"API request failed with status {response.status_code}", "details": response.text}), 500
            
        result = response.json()
        
        # Extract code from Gemini response
        if result.get("candidates") and result["candidates"][0].get("content", {}).get("parts"):
            fixed_text = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Try to extract just the code if it has markdown code blocks
            import re
            code_block_match = re.search(r"```(?:python)?([\s\S]*?)```", fixed_text)
            if code_block_match and code_block_match.group(1):
                code = code_block_match.group(1).strip()
            else:
                code = fixed_text.strip()
                
            return jsonify({"code": code})
        else:
            return jsonify({"error": "Unexpected API response format"}), 500
            
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Backend service is running"}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
