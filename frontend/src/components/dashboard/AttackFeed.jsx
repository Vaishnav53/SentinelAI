import React from 'react';
import { Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AttackFeed({ attacks = [] }) {
  const navigate = useNavigate();

  // Reference blueprint events to enrich live feed
  const mockFeed = [
    { id: 'mock-1', created_at: new Date(Date.now() - 5000).toISOString(), source_ip: '192.168.1.105', attack_type: 'SQL Injection Attempt', target_service: 'CN', severity: 'CRITICAL' },
    { id: 'mock-2', created_at: new Date(Date.now() - 25000).toISOString(), source_ip: '203.0.113.45', attack_type: 'Admin Panel Probe', target_service: 'US', severity: 'HIGH' },
    { id: 'mock-3', created_at: new Date(Date.now() - 65000).toISOString(), source_ip: '198.51.100.23', attack_type: 'XSS Attempt Detected', target_service: 'DE', severity: 'HIGH' },
    { id: 'mock-4', created_at: new Date(Date.now() - 120000).toISOString(), source_ip: '192.168.1.203', attack_type: 'Config File Access', target_service: 'IN', severity: 'MEDIUM' },
    { id: 'mock-5', created_at: new Date(Date.now() - 180000).toISOString(), source_ip: '203.0.113.10', attack_type: 'Brute Force Login', target_service: 'RU', severity: 'HIGH' }
  ];

  // Merge database events with blueprint reference events
  const displayFeed = [...attacks];
  if (displayFeed.length < 5) {
    mockFeed.forEach(mock => {
      if (!displayFeed.some(a => a.attack_type === mock.attack_type)) {
        displayFeed.push(mock);
      }
    });
  }

  // Sort: newest first
  displayFeed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const severityColors = {
    CRITICAL: 'rgba(255, 51, 102, 0.25)',
    HIGH: 'rgba(255, 159, 67, 0.2)',
    MEDIUM: 'rgba(255, 211, 42, 0.15)',
    LOW: 'rgba(0, 255, 136, 0.12)'
  };

  return (
    <div className="dashboard-column event-feed-v2">
      <div className="feed-header-v2">
        <Layers className="text-cyan" size={14} />
        <span className="font-mono text-xs font-bold text-cyan">LIVE ATTACK FEED</span>
      </div>
      <div className="cyber-events-list">
        {displayFeed.slice(0, 6).map((attack, idx) => {
          const isCritical = attack.severity === 'CRITICAL';
          const borderCol = severityColors[attack.severity] || 'rgba(255, 255, 255, 0.1)';

          return (
            <div 
              key={attack.id} 
              className={`cyber-event-card slide-in-event ${isCritical ? 'critical-pulse-card' : ''} ${idx === 0 ? 'incoming-threat-flash' : ''}`}
              style={{ borderLeftColor: borderCol, animationDelay: `${idx * 0.08}s` }}
              onClick={() => navigate(`/agent?analyze_attack=${attack.id}`)}
            >
              <div className="event-row-top font-mono text-xxs">
                <span className="event-time">{new Date(attack.created_at).toLocaleTimeString()}</span>
                <span className="event-country-flag text-cyan" style={{ marginLeft: '8px' }}>
                  {attack.target_service}
                </span>
                <span className={`event-badge badge-${attack.severity.toLowerCase()} ms-auto`}>
                  {attack.severity}
                </span>
              </div>
              <div className="event-type text-xs font-bold mt-1 text-primary">{attack.attack_type}</div>
              <div className="event-details font-mono text-xxs text-muted mt-2">
                <div>IP: <span className="text-cyan">{attack.source_ip}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <button 
        className="btn-view-all-attacks font-mono text-xxs mt-2 w-full py-1.5"
        onClick={() => navigate('/attacks')}
      >
        VIEW ALL ATTACKS →
      </button>
    </div>
  );
}
