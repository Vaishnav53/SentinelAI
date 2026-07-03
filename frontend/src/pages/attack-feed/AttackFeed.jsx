import React, { useState, useEffect } from 'react';
import { Shield, Search, Filter, ShieldCheck, ChevronRight, RefreshCw, AlertOctagon, Cpu, User, Check, AlertTriangle, Play, MessageSquare, ClipboardList, ShieldAlert } from 'lucide-react';
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
  
  // Drawer tab selection: 'info', 'actions', 'timeline'
  const [activeTab, setActiveTab] = useState('info');
  const [noteText, setNoteText] = useState('');
  const [assignedAnalyst, setAssignedAnalyst] = useState('');

  const parseMetadata = (metaString) => {
    if (!metaString) {
      return { 
        mitreId: null, 
        recommendation: null, 
        notes: [], 
        audit_trail: [], 
        timeline: [],
        assigned_analyst: '',
        blocked: false,
        quarantined: false
      };
    }
    try {
      const parsed = typeof metaString === 'string' ? JSON.parse(metaString) : metaString;
      return {
        mitreId: parsed.mitre_id || null,
        recommendation: parsed.recommendation || null,
        notes: parsed.notes || [],
        audit_trail: parsed.audit_trail || [],
        timeline: parsed.timeline || [],
        assigned_analyst: parsed.assigned_analyst || '',
        blocked: !!parsed.blocked,
        quarantined: !!parsed.quarantined
      };
    } catch (e) {
      return { 
        mitreId: null, 
        recommendation: null, 
        notes: [], 
        audit_trail: [], 
        timeline: [],
        assigned_analyst: '',
        blocked: false,
        quarantined: false
      };
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
      if (data.length > 0) {
        if (!selectedAttack) {
          setSelectedAttack(data[0]);
          const meta = parseMetadata(data[0].raw_metadata);
          setAssignedAnalyst(meta.assigned_analyst || '');
        } else {
          // Keep current selection details in sync with the list
          const current = data.find(a => a.id === selectedAttack.id);
          if (current) {
            setSelectedAttack(current);
            const meta = parseMetadata(current.raw_metadata);
            setAssignedAnalyst(meta.assigned_analyst || '');
          }
        }
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

  // Execute an Incident Action
  const executeIncidentAction = async (payload) => {
    if (!selectedAttack) return;
    try {
      const updated = await apiClient.post(`/attacks/${selectedAttack.id}/incident-action`, payload);
      setAttacks(attacks.map(a => a.id === selectedAttack.id ? updated : a));
      setSelectedAttack(updated);
      
      const meta = parseMetadata(updated.raw_metadata);
      setAssignedAnalyst(meta.assigned_analyst || '');
    } catch (err) {
      console.error("Failed to execute SOC action:", err);
    }
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    executeIncidentAction({
      action: 'add_note',
      notes: noteText,
      analyst: assignedAnalyst || 'System Analyst'
    });
    setNoteText('');
  };

  const handleAssignAnalyst = (analystName) => {
    executeIncidentAction({
      action: 'assign_analyst',
      analyst: analystName
    });
  };

  if (loading && attacks.length === 0) {
    return <AttackFeedSkeleton />;
  }

  const selectedMeta = parseMetadata(selectedAttack?.raw_metadata);

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
            <option value="INVESTIGATING">Investigating</option>
            <option value="CONTAINED">Contained</option>
            <option value="CLOSED">Closed</option>
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
                      onClick={() => {
                        setSelectedAttack(attack);
                        const meta = parseMetadata(attack.raw_metadata);
                        setAssignedAnalyst(meta.assigned_analyst || '');
                      }}
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
              <div className="drawer-header" style={{ marginBottom: '15px' }}>
                <Shield className={`header-icon text-${selectedAttack.severity.toLowerCase()}`} size={24} />
                <div className="drawer-title-box">
                  <h4>{selectedAttack.attack_type}</h4>
                  <span className="drawer-subtitle font-mono">Incident ID: {selectedAttack.external_id || `DB-${selectedAttack.id}`}</span>
                </div>
                <span className={`status-tag status-${selectedAttack.status.toLowerCase()}`} style={{ marginLeft: 'auto' }}>
                  {selectedAttack.status}
                </span>
              </div>

              {/* Tabs selectors inside drawer */}
              <div className="soc-tabs">
                <button 
                  className={`soc-tab ${activeTab === 'info' ? 'active' : ''}`}
                  onClick={() => setActiveTab('info')}
                >
                  Analysis &amp; Payload
                </button>
                <button 
                  className={`soc-tab ${activeTab === 'actions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('actions')}
                >
                  Response Center
                </button>
                <button 
                  className={`soc-tab ${activeTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => setActiveTab('timeline')}
                >
                  Timeline &amp; Logs
                </button>
              </div>

              {/* TAB 1: Analysis & Payload */}
              {activeTab === 'info' && (
                <div>
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
                      <div className="info-label">Sensor ID:</div>
                      <div className="info-value">{selectedAttack.sensor_id}</div>
                      {selectedMeta.mitreId && (
                        <>
                          <div className="info-label">MITRE ATT&CK:</div>
                          <div className="info-value">
                            <span className="mitre-tag">{selectedMeta.mitreId}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="drawer-section">
                    <h5 className="section-title">Ingested Payload Data</h5>
                    <pre className="payload-box font-mono" style={{ maxHeight: '120px', overflowY: 'auto' }}>{selectedAttack.payload || 'No raw payload captured'}</pre>
                  </div>

                  {selectedMeta.recommendation && (
                    <div className="drawer-section">
                      <h5 className="section-title">Defensive Recommendation</h5>
                      <p className="recommendation-text font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{selectedMeta.recommendation}</p>
                    </div>
                  )}

                  {/* Copilot Analysis Action */}
                  <div className="drawer-actions" style={{ marginTop: '20px' }}>
                    <button 
                      className="btn-action btn-analyze-ai"
                      style={{ width: '100%', borderColor: 'rgba(139, 92, 246, 0.4)', color: 'var(--purple)', backgroundColor: 'rgba(139, 92, 246, 0.05)' }}
                      onClick={() => navigate(`/agent?analyze_attack=${selectedAttack.id}`)}
                    >
                      <Cpu size={14} style={{ marginRight: '6px' }} />
                      Analyze with AI Copilot
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Response Center */}
              {activeTab === 'actions' && (
                <div>
                  <h5 className="section-title">Case Owner Assignment</h5>
                  <div className="analyst-assign-box">
                    <User size={14} className="text-cyan" />
                    <label>Assign Analyst:</label>
                    <select 
                      value={assignedAnalyst} 
                      onChange={(e) => handleAssignAnalyst(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      <option value="Analyst Sarah">Analyst Sarah (Tier 1)</option>
                      <option value="Analyst Marcus">Analyst Marcus (Tier 2)</option>
                      <option value="Lead Analyst Alex">Alex Rivera (SOC Lead)</option>
                    </select>
                  </div>

                  <h5 className="section-title" style={{ marginTop: '20px' }}>State Transition Control</h5>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {['NEW', 'INVESTIGATING', 'CONTAINED', 'CLOSED'].map((stateName) => (
                      <button
                        key={stateName}
                        className={`btn-cyber-action ${selectedAttack.status === stateName ? 'active' : ''}`}
                        style={{
                          flexGrow: 1,
                          fontSize: '9px',
                          padding: '6px 10px',
                          borderWidth: '1px',
                          borderColor: selectedAttack.status === stateName ? 'var(--cyan-primary)' : 'var(--border-subtle)',
                          backgroundColor: selectedAttack.status === stateName ? 'rgba(0, 229, 255, 0.1)' : 'rgba(2, 6, 12, 0.45)'
                        }}
                        onClick={() => executeIncidentAction({ action: 'update_status', status: stateName })}
                      >
                        {stateName}
                      </button>
                    ))}
                  </div>

                  <h5 className="section-title" style={{ marginTop: '20px' }}>Containment &amp; Defensive Controls</h5>
                  <div className="incident-actions-grid">
                    <button 
                      className="btn-cyber-action action-block"
                      disabled={selectedMeta.blocked}
                      onClick={() => executeIncidentAction({ action: 'block_ip' })}
                    >
                      <ShieldAlert size={14} />
                      {selectedMeta.blocked ? "IP Blocked on WAF" : "Block Attacker IP"}
                    </button>
                    <button 
                      className="btn-cyber-action action-quarantine"
                      disabled={selectedMeta.quarantined}
                      onClick={() => executeIncidentAction({ action: 'quarantine_host' })}
                    >
                      <AlertTriangle size={14} />
                      {selectedMeta.quarantined ? "Asset Quarantined" : "Quarantine Host"}
                    </button>
                  </div>

                  <div className="incident-actions-grid" style={{ marginTop: '10px' }}>
                    <button 
                      className="btn-cyber-action"
                      onClick={() => executeIncidentAction({ action: 'escalate' })}
                    >
                      <Play size={12} style={{ transform: 'rotate(-90deg)' }} />
                      Escalate Case
                    </button>
                    <button 
                      className="btn-cyber-action"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => executeIncidentAction({ action: 'update_status', status: 'CLOSED' })}
                    >
                      Ignore &amp; Archive
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: Timeline & Case Logs */}
              {activeTab === 'timeline' && (
                <div>
                  <h5 className="section-title">Incident Audit History</h5>
                  <div className="soc-timeline">
                    {selectedMeta.timeline.length === 0 ? (
                      <div className="soc-timeline-item">
                        <div className={`soc-timeline-badge ${selectedAttack.severity.toLowerCase()}`}></div>
                        <div className="soc-timeline-header">
                          <span className="soc-timeline-time">{new Date(selectedAttack.created_at).toLocaleTimeString()}</span>
                          <span className="soc-timeline-state">NEW</span>
                        </div>
                        <div className="soc-timeline-desc">Telemetry event ingested from honeypot sensor.</div>
                      </div>
                    ) : (
                      selectedMeta.timeline.map((item, idx) => (
                        <div className="soc-timeline-item" key={idx}>
                          <div className={`soc-timeline-badge ${selectedAttack.severity.toLowerCase()}`}></div>
                          <div className="soc-timeline-header">
                            <span className="soc-timeline-time">{new Date(item.time).toLocaleTimeString()}</span>
                            <span className="soc-timeline-state">{item.state}</span>
                          </div>
                          <div className="soc-timeline-desc">{item.description}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <h5 className="section-title" style={{ marginTop: '20px' }}>Case Notes</h5>
                  <div className="case-notes-list">
                    {selectedMeta.notes.length === 0 ? (
                      <div className="text-muted text-xxs font-mono" style={{ textAlign: 'center', padding: '10px 0' }}>
                        No analyst logs added to this incident case yet.
                      </div>
                    ) : (
                      selectedMeta.notes.map((note, index) => (
                        <div className="case-note-item" key={index}>
                          <div className="case-note-header">
                            <span className="case-note-author">{note.author}</span>
                            <span>{new Date(note.time).toLocaleTimeString()}</span>
                          </div>
                          <div className="case-note-text">{note.text}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddNote} className="add-note-form">
                    <textarea 
                      rows="2" 
                      placeholder="Type custom analyst case note..." 
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <button type="submit" className="btn-cyber-action" style={{ alignSelf: 'flex-end', width: 'auto', padding: '6px 14px' }}>
                      <MessageSquare size={12} />
                      Log Note
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-drawer">Select an attack event to view full telemetry logs</div>
          )}
        </div>
      </div>
    </div>
  );
}
