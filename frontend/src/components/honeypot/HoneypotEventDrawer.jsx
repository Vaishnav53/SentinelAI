import React, { useState } from 'react';
import { X, ShieldAlert, Cpu, Clock, Globe, Server, Terminal, Code, ChevronDown, ChevronRight, AlertTriangle, ExternalLink, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Sanitizes headers, payloads, and strings to redact potential secrets, tokens, or credentials.
 */
function sanitizeSecretContent(text) {
  if (!text) return "";
  let sanitized = String(text);
  // Redact password parameter values
  sanitized = sanitized.replace(/(password|passwd|secret|api_key|token|auth|authorization)=([^&; \n]+)/gi, '$1=[REDACTED_SECRET]');
  // Redact Bearer / Authorization headers
  sanitized = sanitized.replace(/(authorization:\s*)(bearer|basic)\s+([^\s\n]+)/gi, '$1$2 [REDACTED_SECRET]');
  return sanitized;
}

/**
 * Helper to safely extract JSON metadata
 */
function parseRawMetadata(rawString) {
  if (!rawString) return { mitreId: null, recommendation: null, extra: {} };
  try {
    const parsed = typeof rawString === 'string' ? JSON.parse(rawString) : rawString;
    return {
      mitreId: parsed.mitre_id || null,
      recommendation: parsed.recommendation || null,
      latitude: parsed.latitude || null,
      longitude: parsed.longitude || null,
      extra: parsed
    };
  } catch (e) {
    return { mitreId: null, recommendation: null, extra: {} };
  }
}

export default function HoneypotEventDrawer({ event, onClose }) {
  const navigate = useNavigate();
  const [showRawJson, setShowRawJson] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  const metadata = parseRawMetadata(event.raw_metadata);
  const sanitizedPayload = sanitizeSecretContent(event.payload || "No raw payload captured");
  const sanitizedUserAgent = sanitizeSecretContent(event.user_agent || "Unknown");

  // Parse HTTP method and path from payload snippet if present
  let httpMethod = 'GET';
  let requestPath = '/';
  if (event.payload && typeof event.payload === 'string') {
    const lines = event.payload.split('\n');
    for (const line of lines) {
      if (line.startsWith('Method:')) {
        httpMethod = line.replace('Method:', '').trim();
      } else if (line.startsWith('Path:')) {
        requestPath = line.replace('Path:', '').trim();
      }
    }
    if (httpMethod === 'GET' && (event.attack_type?.includes('Login') || event.attack_type?.includes('Upload') || event.attack_type?.includes('Submission'))) {
      httpMethod = 'POST';
    }
  }

  const handleNavigateToAI = () => {
    onClose();
    navigate(`/agent?analyze_attack=${event.id}`);
  };

  return (
    <div className="drawer-backdrop animate-fade-in" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(2, 6, 12, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'flex-end'
    }}>
      <div 
        className="drawer-container card-cyber scroll-bar animate-slide-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '90vw',
          height: '100vh',
          backgroundColor: 'var(--bg-card, #090d16)',
          borderLeft: '1px solid rgba(0, 242, 254, 0.25)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(17, 21, 29, 0.8)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert className={`text-${event.severity?.toLowerCase() || 'cyan'}`} size={20} />
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#ffffff', fontFamily: 'monospace' }}>
                EVENT #{event.id} ({event.external_id || `HON-${event.id}`})
              </h4>
              <span className="font-mono text-xxs text-muted">
                Captured {event.created_at ? new Date(event.created_at.endsWith('Z') ? event.created_at : event.created_at + 'Z').toLocaleString() : ''}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #8b949e)',
              cursor: 'pointer',
              padding: '4px'
            }}
            title="Close Drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Stats Badges */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div>
              <span className="font-mono text-xxs text-muted block">SEVERITY</span>
              <span className={`badge badge-${event.severity?.toLowerCase()}`}>{event.severity}</span>
            </div>
            <div>
              <span className="font-mono text-xxs text-muted block">STATUS</span>
              <span className={`status-tag status-${event.status?.toLowerCase()}`}>{event.status}</span>
            </div>
            <div>
              <span className="font-mono text-xxs text-muted block">THREAT SCORE</span>
              <span className="font-mono text-xs text-red font-bold">{event.threat_score?.toFixed(1) || '0.0'}/10</span>
            </div>
            <div>
              <span className="font-mono text-xxs text-muted block">CONFIDENCE</span>
              <span className="font-mono text-xs text-cyan">{(event.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Section 1: Deterministic Detection Engine Classification */}
          <div className="drawer-section">
            <h5 className="section-title font-mono text-cyan" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Deterministic Detection Engine Classification
            </h5>
            <div style={{
              background: 'rgba(0, 242, 254, 0.04)',
              border: '1px solid rgba(0, 242, 254, 0.2)',
              padding: '10px 14px',
              borderRadius: '4px'
            }}>
              <div className="font-mono text-xs" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Detected Attack Type:</span>
                <span className="text-white font-bold">{event.attack_type}</span>
              </div>
              {metadata.mitreId && (
                <div className="font-mono text-xs mt-2" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">MITRE ATT&CK ID:</span>
                  <span className="mitre-tag">{metadata.mitreId}</span>
                </div>
              )}
              <div className="font-mono text-xs mt-2" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Sensor Identification:</span>
                <span className="text-cyan">{event.sensor_id || 'HTTP Honeypot'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Observed Request Evidence */}
          <div className="drawer-section">
            <h5 className="section-title font-mono text-cyan" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Observed Network & HTTP Request Evidence
            </h5>
            <div className="info-grid font-mono text-xs" style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '12px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div className="text-muted">Source IP:</div>
              <div className="text-white font-bold">{event.source_ip}:{event.source_port || 'N/A'}</div>
              
              <div className="text-muted">GeoIP Location:</div>
              <div className="text-cyan">{event.city || 'Unknown'}, {event.country || 'Unknown'}</div>

              <div className="text-muted">Target Service:</div>
              <div>{event.target_service} (Port {event.destination_port})</div>

              <div className="text-muted">Protocol / Method:</div>
              <div>
                <span className="text-purple font-bold" style={{ marginRight: '8px' }}>{httpMethod}</span>
                <span className="text-white">{requestPath}</span>
              </div>

              <div className="text-muted">User-Agent:</div>
              <div style={{ wordBreak: 'break-all', color: 'var(--text-secondary)' }}>{sanitizedUserAgent}</div>
            </div>
          </div>

          {/* Section 3: Safe Payload Examiner (Untrusted Evidence) */}
          <div className="drawer-section">
            <h5 className="section-title font-mono text-cyan" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={14} /> Captured Payload &amp; Request Body (Untrusted Text Evidence)
            </h5>
            <div style={{ position: 'relative' }}>
              <pre 
                className="font-mono text-xxs scroll-bar"
                style={{
                  background: '#04070d',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  padding: '12px',
                  color: '#00ff88',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0
                }}
              >
                <code>{sanitizedPayload}</code>
              </pre>
            </div>
          </div>

          {/* Section 4: Recommended Response Actions */}
          {metadata.recommendation && (
            <div className="drawer-section">
              <h5 className="section-title font-mono text-cyan" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Defensive Recommendation
              </h5>
              <p className="font-mono text-xs text-muted" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '4px', margin: 0, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                {metadata.recommendation}
              </p>
            </div>
          )}

          {/* Section 5: Collapsible Raw Technical Section */}
          <div className="drawer-section">
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="font-mono text-xxs text-muted"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--cyan-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0'
              }}
            >
              {showRawJson ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{showRawJson ? "Hide Raw Telemetry JSON" : "Show Raw Telemetry JSON"}</span>
            </button>
            {showRawJson && (
              <pre className="font-mono text-xxs mt-2 scroll-bar" style={{
                background: '#04070d',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '10px',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                maxHeight: '140px',
                overflowY: 'auto',
                margin: 0
              }}>
                <code>{JSON.stringify(event, null, 2)}</code>
              </pre>
            )}
          </div>

          {/* Action Footer Button */}
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              className="btn-action btn-analyze-ai font-mono"
              onClick={handleNavigateToAI}
              style={{
                width: '100%',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.5)',
                color: '#a78bfa',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              <Cpu size={16} />
              <span>Analyze Event with AI Copilot →</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
