import React, { useState, useEffect, useRef } from 'react';
import { Share2, Search, Filter, RefreshCw, ChevronRight, Play, AlertTriangle, User, MessageSquare, Cpu, X, GitBranch, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import './CorrelationDashboard.css';

export default function CorrelationDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Case actions
  const [assignedAnalyst, setAssignedAnalyst] = useState('');
  const [commentText, setCommentText] = useState('');

  // Canvas Refs for Interactive Graph
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const graphDataRef = useRef({ nodes: [], links: [] });
  const draggedNodeRef = useRef(null);

  // Fetch Correlation Incidents
  const fetchIncidents = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setIsSyncing(true);
      
      const data = await apiClient.get('/correlation/incidents', {
        params: {
          search: searchQuery || undefined,
          status: statusFilter || undefined
        }
      });
      setIncidents(data);
      
      if (data.length > 0) {
        if (!selectedIncident) {
          setSelectedIncident(data[0]);
          setAssignedAnalyst(data[0].assigned_analyst || '');
        } else {
          const current = data.find(i => i.id === selectedIncident.id);
          if (current) {
            setSelectedIncident(current);
            setAssignedAnalyst(current.assigned_analyst || '');
          }
        }
      }
    } catch (err) {
      console.error("Failed to load correlated incidents:", err);
    } finally {
      if (!isSilent) setLoading(false);
      setIsSyncing(false);
    }
  };

  const handleTriggerDemoLogs = async () => {
    try {
      await apiClient.post('/correlation/seed-demo');
      await fetchIncidents();
    } catch (e) {
      console.error("Failed to seed demo correlation incident:", e);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [searchQuery, statusFilter]);

  // Background polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchIncidents(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [searchQuery, statusFilter, selectedIncident]);

  // Update Graph Data whenever selected incident changes
  useEffect(() => {
    if (!selectedIncident) return;
    try {
      const nodes = JSON.parse(selectedIncident.nodes_data || '[]');
      const links = JSON.parse(selectedIncident.links_data || '[]');
      
      // Initialize nodes physics parameters
      const width = canvasRef.current ? canvasRef.current.width : 400;
      const height = canvasRef.current ? canvasRef.current.height : 300;
      
      const initializedNodes = nodes.map((node, idx) => {
        // Distribute nodes evenly on circle initially
        const angle = (idx / nodes.length) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.3;
        return {
          ...node,
          x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 10,
          y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 10,
          vx: 0,
          vy: 0,
          radius: node.type === 'IP' ? 24 : 20
        };
      });

      graphDataRef.current = { nodes: initializedNodes, links };
    } catch (e) {
      console.error("Failed to parse node-link graph details:", e);
    }
  }, [selectedIncident]);

  // Animation Loop for Physics Force-Directed layout
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Resize canvas bounding rect
    const resizeCanvas = () => {
      const rect = canvas.parentNode.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = Math.max(300, rect.height - 40);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const updatePhysicsAndDraw = () => {
      const { nodes, links } = graphDataRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // 1. Apply Forces (Charge / Repulsion, Gravity pull to center, Link tension)
      const charge = -400;
      const gravity = 0.05;
      const linkTension = 0.03;
      const linkLength = 80;

      // Node Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (dist < 200) {
            const force = charge / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            if (n1 !== draggedNodeRef.current) {
              n1.vx += fx;
              n1.vy += fy;
            }
            if (n2 !== draggedNodeRef.current) {
              n2.vx -= fx;
              n2.vy -= fy;
            }
          }
        }
      }

      // Center Gravity Pull
      nodes.forEach(n => {
        if (n === draggedNodeRef.current) return;
        const dx = width / 2 - n.x;
        const dy = height / 2 - n.y;
        n.vx += dx * gravity;
        n.vy += dy * gravity;
      });

      // Link Tension Force
      links.forEach(link => {
        const sNode = nodes.find(n => n.id === link.source);
        const tNode = nodes.find(n => n.id === link.target);
        if (!sNode || !tNode) return;
        
        const dx = tNode.x - sNode.x;
        const dy = tNode.y - sNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - linkLength) * linkTension;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (sNode !== draggedNodeRef.current) {
          sNode.vx += fx;
          sNode.vy += fy;
        }
        if (tNode !== draggedNodeRef.current) {
          tNode.vx -= fx;
          tNode.vy -= fy;
        }
      });

      // 2. Update velocities and positions
      nodes.forEach(n => {
        if (n === draggedNodeRef.current) return;
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= 0.75; // damping
        n.vy *= 0.75;

        // Keep inside bounds
        n.x = Math.max(n.radius, Math.min(width - n.radius, n.x));
        n.y = Math.max(n.radius, Math.min(height - n.radius, n.y));
      });

      // 3. Render Graph Elements
      ctx.clearRect(0, 0, width, height);

      // Draw connection lines
      links.forEach(link => {
        const sNode = nodes.find(n => n.id === link.source);
        const tNode = nodes.find(n => n.id === link.target);
        if (!sNode || !tNode) return;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sNode.x, sNode.y);
        ctx.lineTo(tNode.x, tNode.y);
        ctx.stroke();

        // Draw relationship text
        const midX = (sNode.x + tNode.x) / 2;
        const midY = (sNode.y + tNode.y) / 2;
        ctx.font = '8px monospace';
        ctx.fillStyle = 'var(--text-muted)';
        ctx.textAlign = 'center';
        ctx.fillText(link.relation || '', midX, midY - 4);
      });

      // Draw nodes circles
      nodes.forEach(n => {
        // Node severity glow color
        let glowColor = 'rgba(0, 229, 255, 0.4)';
        let strokeColor = 'var(--cyan-primary)';
        let fillBg = 'rgba(2, 6, 12, 0.9)';

        if (n.type === 'IP') { glowColor = 'rgba(239, 68, 68, 0.4)'; strokeColor = 'var(--red)'; }
        else if (n.type === 'USER') { glowColor = 'rgba(139, 92, 246, 0.4)'; strokeColor = 'var(--purple)'; }
        else if (n.type === 'HOST') { glowColor = 'rgba(249, 115, 22, 0.4)'; strokeColor = 'var(--orange)'; }
        else if (n.type === 'SERVICE') { glowColor = 'rgba(16, 185, 129, 0.4)'; strokeColor = 'var(--green)'; }

        // Glow ring
        ctx.shadowBlur = 12;
        ctx.shadowColor = glowColor;
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 2, 0, 2 * Math.PI);
        ctx.fill();

        // Node center
        ctx.shadowBlur = 0;
        ctx.fillStyle = fillBg;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
        ctx.fill();

        // Node ID label text
        ctx.font = '9px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(n.id.length > 12 ? n.id.slice(0, 10) + '..' : n.id, n.x, n.y + 3);

        // Node Type badge
        ctx.font = '7px monospace';
        ctx.fillStyle = 'var(--text-muted)';
        ctx.fillText(n.type, n.x, n.y - n.radius - 4);
      });

      animationRef.current = requestAnimationFrame(updatePhysicsAndDraw);
    };

    updatePhysicsAndDraw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [selectedIncident]);

  // Handle Drag on Canvas
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { nodes } = graphDataRef.current;
    const clickedNode = nodes.find(n => {
      const dist = Math.sqrt((n.x - x) * (n.x - x) + (n.y - y) * (n.y - y));
      return dist <= n.radius + 10;
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
    }
  };

  const handleMouseMove = (e) => {
    if (!draggedNodeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    draggedNodeRef.current.x = x;
    draggedNodeRef.current.y = y;
  };

  const handleMouseUpOrLeave = () => {
    draggedNodeRef.current = null;
  };

  // Case Actions Submit
  const handleCaseAction = async (payload) => {
    if (!selectedIncident) return;
    try {
      const updated = await apiClient.post(`/correlation/incidents/${selectedIncident.id}/action`, payload);
      setIncidents(incidents.map(i => i.id === selectedIncident.id ? updated : i));
      setSelectedIncident(updated);
      setAssignedAnalyst(updated.assigned_analyst || '');
    } catch (err) {
      console.error("Failed to commit case action:", err);
    }
  };

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    handleCaseAction({
      action: 'add_comment',
      comment: commentText,
      analyst: assignedAnalyst || 'System Analyst'
    });
    setCommentText('');
  };

  const parseJsonData = (jsonStr, fallback = []) => {
    if (!jsonStr) return fallback;
    try {
      return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    } catch (e) {
      return fallback;
    }
  };

  const incidentTimeline = parseJsonData(selectedIncident?.timeline_data);
  const incidentNotes = parseJsonData(selectedIncident?.timeline_data).filter(t => t.title.startsWith("Note by"));

  return (
    <div className="correlation-root">
      {/* Search and filter header */}
      <div className="waf-filter-bar card-cyber">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search correlated IP address, host..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filters-selectors">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="CONTAINED">Contained</option>
            <option value="CLOSED">Closed</option>
          </select>

          <button 
            className={`sync-btn ${isSyncing ? 'syncing' : ''}`}
            onClick={() => fetchIncidents(true)}
            title="Force synchronization"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Main layout split */}
      {incidents.length === 0 ? (
        <div className="empty-correlation-container card-cyber animate-slide-in">
          <div className="empty-correlation-header font-mono text-cyan">
            <GitBranch size={20} />
            <span>Active Threat Correlation Orchestrator Engine</span>
          </div>
          <div className="empty-correlation-content mt-4">
            <div className="left-guide font-mono">
              <h4 className="text-white">Waiting for Telemetry Logs...</h4>
              <p className="text-muted mt-2" style={{ fontSize: '11px', lineHeight: '1.8' }}>
                The Correlation Engine acts as a centralized brain, linking independent intrusion alerts into continuous attack chains.
              </p>
              
              <h5 className="text-cyan mt-4">Ingested Log Streams</h5>
              <ul className="text-muted mt-2" style={{ fontSize: '11px', lineHeight: '1.8' }}>
                <li><strong>Windows Event Logs</strong>: Normalization checks track Event ID 4624 (logon success) and 4625 (logon failure).</li>
                <li><strong>Syslog traces</strong>: Analyzes Unix authorization triggers and privileged commands access logs.</li>
                <li><strong>Decoy sensor feeds</strong>: Integrates telemetry signals from Honeypot ports and Web Lab.</li>
              </ul>

              <button 
                className="btn-trigger-demo-logs mt-4 font-mono" 
                onClick={handleTriggerDemoLogs}
                style={{ borderColor: 'var(--cyan-primary)', color: 'var(--cyan-primary)', background: 'rgba(0, 229, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Terminal size={12} />
                <span>Seed logs &amp; Trigger Correlation</span>
              </button>
            </div>

            <div className="right-guide font-mono">
              <h4 className="text-white">Graph Topology Visualization</h4>
              <p className="text-muted mt-2" style={{ fontSize: '11px', lineHeight: '1.8' }}>
                When correlated logs align within the lookback window, the physics engine links compromised users, scanning hosts, and honeypot sensors into a dynamic node-link graph:
              </p>
              
              <div className="placeholder-topology-diagram mt-4">
                <div className="diagram-node node-ip">Attacker IP</div>
                <div className="diagram-link">PROBES</div>
                <div className="diagram-node node-host">Decoy Host</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="waf-main-grid">
          {/* Incident Alerts List */}
          <div className="waf-panel card-cyber list-panel-correlation">
            <div className="panel-header">
              <h5 className="panel-title font-mono">Normalized Attack Chains &amp; Signals</h5>
            </div>
            <div className="panel-body">
              <div className="waf-table-container">
                <table className="waf-table">
                  <thead>
                    <tr>
                      <th>Incident Chain ID</th>
                      <th>Alert Description</th>
                      <th>Confidence</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc) => {
                      const isSelected = selectedIncident?.id === inc.id;
                      return (
                        <tr 
                          key={inc.id}
                          className={isSelected ? 'active-row' : ''}
                          onClick={() => {
                            setSelectedIncident(inc);
                            setAssignedAnalyst(inc.assigned_analyst || '');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="font-mono text-cyan" style={{ fontWeight: 'bold' }}>ID-{inc.id}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#ffffff' }}>{inc.title}</div>
                            <div className="text-muted text-xxs">{inc.description}</div>
                          </td>
                          <td className="font-mono text-cyan">{(inc.confidence * 100).toFixed(0)}%</td>
                          <td>
                            <span className={`badge badge-${inc.severity.toLowerCase()}`}>
                              {inc.severity}
                            </span>
                          </td>
                          <td>
                            <span className={`status-tag status-${inc.status.toLowerCase()}`}>
                              {inc.status}
                            </span>
                          </td>
                          <td><ChevronRight size={14} className="chevron-row" /></td>
                        </tr>
                      );
                    })}
                    {incidents.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }} className="text-muted font-mono">
                          No correlated threats matches filters. Correlation Engine active.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Dynamic Details & Interactive Graph panel */}
          <div className="waf-panel card-cyber graph-panel">
            {selectedIncident ? (
              <div className="details-content animate-slide-in">
                <div className="panel-header" style={{ borderBottom: 'none' }}>
                  <h5 className="panel-title font-mono" style={{ color: 'var(--red)' }}>ATTACK CORRELATION TOPOLOGY</h5>
                </div>
                
                {/* Topology Graph Canvas */}
                <div className="canvas-wrapper">
                  <canvas 
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                  />
                </div>

                {/* Operations Control Drawer */}
                <div className="correlation-drawer-details">
                  <div className="drawer-stats" style={{ margin: '15px 0' }}>
                    <div className="d-stat">
                      <span className="d-label font-mono">Confidence Level</span>
                      <span className="d-val text-cyan font-mono">{(selectedIncident.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="d-stat">
                      <span className="d-label font-mono">Incident Status</span>
                      <span className="d-val text-red font-mono">{selectedIncident.status}</span>
                    </div>
                  </div>

                  <div className="drawer-section">
                    <h5 className="section-title">Case Actions &amp; Analyst</h5>
                    
                    <div className="analyst-assign-box">
                      <User size={14} className="text-cyan" />
                      <label>Assign Case Owner:</label>
                      <select 
                        value={assignedAnalyst} 
                        onChange={(e) => handleCaseAction({ action: 'assign_analyst', analyst: e.target.value })}
                      >
                        <option value="">Unassigned</option>
                        <option value="Analyst Marcus">Analyst Marcus (Tier 2)</option>
                        <option value="Lead Analyst Alex">Alex Rivera (SOC Lead)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      {['NEW', 'INVESTIGATING', 'CONTAINED', 'CLOSED'].map((st) => (
                        <button
                          key={st}
                          className={`btn-cyber-action ${selectedIncident.status === st ? 'active' : ''}`}
                          style={{
                            flex: 1,
                            fontSize: '9px',
                            padding: '6px',
                            borderWidth: '1px',
                            borderColor: selectedIncident.status === st ? 'var(--cyan-primary)' : 'var(--border-subtle)',
                            backgroundColor: selectedIncident.status === st ? 'rgba(0, 229, 255, 0.1)' : 'rgba(2, 6, 12, 0.45)'
                          }}
                          onClick={() => handleCaseAction({ action: 'update_status', status: st })}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Copilot Link */}
                  <div className="drawer-actions" style={{ marginTop: '15px' }}>
                    <button 
                      className="btn-action btn-analyze-ai"
                      style={{ width: '100%', borderColor: 'rgba(139, 92, 246, 0.4)', color: 'var(--purple)', backgroundColor: 'rgba(139, 92, 246, 0.05)' }}
                      onClick={() => navigate(`/agent?analyze_incident=${selectedIncident.id}`)}
                    >
                      <Cpu size={14} style={{ marginRight: '6px' }} />
                      Explain Chain with AI Copilot
                    </button>
                  </div>

                  {/* Timeline Path */}
                  <div className="drawer-section" style={{ marginTop: '20px' }}>
                    <h5 className="section-title">Attack Progression Timeline</h5>
                    <div className="soc-timeline" style={{ marginTop: '10px' }}>
                      {incidentTimeline.map((item, idx) => (
                        <div className="soc-timeline-item" key={idx}>
                          <div className="soc-timeline-badge critical"></div>
                          <div className="soc-timeline-header">
                            <span className="soc-timeline-time">{new Date(item.time).toLocaleTimeString()}</span>
                            <span className="soc-timeline-state">{item.title}</span>
                          </div>
                          <div className="soc-timeline-desc">{item.details}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes log */}
                  <div className="drawer-section" style={{ marginTop: '20px' }}>
                    <h5 className="section-title">Analyst Activity Logs</h5>
                    <div className="case-notes-list" style={{ marginTop: '10px' }}>
                      {incidentNotes.map((note, index) => (
                        <div className="case-note-item" key={index}>
                          <div className="case-note-header">
                            <span className="case-note-author">{note.title.replace("Note by ", "")}</span>
                            <span>{new Date(note.time).toLocaleTimeString()}</span>
                          </div>
                          <div className="case-note-text">{note.details}</div>
                        </div>
                      ))}
                      {incidentNotes.length === 0 && (
                        <div className="text-muted text-xxs font-mono text-center">No case audit comments recorded.</div>
                      )}
                    </div>

                    <form onSubmit={handleAddComment} className="add-note-form">
                      <textarea 
                        rows="2" 
                        placeholder="Add investigation details comment..." 
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                      />
                      <button type="submit" className="btn-cyber-action" style={{ alignSelf: 'flex-end', padding: '6px 12px' }}>
                        <MessageSquare size={12} />
                        Log Comment
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-drawer">No incident chain selected.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
