Ollama Chat Application
A locally-hosted chat application that uses Ollama to run language models on your own hardware. This application features conversation management, streaming responses, and a dark mode interface.

    Features
Chat with LLMs running locally via Ollama
Real-time streaming responses
Save and manage conversations
Conversation context for more coherent responses
Dark/Light theme toggle
Stop generation button
Uses SQLite for data persistence

    Prerequisites
Python 3.7+
Ollama installed on your machine
TinyLlama model installed in Ollama (or update the model name in app.py)

    Installation
Clone the repository

Install dependencies
pip install flask flask-cors requests

Install Ollama

Pull the TinyLlama model
ollama pull tinyllama

    Running the Application
Start the Ollama service
Make sure Ollama is running in the background. Typically, it starts automatically after installation.

Start the Flask backend
python app.py

The backend server will start on http://localhost:5000.

    Open the application
Open index.html in your web browser. You can do this by double-clicking the file in your file explorer or using the browser's File > Open menu.

    Usage
Type your message in the input field at the bottom and press Enter or click Send
The AI will respond with streaming text in real-time
Click the Stop button to interrupt a long generation
Start a new conversation with the "New" button in the sidebar
Click on a previous conversation in the sidebar to reload it
Use the Rename button to give your conversations meaningful names
Use the Delete button to remove unwanted conversations
Toggle between dark and light themes with the theme button
Customization
To use a different Ollama model, update the MODEL_NAME variable in app.py.

    Troubleshooting
If you see "Connection error with the server":

Make sure Ollama is running
Verify the OLLAMA_API_URL in app.py matches your Ollama installation (default: http://localhost:11434/api/generate)
Check that the Flask server is running on port 5000