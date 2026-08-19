import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Power, AlertTriangle, ShieldCheck, Activity, Eye, Cpu, Copy, Check, FileText, Lock, ChevronRight } from 'lucide-react';
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
  const [isReady, setIsReady] = useState(false);
  const [lanIp, setLanIp] = useState('127.0.0.1');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);
  const [selectedDrawerEvent, setSelectedDrawerEvent] = useState(null);
  const [serviceStartTime, setServiceStartTime] = useState(null);

  const formatLocalTime = (utcString) => {
    if (!utcString) return '';
    const cleanStr = (utcString.endsWith('Z') || utcString.includes('+')) ? utcString : utcString + 'Z';
    return new Date(cleanStr).toLocaleTimeString();
  };

  const filteredActivity = liveActivity.filter(activity => {
    const isSimulator = activity.sensor_id === 'Simulated Sensor Node' || activity.external_id?.startsWith('SIM-');
    if (logFilter === 'REAL') return !isSimulator;
    if (logFilter === 'SIMULATOR') return isSimulator;
    if (logFilter === 'HTTP') return activity.protocol === 'HTTP' || activity.target_service === 'HTTP' || activity.destination_port === 8088 || activity.destination_port === 8080;
    if (logFilter === 'SUSPICIOUS') return (activity.threat_score >= 5.0) || activity.severity === 'HIGH' || activity.severity === 'CRITICAL' || activity.attack_type?.includes('Traversal') || activity.attack_type?.includes('Injection');
    if (logFilter === 'HIGH_SEV') {
      const sev = activity.severity?.toUpperCase();
      return sev === 'HIGH' || sev === 'CRITICAL';
    }
    return true;
  });

  const applyStatusData = (statusData) => {
    if (!statusData) return;
    const prevStatus = honeypotStatus;
    const newStatus = statusData.status || 'OFFLINE';
    setHoneypotStatus(newStatus);
    setHoneypotUrl(statusData.url || 'http://127.0.0.1:8088');
    setIsReady(!!statusData.ready);
    setLanMode(!!statusData.lan_mode);
    setLanIp(statusData.lan_ip || '127.0.0.1');
    setErrorMessage(statusData.error || null);

    if (newStatus === 'ONLINE' && (!serviceStartTime || prevStatus !== 'ONLINE')) {
      setServiceStartTime(Date.now());
    } else if (newStatus !== 'ONLINE') {
      setServiceStartTime(null);
    }
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
      console.error('Failed to load Honeypot Lab status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndSensors();
    const interval = setInterval(async () => {
      try {
        const statusData = await apiClient.get('/honeypot/status');
        applyStatusData(statusData);
      } catch (err) {
        setHoneypotStatus('OFFLINE');
        setIsReady(false);
      }
    }, 3000);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = import.meta.env.VITE_WS_BASE_URL;
    if (wsUrl) {
      if (!wsUrl.endsWith('/api/attacks/ws')) {
        wsUrl = wsUrl.replace(/\\+$/, '') + '/api/attacks/ws';
      }
    } else {
      wsUrl = window.location.port === '5173'
        ? `${wsProtocol}//127.0.0.1:8000/api/attacks/ws`
        : `${wsProtocol}//${window.location.host}/api/attacks/ws`;
    }
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => console.log('Honeypot Lab WebSocket listener connected.');
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_attack') {
          const attack = payload.data;
          const isReal = attack.destination_port === 8088 && !attack.external_id?.startsWith('SIM-') && attack.sensor_id !== 'Simulated Sensor Node';
          const isSim = attack.sensor_id === 'Simulated Sensor Node' || attack.external_id?.startsWith('SIM-');
          if (isReal || isSim) {
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
    return () => { clearInterval(interval); socket.close(); };
  }, []);

  const handleToggleHoneypot = async () => {
    if (isTransitioning) return;
    try {
      setIsTransitioning(true);
      setErrorMessage(null);
      if (honeypotStatus === 'ONLINE' || honeypotStatus === 'STARTING') {
        setStatusNotice('Stopping HTTP Decoy listener...');
        const res = await apiClient.post('/honeypot/stop');
        applyStatusData(res);
      } else {
        setStatusNotice('Starting HTTP Decoy listener...');
        setHoneypotStatus('STARTING');
        const res = await apiClient.post('/honeypot/start', { lan_mode: lanMode });
        applyStatusData(res);
      }
      const sensorsData = await apiClient.get('/sensors');
      setSensors(sensorsData);
    } catch (e) {
      console.error('Failed to toggle honeypot state:', e);
      setHoneypotStatus('ERROR');
      setErrorMessage(e.message || 'Failed to toggle honeypot service state.');
    } finally { setIsTransitioning(false); setStatusNotice(null); }
  };

  const handleModeChange = async (targetLanMode) => {
    if (isTransitioning) return;
    if (targetLanMode) {
      const confirmLan = window.confirm('WARNING: Enabling LAN Mode will bind the vulnerable sandbox decoy server to 0.0.0.0, allowing inbound connections from your local network subnet.\n\nEnsure your network is trusted. Proceed?');
      if (!confirmLan) return;
    }
    try {
      setIsTransitioning(true);
      setErrorMessage(null);
      setStatusNotice(honeypotStatus === 'ONLINE' || honeypotStatus === 'STARTING' ? 'Rebinding listener interface & restarting HTTP Decoy...' : 'Applying interface binding mode...');
      const res = await apiClient.post('/honeypot/mode', { lan_mode: targetLanMode });
      applyStatusData(res);
      const sensorsData = await apiClient.get('/sensors');
      setSensors(sensorsData);
    } catch (e) {
      console.error('Failed to change binding interface mode:', e);
      setErrorMessage(e.message || 'Failed to update binding interface mode.');
    } finally { setIsTransitioning(false); setStatusNotice(null); }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // KPI calculations from real telemetry
  const totalInteractions = liveActivity.length;
  const uniqueAttackers = new Set(liveActivity.map(a => a.source_ip)).size;
  const highSeverityEvents = liveActivity.filter(a => {
    const sev = a.severity?.toUpperCase();
    return sev === 'HIGH' || sev === 'CRITICAL';
  }).length;

  const calculateUptime = () => {
    if (honeypotStatus !== 'ONLINE' || !serviceStartTime) return 'Offline';
    const elapsedSec = Math.floor((Date.now() - serviceStartTime) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    return `${mins}m ${secs}s`;
  };

  const lastEventTime = liveActivity.length > 0 && liveActivity[0].created_at
    ? formatLocalTime(liveActivity[0].created_at)
    : 'None';

  if (loading && sensors.length === 0) {
    return <div className="loading-state font-mono text-cyan">Initialising Honeypot Lab Telemetry...</div>;
  }

  return (
    <div className="lab-root">
      {/* Content Header */}
      <div className="lab-header card-cyber">
        <div className="lab-header-info">
          <div className="lab-header-icon-box">
            <Radio className={`text-cyan ${honeypotStatus === 'ONLINE' ? 'pulse' : ''}`} size={20} />
          </div>
          <div className="lab-header-title">
            <h4>HONEYPOT LAB</h4>
            <p>Deploy, monitor and analyze deception infrastructure in real-time</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (~80%) & Right Rail (~20%) */}
      <div className="main-grid">
        {/* Left Column */}
        <div className="left-col">
          {/* KPI Row (4 Cards) */}
          <div className="kpi-row">
            <div className="kpi-card status-card">
              <div className="kpi-icon-wrap">
                <Radio size={16} className={honeypotStatus === 'ONLINE' ? 'text-green pulse' : 'text-muted'} />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">HONEYPOT STATUS</div>
                <div className={`kpi-value badge badge-${honeypotStatus.toLowerCase()}`}>{honeypotStatus}</div>
              </div>
            </div>
            <div className="kpi-card interactions-card">
              <div className="kpi-icon-wrap">
                <Activity size={16} className="text-cyan" />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">TOTAL INTERACTIONS</div>
                <div className="kpi-value text-cyan font-mono">{totalInteractions}</div>
              </div>
            </div>
            <div className="kpi-card attackers-card">
              <div className="kpi-icon-wrap">
                <ShieldCheck size={16} className="text-cyan" />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">UNIQUE ATTACKERS</div>
                <div className="kpi-value text-cyan font-mono">{uniqueAttackers}</div>
              </div>
            </div>
            <div className="kpi-card severity-card">
              <div className="kpi-icon-wrap">
                <AlertTriangle size={16} className="text-red" />
              </div>
              <div className="kpi-content">
                <div className="kpi-label">HIGH SEVERITY EVENTS</div>
                <div className="kpi-value text-red font-mono">{highSeverityEvents}</div>
              </div>
            </div>
          </div>

          {/* Service Card */}
          <div className="main-honeypot-controller card-cyber">
            <div className="world-map-accent" />
            <div className="hp-control-header">
              <div className="hp-meta-desc">
                <div className="flex items-center gap-2 mb-1" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge badge-${honeypotStatus.toLowerCase()}`}>{honeypotStatus}</span>
                  <span className="badge font-mono" style={{ background: 'rgba(88, 166, 255, 0.1)', border: '1px solid rgba(88, 166, 255, 0.2)', color: '#58a6ff' }}>{lanMode ? 'LAN MODE' : 'LOCAL MODE'}</span>
                  <span className="badge font-mono" style={{ background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.2)', color: 'var(--cyan-primary)' }}>HTTP</span>
                  {isReady && <span className="badge font-mono" style={{ background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.2)', color: '#00ff88' }}>READY</span>}
                  {statusNotice && <span className="text-purple font-mono text-xxs animate-pulse" style={{ fontSize: '10px', color: '#a855f7' }}>{statusNotice}</span>}
                </div>
                <h3 className="sensor-name">Aetheris HTTP Decoy Service</h3>
                <p className="text-muted font-mono" style={{ fontSize: '11px', color: '#8b949e', margin: '4px 0 8px 0' }}>
                  Bind Address: <strong className="text-white" style={{ color: '#ffffff' }}>{lanMode ? '0.0.0.0:8088' : '127.0.0.1:8088'}</strong> | LAN IP: <strong className="text-cyan" style={{ color: 'var(--cyan-primary)' }}>{lanIp}</strong> | Port: <strong className="text-white" style={{ color: '#ffffff' }}>8088</strong>
                </p>

                <div className="flex items-center gap-3 mt-1" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span className="font-mono text-xs text-muted" style={{ fontSize: '11px' }}>
                    Decoy Access URL: <a href={honeypotUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-cyan" style={{ textDecoration: 'underline', color: 'var(--cyan-primary)' }}>{honeypotUrl}</a>
                  </span>
                  <button onClick={() => window.open(honeypotUrl, '_blank')} className="font-mono btn-action-cyber" style={{ padding: '4px 12px', fontSize: '10px', background: 'rgba(0, 229, 255, 0.15)', border: '1px solid var(--cyan-primary)', color: '#ffffff', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Open Aetheris</button>
                  <button onClick={() => copyToClipboard(honeypotUrl, 'main-url')} className="font-mono btn-action-cyber flex items-center gap-1" style={{ padding: '4px 12px', fontSize: '10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#c9d1d9', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {copiedIndex === 'main-url' ? <Check size={11} className="text-green" /> : <Copy size={11} />}
                    <span>{copiedIndex === 'main-url' ? 'Copied URL!' : 'Copy URL'}</span>
                  </button>
                </div>

                {honeypotStatus === 'STARTING' && (
                  <p className="text-purple font-mono text-xs mt-1" style={{ fontSize: '11px', color: '#a855f7' }}>Starting listener on port 8088 and verifying readiness...</p>
                )}

                {errorMessage && (
                  <p className="text-red font-mono text-xs mt-1" style={{ fontSize: '11px', color: '#ff3366' }}>⚠️ {errorMessage}</p>
                )}
              </div>
              <button className={`hp-power-btn ${honeypotStatus === 'ONLINE' ? 'active' : ''}`} onClick={handleToggleHoneypot} disabled={isTransitioning} title={honeypotStatus === 'ONLINE' ? 'Stop Honeypot' : 'Start Honeypot'}>
                <Power size={22} />
              </button>
            </div>

            {honeypotStatus === 'ONLINE' && isReady ? (
              <div className="sensor-status-msg text-green font-mono"><ShieldCheck size={16} /><span>DECOY ACTIVE: Listening on {lanMode ? `all interfaces (0.0.0.0) — Shareable LAN URL: ${honeypotUrl}` : `loopback interface (127.0.0.1) — Shareable URL: ${honeypotUrl}`}. Capturing raw payloads.</span></div>
            ) : honeypotStatus === 'STARTING' ? (
              <div className="sensor-status-msg text-purple font-mono"><Activity size={16} className="animate-spin" /><span>DECOY INITIALIZING: Rebinding listener interface and restarting HTTP Decoy…</span></div>
            ) : (
              <div className="sensor-status-msg text-muted font-mono"><AlertTriangle size={16} /><span>DECOY OFFLINE: Local listener is inactive. Attack traffic on port 8088 will be dropped.</span></div>
            )}

            {/* Binding Mode Footer */}
            <div className="binding-mode-selector mt-2 pt-2 border-top border-dark" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', marginTop: '10px' }}>
              <div className="flex flex-col">
                <span className="font-mono text-xs text-white" style={{ fontSize: '11px', fontWeight: 'bold' }}>BINDING INTERFACE MODE</span>
                <span className="text-muted text-xxs mt-0.5" style={{ fontSize: '10px', color: '#8b949e' }}>{lanMode ? `LAN Mode: Honeypot binds to 0.0.0.0:8088 (Accessible from other devices on your Wi-Fi/LAN at ${honeypotUrl}).` : 'Local Mode: Honeypot binds strictly to 127.0.0.1:8088 (Only accessible from this computer).'}</span>
                {lanMode && <span className="text-yellow text-xxs font-mono mt-1" style={{ fontSize: '9px', color: '#ffd32a' }}>Note: Windows Firewall must allow inbound TCP traffic on port 8088 for LAN devices to connect.</span>}
              </div>
              <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="font-mono" style={{ fontSize: '10px', color: !lanMode ? 'var(--cyan-primary)' : '#8b949e', fontWeight: !lanMode ? 'bold' : 'normal' }}>LOCAL MODE</span>
                <label className="cyber-switch"><input type="checkbox" checked={lanMode} disabled={isTransitioning} onChange={(e) => handleModeChange(e.target.checked)} /><span className="slider round"></span></label>
                <span className="font-mono" style={{ fontSize: '10px', color: lanMode ? 'var(--yellow)' : '#8b949e', fontWeight: lanMode ? 'bold' : 'normal' }}>LAN MODE</span>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="live-honeypot-activity card-cyber">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Activity className="text-cyan animate-pulse" size={16} />
              <h5 className="section-title font-mono text-cyan" style={{ margin: 0, fontSize: '13px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Live Honeypot Activity Log</h5>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar flex justify-between items-center mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div className="filter-group-left flex gap-1.5" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button className={`filter-btn-cyber ${logFilter === 'ALL' ? 'active' : ''}`} onClick={() => setLogFilter('ALL')}>All Events</button>
                <button className={`filter-btn-cyber ${logFilter === 'HTTP' ? 'active' : ''}`} onClick={() => setLogFilter('HTTP')}>HTTP Requests</button>
                <button className={`filter-btn-cyber ${logFilter === 'SUSPICIOUS' ? 'active' : ''}`} onClick={() => setLogFilter('SUSPICIOUS')}>Suspicious</button>
                <button className={`filter-btn-cyber ${logFilter === 'HIGH_SEV' ? 'active' : ''}`} onClick={() => setLogFilter('HIGH_SEV')}>High Severity</button>
              </div>
              <div className="filter-group-right flex gap-1.5" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button className={`filter-btn-cyber ${logFilter === 'REAL' ? 'active' : ''}`} onClick={() => setLogFilter('REAL')}>Real Portal Events</button>
                <button className={`filter-btn-cyber ${logFilter === 'SIMULATOR' ? 'active' : ''}`} onClick={() => setLogFilter('SIMULATOR')}>Simulator Events</button>
              </div>
            </div>

            {/* Telemetry Table */}
            <div className="table-container scroll-bar" style={{ overflowX: 'auto', maxHeight: '420px' }}>
              <table className="font-mono telemetry-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0, 229, 255, 0.2)', textAlign: 'left', position: 'sticky', top: 0, background: '#090d16', zIndex: 2 }}>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)' }}>TIMESTAMP</th>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)' }}>SOURCE IP</th>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)' }}>METHOD</th>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)' }}>PATH</th>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)' }}>ATTACK TYPE</th>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)' }}>SEVERITY</th>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)' }}>PAYLOAD PREVIEW</th>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)' }}>USER-AGENT</th>
                    <th style={{ padding: '8px 10px', color: 'var(--cyan-primary)', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.length === 0 ? (
                    <tr><td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: '#8b949e' }}>No honeypot activity detected matching the filters. Send a test probe to port 8088 to verify telemetry.</td></tr>
                  ) : (
                    filteredActivity.map((activity, idx) => {
                      const payloadPreview = activity.payload ? (activity.payload.length > 50 ? activity.payload.slice(0,50)+'...' : activity.payload) : '';
                      const userAgentPreview = activity.user_agent ? (activity.user_agent.length > 20 ? activity.user_agent.slice(0,20)+'...' : activity.user_agent) : 'Unknown';
                      return (
                        <tr key={activity.id || idx} className="telemetry-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#c9d1d9' }}>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{formatLocalTime(activity.created_at)}</td>
                          <td style={{ padding: '7px 10px', color: '#ffffff', fontWeight: '600' }}>{activity.source_ip}</td>
                          <td style={{ padding: '7px 10px' }}><span style={{ color: activity.payload?.includes('Method: POST') || activity.attack_type?.includes('Login') || activity.attack_type?.includes('Upload') || activity.attack_type?.includes('Submission') ? '#ff9f43' : '#58a6ff', fontWeight: 'bold' }}>{activity.payload?.includes('Method: POST') || activity.attack_type?.includes('Login') || activity.attack_type?.includes('Upload') || activity.attack_type?.includes('Submission') ? 'POST' : 'GET'}</span></td>
                          <td style={{ padding: '7px 10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activity.payload?.split('\n')[1]?.replace('Path: ', '') || '/'}>{activity.payload?.split('\n')[1]?.replace('Path: ', '') || (activity.attack_type?.includes('Login') ? '/login' : (activity.attack_type?.includes('Upload') ? '/upload' : (activity.attack_type?.includes('Feedback') ? '/feedback' : '/')))}</td>
                          <td style={{ padding: '7px 10px', fontWeight: 'bold', color: '#e6edf3' }}>{activity.attack_type}</td>
                          <td style={{ padding: '7px 10px' }}><span className={`badge badge-${activity.severity?.toLowerCase()}`}>{activity.severity}</span></td>
                          <td style={{ padding: '7px 10px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8b949e' }} title={activity.payload || ''}>{payloadPreview}</td>
                          <td style={{ padding: '7px 10px', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8b949e' }} title={activity.user_agent || ''}>{userAgentPreview}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button onClick={() => setSelectedDrawerEvent(activity)} className="btn-table-action btn-view-details" title="View complete request evidence"><Eye size={11} /> View Details</button>
                            <button onClick={() => navigate(`/agent?analyze_attack=${activity.id}`)} className="btn-table-action btn-analyze-ai" title="Analyze event with AI Copilot"><Cpu size={11} /> Analyze with AI</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column Rail */}
        <div className="right-col">
          {/* 1. Quick Actions */}
          <div className="quick-actions card-cyber">
            <h4 className="section-title font-mono text-cyan" style={{ marginBottom: '12px', fontSize: '12px', letterSpacing: '0.05em' }}>QUICK ACTIONS</h4>
            <div className="quick-actions-list">
              <button className="quick-action-item" onClick={() => document.querySelector('.live-honeypot-activity')?.scrollIntoView({ behavior: 'smooth' })}>
                <div className="quick-action-icon text-cyan"><Activity size={16} /></div>
                <div className="quick-action-text">
                  <span className="quick-action-title">View Live Activity</span>
                  <span className="quick-action-desc">Scroll to live telemetry log</span>
                </div>
                <ChevronRight size={14} className="quick-action-arrow" />
              </button>

              <button className="quick-action-item" onClick={() => navigate('/agent')}>
                <div className="quick-action-icon text-purple"><Cpu size={16} /></div>
                <div className="quick-action-text">
                  <span className="quick-action-title">Analyze with AI</span>
                  <span className="quick-action-desc">Launch SOC AI assistant</span>
                </div>
                <ChevronRight size={14} className="quick-action-arrow" />
              </button>

              <button className="quick-action-item" onClick={() => navigate('/reports')}>
                <div className="quick-action-icon text-cyan"><FileText size={16} /></div>
                <div className="quick-action-text">
                  <span className="quick-action-title">Generate Report</span>
                  <span className="quick-action-desc">Export threat compliance summary</span>
                </div>
                <ChevronRight size={14} className="quick-action-arrow" />
              </button>

              <button className="quick-action-item" onClick={() => copyToClipboard('New-NetFirewallRule -DisplayName "SentinelAI Aetheris HTTP Decoy" -Direction Inbound -Protocol TCP -LocalPort 8088 -Action Allow -Profile Private', 'fw-add')}>
                <div className="quick-action-icon text-green">{copiedIndex === 'fw-add' ? <Check size={16} /> : <ShieldCheck size={16} />}</div>
                <div className="quick-action-text">
                  <span className="quick-action-title">{copiedIndex === 'fw-add' ? 'Rule Copied!' : 'Firewall Helper'}</span>
                  <span className="quick-action-desc">Copy PowerShell inbound rule</span>
                </div>
                <ChevronRight size={14} className="quick-action-arrow" />
              </button>
            </div>
          </div>

          {/* 2. Honeypot Info */}
          <div className="info-card card-cyber">
            <h4 className="section-title font-mono text-cyan" style={{ marginBottom: '12px', fontSize: '12px', letterSpacing: '0.05em' }}>HONEYPOT INFO</h4>
            <div className="info-rows font-mono">
              <div className="info-row"><span>Service Name</span><span className="text-white font-bold">Aetheris HTTP Decoy</span></div>
              <div className="info-row"><span>Protocol</span><span className="text-cyan">HTTP</span></div>
              <div className="info-row"><span>Bind Address</span><span>{lanMode ? '0.0.0.0' : '127.0.0.1'}</span></div>
              <div className="info-row"><span>Port</span><span className="text-white">8088</span></div>
              <div className="info-row"><span>Mode</span><span className="badge font-mono text-xxs" style={{ background: 'rgba(88,166,255,0.1)', color: '#58a6ff' }}>{lanMode ? 'LAN MODE' : 'LOCAL MODE'}</span></div>
              <div className="info-row"><span>Status</span><span className={`badge badge-${honeypotStatus.toLowerCase()}`}>{honeypotStatus}</span></div>
              <div className="info-row"><span>Uptime</span><span className="text-muted">{calculateUptime()}</span></div>
              <div className="info-row"><span>Last Event</span><span className="text-muted">{lastEventTime}</span></div>
            </div>
          </div>

          {/* 3. Safety Reminder */}
          <div className="safety-card card-cyber">
            <div className="safety-header">
              <AlertTriangle size={15} className="text-yellow" />
              <h4 className="safety-title font-mono text-yellow">SAFETY REMINDER</h4>
            </div>
            <p className="safety-body font-mono">
              This honeypot is intended for authorized research and defensive monitoring only. Do not expose it directly to untrusted public networks.
            </p>
          </div>
        </div>
      </div>

      {/* Event Details Drawer */}
      {selectedDrawerEvent && (
        <HoneypotEventDrawer event={selectedDrawerEvent} onClose={() => setSelectedDrawerEvent(null)} />
      )}
    </div>
  );
}
