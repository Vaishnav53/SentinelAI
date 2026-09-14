import React from 'react';
import { Zap, ChevronRight, ArrowUpRight, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatLocalTime, parseUtcDate } from '../../utils/dateUtils';

export default function AttackFeed({ attacks = [] }) {
  const navigate = useNavigate();

  // Strictly use real attacks without mock data injection
  const displayFeed = [...attacks].sort((a, b) => {
    const timeB = parseUtcDate(b.created_at)?.getTime() || 0;
    const timeA = parseUtcDate(a.created_at)?.getTime() || 0;
    return timeB - timeA;
  });

  const getSeverityPill = (severity) => {
    const sev = (severity || 'LOW').toUpperCase();
    switch (sev) {
      case 'CRITICAL':
        return <span className="feed-sev-badge sev-critical">CRITICAL</span>;
      case 'HIGH':
        return <span className="feed-sev-badge sev-high">HIGH</span>;
      case 'MEDIUM':
        return <span className="feed-sev-badge sev-medium">MEDIUM</span>;
      case 'LOW':
      default:
        return <span className="feed-sev-badge sev-low">LOW</span>;
    }
  };

  const getDotColor = (severity) => {
    const sev = (severity || 'LOW').toUpperCase();
    switch (sev) {
      case 'CRITICAL': return '#ff3366';
      case 'HIGH': return '#ff9f43';
      case 'MEDIUM': return '#ffd32a';
      case 'LOW': default: return '#00ff88';
    }
  };

  return (
    <div className="attack-feed-panel">
      {/* Panel Header */}
      <div className="feed-panel-header">
        <div className="feed-header-left">
          <div className="feed-header-icon-box">
            <Zap size={14} className="text-cyan" />
          </div>
          <span className="feed-title-text font-mono">LIVE ATTACK FEED</span>
          <span className="feed-new-pill font-mono">{displayFeed.length} New</span>
        </div>
        
        <button 
          className="feed-view-all-btn font-mono"
          onClick={() => navigate('/attacks')}
        >
          <span>View All</span>
          <ArrowUpRight size={13} />
        </button>
      </div>

      {/* Events List */}
      <div className="feed-events-container">
        {displayFeed.length === 0 ? (
          <div className="feed-empty-state font-mono">
            <Radio size={24} className="text-muted mb-2 animate-live-pulse" />
            <span>Awaiting telemetry signals...</span>
            <span className="text-xxs text-subtle mt-1">Honeypot listener active on port 8088</span>
          </div>
        ) : (
          displayFeed.slice(0, 6).map((attack, idx) => {
            const isCritical = attack.severity === 'CRITICAL';
            const dotColor = getDotColor(attack.severity);
            const port = attack.destination_port || 8088;

            return (
              <div 
                key={attack.id || idx}
                className={`feed-event-card ${isCritical ? 'event-critical-glow' : ''} ${idx === 0 ? 'event-latest-enter' : ''}`}
                onClick={() => navigate(`/agent?analyze_attack=${attack.id}`)}
                title="Click to analyze attack with AI Copilot"
              >
                <div className="feed-event-left-bar" style={{ backgroundColor: dotColor }}></div>

                <div className="feed-event-content">
                  {/* Top metadata line: direction, timestamp, severity badge, port pill */}
                  <div className="event-meta-line font-mono">
                    <span className="event-arrow-icon">↑</span>
                    <span className="event-timestamp">{formatLocalTime(attack.created_at)}</span>
                    {getSeverityPill(attack.severity)}
                    <span className="event-port-pill ms-auto">{port}</span>
                  </div>

                  {/* Middle title: status dot + attack type */}
                  <div className="event-title-line">
                    <span className="event-status-dot" style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}` }}></span>
                    <span className="event-attack-name">{attack.attack_type || 'Suspicious Activity'}</span>
                  </div>

                  {/* Bottom: source IP */}
                  <div className="event-ip-line font-mono">
                    <span className="event-ip-label">IP:</span>
                    <span className="event-ip-value">{attack.source_ip || '127.0.0.1'}</span>
                  </div>
                </div>

                <div className="feed-event-chevron">
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Panel Footer */}
      <div className="feed-panel-footer font-mono">
        <div className="footer-pulse-wave">
          <svg viewBox="0 0 24 10" width="24" height="10">
            <path d="M 0 5 Q 3 0 6 5 T 12 5 T 18 5 T 24 5" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.5" />
          </svg>
        </div>
        <span className="footer-status-text">Live feed updates in real-time</span>
        <span className="footer-live-dot animate-live-pulse ms-auto"></span>
      </div>
    </div>
  );
}
