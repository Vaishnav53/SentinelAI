import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Power, AlertTriangle, ShieldCheck, Terminal, Copy, Check, Activity, Eye, Cpu } from 'lucide-react';
import apiClient from '../../api/client';
import HoneypotEventDrawer from '../../components/honeypot/HoneypotEventDrawer';
import './HoneypotLab.css';

export default function HoneypotLab() {
  const navigate = useNavigate();
  const [sensors, setSensors] = useState([]);
  const [honeypotStatus, setHoneypotStatus] = useState('OFFLINE');
  const [honeypotUrl, setHoneypotUrl] = useState('http://127.0.0.1:8088');
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [lanMode, setLanMode] = useState(false);
  const [liveActivity, setLiveActivity] = useState([]);
  const [logFilter, setLogFilter] = useState('ALL');
  const [showAdvancedDecoys, setShowAdvancedDecoys] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [lanIp, setLanIp] = useState("127.0.0.1");
  const [errorMessage, setErrorMessage] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);
  const [selectedDrawerEvent, setSelectedDrawerEvent] = useState(null);

  const formatLocalTime = (utcString) => {
    if (!utcString) return "";
    const cleanStr = (utcString.endsWith('Z') || utcString.includes('+')) 
      ? utcString 
      : utcString + 'Z';
    return new Date(cleanStr).toLocaleTimeString();
  };

  const filteredActivity = liveActivity.filter(activity => {
    const isSimulator = activity.sensor_id === 'Simulated Sensor Node' || activity.external_id?.startsWith('SIM-');
    if (logFilter === 'REAL') {
      return !isSimulator;
    }
    if (logFilter === 'SIMULATOR') {
      return isSimulator;
    }
    return true;
  });

  const applyStatusData = (statusData) => {
    if (!statusData) return;
    setHoneypotStatus(statusData.status || 'OFFLINE');
    setHoneypotUrl(statusData.url || 'http://127.0.0.1:8088');
    setIsReady(!!statusData.ready);
    setLanMode(!!statusData.lan_mode);
    setLanIp(statusData.lan_ip || "127.0.0.1");
    setErrorMessage(statusData.error || null);
  };

  const fetchStatusAndSensors = async () => {
    try {
      setLoading(true);
      const [sensorsData, statusData, eventsData] = await Promise.all([
        apiClient.get('/sensors'),
        apiClient.get('/honeypot/status'),
        apiClient.get('/honeypot/events')
      ]);
      setSensors(sensorsData);
      applyStatusData(statusData);
      setLiveActivity(eventsData);
    } catch (e) {
      console.error("Failed to load Honeypot Lab status:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndSensors();
    
    // Live update polling for sensor status
    const interval = setInterval(async () => {
      try {
        const statusData = await apiClient.get('/honeypot/status');
        applyStatusData(statusData);
      } catch (err) {
        setHoneypotStatus('OFFLINE');
        setIsReady(false);
      }
    }, 3000);

    // Live WebSocket connection to capture and append attacks in real time
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = import.meta.env.VITE_WS_BASE_URL;
    if (wsUrl) {
      if (!wsUrl.endsWith('/api/attacks/ws')) {
        wsUrl = wsUrl.replace(/\/+$/, '') + '/api/attacks/ws';
      }
    } else {
      wsUrl = window.location.port === '5173'
        ? `${wsProtocol}//127.0.0.1:8000/api/attacks/ws`
        : `${wsProtocol}//${window.location.host}/api/attacks/ws`;
    }
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Honeypot Lab WebSocket listener connected.');
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_attack') {
          const attack = payload.data;
          
          const isRealHoneypot = attack.destination_port === 8088 && !attack.external_id?.startsWith('SIM-') && attack.sensor_id !== 'Simulated Sensor Node';
          const isSimulator = attack.sensor_id === 'Simulated Sensor Node' || attack.external_id?.startsWith('SIM-');
          
          if (isRealHoneypot || isSimulator) {
            setLiveActivity(prev => {
              if (prev.some(a => a.id === attack.id)) return prev;
              return [attack, ...prev].slice(0, 50);
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse websocket payload:', err);
      }
    };

    return () => {
      clearInterval(interval);
      socket.close();
    };
  }, []);

  const handleToggleHoneypot = async () => {
    if (isTransitioning) return;
    try {
      setIsTransitioning(true);
      setErrorMessage(null);

      if (honeypotStatus === 'ONLINE' || honeypotStatus === 'STARTING') {
        setStatusNotice("Stopping HTTP Decoy listener...");
        const res = await apiClient.post('/honeypot/stop');
        applyStatusData(res);
      } else {
        setStatusNotice("Starting HTTP Decoy listener...");
        setHoneypotStatus('STARTING');
        const res = await apiClient.post('/honeypot/start', { lan_mode: lanMode });
        applyStatusData(res);
      }

      const sensorsData = await apiClient.get('/sensors');
      setSensors(sensorsData);
    } catch (e) {
      console.error("Failed to toggle honeypot state:", e);
      setHoneypotStatus('ERROR');
      setErrorMessage(e.message || "Failed to toggle honeypot service state.");
    } finally {
      setIsTransitioning(false);
      setStatusNotice(null);
    }
  };

  const handleModeChange = async (targetLanMode) => {
    if (isTransitioning) return;

    if (targetLanMode) {
      const confirmLan = window.confirm(
        "WARNING: Enabling LAN Mode will bind the vulnerable sandbox decoy server to 0.0.0.0, allowing inbound connections from your local network subnet.\n\nEnsure your network is trusted. Proceed?"
      );
      if (!confirmLan) return;
    }

    try {
      setIsTransitioning(true);
      setErrorMessage(null);
      if (honeypotStatus === 'ONLINE' || honeypotStatus === 'STARTING') {
        setStatusNotice("Rebinding listener interface & restarting HTTP Decoy...");
      } else {
        setStatusNotice("Applying interface binding mode...");
      }

      const res = await apiClient.post('/honeypot/mode', { lan_mode: targetLanMode });
      applyStatusData(res);

      const sensorsData = await apiClient.get('/sensors');
      setSensors(sensorsData);
    } catch (e) {
      console.error("Failed to change binding interface mode:", e);
      setErrorMessage(e.message || "Failed to update binding interface mode.");
    } finally {
      setIsTransitioning(false);
      setStatusNotice(null);
    }
  };

  const handleToggleSimulatedSensor = async (id, currentState) => {
    try {
      const endpoint = currentState === 'ONLINE' ? `/sensors/${id}/stop` : `/sensors/${id}/start`;
      const updated = await apiClient.post(endpoint);
      setSensors(sensors.map(s => s.id === id ? updated : s));
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const testPayloads = [
    {
      title: "Normal Probe (curl)",
      cmd: `curl -A "Mozilla/5.0" http://127.0.0.1:8088/`
    },
    {
      title: "SQL Injection Probe (curl)",
      cmd: `curl -d "username=admin' OR '1'='1&password=anything" http://127.0.0.1:8088/login`
    },
    {
      title: "XSS Infiltration Probe (curl)",
      cmd: `curl -d "comment=<script>alert('xss')</script>" http://127.0.0.1:8088/feedback`
    },
    {
      title: "Directory Traversal Probe (curl)",
      cmd: `curl "http://127.0.0.1:8088/../../../../etc/passwd"`
    },
    {
      title: "Scanner Signature Probe (User-Agent)",
      cmd: `curl -A "sqlmap/1.5.8" http://127.0.0.1:8088/`
    }
  ];

  if (loading && sensors.length === 0) {
    return <div className="loading-state">Initialising Honeypot Lab Telemetry...</div>;
  }

  const fallbackSensors = sensors.filter(s => s.name !== "HTTP Honeypot");

  return (
    <div className="lab-root">
      <div className="lab-header card-cyber">
        <div className="lab-header-info">
          <Radio className={`text-cyan ${honeypotStatus === 'ONLINE' ? 'pulse' : ''}`} size={24} />
          <div className="lab-header-title">
            <h4 className="title-cyber">Honeypot Lab & Decoy Grid</h4>
            <p className="text-muted">Activate real and simulated network listeners to capture attacker payloads locally.</p>
          </div>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="safety-warning-banner card-cyber">
        <AlertTriangle className="text-yellow" size={18} />
        <div className="safety-text">
          <span className="font-mono text-yellow font-bold safety-title">SAFETY DIRECTIVE: LOCAL RESEARCH LAB ONLY</span>
          <p className="text-muted text-xs">This honeypot decoy is configured exclusively for local capture and defensive log parsing. Do not expose this port directly to public networks or use this tool for offensive penetration probes.</p>
        </div>
      </div>

      {/* Main HTTP Honeypot card controls */}
      <div className="main-honeypot-controller card-cyber">
        <div className="hp-control-header">
          <div className="hp-meta-desc">
            <div className="flex items-center gap-2 mb-1" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`badge badge-${honeypotStatus.toLowerCase()}`}>{honeypotStatus}</span>
              <span className="badge font-mono" style={{ background: 'rgba(88, 166, 255, 0.1)', border: '1px solid rgba(88, 166, 255, 0.2)', color: '#58a6ff' }}>
                {lanMode ? 'LAN MODE' : 'LOCAL MODE'}
              </span>
              {isReady && <span className="badge font-mono" style={{ background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.2)', color: '#00ff88' }}>READY</span>}
              {statusNotice && <span className="text-purple font-mono text-xxs animate-pulse" style={{ fontSize: '10px', color: '#a855f7' }}>{statusNotice}</span>}
            </div>
            <h3 className="sensor-name">Aetheris HTTP Decoy Service</h3>
            <p className="text-muted font-mono" style={{ fontSize: '11px', color: '#8b949e' }}>
              Bind Address: <strong className="text-white" style={{ color: '#ffffff' }}>{lanMode ? '0.0.0.0:8088' : '127.0.0.1:8088'}</strong> | LAN IP: <strong className="text-cyan" style={{ color: 'var(--cyan-primary)' }}>{lanIp}</strong> | Port: <strong className="text-white" style={{ color: '#ffffff' }}>8088</strong>
            </p>

            {/* Dynamic Shareable URL Display & Actions */}
            {honeypotStatus === 'ONLINE' && isReady && (
              <div className="flex items-center gap-3 mt-2" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span className="font-mono text-xs text-muted" style={{ fontSize: '11px' }}>
                  Decoy Access URL: <a href={honeypotUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-cyan" style={{ textDecoration: 'underline', color: 'var(--cyan-primary)' }}>{honeypotUrl}</a>
                </span>

                <button
                  onClick={() => window.open(honeypotUrl, '_blank')}
                  className="font-mono btn-action-cyber"
                  style={{ padding: '4px 12px', fontSize: '10px', background: 'rgba(0, 229, 255, 0.15)', border: '1px solid var(--cyan-primary)', color: '#ffffff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Open Aetheris
                </button>

                <button
                  onClick={() => copyToClipboard(honeypotUrl, 'main-url')}
                  className="font-mono btn-action-cyber flex items-center gap-1"
                  style={{ padding: '4px 12px', fontSize: '10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#c9d1d9', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  {copiedIndex === 'main-url' ? <Check size={11} className="text-green" /> : <Copy size={11} />}
                  <span>{copiedIndex === 'main-url' ? 'Copied URL!' : 'Copy URL'}</span>
                </button>
              </div>
            )}

            {honeypotStatus === 'STARTING' && (
              <p className="text-purple font-mono text-xs mt-1" style={{ fontSize: '11px', color: '#a855f7' }}>
                Starting listener on port 8088 and verifying readiness...
              </p>
            )}

            {errorMessage && (
              <p className="text-red font-mono text-xs mt-1" style={{ fontSize: '11px', color: '#ff3366' }}>
                ⚠️ {errorMessage}
              </p>
            )}
          </div>
          <button 
            className={`hp-power-btn ${honeypotStatus === 'ONLINE' ? 'active' : ''}`}
            onClick={handleToggleHoneypot}
            disabled={isTransitioning}
            title={honeypotStatus === 'ONLINE' ? "Stop Honeypot" : "Start Honeypot"}
          >
            <Power size={18} />
          </button>
        </div>

        {honeypotStatus === 'ONLINE' && isReady ? (
          <div className="sensor-status-msg text-green font-mono">
            <ShieldCheck size={16} />
            <span>DECOY ACTIVE: Listening on {lanMode ? `all interfaces (0.0.0.0) — Shareable LAN URL: ${honeypotUrl}` : `loopback interface (127.0.0.1) — Shareable URL: ${honeypotUrl}`}. Capturing raw payloads.</span>
          </div>
        ) : honeypotStatus === 'STARTING' ? (
          <div className="sensor-status-msg text-purple font-mono">
            <Activity size={16} className="animate-spin" />
            <span>DECOY INITIALIZING: Rebinding listener interface and restarting HTTP Decoy…</span>
          </div>
        ) : (
          <div className="sensor-status-msg text-muted font-mono">
            <AlertTriangle size={16} />
            <span>DECOY OFFLINE: Local listener is inactive. Attack traffic on port 8088 will be dropped.</span>
          </div>
        )}

        {/* Toggle switch for Local Only / LAN Mode */}
        <div className="binding-mode-selector mt-3 pt-3 border-top border-dark flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '12px' }}>
          <div className="flex flex-col">
            <span className="font-mono text-xs text-white" style={{ fontSize: '11px', fontWeight: 'bold' }}>BINDING INTERFACE MODE</span>
            <span className="text-muted text-xxs mt-0.5" style={{ fontSize: '10px', color: '#8b949e' }}>
              {lanMode
                ? `LAN Mode: Honeypot binds to 0.0.0.0:8088 (Accessible from other devices on your Wi-Fi/LAN at ${honeypotUrl}).`
                : "Local Mode: Honeypot binds strictly to 127.0.0.1:8088 (Only accessible from this computer)."}
            </span>
            {lanMode && (
              <span className="text-yellow text-xxs font-mono mt-1" style={{ fontSize: '9px', color: '#ffd32a' }}>
                Note: Windows Firewall must allow inbound TCP traffic on port 8088 for LAN devices to connect.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="font-mono" style={{ fontSize: '10px', color: !lanMode ? 'var(--cyan-primary)' : '#8b949e', fontWeight: !lanMode ? 'bold' : 'normal' }}>LOCAL MODE</span>
            <label className="cyber-switch">
              <input
                type="checkbox"
                checked={lanMode}
                disabled={isTransitioning}
                onChange={(e) => handleModeChange(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
            <span className="font-mono" style={{ fontSize: '10px', color: lanMode ? 'var(--yellow)' : '#8b949e', fontWeight: lanMode ? 'bold' : 'normal' }}>LAN MODE</span>
          </div>
        </div>
      </div>

      {/* Access Modes HUD Clarification */}
      <div className="access-modes-clarification card-cyber font-mono" style={{ padding: '16px', fontSize: '10px' }}>
        <div className="hud-title text-cyan mb-3 pb-1" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.05em' }}>HONEYPOT ACCESS MODES & FIREWALL DIRECTIVES</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div>
            <span className="text-white font-bold" style={{ fontSize: '11px' }}>1. LOCAL MODE</span>
            <p className="text-muted mt-1" style={{ color: '#8b949e', marginTop: '4px' }}>
              Binds strictly to <strong>127.0.0.1:8088</strong>. Local Mode is only accessible from this computer.
              <br/><span className="text-cyan font-bold" style={{ color: 'var(--cyan-primary)' }}>URL: http://127.0.0.1:8088</span>
            </p>
          </div>
          <div>
            <span className="text-white font-bold" style={{ fontSize: '11px' }}>2. LAN MODE</span>
            <p className="text-muted mt-1" style={{ color: '#8b949e', marginTop: '4px' }}>
              Binds to <strong>0.0.0.0:8088</strong>. LAN Mode is accessible from other devices on the same network.
              <br/><span className="text-yellow font-bold" style={{ color: '#ffd32a' }}>URL: {lanMode ? honeypotUrl : `http://${lanIp}:8088`}</span>
            </p>
          </div>
          <div>
            <span className="text-white font-bold" style={{ fontSize: '11px', color: 'var(--cyan-primary)' }}>3. WINDOWS FIREWALL DIRECTIVE</span>
            <p className="text-muted mt-1" style={{ color: '#8b949e', marginTop: '4px' }}>
              To allow inbound connections from another laptop, run Administrator PowerShell:
            </p>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                onClick={() => copyToClipboard('New-NetFirewallRule -DisplayName "SentinelAI Aetheris HTTP Decoy" -Direction Inbound -Protocol TCP -LocalPort 8088 -Action Allow -Profile Private', 'fw-add')}
                style={{ padding: '3px 8px', fontSize: '9px', background: 'rgba(0, 229, 255, 0.1)', border: '1px solid var(--cyan-primary)', color: '#ffffff', cursor: 'pointer', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}
              >
                {copiedIndex === 'fw-add' ? 'Copied Allow Rule!' : 'Copy Allow Firewall Command'}
              </button>
              <button
                onClick={() => copyToClipboard('Remove-NetFirewallRule -DisplayName "SentinelAI Aetheris HTTP Decoy"', 'fw-del')}
                style={{ padding: '3px 8px', fontSize: '9px', background: 'rgba(255, 51, 102, 0.1)', border: '1px solid rgba(255, 51, 102, 0.3)', color: '#ff3366', cursor: 'pointer', borderRadius: '3px', fontFamily: 'var(--font-mono)' }}
              >
                {copiedIndex === 'fw-del' ? 'Copied Remove Rule!' : 'Copy Remove Rule'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Advanced Decoy Services */}
      <div className="advanced-decoys-collapsible card-cyber" style={{ padding: '16px', marginTop: '20px', marginBottom: '20px' }}>
        <h5 
          className="section-title collapsible-title" 
          onClick={() => setShowAdvancedDecoys(!showAdvancedDecoys)}
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={14} className="text-purple" /> 
            Advanced Decoy Services
          </span>
          <span className="toggle-indicator font-mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            {showAdvancedDecoys ? '▼' : '►'}
          </span>
        </h5>
        
        {showAdvancedDecoys && (
          <div style={{ marginTop: '16px' }}>
            <p className="text-muted text-xs mb-3 font-mono" style={{ fontSize: '11px', color: '#8b949e', lineHeight: '1.4' }}>
              * NOTE: These decoy listeners represent inactive simulated service models used to capture automated network scanning. They are currently visual decoy placeholders for SSH, FTP, and Telnet protocols.
            </p>
            <div className="sensor-grid">
              {fallbackSensors.map((sensor) => {
                const isOnline = sensor.state === 'ONLINE';
                return (
                  <div key={sensor.id} className={`sensor-card card-cyber ${sensor.state.toLowerCase()}`}>
                    <div className="sensor-card-header">
                      <span className={`badge badge-${sensor.state.toLowerCase()}`}>{sensor.state}</span>
                      <button 
                        className={`power-btn ${isOnline ? 'active' : ''}`}
                        onClick={() => handleToggleSimulatedSensor(sensor.id, sensor.state)}
                        title={isOnline ? "Stop Listener" : "Start Listener"}
                      >
                        <Power size={14} />
                      </button>
                    </div>

                    <div className="sensor-card-body">
                      <h4 className="sensor-name">{sensor.name}</h4>
                      <div className="sensor-meta font-mono">
                        <div className="sm-row">
                          <span className="sm-label">Port:</span>
                          <span className="sm-val">{sensor.port}</span>
                        </div>
                        <div className="sm-row">
                          <span className="sm-label">Protocol:</span>
                          <span className="sm-val">{sensor.type}</span>
                        </div>
                        <div className="sm-row">
                          <span className="sm-label">Binding:</span>
                          <span className="sm-val">{sensor.host}</span>
                        </div>
                      </div>
                    </div>

                    <div className="sensor-card-footer">
                      {isOnline ? (
                        <div className="sensor-status-msg text-green">
                          <ShieldCheck size={14} />
                          <span>Listening on Port {sensor.port}</span>
                        </div>
                      ) : (
                        <div className="sensor-status-msg text-muted">
                          <AlertTriangle size={14} />
                          <span>Port is closed</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Copy paste test payloads instructions */}
      <div className="instructions-section card-cyber">
        <h5 className="section-title"><Terminal size={14} /> Security Telemetry Testing Guide</h5>
        <p className="text-muted text-sm">Use these curl command signatures to test the local threat detection engines directly against loopback port 8088:</p>
        
        <div className="payload-test-list">
          {testPayloads.map((payload, index) => (
            <div key={index} className="payload-item">
              <div className="payload-item-header">
                <span className="payload-title font-mono">{payload.title}</span>
                <button 
                  className="copy-btn font-mono" 
                  onClick={() => copyToClipboard(payload.cmd, index)}
                  title="Copy Command"
                >
                  {copiedIndex === index ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                  <span>{copiedIndex === index ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="payload-cmd font-mono">{payload.cmd}</pre>
            </div>
          ))}
        </div>
      </div>

      {/* Live Honeypot Activity Table widget */}
      <div className="live-honeypot-activity card-cyber">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <Activity className="text-cyan animate-pulse" size={16} />
          <h5 className="section-title" style={{ margin: 0 }}>Live Honeypot Activity Log</h5>
        </div>

        <div className="filter-bar flex gap-2 mb-3" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            className={`filter-btn-cyber ${logFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setLogFilter('ALL')}
            style={{ padding: '4px 8px', fontSize: '10px', background: logFilter === 'ALL' ? 'rgba(0, 229, 255, 0.15)' : 'transparent', border: '1px solid rgba(0, 229, 255, 0.3)', color: '#ffffff', cursor: 'pointer', borderRadius: '3px' }}
          >
            All Events
          </button>
          <button 
            className={`filter-btn-cyber ${logFilter === 'REAL' ? 'active' : ''}`}
            onClick={() => setLogFilter('REAL')}
            style={{ padding: '4px 8px', fontSize: '10px', background: logFilter === 'REAL' ? 'rgba(0, 229, 255, 0.15)' : 'transparent', border: '1px solid rgba(0, 229, 255, 0.3)', color: '#ffffff', cursor: 'pointer', borderRadius: '3px' }}
          >
            Real Portal Events
          </button>
          <button 
            className={`filter-btn-cyber ${logFilter === 'SIMULATOR' ? 'active' : ''}`}
            onClick={() => setLogFilter('SIMULATOR')}
            style={{ padding: '4px 8px', fontSize: '10px', background: logFilter === 'SIMULATOR' ? 'rgba(0, 229, 255, 0.15)' : 'transparent', border: '1px solid rgba(0, 229, 255, 0.3)', color: '#ffffff', cursor: 'pointer', borderRadius: '3px' }}
          >
            Simulator Events
          </button>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="font-mono" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)' }}>TIMESTAMP</th>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)' }}>SOURCE IP</th>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)' }}>METHOD</th>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)' }}>PATH</th>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)' }}>ATTACK TYPE</th>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)' }}>SEVERITY</th>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)' }}>PAYLOAD PREVIEW</th>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)' }}>USER-AGENT</th>
                <th style={{ padding: '8px', color: 'var(--cyan-primary)', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivity.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>
                    No honeypot activity detected matching the filters. Send a test probe to port 8088 to verify telemetry.
                  </td>
                </tr>
              ) : (
                filteredActivity.map((activity, idx) => {
                  const payloadPreview = activity.payload
                    ? (activity.payload.length > 80 ? activity.payload.slice(0, 80) + '...' : activity.payload)
                    : '';

                  return (
                    <tr key={activity.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#c9d1d9' }}>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                        {formatLocalTime(activity.created_at)}
                      </td>
                      <td style={{ padding: '8px', color: '#ffffff' }}>{activity.source_ip}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ color: activity.payload?.includes('Method: POST') || activity.attack_type?.includes('Login') || activity.attack_type?.includes('Upload') || activity.attack_type?.includes('Submission') ? '#ff9f43' : '#58a6ff' }}>
                          {activity.payload?.includes('Method: POST') || activity.attack_type?.includes('Login') || activity.attack_type?.includes('Upload') || activity.attack_type?.includes('Submission') ? 'POST' : 'GET'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activity.payload?.split('\n')[1]?.replace('Path: ', '') || (activity.attack_type?.includes('Login') ? '/login' : (activity.attack_type?.includes('Upload') ? '/upload' : (activity.attack_type?.includes('Feedback') ? '/feedback' : '/')))}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>{activity.attack_type}</td>
                      <td style={{ padding: '8px' }}>
                        <span className={`badge badge-${activity.severity?.toLowerCase()}`}>
                          {activity.severity}
                        </span>
                      </td>
                      <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8b949e' }}>
                        {payloadPreview}
                      </td>
                      <td style={{ padding: '8px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8b949e' }}>
                        {activity.user_agent}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setSelectedDrawerEvent(activity)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '10px',
                            background: 'rgba(0, 229, 255, 0.1)',
                            border: '1px solid rgba(0, 229, 255, 0.3)',
                            color: 'var(--cyan-primary)',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginRight: '6px'
                          }}
                          title="View complete request evidence"
                        >
                          <Eye size={11} /> View Details
                        </button>
                        <button
                          onClick={() => navigate(`/agent?analyze_attack=${activity.id}`)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '10px',
                            background: 'rgba(139, 92, 246, 0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.4)',
                            color: '#a78bfa',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Analyze event with AI Copilot"
                        >
                          <Cpu size={11} /> Analyze with AI
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Render Event Details Drawer when an event is selected */}
      {selectedDrawerEvent && (
        <HoneypotEventDrawer
          event={selectedDrawerEvent}
          onClose={() => setSelectedDrawerEvent(null)}
        />
      )}
    </div>
  );
}
