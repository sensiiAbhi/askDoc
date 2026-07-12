# DocAsk - Python Developer Utilities Suite 🐍🤖

This directory contains local command-line tools written in Python to support document processing, metadata extraction, and QA evaluation metrics. 

---

## 🛠️ Python Setup

1. **Create and Activate a Virtual Environment**:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r scripts/requirements.txt
   ```

3. **Set your Gemini API Key**:
   Make sure you have your key configured in your shell environment:
   ```powershell
   # PowerShell (Windows)
   $env:GEMINI_API_KEY="your_api_key"
   
   # Bash (macOS/Linux)
   export GEMINI_API_KEY="your_api_key"
   ```

---

## 📄 1. Local Document NLP Parser (`scripts/parse_document.py`)
This CLI script extracts text from local files (PDF, DOCX, TXT) and generates a structured concept tree JSON file locally using the Gemini Python API, which is directly loadable into the frontend.

### Running the Parser:
```bash
# Parse a PDF file and save the concept map
python scripts/parse_document.py --file path/to/document.pdf --output concept_map.json
```

### Options:
- `--file`, `-f` : Path to input file (supports PDF or TXT).
- `--output`, `-o` : Path to save generated concept map JSON.
- `--verbose`, `-v` : Enable detailed print logs.

---

## 📊 2. QA Evaluation Harness (`scripts/evaluate_qa.py`)
This script evaluates the quality of Gemini Q&A responses by testing a list of standard questions against the document context, measuring response latency, tracking token usage, and computing lexical set-intersection (overlap) metrics. It exports a markdown report: `evaluation_report.md`.

### Running the Evaluator:
```bash
python scripts/evaluate_qa.py --file path/to/document.pdf
```

---

## 💬 Interview talking points:
- **"How does the Python suite complement the Next.js app?"**
  *"The web application serves the production dashboard for end-users, while the Python developer suite provides backend utilities for data processing, offline NLP profiling, and automated response quality evaluations—which are standard practices in MLOps."*
- **"Why is automated evaluation important in AI engineering?"**
  *"LLMs are non-deterministic, meaning responses can drift over time. Having a Python-based evaluation harness allows us to measure response accuracy (lexical overlap), latency, and token consumption to verify changes before releasing them to users."*
