# DocAsk 📄🤖

DocAsk is a premium, web-based document assistant that allows users to upload files (PDF, Word, TXT, or Markdown) and immediately query them using Gemini AI. 

🌐 **Live Deployment**: [https://doc-ask-wine.vercel.app/](https://doc-ask-wine.vercel.app/)

---

## ✨ Features

- **Multi-Format Parsing**: Extracts text from PDFs (`unpdf`), DOCX (`mammoth`), and plaintext files (`.txt`, `.md`) using 100% environment-agnostic libraries, making it fully compatible with serverless functions on Vercel and Railway.
- **Local RAG (Semantic Context Retriever)**: Solves the Gemini free-tier input limit of 250,000 tokens per minute. For large documents (e.g. 180,000-word books), it chunks text in-memory, scores paragraph relevance using keyword query matching, and sends only the top sequential fragments.
- **On-Demand Visual Concept Trees**: Renders interactive, beautiful SVG diagrams:
  - **Concept Tree**: A left-to-right hierarchy layout.
  - **Radial Mind Map**: A balanced, outward-branching layout.
- **Ask AI Integration**: Select any concept node inside the SVG map to see details and instantly query the AI about it.
- **Modern Responsive Design**: Dynamic layouts built with vanilla CSS matching a sleek warm off-white and vibrant coral color palette. Mobile views scale automatically into bottom tab routes.

---

## 🎨 Design Colors
- Primary Background: `#FFFAF3` (warm off-white)
- Card Background: `#FFF2DB` (cream card)
- Border / Hover Highlight: `#FFE5BF` (soft peach)
- Primary Accents / Buttons: `#F62440` (vibrant coral red)

---

## 🛠️ Local Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Doc-Ask
   ```

2. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the app locally.

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 🐍 Python Developer Utilities

For local MLOps development, the repository includes a Python utilities suite under `scripts/` to parse documents locally and evaluate Q&A response quality.

See the [scripts/README.md](file:///c:/Users/Lenovo/OneDrive/Desktop/CODES/Doc-Ask/scripts/README.md) for full instructions.

### Quick Run:
```bash
# 1. Set up virtual environment
python -m venv venv
source venv/bin/activate  # on Windows: .\venv\Scripts\Activate.ps1
pip install -r scripts/requirements.txt

# 2. Run the QA evaluator script
export GEMINI_API_KEY="your_api_key"
python scripts/evaluate_qa.py --file path/to/document.pdf
```

---

## 🚀 Deployment

- **Frontend**: Deployed on **Vercel** with Next.js Server Actions.
- **API Environment**: Configured with the Gemini API key in Vercel settings.
