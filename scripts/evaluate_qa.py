import os
import sys
import argparse
import time
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
        reader = PdfReader(file_path)
        return "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
    elif ext in ['.txt', '.md']:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        log_error("Unsupported file extension.")
        sys.exit(1)

def local_rag_retrieve(document_text, query, max_chars=120000):
    if len(document_text) <= max_chars:
        return document_text

    # Chunk by double newlines or paragraphs
    paragraphs = document_text.split('\n\n')
    chunks = []
    current_chunk = ""
    for para in paragraphs:
        trimmed = para.strip()
        if not trimmed:
            continue
        if len(current_chunk) + len(trimmed) > 2000:
            chunks.append(current_chunk.strip())
            current_chunk = trimmed
        else:
            current_chunk += ("\n\n" if current_chunk else "") + trimmed
    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    # Score chunks by keyword frequency
    stop_words = {'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'to', 'of', 'in', 'for', 'or', 'about', 'from', 'this', 'that', 'these', 'those', 'with', 'by'}
    query_terms = [t for t in query.lower().split() if len(t) > 2 and t not in stop_words]
    fallback_terms = [t for t in query.lower().split() if len(t) > 1]
    terms = query_terms if query_terms else fallback_terms

    scored = []
    for idx, chunk in enumerate(chunks):
        score = 0
        chunk_lower = chunk.lower()
        for term in terms:
            score += chunk_lower.count(term) * 2.0
            if term in chunk_lower:
                score += 0.5
        
        # summary boost
        is_summary = any(k in query.lower() for k in ['summary', 'summarize', 'overview', 'outline'])
        if is_summary:
            position_factor = max(0.0, 1.0 - (idx / len(chunks)))
            score += position_factor * 6.0
            
        scored.append({"chunk": chunk, "index": idx, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)

    # Take top chunks under character limit
    selected = []
    curr_len = 0
    for item in scored:
        if curr_len + len(item["chunk"]) > max_chars:
            if not selected:
                selected.append(item)
            break
        selected.append(item)
        curr_len += len(item["chunk"])

    selected.sort(key=lambda x: x["index"])
    return "\n\n[...]\n\n".join([item["chunk"] for item in selected])

def calculate_overlap_faithfulness(response_text, retrieved_context):
    """Calculates what % of unique non-stop words in response appear in retrieved context"""
    stop_words = {'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'to', 'of', 'in', 'for', 'or', 'about', 'from', 'this', 'that', 'these', 'those', 'with', 'by'}
    response_words = set([w.lower().strip(".,?!:;\"'") for w in response_text.split() if len(w) > 2]) - stop_words
    context_words = set([w.lower().strip(".,?!:;\"'") for w in retrieved_context.split() if len(w) > 2])
    
    if not response_words:
        return 0.0
    matches = response_words.intersection(context_words)
    return len(matches) / len(response_words)

def main():
    parser = argparse.ArgumentParser(description="AI Q&A Response Evaluation Suite")
    parser.add_argument("--file", "-f", required=True, help="Path to document file")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        log_error("GEMINI_API_KEY environment variable is not defined.")
        sys.exit(1)
        
    genai.configure(api_key=api_key)

    log_info("Extracting document text...")
    doc_text = extract_text(args.file)
    log_success(f"Loaded {len(doc_text)} characters.")

    # 4 standard test queries
    eval_queries = [
        "What is the main topic or primary theme of this document?",
        "Provide a high-level summary of the key takeaways.",
        "Summarize this document in 3 concise bullet points.",
        "Are there any specific dates, figures, or key names mentioned?"
    ]

    log_info(f"Beginning evaluation on {len(eval_queries)} queries...")
    results = []

    models = ["gemini-2.0-flash", "gemini-2.5-flash"]
    selected_model_name = "gemini-2.5-flash"
    
    for idx, query in enumerate(eval_queries):
        log_info(f"Query {idx+1}/{len(eval_queries)}: '{query}'")
        
        # 1. Local RAG Retrieval
        retrieval_start = time.time()
        context = local_rag_retrieve(doc_text, query)
        retrieval_time = time.time() - retrieval_start
        
        # 2. Query Gemini
        prompt = f"Context:\n{context}\n\nQuestion: {query}\nAnswer based on the context."
        
        gen_start = time.time()
        response_text = ""
        success = False
        
        for model_name in models:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                if response.text:
                    response_text = response.text
                    selected_model_name = model_name
                    success = True
                    break
            except Exception as e:
                log_warning(f"Model {model_name} failed: {e}")
                
        gen_time = time.time() - gen_start
        
        if not success:
            log_error("All models failed.")
            continue
            
        # 3. Calculate metrics
        faithfulness = calculate_overlap_faithfulness(response_text, context)
        
        results.append({
            "query": query,
            "latency_sec": gen_time,
            "retrieval_sec": retrieval_time,
            "response_words": len(response_text.split()),
            "faithfulness": faithfulness,
            "answer": response_text
        })
        
        log_success(f"Completed in {gen_time:.2f}s | Faithfulness: {faithfulness*100:.1f}%")

    # Output MD Report
    report_path = "evaluation_report.md"
    log_info(f"Exporting evaluation report to: {report_path}")
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# DocAsk Q&A Evaluation Report 📊\n\n")
        f.write(f"**Document**: `{os.path.basename(args.file)}`  \n")
        f.write(f"**Model Evaluated**: `{selected_model_name}`  \n")
        f.write(f"**Total Queries**: `{len(results)}`  \n\n")
        
        f.write("## 📈 Performance Summary Table\n\n")
        f.write("| Query | Latency (s) | Word Count | Faithfulness (Lexical Overlap) |\n")
        f.write("| :--- | :--- | :--- | :--- |\n")
        
        for res in results:
            f.write(f"| \"{res['query']}\" | {res['latency_sec']:.2f}s | {res['response_words']} | {res['faithfulness']*100:.1f}% |\n")
            
        f.write("\n---\n\n## 📝 Query Responses Detail\n\n")
        for idx, res in enumerate(results):
            f.write(f"### Q{idx+1}: {res['query']}\n")
            f.write(f"*Generation Latency: {res['latency_sec']:.2f}s | Faithfulness Score: {res['faithfulness']*100:.1f}%*\n\n")
            f.write(f"**Response**:\n{res['answer']}\n\n")
            f.write("---\n\n")

    log_success("Evaluation completed successfully!")

if __name__ == "__main__":
    main()
