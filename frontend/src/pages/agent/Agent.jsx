import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Cpu, ShieldAlert, BookOpen, RefreshCw, Server } from 'lucide-react';
import apiClient from '../../api/client';
import './Agent.css';

export default function Agent() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your local cyber defense assistant. I analyze honeypot payloads, log entries, and suggest active mitigation tactics. Ask me anything about current platform events.' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [modelName, setModelName] = useState('llama3.1');
  const [availableModels, setAvailableModels] = useState([]);
  const [agentStatus, setAgentStatus] = useState('OFFLINE');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchAgentStatus = async () => {
    try {
      const status = await apiClient.get('/agent/status');
      setAgentStatus(status.status);
      setAvailableModels(status.models_available);
      if (status.models_available.length > 0) {
        setModelName(status.models_available[0]);
      }
    } catch (e) {
      console.error(e);
      setAgentStatus('OFFLINE');
    }
  };

  useEffect(() => {
    fetchAgentStatus();
  }, []);

  // Scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text.trim() || loading) return;

    if (!textToSend) {
      setInputValue('');
    }

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await apiClient.post('/agent/chat', {
        message: text,
        model: modelName,
        conversation_id: 'conv_session_1'
      });

      setMessages([...newMessages, { role: 'assistant', content: res.message }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message || 'AI generation failed.'}` }]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: "Explain Directory Traversal", query: "Explain directory traversal signatures and mitigation methods." },
    { label: "Suggest SSH blocking steps", query: "Suggest mitigation steps for high-frequency SSH brute force attacks." },
    { label: "What are honeypots?", query: "How do simulated honeypot sensors improve local defensive telemetry?" }
  ];

  return (
    <div className="agent-root">
      {/* Top Header info */}
      <div className="agent-header card-cyber">
        <div className="agent-header-info">
          <Terminal className="text-purple pulse" size={22} />
          <div className="agent-header-title">
            <h4 className="title-cyber">AI Cyber Analyst Console</h4>
            <p className="text-muted">Query local language models to classify payloads and formulate incident responses.</p>
          </div>
        </div>

        <div className="agent-model-selector font-mono">
          <Cpu className="text-muted" size={16} />
          <span className="model-label">Active LLM:</span>
          <select 
            value={modelName} 
            onChange={(e) => setModelName(e.target.value)}
            disabled={availableModels.length === 0}
          >
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
            {availableModels.length === 0 && (
              <option value="llama3.1">llama3.1 (default)</option>
            )}
          </select>
          <span className={`ai-status-light ${agentStatus.toLowerCase()}`} title={`Ollama status: ${agentStatus}`}></span>
        </div>
      </div>

      {/* Main layout: Chat Area + Quick Prompts */}
      <div className="agent-grid">
        {/* Chat window */}
        <div className="chat-box-card card-cyber">
          <div className="chat-messages-container">
            {messages.map((msg, index) => (
              <div key={index} className={`message-row ${msg.role}`}>
                <div className="message-bubble font-mono">
                  <div className="bubble-sender">{msg.role === 'user' ? 'OPERATOR' : 'CYBER_ANALYST_AI'}</div>
                  <div className="bubble-text">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="message-row assistant">
                <div className="message-bubble font-mono typing-bubble">
                  <div className="bubble-sender">CYBER_ANALYST_AI</div>
                  <div className="typing-indicator">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-bar">
            <input 
              type="text" 
              placeholder="Ask the AI Cyber Assistant..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={loading}
            />
            <button 
              className="send-btn" 
              onClick={() => handleSendMessage()}
              disabled={loading || !inputValue.trim()}
            >
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* Quick action prompts & active status sidebar */}
        <div className="quick-prompts-sidebar">
          {/* Active Profile panel */}
          <div className="card-cyber profile-card">
            <h5 className="section-title"><Server size={14} /> Local LLM Service Profile</h5>
            <div className="profile-details font-mono text-xs">
              <div className="profile-row">
                <span className="profile-label">Ollama Host:</span>
                <span className="profile-value text-cyan">http://127.0.0.1:11434</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Model Target:</span>
                <span className="profile-value">{modelName}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Temperature:</span>
                <span className="profile-value text-purple">0.7 (Locked)</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">System Mode:</span>
                <span className="profile-value text-green">Zero-Trust SOC</span>
              </div>
            </div>
          </div>

          {/* Quick Prompts list */}
          <div className="card-cyber prompts-card">
            <h5 className="section-title"><BookOpen size={14} /> Quick Action Prompts</h5>
            <div className="prompts-list">
              {quickPrompts.map((p, idx) => (
                <button 
                  key={idx} 
                  className="prompt-btn font-mono"
                  onClick={() => handleSendMessage(p.query)}
                  disabled={loading}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
