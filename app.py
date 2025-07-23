from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import ollama
from pymongo import MongoClient
from datetime import datetime
import os
import re
import logging
import requests

app = Flask(__name__)
CORS(app)

# Configure logging for the Flask app
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Ollama Model Configuration ---
model_name = 'mistral' # Ensure this model is pulled: ollama pull mistral

# --- MongoDB Configuration ---
MONGO_URI = "mongodb://localhost:27017/" # Default MongoDB URI
DB_NAME = "journal_app_db"
COLLECTION_NAME = "journal_entries"

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    journal_collection = db[COLLECTION_NAME]
    app.logger.info(f"Successfully connected to MongoDB: {DB_NAME}")
except Exception as e:
    app.logger.error(f"Error connecting to MongoDB: {e}")
    # It's critical to have a DB connection, so exit if it fails
    exit(1)

# --- Configuration for Local File Storage ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JOURNAL_FILES_DIR = os.path.join(BASE_DIR, 'journal_files')
os.makedirs(JOURNAL_FILES_DIR, exist_ok=True) # Ensure the directory exists
app.logger.info(f"Journal text files will be saved in: {JOURNAL_FILES_DIR}")

# --- Helper function to sanitize filename ---
def sanitize_filename(filename):
    """Remove illegal characters and replace spaces for a valid filename."""
    if not filename:
        return "untitled"
    # Replace spaces with underscores
    filename = filename.replace(" ", "_")
    # Remove characters that are illegal in typical file systems
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    # Limit filename length to prevent issues on some OS
    return filename[:100]

# --- Helper function to save content to a local file ---
def save_entry_to_local_file(entry_data):
    """
    Saves the journal entry content (original and enhanced text, title, date)
    to a local .txt file within the JOURNAL_FILES_DIR.
    Returns the generated filename if successful, None otherwise.
    """
    try:
        title = entry_data.get('title', 'untitled_entry')
        sanitized_title = sanitize_filename(title)
        # Use a timestamp to ensure uniqueness and chronological order
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S_%f") # Added microseconds for more uniqueness
        filename = f"{sanitized_title}_{timestamp_str}.txt"
        file_path = os.path.join(JOURNAL_FILES_DIR, filename)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"Title: {entry_data.get('title', 'No Title')}\n")
            f.write(f"Date: {entry_data.get('date', 'N/A')} Time: {entry_data.get('time', 'N/A')}\n")
            if entry_data.get('imageUrl'):
                f.write(f"Image Attached: Yes (Base64 data not stored in text file for brevity)\n")
            f.write("\n-- Original Entry --\n")
            f.write(entry_data.get('originalText', 'No original text provided.'))
            f.write("\n\n-- AI-Enhanced Version --\n")
            f.write(entry_data.get('enhancedText', 'No AI enhancement provided.'))
            f.write("\n")
        app.logger.info(f"Successfully saved entry to local file: {file_path}")
        return filename
    except Exception as e:
        app.logger.error(f"Error saving entry to local file for title '{entry_data.get('title')}': {e}", exc_info=True)
        return None

# --- API Route: Enhance Journal Entry with Ollama ---
@app.route('/enhance', methods=['POST'])
def enhance_journal():
    data = request.json
    journal_text = data.get('journalText')

    if not journal_text:
        app.logger.warning("Enhance request received without journal text.")
        return jsonify({"error": "No journal text provided"}), 400

    app.logger.info(f"Received journal text for enhancement: {journal_text[:50]}...")

    try:
        # Ollama chat completion call
        response = ollama.chat(
            model=model_name,
            messages=[
                {'role': 'user', 'content': f'Enhance the following journal entry into a more lovable and readable form, incorporating relevant emojis where appropriate. Keep the original meaning and tone. Make it sound warm and reflective. Here is the entry: \n\n"{journal_text}"'}
            ],
            stream=False, # We want the full response at once
            options={
                'temperature': 0.7, # Controls randomness
                'num_predict': 500 # Max tokens to generate
            }
        )

        # Extract the content from the response
        enhanced_text = response['message']['content']
        app.logger.info(f"Successfully enhanced text (first 50 chars): {enhanced_text[:50]}...")
        return jsonify({"enhancedText": enhanced_text})

    except ollama.ResponseError as e:
        app.logger.error(f"Ollama API error (Status: {e.status_code}, Message: {e.message})", exc_info=True)
        return jsonify({"error": f"Ollama API error: {e.message}"}), e.status_code
    except requests.exceptions.ConnectionError as e:
        app.logger.error(f"Connection error to Ollama server: {e}", exc_info=True)
        return jsonify({"error": "Could not connect to Ollama server. Please ensure Ollama is running."}), 500
    except KeyError as e:
        app.logger.error(f"KeyError in Ollama response: Missing key {e}. Raw response: {response}", exc_info=True)
        return jsonify({"error": "Unexpected response format from Ollama. Please check Ollama API response structure."}), 500
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during Ollama interaction: {e}", exc_info=True)
        return jsonify({"error": f"Failed to enhance text due to an unexpected error: {str(e)}"}), 500

# --- API Route: Save a Journal Entry to MongoDB and Local File ---
@app.route('/save_entry', methods=['POST'])
def save_entry():
    data = request.json
    title = data.get('title')
    original_text = data.get('originalText')
    enhanced_text = data.get('enhancedText')
    image_url = data.get('imageUrl') # This is base64 string or URL

    if not title or not original_text:
        app.logger.warning("Save entry request missing title or original text.")
        return jsonify({"error": "Title and original text are required"}), 400

    try:
        current_datetime = datetime.now()
        entry_to_save = {
            "title": title,
            "originalText": original_text,
            "enhancedText": enhanced_text,
            "imageUrl": image_url, # Store base64 or URL directly for display
            "timestamp": current_datetime.isoformat(), # ISO format for easy sorting and parsing
            "date": current_datetime.strftime("%Y-%m-%d"),
            "time": current_datetime.strftime("%H:%M:%S")
        }

        # Save to local file first
        file_name = save_entry_to_local_file(entry_to_save)
        if file_name:
            entry_to_save["fileName"] = file_name # Add filename to MongoDB entry
            app.logger.info(f"File name '{file_name}' added to MongoDB entry data for '{title}'.")
        else:
            # Handle case where file saving failed but we still want to save to DB
            app.logger.warning(f"Could not generate filename for entry '{title}'. Entry will be saved to DB without fileName.")
            entry_to_save["fileName"] = None # Explicitly set to None if saving failed

        # Save to MongoDB
        result = journal_collection.insert_one(entry_to_save)
        app.logger.info(f"Entry saved to MongoDB with ID: {result.inserted_id}")

        message = "Memory saved successfully! ✨"
        if not file_name:
            message += " (Note: Local text file could not be saved. 😟)"

        # Return the saved entry's details (including _id and fileName)
        # This is useful if the frontend needs to immediately display the new entry
        saved_entry = journal_collection.find_one({"_id": result.inserted_id})
        saved_entry['_id'] = str(saved_entry['_id']) # Convert ObjectId to string for JSON
        return jsonify({"message": message, "entry": saved_entry}), 201

    except Exception as e:
        app.logger.error(f"Error saving entry to MongoDB or local file: {e}", exc_info=True)
        return jsonify({"error": f"Failed to save memory: {str(e)} 😔"}), 500

# --- API Route: Get All Journal Entries ---
@app.route('/get_entries', methods=['GET'])
def get_entries():
    try:
        # Fetch entries, sort by timestamp in descending order (most recent first)
        entries_cursor = journal_collection.find().sort("timestamp", -1)

        entries_list = []
        for entry in entries_cursor:
            entry['_id'] = str(entry['_id']) # Convert ObjectId to string for JSON serialization
            entries_list.append(entry)

        app.logger.info(f"Fetched {len(entries_list)} entries from MongoDB.")
        return jsonify(entries_list), 200
    except Exception as e:
        app.logger.error(f"Error fetching entries from MongoDB: {e}", exc_info=True)
        return jsonify({"error": f"Failed to fetch memories: {str(e)} 💔"}), 500

# --- NEW API Route: Serve Saved Text File ---
@app.route('/get_memory_file/<filename>', methods=['GET'])
def get_memory_file(filename):
    """
    Serves a specific journal text file from the JOURNAL_FILES_DIR.
    Includes basic security checks for filename.
    """
    try:
        # Prevent directory traversal attacks
        safe_path = os.path.abspath(os.path.join(JOURNAL_FILES_DIR, filename))
        if not safe_path.startswith(os.path.abspath(JOURNAL_FILES_DIR)):
            app.logger.warning(f"Attempted directory traversal: {filename}")
            return jsonify({"error": "Invalid filename"}), 400

        # Check if the file exists before attempting to serve
        if not os.path.exists(safe_path):
            app.logger.warning(f"Requested file not found: {safe_path}")
            return jsonify({"error": "File not found"}), 404

        app.logger.info(f"Serving file: {filename} from {JOURNAL_FILES_DIR}")
        # send_from_directory will handle file streaming and content-type automatically
        return send_from_directory(JOURNAL_FILES_DIR, filename, as_attachment=True) # as_attachment=True prompts download
    except Exception as e:
        app.logger.error(f"Error serving file '{filename}': {e}", exc_info=True)
        return jsonify({"error": f"Could not retrieve file: {str(e)}"}), 500

# --- Main execution block ---
if __name__ == '__main__':
    app.logger.info(f"Attempting to check Ollama for model: {model_name}...")
    try:
        # This will raise an exception if the model doesn't exist or Ollama isn't running
        ollama.show(model_name)
        app.logger.info(f"Ollama model '{model_name}' found. Starting Flask server... ✅")
    except Exception as e:
        app.logger.error(f"Error: Ollama model '{model_name}' not found or Ollama is not running. "
                         f"Please ensure Ollama is running and you have pulled the model using 'ollama pull {model_name}'. "
                         f"Details: {e} ❌")
        # Exit if Ollama setup is not correct, as the app relies on it
        exit(1)

    app.run(debug=True, port=5000) # Run in debug mode for development