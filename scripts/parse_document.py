import os
import sys
import argparse
import json
from pypdf import PdfReader
import google.generativeai as genai
from termcolor import colored

def log_success(msg):
    print(colored(f"[✓] {msg}", "green"))

def log_info(msg):
    print(colored(f"[*] {msg}", "cyan"))

def log_warning(msg):
    print(colored(f"[!] {msg}", "yellow"))

def log_error(msg):
    print(colored(f"[✗] {msg}", "red"), file=sys.stderr)

def extract_text(file_path):
    if not os.path.exists(file_path):
        log_error(f"File not found: {file_path}")
        sys.exit(1)
        
    _, ext = os.path.splitext(file_path.lower())
    
    if ext == '.pdf':
        log_info(f"Extracting text from PDF: {file_path}")
        reader = PdfReader(file_path)
        text = ""
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()
    elif ext in ['.txt', '.md']:
        log_info(f"Reading text file: {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    else:
        log_error(f"Unsupported file type '{ext}'. Only PDF, TXT, or MD are supported.")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Local NLP Document Parser & Concept Tree Generator")
    parser.add_argument("--file", "-f", required=True, help="Path to PDF, TXT, or MD file")
    parser.add_argument("--output", "-o", default="concept_map.json", help="Output path for JSON map")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose printing")
    
    args = parser.parse_args()
    
    # 1. Check API Key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        log_error("GEMINI_API_KEY environment variable is not defined.")
        log_info("Please set it in your terminal, e.g.: export GEMINI_API_KEY='your_key'")
        sys.exit(1)
        
    genai.configure(api_key=api_key)
    
    # 2. Extract text
    text = extract_text(args.file)
    if not text:
        log_error("Failed to extract text. File might be empty.")
        sys.exit(1)
        
    word_count = len(text.split())
    log_success(f"Successfully extracted {word_count} words from {os.path.basename(args.file)}")
    
    # 3. Generate Concept Map JSON using Gemini
    log_info("Contacting Gemini API to generate structured concept map...")
    
    sliced_text = text[:15000]
    
    prompt = f"""Analyze the following text from a document and generate an interactive mind map representing the hierarchical tree of main concepts and subtopics.
Return ONLY valid JSON that matches the following structure:
{{
  "topic": "Main Subject or Document Title",
  "description": "A very brief 1-sentence description summarizing this main topic",
  "children": [
    {{
      "topic": "Key Subtopic 1",
      "description": "Brief 1-sentence description of this subtopic",
      "children": [
        {{
          "topic": "Important Detail A",
          "description": "Brief description of Detail A"
        }},
        {{
          "topic": "Important Detail B",
          "description": "Brief description of Detail B"
        }}
      ]
    }}
  ]
}}

Limit the mind map to a maximum of 4 main subtopics, and 2-3 details per subtopic. Output ONLY valid, parsable JSON. Do not write markdown blocks or backticks.

Text to analyze:
{sliced_text}
"""
    
    try:
        models = ["gemini-2.0-flash", "gemini-2.5-flash"]
        model = None
        response = None
        
        for model_name in models:
            try:
                log_info(f"Attempting generation with model: {model_name}")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.3
                    )
                )
                if response.text:
                    break
            except Exception as e:
                log_warning(f"Model {model_name} failed: {e}")
                
        if not response or not response.text:
            log_error("All Gemini models failed to generate content.")
            sys.exit(1)
            
        cleaned_json = response.text.strip()
        parsed_map = json.loads(cleaned_json)
        
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(parsed_map, f, indent=2)
            
        log_success(f"Successfully generated Concept Map JSON and saved to: {args.output}")
        if args.verbose:
            print(json.dumps(parsed_map, indent=2))
            
    except json.JSONDecodeError as jde:
        log_error("Failed to parse response as valid JSON.")
        if response:
            print("Raw response:")
            print(response.text)
        sys.exit(1)
    except Exception as e:
        log_error(f"An unexpected error occurred during map generation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
