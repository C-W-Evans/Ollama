from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import json
import sqlite3
import datetime
import os

app = Flask(__name__)
CORS(app)

# Database setup
DB_PATH = "conversations.db"

def init_db():
    if not os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Create tables
        cursor.execute('''
        CREATE TABLE conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
        )
        ''')
        
        conn.commit()
        conn.close()

init_db()

OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "tinyllama"

# Existing chat route
@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message')
        conversation_id = data.get('conversation_id')
        
        # Save message to database if conversation_id is provided
        if conversation_id:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            now = datetime.datetime.now().isoformat()
            
            # Save user message
            cursor.execute(
                "INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                (conversation_id, "user", user_message, now)
            )
            
            # Update conversation timestamp
            cursor.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id)
            )
            
            conn.commit()
            conn.close()
            
            # Get conversation history for context
            context = get_conversation_history(conversation_id)
            prompt = format_context_for_llm(context, user_message)
        else:
            prompt = user_message
            
    except Exception as e:
        return jsonify({"error": f"Failed to process request: {e}"}), 400

    if not user_message:
        return jsonify({"error": "The 'message' field is required in the JSON request"}), 400

    payload = {
        "prompt": prompt,
        "model": MODEL_NAME,
        "stream": True,
        "options": {
            "temperature": 0.7,
            "top_p": 0.9,
            "max_tokens": 500,
            "frequency_penalty": 0.5,
            "presence_penalty": 0.5
        }
    }

    def generate():
        bot_response = ""
        try:
            response = requests.post(OLLAMA_API_URL, json=payload, stream=True)
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        if 'response' in data:
                            bot_response += data['response']
                            yield f"data: {json.dumps({'response': data['response']})}\n\n"
                        elif 'error' in data:
                            yield f"data: {json.dumps({'error': data['error']})}\n\n"
                    except json.JSONDecodeError:
                        print(f"Error decoding JSON line: {line}")
                    continue

            # Save bot response to database if conversation_id is provided
            if conversation_id and bot_response:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                now = datetime.datetime.now().isoformat()
                cursor.execute(
                    "INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                    (conversation_id, "assistant", bot_response, now)
                )
                conn.commit()
                conn.close()
                
        except requests.exceptions.RequestException as e:
            yield f"data: {json.dumps({'error': f'Error communicating with Ollama: {e}'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return Response(generate(), mimetype='text/event-stream')

def get_conversation_history(conversation_id, max_messages=10):
    """Retrieve conversation history from database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ?",
        (conversation_id, max_messages)
    )
    messages = cursor.fetchall()
    conn.close()
    
    # Return messages in chronological order
    return list(reversed([(role, content) for role, content in messages]))

def format_context_for_llm(message_history, current_message):
    """Format conversation history for the LLM"""
    context = ""
    
    for role, content in message_history:
        if role == "user":
            context += f"User: {content}\n"
        else:
            context += f"Assistant: {content}\n"
            
    context += f"User: {current_message}\nAssistant: "
    return context

# New endpoints for conversation management
@app.route('/conversations', methods=['GET'])
def list_conversations():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, created_at, updated_at FROM conversations ORDER BY updated_at DESC")
    conversations = [
        {"id": row[0], "name": row[1], "created_at": row[2], "updated_at": row[3]}
        for row in cursor.fetchall()
    ]
    conn.close()
    return jsonify(conversations)

@app.route('/conversations', methods=['POST'])
def create_conversation():
    data = request.get_json()
    name = data.get('name', f"Conversation {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO conversations (name, created_at, updated_at) VALUES (?, ?, ?)",
        (name, now, now)
    )
    conversation_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        "id": conversation_id,
        "name": name,
        "created_at": now,
        "updated_at": now
    })

@app.route('/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get conversation details
    cursor.execute("SELECT id, name, created_at, updated_at FROM conversations WHERE id = ?", (conversation_id,))
    conversation = cursor.fetchone()
    
    if not conversation:
        conn.close()
        return jsonify({"error": "Conversation not found"}), 404
    
    # Get messages for this conversation
    cursor.execute(
        "SELECT id, role, content, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp",
        (conversation_id,)
    )
    messages = [
        {"id": row[0], "role": row[1], "content": row[2], "timestamp": row[3]}
        for row in cursor.fetchall()
    ]
    
    conn.close()
    
    return jsonify({
        "id": conversation[0],
        "name": conversation[1],
        "created_at": conversation[2],
        "updated_at": conversation[3],
        "messages": messages
    })

@app.route('/conversations/<int:conversation_id>', methods=['PUT'])
def update_conversation(conversation_id):
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({"error": "Name field is required"}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.datetime.now().isoformat()
    
    cursor.execute(
        "UPDATE conversations SET name = ?, updated_at = ? WHERE id = ?",
        (name, now, conversation_id)
    )
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Conversation not found"}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({"id": conversation_id, "name": name, "updated_at": now})

@app.route('/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Conversation not found"}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({"message": f"Conversation {conversation_id} deleted successfully"})

if __name__ == '__main__':
    app.run(debug=True)