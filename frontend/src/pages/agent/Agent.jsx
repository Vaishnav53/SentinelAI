import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send, Cpu, ShieldAlert, Plus, Shield,
  Activity, Sliders, User, Check, Copy,
  Sparkles, Terminal, FileText, ChevronRight, Zap,
  ThumbsUp, ThumbsDown
} from 'lucide-react';
import apiClient from '../../api/client';
import MarkdownRenderer from './MarkdownRenderer';
import './Agent.css';

const DEFAULT_MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', description: 'Primary high-intelligence reasoning model for deep SOC analysis & threat response' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', description: 'High-speed low-latency reasoning model for rapid telemetry queries & triage' },
  { id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B', description: 'High-throughput open weights reasoning & cybersecurity instruction model' }
];

export default function Agent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const analyzeAttackId = searchParams.get('analyze_attack');
  const analyzeAttackerIp = searchParams.get('analyze_attacker');
  const analyzeIncidentId = searchParams.get('analyze_incident');

  // Conversation state
  const [messages, setMessages] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [inputValue, setInputValue] = useState('');

  // Model & Provider state
  const [modelName, setModelName] = useState('openai/gpt-oss-120b');
  const [availableModels, setAvailableModels] = useState(DEFAULT_MODELS);
  const [providerStatus, setProviderStatus] = useState('ONLINE');
  const [loading, setLoading] = useState(false);
  const [_lastLatency, setLastLatency] = useState(null);

  // Feedback state per message index
  const [feedback, setFeedback] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Selected threat context (Optional background context for investigation)
  const [selectedAttack, setSelectedAttack] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedSandboxId, setSelectedSandboxId] = useState(null);
  const [selectedAttackerIp, setSelectedAttackerIp] = useState(null);

  // Right side panel tabs & telemetry metrics
  const [activeTab, setActiveTab] = useState('telemetry');
  const [attacksList, setAttacksList] = useState([]);
  const [incidentsList, setIncidentsList] = useState([]);
  const [wafSourcesCount, setWafSourcesCount] = useState(0);
  const [activeWafRulesCount, setActiveWafRulesCount] = useState(0);

  const messagesEndRef = useRef(null);
  const activeReaderRef = useRef(null);
  const activeAbortControllerRef = useRef(null);
  const streamIdRef = useRef(0);

  // Scroll to bottom
  const scrollToBottom = (instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom(loading);
  }, [messages, loading]);

  // Clean up active stream reader & abort controller on unmount
  useEffect(() => {
    return () => {
      streamIdRef.current++;
      if (activeAbortControllerRef.current) {
        try {
          activeAbortControllerRef.current.abort();
        } catch {}
        activeAbortControllerRef.current = null;
      }
      if (activeReaderRef.current) {
        try {
          activeReaderRef.current.cancel();
        } catch {}
        activeReaderRef.current = null;
      }
    };
  }, []);

  // Fetch Groq models & Provider status
  const fetchModelsAndStatus = async () => {
    try {
      const [modelsRes, statusRes] = await Promise.all([
        apiClient.get('/agent/models'),
        apiClient.get('/agent/status')
      ]);

      if (modelsRes && modelsRes.models && modelsRes.models.length > 0) {
        setAvailableModels(modelsRes.models);
        setModelName(prev => {
          const isValid = modelsRes.models.some(m => m.id === prev);
          if (!isValid || prev.includes('llama') || prev.includes('mixtral') || prev.includes('gemma')) {
            return modelsRes.default_model || 'openai/gpt-oss-120b';
          }
          return prev;
        });
      }
      if (statusRes && statusRes.status) {
        setProviderStatus(statusRes.status);
      }
    } catch (_err) {
      console.warn("Using default Groq model allowlist:", _err);
      setProviderStatus('ONLINE');
    }
  };

  // Fetch telemetry panel data
  const fetchTelemetryData = async () => {
    try {
      const [attacks, incidents, observed, wafRules] = await Promise.all([
        apiClient.get('/attacks'),
        apiClient.get('/correlation/incidents'),
        apiClient.get('/waf/observed-sources'),
        apiClient.get('/waf/rules')
      ]);
      setAttacksList(attacks || []);
      setIncidentsList(incidents || []);
      setWafSourcesCount(observed ? observed.length : 0);
      setActiveWafRulesCount(wafRules ? wafRules.filter(r => r.is_enabled === 1).length : 0);
    } catch (e) {
      console.error("Failed to load side panel telemetry data:", e);
    }
  };

  useEffect(() => {
    fetchModelsAndStatus();
    fetchTelemetryData();
  }, []);

  // Deep-link context handling for ?analyze_attack=<id> (Loads context without auto-triggering prompts)
  useEffect(() => {
    if (analyzeAttackId) {
      const loadDeepLink = async () => {
        try {
          const attack = await apiClient.get(`/attacks/${analyzeAttackId}`);
          setSelectedAttack(attack);
          setSelectedIncident(null);
          setSelectedAttackerIp(null);
          setSelectedSandboxId(null);
        } catch (e) {
          console.error("Failed to load deep-link attack:", e);
        }
      };
      loadDeepLink();
    }
  }, [analyzeAttackId]);

  // Deep-link context handling for ?analyze_attacker=<ip>
  useEffect(() => {
    if (analyzeAttackerIp) {
      const loadAttackerLink = async () => {
        try {
          const profileData = await apiClient.get(`/attacker/profiles/${analyzeAttackerIp}`);
          setSelectedAttackerIp(analyzeAttackerIp);
          setSelectedAttack(null);
          setSelectedIncident(null);
          setSelectedSandboxId(null);
        } catch (e) {
          console.error("Failed to load deep-link attacker profile:", e);
          setSelectedAttackerIp(analyzeAttackerIp);
        }
      };
      loadAttackerLink();
    }
  }, [analyzeAttackerIp]);

  // Deep-link context handling for ?analyze_incident=<id>
  useEffect(() => {
    if (analyzeIncidentId) {
      const loadIncidentLink = async () => {
        try {
          const incident = await apiClient.get(`/correlation/incidents/${analyzeIncidentId}`);
          setSelectedIncident(incident);
          setSelectedAttack(null);
          setSelectedAttackerIp(null);
          setSelectedSandboxId(null);
        } catch (e) {
          console.error("Failed to load deep-link incident:", e);
        }
      };
      loadIncidentLink();
    }
  }, [analyzeIncidentId]);

  // Start new blank conversation
  const handleNewConversation = () => {
    streamIdRef.current++;
    if (activeAbortControllerRef.current) {
      try {
        activeAbortControllerRef.current.abort();
      } catch {}
      activeAbortControllerRef.current = null;
    }
    if (activeReaderRef.current) {
      try {
        activeReaderRef.current.cancel();
      } catch {}
      activeReaderRef.current = null;
    }
    setCurrentConversation(null);
    setMessages([]);
    setSelectedAttack(null);
    setSelectedIncident(null);
    setSelectedAttackerIp(null);
    setSelectedSandboxId(null);
    setSearchParams({});
    setInputValue('');
    setLoading(false);
  };

  // Send Chat message
  const handleSendMessage = async (textToSend, modeOverride = null, actionName = null) => {
    const text = textToSend || inputValue;
    if (!text.trim() || loading) return;

    if (!textToSend) {
      setInputValue('');
    }

    // Assign unique generation ID to supersede any previous stream
    const streamId = ++streamIdRef.current;

    // Abort and cancel any previous stream request and reader if still active
    if (activeAbortControllerRef.current) {
      try {
        activeAbortControllerRef.current.abort();
      } catch {}
      activeAbortControllerRef.current = null;
    }
    if (activeReaderRef.current) {
      try {
        await activeReaderRef.current.cancel();
      } catch {}
      activeReaderRef.current = null;
    }

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    const responseMode = modeOverride || (actionName ? 'investigator_action' : 'general_chat');
    const convId = currentConversation?.conversation_key || null;
    const userMsg = { role: 'user', content: text, created_at: new Date() };
    const tempMessages = [...messages, userMsg];

    const assistantMsgIndex = tempMessages.length;
    setMessages([...tempMessages, { role: 'assistant', content: '', isStreaming: true }]);
    setLoading(true);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiBase}/agent/chat/stream`, {
        method: 'POST',
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          model: modelName,
          conversation_id: convId,
          response_mode: responseMode,
          action: actionName,
          context: {
            attack_id: selectedAttack ? selectedAttack.id : (searchParams.get('analyze_attack') ? parseInt(searchParams.get('analyze_attack')) : null),
            incident_id: selectedIncident ? selectedIncident.id : (searchParams.get('analyze_incident') ? parseInt(searchParams.get('analyze_incident')) : null),
            sandbox_file_id: selectedSandboxId || null,
            attacker_ip: selectedAttackerIp || searchParams.get('analyze_attacker') || null
          }
        })
      });

      if (streamIdRef.current !== streamId) return;

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      activeReaderRef.current = reader;

      const decoder = new TextDecoder('utf-8');
      let finished = false;
      let accumulatedText = '';
      let leftover = '';
      let lastPublishTime = 0;
      const THROTTLE_MS = 50; // ~20 FPS throttled state publication

      while (!finished) {
        if (streamIdRef.current !== streamId) break;

        const { value, done } = await reader.read();
        if (done || streamIdRef.current !== streamId) {
          finished = true;
          break;
        }

        const chunkStr = decoder.decode(value, { stream: true });
        const combined = leftover + chunkStr;
        const lines = combined.split('\n');
        leftover = lines.pop() || '';

        for (const line of lines) {
          if (streamIdRef.current !== streamId) break;

          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            const rawJson = trimmed.substring(6).trim();
            if (!rawJson) continue;
            try {
              const data = JSON.parse(rawJson);
              if (data.done) {
                if (data.latency !== undefined) {
                  setLastLatency(data.latency);
                }
                // Immediate synchronous final flush on stream completion
                if (streamIdRef.current === streamId) {
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[assistantMsgIndex] = {
                      role: 'assistant',
                      content: accumulatedText || data.text,
                      model: data.model || modelName,
                      latency: data.latency,
                      isStreaming: false,
                      created_at: new Date()
                    };
                    return updated;
                  });
                }
              } else {
                accumulatedText += data.text;
                const now = Date.now();
                if (now - lastPublishTime >= THROTTLE_MS) {
                  lastPublishTime = now;
                  if (streamIdRef.current === streamId) {
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[assistantMsgIndex] = {
                        role: 'assistant',
                        content: accumulatedText,
                        model: modelName,
                        isStreaming: true,
                        created_at: new Date()
                      };
                      return updated;
                    });
                  }
                }
              }
            } catch (e) {
              console.error("Chunk parse error:", e);
            }
          }
        }
      }

      // Safety final check: if stream finished without data.done event, ensure accumulated content is flushed
      if (streamIdRef.current === streamId) {
        setMessages(prev => {
          if (prev[assistantMsgIndex]?.isStreaming) {
            const updated = [...prev];
            updated[assistantMsgIndex] = {
              role: 'assistant',
              content: accumulatedText,
              model: modelName,
              isStreaming: false,
              created_at: new Date()
            };
            return updated;
          }
          return prev;
        });
      }

    } catch (err) {
      if (streamIdRef.current === streamId && err.name !== 'AbortError') {
        console.error("Chat stream error:", err);
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantMsgIndex] = {
            role: 'assistant',
            content: `⚠️ Communication error: ${err.message || 'Failed to reach AI Copilot API'}. Please verify backend status and Groq Cloud connection.`,
            isError: true,
            isStreaming: false,
            created_at: new Date()
          };
          return updated;
        });
      }
    } finally {
      if (streamIdRef.current === streamId) {
        activeAbortControllerRef.current = null;
        activeReaderRef.current = null;
        setLoading(false);
      }
    }
  };

  // Copy plain textual message to clipboard (No SVG / icon text contamination)
  const handleCopyMessage = (text, index) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle message feedback
  const handleFeedback = (index, type) => {
    setFeedback(prev => ({
      ...prev,
      [index]: prev[index] === type ? null : type
    }));
  };

  // Quick Action / Prompt handlers
  const handleQuickAction = (label) => {
    if (!selectedAttack) return;
    let queryText = "";
    switch (label) {
      case "Explain Attack":
        queryText = `Analyze and explain the root cause, severity, and potential vector of attack event #${selectedAttack.id} (${selectedAttack.attack_type}) targeting service ${selectedAttack.target_service} on port ${selectedAttack.destination_port}.`;
        break;
      case "Recommend Firewall Rule":
        queryText = `Generate concrete, actionable firewall block rules and WAF filtering guidelines to mitigate future malicious traffic from source IP ${selectedAttack.source_ip}.`;
        break;
      case "Explain Payload":
        queryText = `Perform a deep technical dissection of the captured payload for attack event #${selectedAttack.id}: "${selectedAttack.payload || 'No raw payload data captured'}".`;
        break;
      case "Map to MITRE":
        queryText = `Map attack event #${selectedAttack.id} (${selectedAttack.attack_type}) to specific MITRE ATT&CK techniques, tactics, and mitigation IDs.`;
        break;
      case "IOC Summary":
        queryText = `Compile a formal Indicators of Compromise (IOC) summary details list for attack event #${selectedAttack.id} containing source IP (${selectedAttack.source_ip}), target port (${selectedAttack.destination_port}), protocol (${selectedAttack.protocol}), and threat score (${selectedAttack.threat_score}/100).`;
        break;
      default:
        return;
    }
    handleSendMessage(queryText, "security_analysis");
  };

  const handleInvestigationAction = (action) => {
    if (!selectedIncident && !selectedAttack) return;
    const targetName = selectedIncident
      ? `incident ID-${selectedIncident.id} ("${selectedIncident.title}")`
      : `attack event HON-${selectedAttack.id} (${selectedAttack.attack_type})`;

    let queryText = "";
    switch (action) {
      case "Analyze Incident":
        queryText = `Conduct a detailed SOC analysis and investigation of ${targetName}. Summarize target services, attack vector, threat severity, and potential progression paths.`;
        break;
      case "Explain Severity":
        queryText = `Analyze the severity metrics of ${targetName}. Detail why it is classified at this severity, and describe the potential threat impacts.`;
        break;
      case "Extract IOCs":
        queryText = `Perform a comprehensive Indicators of Compromise (IOC) extraction for ${targetName}. Tabulate malicious source IPs, target ports, protocol headers, and payload signatures.`;
        break;
      case "Recommend Containment":
        queryText = `Generate concrete WAF filtering guidelines, firewall routing blocks, and immediate host isolation recommendations to contain ${targetName}.`;
        break;
      case "Map to MITRE":
        queryText = `Map ${targetName} to the MITRE ATT&CK enterprise matrix. Detail matching technique codes and mitigation strategies.`;
        break;
      case "Generate Timeline":
        queryText = `Reconstruct the threat campaign execution timeline for ${targetName}. Order the steps from initial scan activity to payload delivery.`;
        break;
      case "Executive Summary":
        queryText = `Prepare a concise, non-technical executive security brief summarizing the threat vector, business risk, and containment status of ${targetName}.`;
        break;
      default:
        return;
    }
    handleSendMessage(queryText, "investigator_action", action);
  };

  const getModelLabel = (modelId) => {
    const found = availableModels.find(m => m.id === modelId);
    return found ? found.label : modelId;
  };

  const highSeverityCount = attacksList.filter(a => ['HIGH', 'CRITICAL'].includes((a.severity || '').toUpperCase())).length;

  return (
    <div className="agent-page-container">
      {/* Top Model & Action Bar */}
      <header className="agent-top-bar card-cyber">
        <div className="top-bar-left">
          <div className="model-selector-group">
            <span className="model-selector-label font-mono">ACTIVE MODEL</span>
            <select
              className="model-select-dropdown font-mono"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            >
              {availableModels.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <button className="btn-new-chat font-mono" onClick={handleNewConversation}>
            <Plus size={14} />
            <span>NEW CHAT</span>
          </button>
        </div>

        <div className="top-bar-right font-mono">
          <div className="provider-badge">
            <span className="pb-label">PROVIDER:</span>
            <span className="pb-val">Groq Cloud</span>
          </div>
          <div className={`status-badge ${providerStatus.toLowerCase()}`}>
            <span className="status-dot-inner"></span>
            <span>{providerStatus}</span>
          </div>
        </div>
      </header>

      {/* Main Copilot Body Container */}
      <div className="agent-body-container">
        {/* Left / Center AI Chat Workspace */}
        <section className="agent-chat-section card-cyber">
          <div className="chat-messages-scroll-container">
            {messages.length === 0 ? (
              /* Polished Initial Copilot Welcome Card */
              <div className="copilot-welcome-card animate-fade-in">
                <div className="welcome-avatar-icon">
                  <Cpu size={32} className="text-cyan pulse" />
                </div>
                <h3 className="welcome-title font-mono">SentinelAI Copilot</h3>
                <p className="welcome-subtitle font-mono">AI-Powered Security Operations Companion</p>
                <p className="welcome-desc">
                  Ask me about active threats, incidents, defensive strategies, attack analysis, IOC interpretation, or general technical questions.
                </p>

                <div className="suggested-prompts-section">
                  <div className="sp-header font-mono">
                    <Sparkles size={14} className="text-cyan" />
                    <span>Try asking me about:</span>
                  </div>
                  <div className="suggested-prompts-grid">
                    <button
                      className="prompt-chip-btn font-mono"
                      onClick={() => handleSendMessage("Analyze the most recent high-severity attack events captured by SentinelAI.")}
                    >
                      <ShieldAlert size={14} className="text-red" />
                      <span>Analyze recent attacks</span>
                    </button>
                    <button
                      className="prompt-chip-btn font-mono"
                      onClick={() => handleSendMessage("Recommend active WAF and IP containment firewall rules for detected threat sources.")}
                    >
                      <Shield size={14} className="text-green" />
                      <span>Recommend firewall rules</span>
                    </button>
                    <button
                      className="prompt-chip-btn font-mono"
                      onClick={() => handleSendMessage("Explain common web intrusion signatures such as SQL Injection and Path Traversal.")}
                    >
                      <Terminal size={14} className="text-purple" />
                      <span>Explain a payload</span>
                    </button>
                    <button
                      className="prompt-chip-btn font-mono"
                      onClick={() => handleSendMessage("Provide a MITRE ATT&CK mapping of observed honeypot and WAF attack signatures.")}
                    >
                      <Activity size={14} className="text-cyan" />
                      <span>Map to MITRE ATT&CK</span>
                    </button>
                    <button
                      className="prompt-chip-btn font-mono"
                      onClick={() => handleSendMessage("Summarize the key Indicators of Compromise (IOCs) across all active attack logs.")}
                    >
                      <FileText size={14} className="text-amber" />
                      <span>Generate IOC summary</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Chat Conversation Message Thread */
              <div className="chat-thread">
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={index} className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
                      {!isUser && (
                        <div className="assistant-avatar-box">
                          <Cpu size={16} className="text-cyan" />
                        </div>
                      )}
                      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'} ${msg.isError ? 'error-bubble' : ''}`}>
                        <div className="message-header font-mono">
                          <span className="msg-sender">{isUser ? 'SOC Analyst' : 'SentinelAI Copilot'}</span>
                          {msg.created_at && (
                            <span className="msg-time">{new Date(msg.created_at).toLocaleTimeString()}</span>
                          )}
                          {!isUser && msg.model && (
                            <span className="msg-model-tag">{getModelLabel(msg.model)}</span>
                          )}
                        </div>

                        <div className="message-content">
                          {msg.content ? (
                            <div className="markdown-body font-sans">
                              <MarkdownRenderer content={msg.content} />
                            </div>
                          ) : (
                            <div className="typing-indicator font-mono">
                              <span className="dot"></span>
                              <span className="dot"></span>
                              <span className="dot"></span>
                              <span className="typing-text">Analyzing security context...</span>
                            </div>
                          )}
                        </div>

                        {!isUser && !msg.isStreaming && msg.content && (
                          <div className="message-actions font-mono">
                            <button
                              className="msg-action-btn"
                              onClick={() => handleCopyMessage(msg.content, index)}
                              title="Copy response"
                            >
                              {copiedId === index ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                              <span>{copiedId === index ? 'Copied' : 'Copy'}</span>
                            </button>

                            <button
                              className={`msg-action-btn ${feedback[index] === 'up' ? 'active-up' : ''}`}
                              onClick={() => handleFeedback(index, 'up')}
                              title="Useful response"
                            >
                              <ThumbsUp size={12} />
                            </button>
                            <button
                              className={`msg-action-btn ${feedback[index] === 'down' ? 'active-down' : ''}`}
                              onClick={() => handleFeedback(index, 'down')}
                              title="Not useful"
                            >
                              <ThumbsDown size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {isUser && (
                        <div className="user-avatar-box">
                          <User size={16} className="text-slate" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Contextual Suggestion Chips below conversation */}
                {messages.length > 0 && !loading && (
                  <div className="contextual-chips-row font-mono">
                    <span className="chips-label">Quick Next Steps:</span>
                    <button className="chip-btn" onClick={() => handleSendMessage("Show active threat summary for the past 24 hours.")}>
                      Active Threats
                    </button>
                    <button className="chip-btn" onClick={() => handleSendMessage("Investigate top source IP addresses targeting Honeypot port 8088.")}>
                      Investigate IP
                    </button>
                    <button className="chip-btn" onClick={() => handleSendMessage("Provide defense advice for mitigating SQL Injection and Traversal probes.")}>
                      Defense Advice
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom Chat Composer */}
          <div className="chat-composer-container">
            <div className="composer-input-wrapper">
              <textarea
                className="composer-textarea font-mono"
                placeholder="Ask SentinelAI anything..."
                rows={2}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={loading}
              />
              <button
                className={`composer-send-btn ${loading || !inputValue.trim() ? 'disabled' : ''}`}
                onClick={() => handleSendMessage()}
                disabled={loading || !inputValue.trim()}
                title="Send Message"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="composer-disclaimer font-mono">
              SentinelAI Copilot uses Groq Cloud LLMs. Verify critical security findings before executing live SOC playbooks.
            </div>
          </div>
        </section>

        {/* Right Side Panel: Telemetry & Investigator Tabs */}
        <aside className="agent-side-panel card-cyber">
          <div className="panel-tab-header font-mono">
            <button
              className={`panel-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
              onClick={() => setActiveTab('telemetry')}
            >
              <Activity size={14} />
              <span>TELEMETRY</span>
            </button>
            <button
              className={`panel-tab-btn ${activeTab === 'investigator' ? 'active' : ''}`}
              onClick={() => setActiveTab('investigator')}
            >
              <Sliders size={14} />
              <span>INVESTIGATOR</span>
            </button>
          </div>

          <div className="panel-tab-body">
            {activeTab === 'telemetry' ? (
              <div className="telemetry-tab-content">
                {/* 4 SOC Metric Overview Cards */}
                <div className="telemetry-metrics-grid font-mono">
                  <div className="metric-card-sm">
                    <span className="m-val text-cyan">{attacksList.length}</span>
                    <span className="m-lbl">TOTAL ATTACKS</span>
                  </div>
                  <div className="metric-card-sm">
                    <span className="m-val text-purple">{wafSourcesCount}</span>
                    <span className="m-lbl">UNIQUE SOURCES</span>
                  </div>
                  <div className="metric-card-sm">
                    <span className="m-val text-red">{highSeverityCount}</span>
                    <span className="m-lbl">HIGH SEVERITY</span>
                  </div>
                  <div className="metric-card-sm">
                    <span className="m-val text-green">{activeWafRulesCount}</span>
                    <span className="m-lbl">BLOCKED TODAY</span>
                  </div>
                </div>

                {/* Selected Attack Context Banner if present */}
                {selectedAttack && (
                  <div className="selected-context-banner card-cyber font-mono">
                    <div className="banner-top">
                      <ShieldAlert size={14} className="text-red" />
                      <span className="banner-title">Linked Context: #{selectedAttack.id}</span>
                      <button className="clear-ctx-btn" onClick={() => setSelectedAttack(null)} title="Clear context">✕</button>
                    </div>
                    <div className="banner-desc">
                      {selectedAttack.attack_type} from {selectedAttack.source_ip} (Severity: {selectedAttack.severity})
                    </div>
                  </div>
                )}

                {/* Selected Incident Context Banner if present */}
                {selectedIncident && (
                  <div className="selected-context-banner card-cyber font-mono">
                    <div className="banner-top">
                      <ShieldAlert size={14} className="text-amber" />
                      <span className="banner-title">Linked Incident: #{selectedIncident.id}</span>
                      <button className="clear-ctx-btn" onClick={() => setSelectedIncident(null)} title="Clear context">✕</button>
                    </div>
                    <div className="banner-desc">
                      {selectedIncident.title} (Severity: {selectedIncident.severity})
                    </div>
                  </div>
                )}

                {/* Selected Attacker Profile Context Banner if present */}
                {selectedAttackerIp && (
                  <div className="selected-context-banner card-cyber font-mono">
                    <div className="banner-top">
                      <ShieldAlert size={14} className="text-purple" />
                      <span className="banner-title">Attacker Profile: {selectedAttackerIp}</span>
                      <button className="clear-ctx-btn" onClick={() => setSelectedAttackerIp(null)} title="Clear context">✕</button>
                    </div>
                    <div className="banner-desc">
                      Telemetry analysis available for IP {selectedAttackerIp}
                    </div>
                  </div>
                )}

                {/* Quick Scans Section */}
                <div className="quick-scans-section">
                  <h6 className="qs-title font-mono">
                    <Zap size={14} className="text-cyan" />
                    <span>Quick Scans & Telemetry Actions</span>
                  </h6>
                  <div className="quick-scans-buttons">
                    <button className="qs-btn font-mono" onClick={() => handleQuickAction("Explain Attack")} disabled={!selectedAttack}>
                      <ChevronRight size={12} />
                      <span>Explain Attack</span>
                    </button>
                    <button className="qs-btn font-mono" onClick={() => handleQuickAction("Recommend Firewall Rule")} disabled={!selectedAttack}>
                      <ChevronRight size={12} />
                      <span>Recommend Firewall Rule</span>
                    </button>
                    <button className="qs-btn font-mono" onClick={() => handleQuickAction("Explain Payload")} disabled={!selectedAttack}>
                      <ChevronRight size={12} />
                      <span>Explain Payload</span>
                    </button>
                    <button className="qs-btn font-mono" onClick={() => handleQuickAction("Map to MITRE")} disabled={!selectedAttack}>
                      <ChevronRight size={12} />
                      <span>Map to MITRE ATT&CK</span>
                    </button>
                    <button className="qs-btn font-mono" onClick={() => handleQuickAction("IOC Summary")} disabled={!selectedAttack}>
                      <ChevronRight size={12} />
                      <span>IOC Summary</span>
                    </button>
                  </div>
                  {!selectedAttack && (
                    <p className="qs-help text-muted font-mono">* Select an attack event from the Investigator tab or Attack Feed to enable context scans.</p>
                  )}
                </div>
              </div>
            ) : (
              /* INVESTIGATOR Tab */
              <div className="investigator-tab-content font-mono">
                <div className="investigator-selector-card card-cyber mb-3">
                  <label className="inv-label">TARGET CONTEXT OBJECT:</label>
                  <select
                    className="inv-select"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setSelectedAttack(null);
                        setSelectedIncident(null);
                        return;
                      }
                      if (val.startsWith('attack_')) {
                        const id = parseInt(val.replace('attack_', ''));
                        const found = attacksList.find(a => a.id === id);
                        setSelectedAttack(found || null);
                        setSelectedIncident(null);
                      } else if (val.startsWith('inc_')) {
                        const id = parseInt(val.replace('inc_', ''));
                        const found = incidentsList.find(i => i.id === id);
                        setSelectedIncident(found || null);
                        setSelectedAttack(null);
                      }
                    }}
                  >
                    <option value="">-- Choose Incident / Attack --</option>
                    <optgroup label="Correlated Incidents">
                      {incidentsList.map(inc => (
                        <option key={`inc_${inc.id}`} value={`inc_${inc.id}`}>
                          Incident #{inc.id}: {inc.title} ({inc.severity})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Recent Attack Events">
                      {attacksList.slice(0, 15).map(atk => (
                        <option key={`attack_${atk.id}`} value={`attack_${atk.id}`}>
                          Event #{atk.id}: {atk.attack_type} from {atk.source_ip}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="investigator-actions-grid">
                  <h6 className="inv-actions-title">SOC Investigator Workflows</h6>
                  <button className="inv-action-btn" onClick={() => handleInvestigationAction("Analyze Incident")} disabled={!selectedIncident && !selectedAttack}>
                    <span>Analyze Incident</span>
                  </button>
                  <button className="inv-action-btn" onClick={() => handleInvestigationAction("Explain Severity")} disabled={!selectedIncident && !selectedAttack}>
                    <span>Explain Severity</span>
                  </button>
                  <button className="inv-action-btn" onClick={() => handleInvestigationAction("Extract IOCs")} disabled={!selectedIncident && !selectedAttack}>
                    <span>Extract IOCs</span>
                  </button>
                  <button className="inv-action-btn" onClick={() => handleInvestigationAction("Recommend Containment")} disabled={!selectedIncident && !selectedAttack}>
                    <span>Recommend Containment</span>
                  </button>
                  <button className="inv-action-btn" onClick={() => handleInvestigationAction("Map to MITRE")} disabled={!selectedIncident && !selectedAttack}>
                    <span>Map to MITRE ATT&CK</span>
                  </button>
                  <button className="inv-action-btn" onClick={() => handleInvestigationAction("Generate Timeline")} disabled={!selectedIncident && !selectedAttack}>
                    <span>Generate Timeline</span>
                  </button>
                  <button className="inv-action-btn" onClick={() => handleInvestigationAction("Executive Summary")} disabled={!selectedIncident && !selectedAttack}>
                    <span>Executive Summary</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
