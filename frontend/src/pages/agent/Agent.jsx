import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Terminal, Send, Cpu, ShieldAlert, BookOpen, Trash2, Plus, 
  Search, Shield, ShieldAlert as AlertIcon, AlertTriangle, 
  Activity, Settings, Sliders, Database, User, Check, RefreshCw
} from 'lucide-react';
import apiClient from '../../api/client';
import './Agent.css';
import ThreatIntelPanel from '../../components/ThreatIntelPanel';

export default function Agent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const analyzeAttackId = searchParams.get('analyze_attack');

  // List of active conversations
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Input settings
  const [inputValue, setInputValue] = useState('');
  const [modelName, setModelName] = useState('llama3.2:3b');
  const [availableModels, setAvailableModels] = useState([]);
  const [agentStatus, setAgentStatus] = useState('OFFLINE');
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Selected threat context
  const [selectedAttack, setSelectedAttack] = useState(null);
  const [selectedIntelIp, setSelectedIntelIp] = useState(null);

  // Settings Overlay Configurations
  const [temp, setTemp] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [systemPrompt, setSystemPrompt] = useState('Zero-Trust SOC Assistant');

  const messagesEndRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Fetch conversations list
  const fetchConversations = async () => {
    try {
      const data = await apiClient.get('/agent/conversations');
      setConversations(data);
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  };

  // Fetch Ollama Status & Available Models
  const fetchAgentStatus = async () => {
    try {
      setIsSyncing(true);
      const status = await apiClient.get('/agent/status');
      setAgentStatus(status.status);
      setAvailableModels(status.models_available);
      
      // Load default model from platform setting or first available
      if (status.models_available.length > 0 && !modelName) {
        setModelName(status.models_available[0]);
      }
    } catch (e) {
      setAgentStatus('OFFLINE');
    } finally {
      setIsSyncing(false);
    }
  };

  // Load a single conversation detail
  const handleSelectConversation = async (conv) => {
    try {
      setLoading(true);
      const detail = await apiClient.get(`/agent/conversations/${conv.id}`);
      setCurrentConversation(detail);
      setMessages(detail.messages);
      
      // Load linked attack context if present
      if (detail.linked_attack_id) {
        const attackDetails = await apiClient.get(`/attacks/${detail.linked_attack_id}`);
        setSelectedAttack(attackDetails);
      } else {
        setSelectedAttack(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Start a new blank conversation
  const handleNewConversation = () => {
    setCurrentConversation(null);
    setMessages([
      { 
        role: 'assistant', 
        content: 'Hello! I am your local cyber defense assistant. I analyze honeypot payloads, log entries, and suggest active mitigation tactics. Ask me anything about current platform events.' 
      }
    ]);
    setSelectedAttack(null);
    setSearchParams({});
  };

  // Delete conversation
  const handleDeleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/agent/conversations/${id}`);
      fetchConversations();
      if (currentConversation?.id === id) {
        handleNewConversation();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Send message
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text.trim() || loading) return;

    if (!textToSend) {
      setInputValue('');
    }

    const convId = currentConversation?.conversation_key || null;
    const userMsg = { role: 'user', content: text, created_at: new Date() };
    const tempMessages = [...messages, userMsg];
    
    // Add placeholder assistant message that will be populated with the stream chunks
    const assistantMsgIndex = tempMessages.length;
    setMessages([...tempMessages, { role: 'assistant', content: '', isStreaming: true }]);
    setLoading(true);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
      const response = await fetch(`${apiBase}/agent/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          model: modelName,
          conversation_id: convId,
          context: selectedAttack ? { attack_id: selectedAttack.id } : null,
          temperature: temp,
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let finished = false;
      let accumulatedText = '';
      let conversationKey = convId;
      let leftover = '';

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) {
          finished = true;
          break;
        }

        const chunkStr = decoder.decode(value, { stream: true });
        const combined = leftover + chunkStr;
        const lines = combined.split('\n');
        leftover = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          if (trimmed.startsWith('data: ')) {
            const rawJson = trimmed.substring(6).trim();
            if (!rawJson) continue;
            try {
              const data = JSON.parse(rawJson);
              if (data.done) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMsgIndex] = {
                    role: 'assistant',
                    content: accumulatedText || data.text,
                    model: data.model,
                    latency: data.latency,
                    isStreaming: false,
                    created_at: new Date()
                  };
                  return updated;
                });
                
                if (!currentConversation && data.conversation_id) {
                  conversationKey = data.conversation_id;
                }
              } else {
                accumulatedText += data.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[assistantMsgIndex] = {
                    role: 'assistant',
                    content: accumulatedText,
                    isStreaming: true,
                    created_at: new Date()
                  };
                  return updated;
                });
              }
            } catch (err) {
              console.error("Failed to parse chunk JSON:", err, "Line:", line);
            }
          }
        }
      }

      if (leftover && leftover.trim().startsWith('data: ')) {
        const rawJson = leftover.trim().substring(6).trim();
        try {
          const data = JSON.parse(rawJson);
          if (data.done) {
            setMessages(prev => {
              const updated = [...prev];
              updated[assistantMsgIndex] = {
                role: 'assistant',
                content: accumulatedText || data.text,
                model: data.model,
                latency: data.latency,
                isStreaming: false,
                created_at: new Date()
              };
              return updated;
            });
            if (!currentConversation && data.conversation_id) {
              conversationKey = data.conversation_id;
            }
          } else {
            accumulatedText += data.text;
            setMessages(prev => {
              const updated = [...prev];
              updated[assistantMsgIndex] = {
                role: 'assistant',
                content: accumulatedText,
                isStreaming: true,
                created_at: new Date()
              };
              return updated;
            });
          }
        } catch (err) {}
      }

      // Sync conversations list
      const updatedConvs = await apiClient.get('/agent/conversations');
      setConversations(updatedConvs);
      if (!currentConversation && conversationKey) {
        const match = updatedConvs.find(c => c.conversation_key === conversationKey);
        if (match) {
          const detail = await apiClient.get(`/agent/conversations/${match.id}`);
          setCurrentConversation(detail);
        }
      }
    } catch (err) {
      const isTimeout = (err.message || '').toLowerCase().includes('timeout');
      const fallbackMsg = isTimeout 
        ? "The local AI model is online but took too long to respond. Try a smaller model, reduce max tokens, or retry."
        : `Security Copilot was unable to get a response: ${err.message || 'Connection failed.'}. Utilizing local rule fallback.`;
      
      setMessages([...tempMessages, { 
        role: 'assistant', 
        content: fallbackMsg, 
        created_at: new Date()
      }]);
    } finally {
      setLoading(false);
      fetchConversations();
    }
  };

  // Trigger Automatic Attack Analysis (from URL or Context click)
  const triggerAttackAnalysis = async (attackId) => {
    try {
      setLoading(true);
      const attackDetails = await apiClient.get(`/attacks/${attackId}`);
      setSelectedAttack(attackDetails);
      
      const analysis = await apiClient.post(`/agent/analyze/${attackId}`);
      
      // Load newly created analysis conversation key
      const updatedConvs = await apiClient.get('/agent/conversations');
      setConversations(updatedConvs);
      
      const match = updatedConvs.find(c => c.conversation_key === analysis.conversation_id);
      if (match) {
        const detail = await apiClient.get(`/agent/conversations/${match.id}`);
        setCurrentConversation(detail);
        setMessages(detail.messages);
      }
    } catch (e) {
      console.error("Attack analysis failed:", e);
      const isTimeout = (e.message || '').toLowerCase().includes('timeout') || e.code === 'ECONNABORTED';
      const fallbackMsg = isTimeout 
        ? "The local AI model is online but took too long to respond. Try a smaller model, reduce max tokens, or retry."
        : `Analysis failed: ${e.message || 'Server connection error.'}`;
      setMessages([
        { role: 'assistant', content: fallbackMsg }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Check URL query parameters for analyze link on mount
  useEffect(() => {
    fetchConversations();
    fetchAgentStatus();
    
    const enrichIp = searchParams.get('enrich_ip');
    if (enrichIp) {
      setSelectedIntelIp(enrichIp);
    }
    
    if (analyzeAttackId) {
      triggerAttackAnalysis(analyzeAttackId);
    }
  }, [analyzeAttackId, searchParams]);

  const quickActions = [
    { label: "Explain Attack", query: "Can you provide a clear description and root cause summary of this attack vector?" },
    { label: "Recommend Firewall Rule", query: "Generate a block rule or routing recommendation to mitigate traffic from this source IP." },
    { label: "Explain Payload", query: "Break down the raw elements, query injections, or traverse keys found in this payload." },
    { label: "Map to MITRE", query: "Explain what MITRE ATT&CK technique IDs match this capture and why." },
    { label: "IOC Summary", query: "Summarize the indicators of compromise (IP, port, signature patterns) for this event." },
  ];

  // Inline badge highlights helper
  const formatInlineTags = (line) => {
    const mitreRegex = /\b(T\d{4}(?:\.\d{3})?)\b/g;
    const percentRegex = /\b(\d{1,3}%)\b/g;
    const ipRegex = /\b((?:[0-9]{1,3}\.){3}[0-9]{1,3})\b/g;
    
    const mitreMatches = [...line.matchAll(mitreRegex)];
    const percentMatches = [...line.matchAll(percentRegex)];
    const ipMatches = [...line.matchAll(ipRegex)];
    
    if (mitreMatches.length === 0 && percentMatches.length === 0 && ipMatches.length === 0) {
      return line;
    }
    
    let currentText = line;
    currentText = currentText.replace(mitreRegex, '##MITRE_START##$1##MITRE_END##');
    currentText = currentText.replace(percentRegex, '##PCT_START##$1##PCT_END##');
    currentText = currentText.replace(ipRegex, '##IP_START##$1##IP_END##');
    
    const splitParts = currentText.split(/(##MITRE_START##.*?##MITRE_END##|##PCT_START##.*?##PCT_END##|##IP_START##.*?##IP_END##)/g);
    
    return splitParts.map((part, pidx) => {
      if (part.startsWith('##MITRE_START##')) {
        const id = part.replace('##MITRE_START##', '').replace('##MITRE_END##', '');
        return <span key={pidx} className="inline-mitre-badge">{id}</span>;
      }
      if (part.startsWith('##PCT_START##')) {
        const pct = part.replace('##PCT_START##', '').replace('##PCT_END##', '');
        return <span key={pidx} className="inline-percent-badge">{pct}</span>;
      }
      if (part.startsWith('##IP_START##')) {
        const ipVal = part.replace('##IP_START##', '').replace('##IP_END##', '');
        return (
          <span 
            key={pidx} 
            className="clickable-ip-address"
            onClick={() => setSelectedIntelIp(ipVal)}
            title="Click to query Threat Intelligence profile"
          >
            {ipVal}
          </span>
        );
      }
      return part;
    });
  };

  // Custom Markdown renderer inside bubble
  const renderMarkdown = (text) => {
    if (!text) return "";
    const parts = text.split("```");
    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        const lines = part.split("\n");
        const lang = lines[0];
        const code = lines.slice(1).join("\n");
        return (
          <pre key={idx} className="markdown-code-block font-mono">
            <div className="code-lang-label">{lang || "code"}</div>
            <code>{code}</code>
          </pre>
        );
      }
      
      const lines = part.split("\n");
      return lines.map((line, lIdx) => {
        if (line.startsWith("### ")) {
          return <h5 key={lIdx} className="md-h3 font-bold text-cyan mt-3">{formatInlineTags(line.replace("### ", ""))}</h5>;
        }
        if (line.startsWith("## ")) {
          return <h4 key={lIdx} className="md-h2 font-bold text-cyan mt-3">{formatInlineTags(line.replace("## ", ""))}</h4>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <li key={lIdx} className="md-li list-disc ml-4 font-mono text-xs">{formatInlineTags(line.substring(2))}</li>;
        }
        if (line.trim() === "") return <div key={lIdx} className="h-2"></div>;
        return <p key={lIdx} className="md-p my-1 font-mono text-xs leading-relaxed">{formatInlineTags(line)}</p>;
      });
    });
  };

  const filteredConversations = conversations.filter(c => 
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="copilot-container">
      {/* CENTER PANEL: Chat Workspace (Expanded) */}
      <section className="copilot-center card-cyber">
        {/* Header Console controls */}
        <div className="copilot-workspace-header border-bottom">
          <div className="header-conv-info">
            <span className="conv-title font-mono text-cyan">
              {currentConversation ? currentConversation.title.toUpperCase() : "ACTIVE_SECURITY_COPILOT"}
            </span>
          </div>

          <div className="header-controls font-mono text-xs">
            <button 
              className="btn-new-chat-header font-mono text-xxs"
              onClick={handleNewConversation}
              title="Start a new investigation session"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={12} />
              NEW CHAT
            </button>

            <div className="control-item">
              <span className="text-muted">LLM:</span>
              <select 
                value={modelName} 
                onChange={(e) => setModelName(e.target.value)}
                disabled={availableModels.length === 0}
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {availableModels.length === 0 && (
                  <option value="llama3.2:3b">llama3.2:3b (default)</option>
                )}
              </select>
            </div>
            
            <div className="control-item">
              <span className="text-muted">STATUS:</span>
              <span className={`status-tag status-${agentStatus.toLowerCase()}`}>{agentStatus}</span>
            </div>

            <button 
              className={`sync-btn-copilot ${isSyncing ? 'syncing' : ''}`}
              onClick={fetchAgentStatus}
              title="Refresh models discovery"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Message threads list */}
        <div className="copilot-messages-container scroll-bar">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div key={index} className={`msg-bubble-wrapper ${msg.role}`}>
                <div className={`msg-bubble ${msg.role}`}>
                  <div className="msg-meta font-mono text-xxs">
                    <span className="msg-sender">
                      {isUser ? <User size={10} className="icon-role" /> : <Cpu size={10} className="icon-role text-purple" />}
                      {isUser ? 'OPERATOR' : 'SECURITY_COPILOT_AI'}
                    </span>
                    {msg.latency > 0 && (
                      <span className="msg-latency text-muted">({msg.latency.toFixed(2)}s)</span>
                    )}
                  </div>
                  <div className="msg-text">
                    {renderMarkdown(msg.content)}
                    {msg.isStreaming && (
                      <span className="blinking-cursor text-purple font-bold ml-1">_</span>
                    )}
                    {msg.role === 'assistant' && msg.latency > 20 && (
                      <div className="latency-warning font-mono text-xxs mt-2 pt-2 flex items-center gap-2" style={{ color: '#ffd32a', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <AlertTriangle size={10} />
                        <span>Local model is responding slowly. For faster responses, use a smaller model or reduce max tokens.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="msg-bubble-wrapper assistant">
              <div className="msg-bubble assistant typing-bubble-card">
                <div className="msg-meta font-mono text-xxs">
                  <span className="msg-sender text-purple">
                    <Cpu size={10} className="icon-role text-purple" />
                    SECURITY_COPILOT_AI
                  </span>
                </div>
                <div className="typing-indicator-wrapper">
                  <div className="typing-indicator">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                  <span className="typing-label font-mono text-xxs text-muted">Security Copilot is analyzing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick action triggers */}
        <div className="copilot-quick-actions font-mono text-xs">
          {quickActions.map(action => (
            <button 
              key={action.label} 
              className="quick-action-btn"
              onClick={() => handleSendMessage(action.query)}
              disabled={loading || !selectedAttack}
              title={!selectedAttack ? "Link an attack context on the right to trigger" : ""}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Input message box */}
        <div className="copilot-input-area">
          <input 
            type="text" 
            placeholder={selectedAttack ? "Ask Copilot to investigate this payload..." : "Ask general cybersecurity query..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={loading}
          />
          <button 
            className="btn-send-copilot"
            onClick={() => handleSendMessage()}
            disabled={loading || !inputValue.trim()}
          >
            <Send size={14} />
          </button>
        </div>
      </section>

      {/* 3. RIGHT PANEL: SOC Context & Settings */}
      <aside className="copilot-right">
        {/* Threat context box */}
        <div className="card-cyber copilot-context-card">
          <h5 className="section-title"><Shield size={14} className="text-cyan" /> Threat Telemetry Context</h5>
          {selectedIntelIp ? (
            <ThreatIntelPanel ip={selectedIntelIp} onClose={() => setSelectedIntelIp(null)} />
          ) : selectedAttack ? (
            <div className="context-details font-mono text-xs">
              <div className="context-row font-bold text-red border-bottom pb-2">
                <span>{selectedAttack.attack_type}</span>
              </div>
              <div className="context-row">
                <span className="text-muted">Severity:</span>
                <span className={`badge badge-${selectedAttack.severity.toLowerCase()}`}>{selectedAttack.severity}</span>
              </div>
              <div className="context-row">
                <span className="text-muted">Source IP:</span>
                <span className="text-primary">{selectedAttack.source_ip}:{selectedAttack.source_port}</span>
              </div>
              <div className="context-row">
                <span className="text-muted">Protocol / Port:</span>
                <span>{selectedAttack.protocol} / {selectedAttack.destination_port}</span>
              </div>
              <div className="context-row">
                <span className="text-muted">Confidence:</span>
                <span className="text-cyan">{(selectedAttack.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="context-payload-box mt-2">
                <span className="text-muted text-xxs uppercase block mb-1">Captured Payload snippet:</span>
                <pre className="payload-snippet scroll-bar text-xxs font-mono">{selectedAttack.payload || 'No raw payload captured'}</pre>
              </div>
            </div>
          ) : (
            <div className="empty-context text-center text-muted font-mono text-xs py-4">
              <AlertTriangle size={16} className="block mx-auto mb-2 text-muted" />
              No Threat Context Linked.<br />Select analyze on the Attack Feed.
            </div>
          )}
        </div>

        {/* Hyper-parameters configurations block */}
        <div className="card-cyber copilot-settings-card">
          <h5 className="section-title"><Sliders size={14} className="text-purple" /> Copilot Hyperparameters</h5>
          <div className="settings-controls font-mono text-xs">
            <div className="setting-slider-box">
              <div className="slider-label">
                <span>Temperature:</span>
                <span className="text-cyan font-bold">{temp}</span>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.05"
                value={temp}
                onChange={(e) => setTemp(parseFloat(e.target.value))}
              />
            </div>

            <div className="setting-slider-box">
              <div className="slider-label">
                <span>Max Tokens:</span>
                <span className="text-purple font-bold">{maxTokens}</span>
              </div>
              <input 
                type="range" 
                min="128" 
                max="4096" 
                step="128"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              />
            </div>

            <div className="setting-slider-box">
              <div className="slider-label">
                <span>System Role Directive:</span>
              </div>
              <input 
                type="text" 
                className="text-input-field text-xs font-mono"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
