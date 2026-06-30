import React, { useState, useEffect } from 'react';
import { Shield, Search, Filter, ShieldCheck, ChevronRight, RefreshCw, AlertOctagon, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import './AttackFeed.css';

// Loading skeleton loader matching layout columns
function AttackFeedSkeleton() {
  return (
    <div className="feed-root skeleton-root">
      <div className="filter-bar card-cyber skeleton-card animate-skeleton" style={{ height: '54px' }}></div>
      <div className="feed-grid">
        <div className="list-box card-cyber skeleton-card animate-skeleton" style={{ height: '400px' }}></div>
        <div className="details-drawer card-cyber skeleton-card animate-skeleton" style={{ height: '400px' }}></div>
      </div>
    </div>
  );
}

export default function AttackFeed() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [attacks, setAttacks] = useState([]);
  const [selectedAttack, setSelectedAttack] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const getMetadata = (metaString) => {
    if (!metaString) return { mitreId: null, recommendation: null };
    try {
      const parsed = JSON.parse(metaString);
      return {
        mitreId: parsed.mitre_id || null,
        recommendation: parsed.recommendation || null
      };
    } catch (e) {
      return { mitreId: null, recommendation: null };
    }
  };

  // Fetch attacks
  const fetchAttacks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setIsSyncing(true);
      
      const data = await apiClient.get('/attacks', {
        params: {
          severity: severityFilter || undefined,
          target_service: serviceFilter || undefined,
          status: statusFilter || undefined,
          search: searchQuery || undefined
        }
      });
      setAttacks(data);
      
      // Auto-select first item if details panel is empty
      if (data.length > 0 && !selectedAttack) {
        setSelectedAttack(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
      setIsSyncing(false);
    }
  };

  // Poll for changes when filters change
  useEffect(() => {
    fetchAttacks();
  }, [severityFilter, serviceFilter, statusFilter, searchQuery]);

  // Dynamic background polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAttacks(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [severityFilter, serviceFilter, statusFilter, searchQuery, selectedAttack]);

  // Update status
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const updated = await apiClient.post(`/attacks/${id}/status`, { status: newStatus });
      setAttacks(attacks.map(a => a.id === id ? updated : a));
      if (selectedAttack && selectedAttack.id === id) {
        setSelectedAttack(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && attacks.length === 0) {
    return <AttackFeedSkeleton />;
  }

  return (
    <div className="feed-root">
      {/* Filters row with refresh indicator */}
      <div className="filter-bar card-cyber">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search IP, payload signatures..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filters-selectors">
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">All Severities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
            <option value="">All Services</option>
            <option value="HTTP">HTTP</option>
            <option value="SSH">SSH</option>
            <option value="FTP">FTP</option>
            <option value="TELNET">Telnet</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="RESOLVED">Resolved</option>
            <option value="IGNORED">Ignored</option>
          </select>

          {/* Sync indicator */}
          <button 
            className={`sync-btn ${isSyncing ? 'syncing' : ''}`}
            onClick={() => fetchAttacks(true)}
            title="Force telemetry synchronization"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main layout: Grid of List + Details */}
      <div className="feed-grid">
        {/* Attacks List */}
        <div className="list-box card-cyber">
          <div className="feed-table-container">
            <table className="feed-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source IP</th>
                  <th>Attack Type</th>
                  <th>Service</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {attacks.map((attack) => {
                  const isSelected = selectedAttack?.id === attack.id;
                  
                  // Highlight events less than 20 seconds old
                  const isNew = (new Date() - new Date(attack.created_at)) < 20000;
                  
                  return (
                    <tr 
                      key={attack.id} 
                      className={`${isSelected ? 'active-row' : ''} ${isNew ? 'newly-captured-row' : ''}`}
                      onClick={() => setSelectedAttack(attack)}
                    >
                      <td className="font-mono">{new Date(attack.created_at).toLocaleTimeString()}</td>
                      <td className="font-mono">{attack.source_ip}</td>
                      <td className={attack.severity === 'CRITICAL' ? 'text-red font-bold' : ''}>{attack.attack_type}</td>
                      <td><span className="service-tag font-mono">{attack.target_service}</span></td>
                      <td>
                        <span className={`badge badge-${attack.severity.toLowerCase()}`}>
                          {attack.severity}
                        </span>
                      </td>
                      <td>
                        <span className={`status-tag status-${attack.status.toLowerCase()}`}>
                          {attack.status}
                        </span>
                      </td>
                      <td><ChevronRight size={14} className="chevron-row" /></td>
                    </tr>
                  );
                })}
                {attacks.length === 0 && (
                  <tr>
                    <td colSpan="7">
                      <div className="empty-state-container font-mono">
                        <AlertOctagon className="text-muted text-lg" size={32} />
                        <h4>NO THREAT SIGNATURES DETECTED</h4>
                        <p className="text-muted">No telemetry events match your selected filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Attack Details Drawer */}
        <div className="details-drawer card-cyber">
          {selectedAttack ? (
            <div className="details-content animate-slide-in">
              <div className="drawer-header">
                <Shield className={`header-icon text-${selectedAttack.severity.toLowerCase()}`} size={24} />
                <div className="drawer-title-box">
                  <h4>{selectedAttack.attack_type}</h4>
                  <span className="drawer-subtitle font-mono">ID: {selectedAttack.external_id || `DB-${selectedAttack.id}`}</span>
                </div>
              </div>

              <div className="drawer-stats">
                <div className="d-stat">
                  <span className="d-label">Threat Score</span>
                  <span className="d-val text-red font-mono">{selectedAttack.threat_score.toFixed(1)}/10</span>
                </div>
                <div className="d-stat">
                  <span className="d-label">Confidence</span>
                  <span className="d-val text-cyan font-mono">{(selectedAttack.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="drawer-section">
                <h5 className="section-title">Telemetry Info</h5>
                <div className="info-grid font-mono">
                  <div className="info-label">Timestamp:</div>
                  <div className="info-value">{new Date(selectedAttack.created_at).toLocaleString()}</div>
                  <div className="info-label">Source IP:</div>
                  <div className="info-value">{selectedAttack.source_ip}:{selectedAttack.source_port || 'N/A'}</div>
                  <div className="info-label">Geo Location:</div>
                  <div className="info-value">{selectedAttack.country || 'Unknown'}, {selectedAttack.city || 'Unknown'}</div>
                  <div className="info-label">Sensor Identity:</div>
                  <div className="info-value">{selectedAttack.sensor_id}</div>
                  {getMetadata(selectedAttack.raw_metadata).mitreId && (
                    <>
                      <div className="info-label">MITRE ATT&CK:</div>
                      <div className="info-value">
                        <span className="mitre-tag">{getMetadata(selectedAttack.raw_metadata).mitreId}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="drawer-section">
                <h5 className="section-title">Ingested Payload Data</h5>
                <pre className="payload-box font-mono">{selectedAttack.payload || 'No raw payload captured'}</pre>
              </div>

              {getMetadata(selectedAttack.raw_metadata).recommendation && (
                <div className="drawer-section">
                  <h5 className="section-title">Defensive Recommendation</h5>
                  <p className="recommendation-text font-mono">{getMetadata(selectedAttack.raw_metadata).recommendation}</p>
                </div>
              )}

              {/* Copilot Analysis Action */}
              <div className="drawer-actions" style={{ marginBottom: '12px' }}>
                <button 
                  className="btn-action btn-analyze-ai"
                  style={{ width: '100%', borderColor: 'rgba(139, 92, 246, 0.4)', color: 'var(--purple)', backgroundColor: 'rgba(139, 92, 246, 0.05)' }}
                  onClick={() => navigate(`/agent?analyze_attack=${selectedAttack.id}`)}
                >
                  <Cpu size={14} style={{ marginRight: '6px' }} />
                  Analyze with AI
                </button>
              </div>

              {/* Status Actions */}
              <div className="drawer-actions">
                <h5 className="section-title">Incident Response</h5>
                <div className="actions-buttons">
                  {selectedAttack.status !== 'RESOLVED' && (
                    <button 
                      className="btn-action btn-resolve"
                      onClick={() => handleUpdateStatus(selectedAttack.id, 'RESOLVED')}
                    >
                      <ShieldCheck size={16} />
                      Resolve Event
                    </button>
                  )}
                  {selectedAttack.status === 'NEW' && (
                    <button 
                      className="btn-action btn-assign"
                      onClick={() => handleUpdateStatus(selectedAttack.id, 'ASSIGNED')}
                    >
                      Assign
                    </button>
                  )}
                  {selectedAttack.status !== 'IGNORED' && (
                    <button 
                      className="btn-action btn-ignore"
                      onClick={() => handleUpdateStatus(selectedAttack.id, 'IGNORED')}
                    >
                      Ignore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-drawer">Select an attack event to view full telemetry logs</div>
          )}
        </div>
      </div>
    </div>
  );
}
