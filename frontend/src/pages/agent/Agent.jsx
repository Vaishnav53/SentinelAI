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
  const [modelName, setModelName] = useState('llama-3.3-70b-versatile');
  const [availableModels, setAvailableModels] = useState([]);
  const [agentStatus, setAgentStatus] = useState('OFFLINE');
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastLatency, setLastLatency] = useState(null);

  const getModelLabel = (modelId) => {
    if (!modelId) return '';
    const mappings = {
      'llama-3.3-70b-versatile': 'Llama 3.3 70B Versatile',
      'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
      'llama-3.1-70b-versatile': 'Llama 3.1 70B Versatile',
      'llama3-70b-8192': 'Llama 3 70B',
      'llama3-8b-8192': 'Llama 3 8B',
      'mixtral-8x7b-32768': 'Mixtral 8x7B',
      'gemma2-9b-it': 'Gemma 2 9B',
      'gemma-7b-it': 'Gemma 7B',
      'qwen-2.5-32b': 'Qwen 2.5 32B',
      'qwen-2.5-coder-32b': 'Qwen 2.5 Coder 32B',
      'deepseek-r1-distill-llama-70b': 'DeepSeek R1 Llama 70B',
      'deepseek-r1-distill-qwen-32b': 'DeepSeek R1 Qwen 32B'
    };
    if (mappings[modelId]) return mappings[modelId];
    return modelId
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Selected threat context
  const [selectedAttack, setSelectedAttack] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedIntelIp, setSelectedIntelIp] = useState(null);
  const [selectedSandboxId, setSelectedSandboxId] = useState(null);
  const [selectedAttackerIp, setSelectedAttackerIp] = useState(null);

  // Investigator Selector state
  const [activeTab, setActiveTab] = useState('telemetry');
  const [incidentsList, setIncidentsList] = useState([]);
  const [attacksList, setAttacksList] = useState([]);
  const [showSelector, setShowSelector] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState('');

  // Settings Overlay Configurations
  const [temp, setTemp] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(128);
  const [systemPrompt, setSystemPrompt] = useState('Zero-Trust SOC Assistant');
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Fetch lists for investigator dropdown selector
  const fetchSelectorData = async () => {
    try {
      const incidents = await apiClient.get('/correlation/incidents');
      const attacks = await apiClient.get('/attacks');
      setIncidentsList(incidents);
      setAttacksList(attacks);
    } catch (err) {
      console.error("Failed to load selector items:", err);
    }
  };

  // Fetch details of a selected incident context
  const fetchIncidentDetails = async (id) => {
    try {
      const detail = await apiClient.get(`/correlation/incidents/${id}`);
      setSelectedIncident(detail);
      setSelectedAttack(null); // Clear attack if incident is loaded
    } catch (e) {
      console.error("Failed to load incident detail:", e);
    }
  };

  // Fetch Ollama Status & Available Models
  const fetchAgentStatus = async () => {
    try {
      setIsSyncing(true);
      const status = await apiClient.get('/agent/status');
      setAgentStatus(status.status);
      setAvailableModels(status.models_available);

      // Load default model prioritizing llama-3.3-70b-versatile, then llama-3.1-8b-instant
      if (status.models_available.length > 0) {
        const hasLlama70b = status.models_available.includes('llama-3.3-70b-versatile');
        const hasLlama8b = status.models_available.includes('llama-3.1-8b-instant');
        if (hasLlama70b) {
          setModelName('llama-3.3-70b-versatile');
        } else if (hasLlama8b) {
          setModelName('llama-3.1-8b-instant');
        } else if (!modelName || !status.models_available.includes(modelName)) {
          setModelName(status.models_available[0]);
        }
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
        setSelectedIncident(null);
      } else {
        setSelectedAttack(null);
        setSelectedIncident(null);
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

  // Handle context-aware Quick Scan Actions
  const handleQuickAction = (label) => {
    if (!selectedAttack) return;

    let queryText = "";
    switch (label) {
      case "Explain Attack":
        queryText = `Analyze and explain the root cause, severity, and potential vector of this ${selectedAttack.attack_type} attack event targeting service ${selectedAttack.target_service} on port ${selectedAttack.destination_port}.`;
        break;
      case "Recommend Firewall Rule":
        queryText = `Generate concrete, actionable firewall block rules (e.g., iptables, Cisco ACL, pfSense, or Windows Firewall) and WAF filtering guidelines to mitigate future malicious traffic from source IP ${selectedAttack.source_ip}.`;
        break;
      case "Explain Payload":
        queryText = `Perform a deep technical dissection of the captured payload for this event: "${selectedAttack.payload || 'No raw payload data captured'}". Identify potential query patterns, traversal keywords, or signature exploit indicators.`;
        break;
      case "Map to MITRE":
        queryText = `Map this ${selectedAttack.attack_type} event to specific MITRE ATT&CK techniques, tactics, and mitigation IDs. Provide technique codes (e.g. T1059) and explain your mapping rationale.`;
        break;
      case "IOC Summary":
        queryText = `Compile a formal Indicators of Compromise (IOC) summary details list containing the malicious source IP (${selectedAttack.source_ip}), target port (${selectedAttack.destination_port}), protocol (${selectedAttack.protocol}), threat score (${selectedAttack.threat_score}/100), and confidence score (${(selectedAttack.confidence*100).toFixed(0)}%).`;
        break;
      default:
        return;
    }
    handleSendMessage(queryText);
  };

  // Handle context-aware Quick Investigation Actions
  const handleInvestigationAction = (action) => {
    if (!selectedIncident && !selectedAttack) return;

    let queryText = "";
    const targetName = selectedIncident
      ? `incident ID-${selectedIncident.id} ("${selectedIncident.title}")`
      : `attack event HON-${selectedAttack.id} (${selectedAttack.attack_type})`;

    switch (action) {
      case "Analyze Incident":
        queryText = `Conduct a detailed SOC analysis and investigation of ${targetName}. Summarize target services, attack vector, threat severity, and potential progression paths.`;
        break;
      case "Explain Severity":
        queryText = `Analyze the severity metrics of ${targetName}. Detail why it is classified at this severity, and describe the potential network and host threat impacts.`;
        break;
      case "Extract IOCs":
        queryText = `Perform a comprehensive Indicators of Compromise (IOC) extraction for ${targetName}. Tabulate malicious source IPs, target ports, protocol headers, and payload signatures.`;
        break;
      case "Recommend Containment":
        queryText = `Generate concrete WAF filtering guidelines, firewall routing blocks (e.g. iptables/Cisco ACL), and immediate host isolation recommendations to contain ${targetName}.`;
        break;
      case "Map to MITRE":
        queryText = `Map ${targetName} to the MITRE ATT&CK enterprise matrix. Detail matching technique codes (e.g. T1190 or T1059) and mitigation strategies.`;
        break;
      case "Generate Timeline":
        queryText = `Reconstruct the threat campaign execution timeline for ${targetName}. Order the steps from initial scan activity to payload delivery, detail observed protocol sequences, and list timestamps.`;
        break;
      case "Executive Summary":
        queryText = `Prepare a concise, non-technical executive security brief summarizing the threat vector, business risk, and containment status of ${targetName}.`;
        break;
      default:
        return;
    }
    handleSendMessage(queryText);
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
          context: {
            attack_id: selectedAttack ? selectedAttack.id : (searchParams.get('analyze_attack') ? parseInt(searchParams.get('analyze_attack')) : null),
            incident_id: selectedIncident ? selectedIncident.id : (searchParams.get('analyze_incident') ? parseInt(searchParams.get('analyze_incident')) : null),
            sandbox_file_id: selectedSandboxId || (searchParams.get('analyze_sandbox') ? parseInt(searchParams.get('analyze_sandbox')) : null),
            attacker_ip: selectedAttackerIp || searchParams.get('analyze_attacker') || null
          },
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
                if (data.latency !== undefined) {
                  setLastLatency(data.latency);
                }
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
            if (data.latency !== undefined) {
              setLastLatency(data.latency);
            }
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
    fetchSelectorData();

    const enrichIp = searchParams.get('enrich_ip');
    if (enrichIp) {
      setSelectedIntelIp(enrichIp);
    }

    if (analyzeAttackId) {
      triggerAttackAnalysis(analyzeAttackId);
    }

    const analyzeIncidentId = searchParams.get('analyze_incident');
    if (analyzeIncidentId) {
      fetchIncidentDetails(analyzeIncidentId);
    }

    const analyzeSandboxId = searchParams.get('analyze_sandbox');
    if (analyzeSandboxId) {
      setSelectedSandboxId(parseInt(analyzeSandboxId));
      setInputValue("Can you perform an automated threat sandbox analysis for this uploaded payload file?");
    }

    const analyzeAttackerIp = searchParams.get('analyze_attacker');
    if (analyzeAttackerIp) {
      setSelectedAttackerIp(analyzeAttackerIp);
      setInputValue("Please compile a threat brief campaign progression dossier and playbook recommendation list for this attacker IP.");
    }
  }, [analyzeAttackId, searchParams]);

  const quickActions = [
    { label: "Explain Attack", query: "Can you provide a clear description and root cause summary of this attack vector?" },
    { label: "Recommend Firewall Rule", query: "Generate a block rule or routing recommendation to mitigate traffic from this source IP." },
    { label: "Explain Payload", query: "Break down the raw elements, query injections, or traverse keys found in this payload." },
    { label: "Map to MITRE", query: "Explain what MITRE ATT&CK technique IDs match this capture and why." },
    { label: "IOC Summary", query: "Summarize the indicators of compromise (IP, port, signature patterns) for this event." },
  ];

  const investigationActions = [
    { label: "Analyze Incident", action: "Analyze Incident" },
    { label: "Explain Severity", action: "Explain Severity" },
    { label: "Extract IOCs", action: "Extract IOCs" },
    { label: "Recommend Containment", action: "Recommend Containment" },
    { label: "Map to MITRE", action: "Map to MITRE" },
    { label: "Generate Timeline", action: "Generate Timeline" },
    { label: "Executive Summary", action: "Executive Summary" }
  ];

  // Inline badge and markdown highlights tokenizing parser
  const formatInlineTags = (line) => {
    if (!line) return "";
    let parts = [{ text: line, type: 'text' }];

    // 1. Parse inline code: `code`
    let nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subParts = part.text.split(/(`[^`]+`)/g);
        for (const sub of subParts) {
          if (sub.startsWith('`') && sub.endsWith('`')) {
            nextParts.push({ text: sub.slice(1, -1), type: 'code' });
          } else {
            nextParts.push({ text: sub, type: 'text' });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    // 2. Parse bold: **text**
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subParts = part.text.split(/(\*\*[^*]+\*\*)/g);
        for (const sub of subParts) {
          if (sub.startsWith('**') && sub.endsWith('**')) {
            nextParts.push({ text: sub.slice(2, -2), type: 'bold' });
          } else {
            nextParts.push({ text: sub, type: 'text' });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    // 3. Parse MITRE badge: (T\d{4})
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subParts = part.text.split(/\b(T\d{4}(?:\.\d{3})?)\b/g);
        for (const sub of subParts) {
          if (/\b(T\d{4}(?:\.\d{3})?)\b/.test(sub)) {
            nextParts.push({ text: sub, type: 'mitre' });
          } else {
            nextParts.push({ text: sub, type: 'text' });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    // 4. Parse percentage badge: (100%)
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subParts = part.text.split(/\b(\d{1,3}%)\b/g);
        for (const sub of subParts) {
          if (/\b(\d{1,3}%)\b/.test(sub)) {
            nextParts.push({ text: sub, type: 'percent' });
          } else {
            nextParts.push({ text: sub, type: 'text' });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    // 5. Parse IP Address highlights
    nextParts = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const subParts = part.text.split(/\b((?:[0-9]{1,3}\.){3}[0-9]{1,3})\b/g);
        for (const sub of subParts) {
          if (/\b((?:[0-9]{1,3}\.){3}[0-9]{1,3})\b/.test(sub)) {
            nextParts.push({ text: sub, type: 'ip' });
          } else {
            nextParts.push({ text: sub, type: 'text' });
          }
        }
      } else {
        nextParts.push(part);
      }
    }
    parts = nextParts;

    // Map tokens to React nodes
    return parts.map((part, idx) => {
      switch (part.type) {
        case 'code':
          return <code key={idx} className="inline-code-badge font-mono">{part.text}</code>;
        case 'bold':
          return <strong key={idx} className="font-bold text-cyan">{part.text}</strong>;
        case 'mitre':
          return <span key={idx} className="inline-mitre-badge">{part.text}</span>;
        case 'percent':
          return <span key={idx} className="inline-percent-badge">{part.text}</span>;
        case 'ip':
          return (
            <span
              key={idx}
              className="clickable-ip-address"
              onClick={() => setSelectedIntelIp(part.text)}
              title="Click to query Threat Intelligence profile"
            >
              {part.text}
            </span>
          );
        default:
          return part.text;
      }
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

        // Match ordered list patterns: e.g. "1. " or "2. "
        const orderedListRegex = /^(\d+)\.\s+(.*)$/;
        if (orderedListRegex.test(line)) {
          const match = line.match(orderedListRegex);
          return <li key={lIdx} className="md-li list-decimal ml-4 font-mono text-xs" style={{ listStyleType: 'decimal' }}>{formatInlineTags(match[2])}</li>;
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
              >
                {availableModels.length > 0 ? (
                  availableModels.map(m => (
                    <option key={m} value={m}>{getModelLabel(m)}</option>
                  ))
                ) : (
                  <>
                    <option value="llama-3.3-70b-versatile">{getModelLabel("llama-3.3-70b-versatile")}</option>
                    <option value="llama-3.1-8b-instant">{getModelLabel("llama-3.1-8b-instant")}</option>
                  </>
                )}
              </select>
            </div>

            <div className="control-item">
              <span className="text-muted">PROVIDER:</span>
              <span className="font-mono text-cyan" style={{ fontSize: '10px' }}>Groq Cloud</span>
            </div>

            <div className="control-item">
              <span className="text-muted">STATUS:</span>
              <span className={`status-tag status-${agentStatus.toLowerCase()}`}>{agentStatus}</span>
            </div>

            {lastLatency !== null && (
              <div className="control-item">
                <span className="text-muted">LATENCY:</span>
                <span className="font-mono text-purple">{lastLatency.toFixed(2)}s</span>
              </div>
            )}

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
            // Skip rendering assistant placeholder if it is empty and streaming (typing bubble covers this)
            if (msg.role === 'assistant' && !msg.content && msg.isStreaming) {
              return null;
            }
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
          {loading && (messages.length === 0 || messages[messages.length - 1].role !== 'assistant' || !messages[messages.length - 1].content) && (
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
        {/* Tab selector */}
        <div className="copilot-tabs-header font-mono text-xs">
          <button
            className={`copilot-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            Telemetry
          </button>
          <button
            className={`copilot-tab-btn ${activeTab === 'investigate' ? 'active' : ''}`}
            onClick={() => setActiveTab('investigate')}
          >
            Investigator
          </button>
        </div>

        <div className="copilot-tab-content scroll-bar">
          {activeTab === 'telemetry' ? (
            <>
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
                    <pre className="payload-snippet scroll-bar text-xxs font-mono">{selectedAttack.payload || 'No raw payload data captured'}</pre>
                  </div>
                </div>
              ) : (
                <div className="empty-context text-center text-muted font-mono text-xs py-4">
                  <AlertTriangle size={16} className="block mx-auto mb-2 text-muted" />
                  No incident linked. Select Analyze from Attack Feed to attach threat context.
                </div>
              )}
            </div>

            {/* Quick Scans Panel */}
            <div className="card-cyber copilot-settings-card" style={{ marginTop: '0' }}>
              <h5 className="section-title"><Activity size={14} className="text-cyan" /> Quick Scans</h5>
              <div className="settings-controls font-mono text-xs mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {quickActions.map(action => (
                  <button
                    key={action.label}
                    className="quick-action-btn"
                    onClick={() => handleQuickAction(action.label)}
                    disabled={loading || !selectedAttack}
                    title={!selectedAttack ? "Link an attack context on the right to trigger" : ""}
                    style={{ width: '100%', textAlign: 'left', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hyper-parameters configurations block */}
            <div className="card-cyber copilot-settings-card">
              <h5
                className="section-title collapsible-title"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sliders size={14} className="text-purple" />
                  Advanced AI Settings
                </span>
                <span className="toggle-indicator font-mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  {showAdvanced ? '▼' : '►'}
                </span>
              </h5>
              {showAdvanced && (
                <div className="settings-controls font-mono text-xs mt-2">
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
              )}
            </div>
          </>
        ) : (
          <>
            {/* INCIDENT / ATTACK SELECTOR DROPDOWN */}
            <div className="card-cyber copilot-context-card">
              <h5 className="section-title"><Database size={14} className="text-cyan" /> Threat Context Selector</h5>

              <div className="selector-wrapper font-mono text-xs mt-2" style={{ position: 'relative' }}>
                <button
                  className="btn-select-threat text-cyan"
                  onClick={() => {
                    setShowSelector(!showSelector);
                    if (!showSelector) fetchSelectorData();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0, 242, 254, 0.05)',
                    border: '1px solid rgba(0, 242, 254, 0.2)',
                    padding: '8px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                    {selectedIncident ? `Linked Incident: ID-${selectedIncident.id}` :
                     selectedAttack ? `Linked Attack: HON-${selectedAttack.id}` :
                     'Choose Incident/Attack...'}
                  </span>
                  <span>{showSelector ? '▲' : '▼'}</span>
                </button>

                {showSelector && (
                  <div className="selector-dropdown card-cyber">
                    <input
                      type="text"
                      placeholder="Search alerts, IPs..."
                      value={selectorSearch}
                      onChange={(e) => setSelectorSearch(e.target.value)}
                      className="selector-search-input font-mono text-xxs"
                    />
                    <div className="selector-items scroll-bar">
                      <div className="selector-section-title text-cyan uppercase font-bold mb-1" style={{ fontSize: '9px', opacity: 0.8 }}>Correlated Incidents</div>
                      {incidentsList.length === 0 ? (
                        <div className="text-muted text-xxs py-1 pl-2">No incidents found</div>
                      ) : incidentsList
                        .filter(inc => (inc.title || '').toLowerCase().includes(selectorSearch.toLowerCase()) || (inc.severity || '').toLowerCase().includes(selectorSearch.toLowerCase()))
                        .map(inc => (
                          <div
                            key={`inc-${inc.id}`}
                            className="selector-item font-mono text-xxs"
                            onClick={() => {
                              setSelectedIncident(inc);
                              setSelectedAttack(null);
                              setShowSelector(false);
                            }}
                            style={{
                              cursor: 'pointer',
                              padding: '6px',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span className={`badge badge-${inc.severity.toLowerCase()}`} style={{ fontSize: '8px', padding: '1px 4px' }}>{inc.severity}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ID-{inc.id}: {inc.title}</span>
                          </div>
                        ))}

                      <div className="selector-section-title text-purple uppercase font-bold mt-2 mb-1" style={{ fontSize: '9px', opacity: 0.8 }}>Raw Attack Feeds</div>
                      {attacksList.length === 0 ? (
                        <div className="text-muted text-xxs py-1 pl-2">No attacks found</div>
                      ) : attacksList
                        .filter(atk => (atk.attack_type || '').toLowerCase().includes(selectorSearch.toLowerCase()) || (atk.source_ip || '').includes(selectorSearch))
                        .map(atk => (
                          <div
                            key={`atk-${atk.id}`}
                            className="selector-item font-mono text-xxs"
                            onClick={() => {
                              setSelectedAttack(atk);
                              setSelectedIncident(null);
                              setShowSelector(false);
                            }}
                            style={{
                              cursor: 'pointer',
                              padding: '6px',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span className={`badge badge-${atk.severity.toLowerCase()}`} style={{ fontSize: '8px', padding: '1px 4px' }}>{atk.severity}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>HON-{atk.id}: {atk.attack_type} ({atk.source_ip})</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVE INVESTIGATION DETAILS CARD */}
            <div className="card-cyber copilot-context-card" style={{ marginTop: '0' }}>
              <h5 className="section-title"><ShieldAlert size={14} className="text-cyan" /> Active Target Details</h5>
              {selectedIncident ? (
                <div className="context-details font-mono text-xs">
                  <div className="context-row font-bold text-red border-bottom pb-2" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Incident ID-{selectedIncident.id}</span>
                    <span className={`badge badge-${selectedIncident.severity.toLowerCase()}`}>{selectedIncident.severity}</span>
                  </div>
                  <div className="context-row">
                    <span className="text-muted">Title:</span>
                    <span className="text-cyan">{selectedIncident.title}</span>
                  </div>
                  <div className="context-row">
                    <span className="text-muted">Confidence:</span>
                    <span>{(selectedIncident.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="context-row">
                    <span className="text-muted">Status:</span>
                    <span className="text-cyan">{selectedIncident.status}</span>
                  </div>
                  <div className="context-row">
                    <span className="text-muted">Owner:</span>
                    <span>{selectedIncident.assigned_analyst || 'Unassigned'}</span>
                  </div>
                  <div className="context-payload-box mt-2">
                    <span className="text-muted text-xxs uppercase block mb-1">Description:</span>
                    <p className="text-xxs leading-relaxed" style={{ color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '3px', margin: 0 }}>
                      {selectedIncident.description}
                    </p>
                  </div>
                </div>
              ) : selectedAttack ? (
                <div className="context-details font-mono text-xs">
                  <div className="context-row font-bold text-red border-bottom pb-2" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Attack HON-{selectedAttack.id}</span>
                    <span className={`badge badge-${selectedAttack.severity.toLowerCase()}`}>{selectedAttack.severity}</span>
                  </div>
                  <div className="context-row">
                    <span className="text-muted">Type:</span>
                    <span className="text-cyan">{selectedAttack.attack_type}</span>
                  </div>
                  <div className="context-row">
                    <span className="text-muted">Source IP:</span>
                    <span className="text-primary">{selectedAttack.source_ip}:{selectedAttack.source_port}</span>
                  </div>
                  <div className="context-row">
                    <span className="text-muted">Protocol:</span>
                    <span>{selectedAttack.protocol} / Port {selectedAttack.destination_port}</span>
                  </div>
                  <div className="context-payload-box mt-2">
                    <span className="text-muted text-xxs uppercase block mb-1">Captured Payload:</span>
                    <pre className="payload-snippet scroll-bar text-xxs font-mono" style={{ margin: 0 }}>{selectedAttack.payload || 'No raw payload captured'}</pre>
                  </div>
                </div>
              ) : (
                <div className="empty-context text-center text-muted font-mono text-xs py-4">
                  <AlertTriangle size={16} className="block mx-auto mb-2 text-muted" />
                  No threat context linked. Link an Incident or Attack Event using the selector above.
                </div>
              )}
            </div>

            {/* STRUCTURED INVESTIGATION ACTIONS */}
            <div className="card-cyber copilot-settings-card" style={{ marginTop: '0' }}>
              <h5 className="section-title"><BookOpen size={14} className="text-cyan" /> Investigation Actions</h5>
              <div className="settings-controls font-mono text-xs mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {investigationActions.map(action => (
                  <button
                    key={action.action}
                    className="quick-action-btn"
                    onClick={() => handleInvestigationAction(action.action)}
                    disabled={loading || (!selectedIncident && !selectedAttack)}
                    title={(!selectedIncident && !selectedAttack) ? "Link an incident context above to trigger" : ""}
                    style={{ width: '100%', textAlign: 'left', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        </div>
      </aside>
    </div>
  );
}
