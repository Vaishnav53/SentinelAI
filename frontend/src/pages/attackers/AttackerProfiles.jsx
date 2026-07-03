import React, { useState, useEffect } from 'react';
import { Skull, AlertTriangle, ShieldAlert, Cpu, Network, MapPin, ChevronRight, Activity, Search, ShieldX, Play, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import './AttackerProfiles.css';

export default function AttackerProfiles() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attackers, setAttackers] = useState([]);
  const [selectedIp, setSelectedIp] = useState(null);
  const [profile, setProfile] = useState(null);
  const [playbooks, setPlaybooks] = useState([]);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('');
  const [executingPlaybook, setExecutingPlaybook] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');

  const fetchList = async () => {
    try {
      const listData = await apiClient.get('/attacker/profiles');
      setAttackers(listData);
      
      if (listData.length > 0) {
        if (!selectedIp) {
          setSelectedIp(listData[0].ip_address);
        }
      }
    } catch (err) {
      console.error("Failed to load attacker list:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (ip) => {
    try {
      const detail = await apiClient.get(`/attacker/profiles/${ip}`);
      setProfile(detail);
      setExecutionLogs([]);
    } catch (err) {
      console.error(`Failed to load profile for ${ip}:`, err);
    }
  };

  const fetchPlaybooks = async () => {
    try {
      const data = await apiClient.get('/playbooks');
      setPlaybooks(data);
      if (data.length > 0) {
        setSelectedPlaybookId(data[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to load playbooks list:", err);
    }
  };

  useEffect(() => {
    fetchList();
    fetchPlaybooks();
  }, []);

  useEffect(() => {
    if (selectedIp) {
      fetchProfile(selectedIp);
    }
  }, [selectedIp]);

  // Execute Playbook trigger action
  const handleExecutePlaybook = async () => {
    if (!selectedPlaybookId || !selectedIp) return;
    try {
      setExecutingPlaybook(true);
      setExecutionLogs([{ step: 'INITIATING', status: 'RUNNING', message: 'Starting orchestrator workflow execution thread...' }]);
      
      const res = await apiClient.post(`/playbooks/execute/${selectedPlaybookId}`, {
        target_ip: selectedIp
      });

      // Populate logs
      if (res.logs_data) {
        const parsed = JSON.parse(res.logs_data);
        setExecutionLogs(parsed);
      }
      
      // Re-fetch profile and list state to show updated blocks
      await Promise.all([fetchProfile(selectedIp), fetchList()]);
    } catch (err) {
      console.error("Playbook execution failed:", err);
      setExecutionLogs(prev => [...prev, { step: 'SYSTEM_CRASH', status: 'FAILED', message: `Execution failed: ${err.message || err}` }]);
    } finally {
      setExecutingPlaybook(false);
    }
  };

  // Filtered attackers list
  const filteredAttackers = attackers.filter(a => 
    a.ip_address.includes(searchQuery) ||
    a.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="profile-root">
      {/* Search Filter Header */}
      <div className="waf-filter-bar card-cyber">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by IP, country, or location..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="waf-main-grid">
        {/* Profile list table */}
        <div className="waf-panel card-cyber list-panel-correlation" style={{ flex: 1 }}>
          <div className="panel-header">
            <h5 className="panel-title font-mono">Telemetry Attacker Dossiers</h5>
          </div>
          <div className="panel-body">
            <div className="attacker-list-container">
              {filteredAttackers.map((a) => {
                const isSelected = selectedIp === a.ip_address;
                return (
                  <div 
                    key={a.ip_address} 
                    className={`attacker-item card-cyber ${isSelected ? 'active-item' : ''}`}
                    onClick={() => setSelectedIp(a.ip_address)}
                  >
                    <div className="item-header">
                      <div className="d-flex align-items-center gap-2">
                        <Skull size={14} className={a.highest_severity === 'CRITICAL' ? 'text-red' : 'text-orange'} />
                        <span className="ip-val font-mono">{a.ip_address}</span>
                      </div>
                      <span className={`status-tag ${a.is_blocked ? 'tag-blocked' : 'tag-monitored'}`}>
                        {a.is_blocked ? 'BLOCKED' : 'MONITORED'}
                      </span>
                    </div>

                    <div className="item-meta mt-2">
                      <span className="meta-label">Events count:</span>
                      <span className="meta-val font-mono">{a.attack_count + a.waf_count}</span>
                    </div>
                    
                    <div className="item-meta">
                      <span className="meta-label">Location:</span>
                      <span className="meta-val text-cyan">{a.city}, {a.country}</span>
                    </div>
                  </div>
                );
              })}
              {filteredAttackers.length === 0 && (
                <div className="empty-text">No dossiers match search query.</div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed profiles section */}
        <div className="waf-panel card-cyber graph-panel" style={{ flex: 2 }}>
          {profile ? (
            <div className="attacker-detail-layout animate-slide-in">
              <div className="detail-header-block">
                <div className="left">
                  <h4 className="font-mono text-cyan" style={{ fontSize: '18px' }}>{profile.ip_address}</h4>
                  <div className="location-row font-mono mt-1">
                    <MapPin size={12} className="text-cyan" />
                    <span>{profile.city}, {profile.country} (Coordinates: {profile.latitude}, {profile.longitude})</span>
                  </div>
                </div>
                
                <div className="right">
                  <button 
                    className="btn-action btn-analyze-ai"
                    onClick={() => navigate(`/agent?analyze_attacker=${profile.ip_address}`)}
                  >
                    <Cpu size={14} />
                    Consult AI Security Copilot
                  </button>
                </div>
              </div>

              {/* MITRE ATT&CK taxonomy panel */}
              <div className="mt-4">
                <h5 className="section-title font-mono mb-2">MITRE ATT&CK Indicators</h5>
                <div className="mitre-cards-grid">
                  {profile.mitre_techniques.map((t) => (
                    <div key={t.id} className="mitre-card font-mono">
                      <span className="t-id">{t.id}</span>
                      <span className="t-name">{t.name}</span>
                      <span className="t-tactic text-muted">{t.tactic}</span>
                      <div className="t-count badge-cyan mt-1">{t.count} match events</div>
                    </div>
                  ))}
                  {profile.mitre_techniques.length === 0 && (
                    <div className="empty-small font-mono text-muted">
                      No technique patterns registered yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Response Playbook widget */}
              <div className="playbook-widget card-cyber mt-4">
                <h5 className="panel-title font-mono text-orange mb-2">Automated Threat Mitigation Playbooks</h5>
                <div className="playbook-launcher-row mt-2">
                  <select 
                    value={selectedPlaybookId} 
                    onChange={(e) => setSelectedPlaybookId(e.target.value)}
                    disabled={executingPlaybook}
                  >
                    {playbooks.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button 
                    className="btn-run-playbook"
                    onClick={handleExecutePlaybook}
                    disabled={executingPlaybook || !selectedPlaybookId}
                  >
                    <Play size={12} />
                    Run Playbook Workflow
                  </button>
                </div>

                {/* Execution logs display list */}
                {executionLogs.length > 0 && (
                  <div className="playbook-logs-container mt-3 font-mono">
                    <div className="logs-title">Execution Console Output:</div>
                    <div className="logs-list">
                      {executionLogs.map((log, idx) => (
                        <div key={idx} className="log-line">
                          <span className="log-time text-muted">[{new Date(log.time || Date.now()).toLocaleTimeString()}]</span>
                          <span className={`log-step ${log.status === 'FAILED' ? 'text-red' : 'text-cyan'}`}>[{log.step}]</span>
                          <span className="log-msg"> {log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Attacker detailed chronological timeline */}
              <div className="timeline-block mt-4">
                <h5 className="section-title font-mono mb-3">Chronological Threat Activity timeline</h5>
                <div className="campaign-timeline">
                  {profile.timeline.map((item, index) => (
                    <div key={index} className="timeline-item">
                      <div className="timeline-marker"></div>
                      <div className="timeline-content">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="time-lbl font-mono text-muted">{new Date(item.time).toLocaleString()}</span>
                          <span className={`badge badge-${item.severity.toLowerCase()}`}>{item.severity}</span>
                        </div>
                        <p className="desc-text font-mono text-sm mt-1">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-drawer">No attacker IP dossier selected.</div>
          )}
        </div>
      </div>
    </div>
  );
}
