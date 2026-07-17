import React, { useState, useEffect } from 'react';
import { Radio, Power, AlertTriangle, ShieldCheck, Terminal, Copy, Check, Activity } from 'lucide-react';
import apiClient from '../../api/client';
import './HoneypotLab.css';

export default function HoneypotLab() {
  const [sensors, setSensors] = useState([]);
  const [honeypotStatus, setHoneypotStatus] = useState('OFFLINE');
  const [honeypotUrl, setHoneypotUrl] = useState('http://127.0.0.1:8088');
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [lanMode, setLanMode] = useState(false);
  const [liveActivity, setLiveActivity] = useState([]);
  const [logFilter, setLogFilter] = useState('ALL');
  const [showAdvancedDecoys, setShowAdvancedDecoys] = useState(false);

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

  const fetchStatusAndSensors = async () => {
    try {
      setLoading(true);
      const [sensorsData, statusData, eventsData] = await Promise.all([
        apiClient.get('/sensors'),
        apiClient.get('/honeypot/status'),
        apiClient.get('/honeypot/events')
      ]);
      setSensors(sensorsData);
      setHoneypotStatus(statusData.status);
      setHoneypotUrl(statusData.url);
      setLiveActivity(eventsData);
      if (statusData.host !== '127.0.0.1' && statusData.host !== 'localhost') {
        setLanMode(true);
      }
    } catch (e) {
      console.error(e);
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
        setHoneypotStatus(statusData.status);
        setHoneypotUrl(statusData.url);
      } catch (err) {
        setHoneypotStatus('OFFLINE');
      }
    }, 5000);

    // Live WebSocket connection to capture and append attacks in real time
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_BASE_URL || (window.location.port === '5173'
      ? `${wsProtocol}//127.0.0.1:8000/api/attacks/ws`
      : `${wsProtocol}//${window.location.host}/api/attacks/ws`);
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
    try {
      const endpoint = honeypotStatus === 'ONLINE' ? '/honeypot/stop' : '/honeypot/start';
      const payload = endpoint === '/honeypot/start' ? { lan_mode: lanMode } : {};
      const res = await apiClient.post(endpoint, payload);
      setHoneypotStatus(res.status);
      setHoneypotUrl(res.url);
      
      // Refresh the static sensors list as well to reflect state changes
      const sensorsData = await apiClient.get('/sensors');
      setSensors(sensorsData);
    } catch (e) {
      console.error(e);
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
            <span className={`badge badge-${honeypotStatus.toLowerCase()}`}>{honeypotStatus}</span>
            <h3 className="sensor-name">Local HTTP Decoy Service</h3>
            <p className="text-muted font-mono">
              {honeypotStatus === 'ONLINE' ? `Active Binding URL: ${honeypotUrl}` : `Target Binding IP: ${lanMode ? '0.0.0.0 (LAN)' : '127.0.0.1 (Local Only)'}`}
            </p>
            {honeypotStatus === 'ONLINE' && (
              <p className="text-cyan font-mono text-xs mt-1">
                Access Lab Portal: <a href={lanMode ? honeypotUrl : "http://127.0.0.1:8088"} target="_blank" rel="noreferrer" className="underline text-cyan" style={{ textDecoration: 'underline' }}>{lanMode ? honeypotUrl : "http://127.0.0.1:8088"}</a>
              </p>
            )}
          </div>
          <button 
            className={`hp-power-btn ${honeypotStatus === 'ONLINE' ? 'active' : ''}`}
            onClick={handleToggleHoneypot}
            title={honeypotStatus === 'ONLINE' ? "Stop Honeypot" : "Start Honeypot"}
          >
            <Power size={18} />
          </button>
        </div>

        {honeypotStatus === 'ONLINE' ? (
          <div className="sensor-status-msg text-green font-mono">
            <ShieldCheck size={16} />
            <span>DECOY ACTIVE: Listening on {lanMode ? "all interfaces (0.0.0.0)" : "loopback interface (127.0.0.1)"} port 8088. Capturing raw payloads.</span>
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
            <span className="font-mono text-xs text-white" style={{ fontSize: '11px' }}>BINDING INTERFACE MODE</span>
            <span className="text-muted text-xxs mt-0.5" style={{ fontSize: '10px', color: '#8b949e' }}>
              {lanMode 
                ? "LAN Lab Mode: Honeypot binds to 0.0.0.0 and will accept connections from remote LAN devices." 
                : "Local Only Mode: Honeypot binds strictly to 127.0.0.1 (sandbox isolation)."}
            </span>
          </div>
          
          <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="font-mono" style={{ fontSize: '10px', color: !lanMode ? 'var(--cyan-primary)' : '#8b949e' }}>LOCAL ONLY</span>
            <label className="cyber-switch">
              <input 
                type="checkbox" 
                checked={lanMode} 
                disabled={honeypotStatus === 'ONLINE'}
                onChange={(e) => {
                  if (e.target.checked) {
                    const confirmLan = window.confirm(
                      "WARNING: Enabling LAN Mode will expose this vulnerable sandbox web server to your local network subnet. Do not execute this on untrusted public networks. Proceed?"
                    );
                    if (!confirmLan) return;
                  }
                  setLanMode(e.target.checked);
                }} 
              />
              <span className="slider round"></span>
            </label>
            <span className="font-mono" style={{ fontSize: '10px', color: lanMode ? 'var(--yellow)' : '#8b949e' }}>LAN LAB</span>
          </div>
        </div>
      </div>

      {/* Access Modes HUD Clarification */}
      <div className="access-modes-clarification card-cyber font-mono" style={{ padding: '16px', fontSize: '10px' }}>
        <div className="hud-title text-cyan mb-3 pb-1" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.05em' }}>HONEYPOT ACCESS MODES</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div>
            <span className="text-white font-bold" style={{ fontSize: '11px' }}>1. LOCAL ONLY MODE</span>
            <p className="text-muted mt-1" style={{ color: '#8b949e', marginTop: '4px' }}>
              Binds strictly to <strong>127.0.0.1</strong>. Works exclusively on this local machine. Recommended for safe local testing.
              <br/><span className="text-cyan">URL: http://127.0.0.1:8088</span>
            </p>
          </div>
          <div>
            <span className="text-white font-bold" style={{ fontSize: '11px' }}>2. LAN LAB MODE</span>
            <p className="text-muted mt-1" style={{ color: '#8b949e', marginTop: '4px' }}>
              Binds to <strong>0.0.0.0</strong>. Exposes sandbox endpoints to other devices connected to the same Wi-Fi/LAN. 
              <br/><span className="text-yellow">URL: {lanMode ? honeypotUrl : 'http://<your-laptop-lan-ip>:8088'}</span>
              <br/><span className="text-red-alert font-bold" style={{ color: 'var(--yellow)' }}>* Windows Firewall must allow port 8088.</span>
            </p>
          </div>
          <div>
            <span className="text-white font-bold" style={{ fontSize: '11px', color: '#5f748d' }}>3. PUBLIC CLOUD MODE (FUTURE PHASE)</span>
            <p className="text-muted mt-1" style={{ color: '#5f748d', marginTop: '4px' }}>
              Exposes target decoy endpoints to the public internet (e.g. AWS/GCP static IPv4). Blocked in local sandbox mode.
              <br/><span>URL: http://3.111.198.128:8088 (Unavailable)</span>
            </p>
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
              </tr>
            </thead>
            <tbody>
              {filteredActivity.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>
                    No honeypot activity detected matching the filters. Send a test probe to port 8088 to verify telemetry.
                  </td>
                </tr>
              ) : (
                filteredActivity.map((activity, idx) => (
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
                      <span className={`badge badge-${activity.severity.toLowerCase()}`}>
                        {activity.severity}
                      </span>
                    </td>
                    <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8b949e' }}>
                      {activity.payload}
                    </td>
                    <td style={{ padding: '8px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8b949e' }}>
                      {activity.user_agent}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
