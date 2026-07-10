'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Send, 
  MessageSquare, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2,
  FileCode,
  HelpCircle
} from 'lucide-react';
import MindMap from './components/MindMap';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export default function Home() {
  // Document state
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [mindMap, setMindMap] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Responsive state (tab switcher)
  const [activeTab, setActiveTab] = useState<'document' | 'mindmap' | 'chat'>('document');
  const [leftActiveTab, setLeftActiveTab] = useState<'upload' | 'mindmap'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat history
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // When document parses successfully, auto-switch to mindmap view for best UX
  useEffect(() => {
    if (extractedText) {
      setLeftActiveTab('mindmap');
      if (activeTab === 'document') {
        const timer = setTimeout(() => {
          setActiveTab('mindmap');
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [extractedText]);

  // Handle uploading and parsing
  const processFile = async (file: File) => {
    if (!file) return;

    setIsProcessing(true);
    setDocError(null);
    setFileName(file.name);

    // Format size
    const sizeInKb = file.size / 1024;
    const formattedSize = sizeInKb > 1024 
      ? `${(sizeInKb / 1024).toFixed(1)} MB` 
      : `${sizeInKb.toFixed(0)} KB`;
    setFileSize(formattedSize);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/process-doc', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Failed to parse the file';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch (_) {
          try {
            const textMsg = await response.text();
            errorMsg = textMsg || errorMsg;
          } catch (_) {}
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      setExtractedText(data.text);
      setWordCount(data.wordCount);
      setMindMap(data.mindMap);
      
      // Set initial assistant message
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: `Successfully uploaded and processed **${file.name}** (${data.wordCount.toLocaleString()} words). 

I have analyzed the document. You can now ask me any questions based on it. Use the suggested prompts below or type your own question!`
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setDocError(err.message || 'An error occurred while uploading. Please check the file type.');
      setFileName(null);
      setFileSize(null);
      setExtractedText(null);
      setWordCount(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Drag-and-drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeDocument = () => {
    setFileName(null);
    setFileSize(null);
    setWordCount(null);
    setExtractedText(null);
    setMindMap(null);
    setDocError(null);
    setMessages([]);
    setChatError(null);
    setActiveTab('document');
    setLeftActiveTab('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Chat actions
  const handleSendMessage = async (forcedQuery?: string) => {
    const query = (forcedQuery || inputValue).trim();
    if (!query || !extractedText || isGenerating) return;

    if (!forcedQuery) setInputValue('');
    setChatError(null);

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      // Extract prior dialogue history (skipping welcome)
      const chatHistory = messages
        .filter((msg) => msg.id !== 'welcome')
        .map((msg) => ({
          role: msg.role,
          text: msg.text,
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText: extractedText,
          question: query,
          history: chatHistory,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to communicate with assistant';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch (_) {
          try {
            const textMsg = await response.text();
            errorMsg = textMsg || errorMsg;
          } catch (_) {}
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          text: data.text,
        },
      ]);
    } catch (err: any) {
      console.error(err);
      setChatError(err.message || 'Failed to retrieve response from Gemini. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Inline basic markdown formatter for bolding, bullet points, and numbered lists
  const formatMessageText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let cleanLine = line;
      const boldRegex = /\*\*(.*?)\*\*/g;

      const isBullet = line.trim().startsWith('* ') || line.trim().startsWith('- ');
      const isNumList = /^\d+\.\s/.test(line.trim());

      if (isBullet) {
        cleanLine = line.trim().substring(2);
      } else if (isNumList) {
        cleanLine = line.trim().replace(/^\d+\.\s/, '');
      }

      // Convert bold matches to React tags
      const parts = [];
      let lastIdx = 0;
      let match;
      while ((match = boldRegex.exec(cleanLine)) !== null) {
        if (match.index > lastIdx) {
          parts.push(cleanLine.substring(lastIdx, match.index));
        }
        parts.push(<strong key={match.index} style={{ fontWeight: '600', color: 'var(--brand-primary)' }}>{match[1]}</strong>);
        lastIdx = boldRegex.lastIndex;
      }
      if (lastIdx < cleanLine.length) {
        parts.push(cleanLine.substring(lastIdx));
      }

      const content = parts.length > 0 ? parts : cleanLine;

      if (isBullet) {
        return (
          <li key={idx} style={{ marginLeft: '1.25rem', listStyleType: 'disc', marginBottom: '0.25rem' }}>
            {content}
          </li>
        );
      }
      if (isNumList) {
        return (
          <li key={idx} style={{ marginLeft: '1.25rem', listStyleType: 'decimal', marginBottom: '0.25rem' }}>
            {content}
          </li>
        );
      }

      return (
        <p key={idx} style={{ marginBottom: line.trim() === '' ? '0.75rem' : '0.35rem' }}>
          {content}
        </p>
      );
    });
  };

  const suggestedPrompts = [
    "Summarize this document in 3 bullet points.",
    "What are the main key takeaways?",
    "Identify any important figures, dates, or values.",
    "Provide a brief overview of the primary topic."
  ];

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="header">
        <div className="logo-container">
          <div className="logo-icon">D</div>
          <h1 className="logo-text">
            Doc<span className="logo-accent">Ask</span>
          </h1>
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Powered by Gemini AI
        </div>
      </header>

      {/* Mobile Tab Toggle */}
      <div className="mobile-tabs" id="mobile-tabs-container">
        <button 
          id="tab-btn-doc"
          className={`mobile-tab-btn ${activeTab === 'document' ? 'active' : ''}`}
          onClick={() => { setActiveTab('document'); setLeftActiveTab('upload'); }}
        >
          <FileText size={15} /> Doc
        </button>
        {extractedText && (
          <button 
            id="tab-btn-map"
            className={`mobile-tab-btn ${activeTab === 'mindmap' ? 'active' : ''}`}
            onClick={() => { setActiveTab('mindmap'); setLeftActiveTab('mindmap'); }}
          >
            <Sparkles size={15} /> Map
          </button>
        )}
        <button 
          id="tab-btn-chat"
          className={`mobile-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          disabled={!extractedText}
          onClick={() => setActiveTab('chat')}
          style={{ opacity: !extractedText ? 0.5 : 1 }}
        >
          <MessageSquare size={15} /> Chat {!extractedText && '(Locked)'}
        </button>
      </div>

      {/* Main Workspace Layout */}
      <main className="main-workspace">
        
        {/* Left Side: Document Panel */}
        <section 
          id="doc-panel-section"
          className={`left-panel ${activeTab === 'document' || activeTab === 'mindmap' ? 'active' : ''}`}
        >
          {extractedText && (
            <div className="left-panel-tabs">
              <button
                className={`left-tab-btn ${leftActiveTab === 'upload' ? 'active' : ''}`}
                onClick={() => setLeftActiveTab('upload')}
              >
                Document Info
              </button>
              <button
                className={`left-tab-btn ${leftActiveTab === 'mindmap' ? 'active' : ''}`}
                onClick={() => setLeftActiveTab('mindmap')}
              >
                Concept Map
              </button>
            </div>
          )}

          {leftActiveTab === 'upload' ? (
            <>
              <div className="card">
                <h2 className="card-title">
                  <Upload size={18} className="doc-meta-icon" /> Upload Document
                </h2>
                
                {/* Drag and Drop Zone */}
                {!fileName && (
                  <div 
                    id="drop-zone-area"
                    className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerUploadClick}
                  >
                    <input 
                      id="file-selector-input"
                      type="file" 
                      className="hidden-file-input" 
                      ref={fileInputRef} 
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.txt,.md"
                    />
                    <div className="upload-icon">
                      <Upload size={24} />
                    </div>
                    <p className="upload-text">Drag & drop your file here</p>
                    <p className="upload-hint">or click to browse from device</p>
                    <p className="upload-hint" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                      Supports PDF, Word (.docx), TXT, or MD
                    </p>
                  </div>
                )}

                {/* Document processing state */}
                {isProcessing && (
                  <div className="status-banner processing" id="status-processing-banner">
                    <div className="loading-dots">
                      <div className="loading-dot"></div>
                      <div className="loading-dot"></div>
                      <div className="loading-dot"></div>
                    </div>
                    Processing document...
                  </div>
                )}

                {/* Document error state */}
                {docError && (
                  <div className="status-banner error" id="status-error-banner">
                    <AlertCircle size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{docError}</span>
                  </div>
                )}

                {/* Document details when uploaded successfully */}
                {extractedText && fileName && (
                  <div className="doc-info" id="uploaded-doc-details">
                    <div className="doc-meta">
                      <FileText className="doc-meta-icon" size={24} />
                      <div style={{ overflow: 'hidden' }}>
                        <div className="doc-name" title={fileName}>{fileName}</div>
                        <div className="doc-size">{fileSize}</div>
                      </div>
                      <button 
                        id="btn-remove-document"
                        onClick={removeDocument} 
                        className="btn-remove-doc" 
                        title="Remove Document"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="status-banner success">
                      <CheckCircle2 size={16} /> Document processed successfully!
                    </div>

                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span>Estimated Words:</span>
                        <span style={{ fontWeight: 600 }}>{wordCount?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Guidelines / Quick Prompts Card */}
              {extractedText && (
                <div className="card" id="quick-prompts-card" style={{ animation: 'fadeIn 0.4s ease-out' }}>
                  <h2 className="card-title">
                    <Sparkles size={18} className="doc-meta-icon" /> Suggested Prompts
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Click a prompt below to quickly ask the assistant about the uploaded document:
                  </p>
                  <div className="suggestions-grid">
                    {suggestedPrompts.map((prompt, idx) => (
                      <button 
                        key={idx}
                        className="suggestion-btn"
                        onClick={() => handleSendMessage(prompt)}
                        disabled={isGenerating}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '400px', padding: '1.25rem', overflow: 'hidden' }}>
              <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>
                <Sparkles size={18} className="doc-meta-icon" /> Concept Map
              </h2>
              {mindMap ? (
                <MindMap data={mindMap} onAskQuestion={handleSendMessage} />
              ) : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', padding: '3rem 1rem' }}>
                  <div className="loading-dots">
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                    <div className="loading-dot"></div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Generating interactive concept map...</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Side: Chat Panel */}
        <section 
          id="chat-panel-section"
          className={`right-panel ${activeTab === 'chat' ? 'active' : ''}`}
        >
          <div className="chat-container">
            
            {/* Chat History Panel */}
            <div className="chat-history">
              {messages.length === 0 ? (
                <div className="chat-welcome" id="empty-chat-welcome">
                  <div className="chat-welcome-icon">
                    <MessageSquare size={36} />
                  </div>
                  <h3 className="chat-welcome-title">Ask Your Document</h3>
                  <p className="chat-welcome-desc">
                    {extractedText 
                      ? "The document is ready! Ask questions, request summaries, or check specific figures."
                      : "Please upload a PDF, Word document, or TXT file on the left side to start asking questions."
                    }
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`message-bubble ${msg.role}`}
                  >
                    <div className="message-avatar">
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div className="message-content-wrapper">
                      <span className="message-sender">
                        {msg.role === 'user' ? 'You' : 'Assistant'}
                      </span>
                      <div className="message-text">
                        {formatMessageText(msg.text)}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Loader during API calls */}
              {isGenerating && (
                <div className="message-bubble assistant" id="chat-generating-bubble">
                  <div className="message-avatar">AI</div>
                  <div className="message-content-wrapper">
                    <span className="message-sender">Assistant</span>
                    <div className="message-text" style={{ padding: '0.5rem 1rem' }}>
                      <div className="loading-dots">
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                        <div className="loading-dot"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat-level error indicators */}
              {chatError && (
                <div className="status-banner error" id="chat-error-indicator" style={{ alignSelf: 'center', maxWidth: '80%' }}>
                  <AlertCircle size={16} />
                  <span>{chatError}</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Textbox */}
            <div className="chat-input-area">
              <div className="chat-input-wrapper">
                <textarea
                  id="chat-message-textbox"
                  className="chat-input"
                  placeholder={extractedText 
                    ? "Ask a question about the document..." 
                    : "Upload a document first to start chatting..."
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!extractedText || isGenerating}
                  rows={1}
                />
                <button
                  id="btn-send-message"
                  className="chat-send-btn"
                  onClick={() => handleSendMessage()}
                  disabled={!extractedText || !inputValue.trim() || isGenerating}
                  title="Send Message"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
            
          </div>
        </section>

      </main>
    </div>
  );
}
