import React, { useState, useEffect } from 'react';
import { Radio, Power, AlertTriangle, ShieldCheck, Terminal, Copy, Check } from 'lucide-react';
import apiClient from '../../api/client';
import './HoneypotLab.css';

export default function HoneypotLab() {
  const [sensors, setSensors] = useState([]);
  const [honeypotStatus, setHoneypotStatus] = useState('OFFLINE');
  const [honeypotUrl, setHoneypotUrl] = useState('http://127.0.0.1:8088');
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const fetchStatusAndSensors = async () => {
    try {
      setLoading(true);
      const [sensorsData, statusData] = await Promise.all([
        apiClient.get('/sensors'),
        apiClient.get('/honeypot/status')
      ]);
      setSensors(sensorsData);
      setHoneypotStatus(statusData.status);
      setHoneypotUrl(statusData.url);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndSensors();
    const interval = setInterval(async () => {
      try {
        const statusData = await apiClient.get('/honeypot/status');
        setHoneypotStatus(statusData.status);
      } catch (err) {
        setHoneypotStatus('OFFLINE');
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleHoneypot = async () => {
    try {
      const endpoint = honeypotStatus === 'ONLINE' ? '/honeypot/stop' : '/honeypot/start';
      const res = await apiClient.post(endpoint);
      setHoneypotStatus(res.status);
      
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
      cmd: `curl -G "http://127.0.0.1:8088/search" --data-urlencode "q=admin' OR '1'='1"`
    },
    {
      title: "XSS Infiltration Probe (curl)",
      cmd: `curl -G "http://127.0.0.1:8088/comments" --data-urlencode "text=<script>alert(document.cookie)</script>"`
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

  // Find http honeypot dynamic details
  const httpSensor = sensors.find(s => s.name === "HTTP Honeypot");
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
            <p className="text-muted font-mono">{honeypotUrl}</p>
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
            <span>DECOY ACTIVE: Listening on loopback interface port 8088. Capturing raw payloads.</span>
          </div>
        ) : (
          <div className="sensor-status-msg text-muted font-mono">
            <AlertTriangle size={16} />
            <span>DECOY OFFLINE: Local listener is inactive. Attack traffic on port 8088 will be dropped.</span>
          </div>
        )}
      </div>

      {/* Grid of other simulated sensors */}
      <h5 className="section-title">Decoy Sandbox Listener Nodes</h5>
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
    </div>
  );
}
