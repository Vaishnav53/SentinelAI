import React, { useState } from 'react';
import { BookOpen, Cpu, Database, ShieldAlert, GitCommit, Network, Radio, Layout, Terminal, Code, Settings, ShieldAlert as AlertIcon, Eye } from 'lucide-react';
import './Blueprint.css';

export default function Blueprint() {
  const [activeTab, setActiveTab] = useState('architecture');

  const tabs = [
    { id: 'architecture', label: 'ARCHITECTURE' },
    { id: 'database_apis', label: 'DB & API CONTRACTS' },
    { id: 'threat_engine', label: 'DETECTION ENGINE' },
    { id: 'roadmap', label: 'ROADMAP TIMELINE' }
  ];

  return (
    <div className="blueprint-root animate-fade-in">
      {/* Top Header Card */}
      <div className="blueprint-header card-cyber">
        <div className="blueprint-header-info">
          <BookOpen className="text-cyan pulse" size={22} />
          <div className="blueprint-header-title">
            <h4 className="title-cyber">SentinelAI Blueprint</h4>
            <p className="text-muted">Interactive design documents, network pipeline topologies, API endpoints, and system roadmap schemas.</p>
          </div>
        </div>
      </div>

      {/* Tabs navigation panel */}
      <div className="blueprint-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab contents */}
      <div className="blueprint-content">
        {activeTab === 'architecture' && (
          <>
            {/* HTML/CSS-based Interactive Pipeline */}
            <div className="card-cyber diagram-container">
              <h3 className="chart-title">SOC Signal Processing Pipeline</h3>
              <div className="pipeline-diagram font-mono">
                <div className="pipeline-node">
                  <div className="node-icon-box">
                    <Terminal size={18} className="text-red" />
                  </div>
                  <span className="node-label">Attacker</span>
                  <span className="node-desc">Port 8088 Probes</span>
                </div>

                <div className="pipeline-connector"></div>

                <div className="pipeline-node">
                  <div className="node-icon-box">
                    <Radio size={18} className="text-cyan" />
                  </div>
                  <span className="node-label">Honeypot</span>
                  <span className="node-desc">Daemon Listener</span>
                </div>

                <div className="pipeline-connector"></div>

                <div className="pipeline-node">
                  <div className="node-icon-box">
                    <AlertIcon size={18} className="text-cyan" />
                  </div>
                  <span className="node-label">Threat Engine</span>
                  <span className="node-desc">Regex Regex Scan</span>
                </div>

                <div className="pipeline-connector"></div>

                <div className="pipeline-node">
                  <div className="node-icon-box">
                    <Database size={18} className="text-cyan" />
                  </div>
                  <span className="node-label">SQLite</span>
                  <span className="node-desc">Local Storage</span>
                </div>

                <div className="pipeline-connector"></div>

                <div className="pipeline-node">
                  <div className="node-icon-box">
                    <Cpu size={18} className="text-cyan" />
                  </div>
                  <span className="node-label">FastAPI Core</span>
                  <span className="node-desc">Router/Controllers</span>
                </div>

                <div className="pipeline-connector purple-flow"></div>

                <div className="pipeline-node active">
                  <div className="node-icon-box">
                    <Layout size={18} className="text-purple" />
                  </div>
                  <span className="node-label">React SOC</span>
                  <span className="node-desc">Active Dashboard</span>
                </div>
              </div>
            </div>

            {/* Neural Net Pulse Core area */}
            <div className="blueprint-grid-2">
              <div className="card-cyber module-card">
                <div className="module-title-box">
                  <Cpu className="text-purple" size={16} />
                  <h3>Integrated Neural Core</h3>
                </div>
                <div className="ai-core-container">
                  <div className="ai-core-pulse">
                    <span className="ai-core-text font-mono">OLLAMA</span>
                  </div>
                </div>
                <p className="module-content font-mono text-xs">
                  Zero-Trust local analytics utilizing a sandboxed Ollama endpoint. Leverages local context compilation to identify intrusion goals, query schemas, and recommend firewall blocks.
                </p>
              </div>

              <div className="card-cyber module-card">
                <div className="module-title-box">
                  <Network className="text-cyan" size={16} />
                  <h3>Platform Scope & Integrations</h3>
                </div>
                <p className="module-content">
                  SentinelAI acts as a cyber defense operations platform:
                </p>
                <div className="module-content">
                  <span className="tech-tag">MITRE ATT&CK Mapping</span>
                  <span className="tech-tag">Threat Intel</span>
                  <span className="tech-tag">Sigma/YARA Logs</span>
                  <span className="tech-tag">Windows Event Log scraper</span>
                  <span className="tech-tag">Live Websockets Feed</span>
                  <span className="tech-tag">Role-Based Access Control</span>
                  <span className="tech-tag">Hardware Sensor grids</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'database_apis' && (
          <div className="blueprint-grid-2">
            <div className="card-cyber module-card">
              <div className="module-title-box">
                <Database className="text-cyan" size={16} />
                <h3>SQLite Schema Structure</h3>
              </div>
              
              <div className="schema-block font-mono">
                <div className="schema-title">attacks (AttackEvent)</div>
                <div className="schema-fields">
                  <div className="schema-field-row"><span className="field-name">id</span><span className="field-type">INTEGER (PK)</span></div>
                  <div className="schema-field-row"><span className="field-name">external_id</span><span className="field-type">VARCHAR(50) (Unique)</span></div>
                  <div className="schema-field-row"><span className="field-name">attack_type</span><span className="field-type">VARCHAR(100)</span></div>
                  <div className="schema-field-row"><span className="field-name">severity</span><span className="field-type">VARCHAR(20)</span></div>
                  <div className="schema-field-row"><span className="field-name">status</span><span className="field-type">VARCHAR(20)</span></div>
                  <div className="schema-field-row"><span className="field-name">source_ip</span><span className="field-type">VARCHAR(45)</span></div>
                  <div className="schema-field-row"><span className="field-name">destination_port</span><span className="field-type">INTEGER</span></div>
                  <div className="schema-field-row"><span className="field-name">payload</span><span className="field-type">TEXT</span></div>
                  <div className="schema-field-row"><span className="field-name">threat_score</span><span className="field-type">FLOAT</span></div>
                  <div className="schema-field-row"><span className="field-name">confidence</span><span className="field-type">FLOAT</span></div>
                  <div className="schema-field-row"><span className="field-name">raw_metadata</span><span className="field-type">TEXT (JSON)</span></div>
                </div>
              </div>

              <div className="schema-block font-mono">
                <div className="schema-title">sensors (HoneypotSensor)</div>
                <div className="schema-fields">
                  <div className="schema-field-row"><span className="field-name">id</span><span className="field-type">INTEGER (PK)</span></div>
                  <div className="schema-field-row"><span className="field-name">name</span><span className="field-type">VARCHAR(100)</span></div>
                  <div className="schema-field-row"><span className="field-name">type</span><span className="field-type">VARCHAR(50)</span></div>
                  <div className="schema-field-row"><span className="field-name">state</span><span className="field-type">VARCHAR(20)</span></div>
                  <div className="schema-field-row"><span className="field-name">last_heartbeat</span><span className="field-type">DATETIME</span></div>
                </div>
              </div>
            </div>

            <div className="card-cyber module-card">
              <div className="module-title-box">
                <Code className="text-purple" size={16} />
                <h3>FastAPI Controller APIs</h3>
              </div>
              <div className="schema-block font-mono text-xs">
                <div className="schema-title">Honeypot Control Group</div>
                <div className="schema-field-row"><span className="field-name">POST /api/honeypot/start</span><span className="field-type">Activates Thread Server</span></div>
                <div className="schema-field-row"><span className="field-name">POST /api/honeypot/stop</span><span className="field-type">Shuts down daemon port</span></div>
                <div className="schema-field-row"><span className="field-name">GET /api/honeypot/status</span><span className="field-type">Retrieves Port binding</span></div>
              </div>

              <div className="schema-block font-mono text-xs">
                <div className="schema-title">Alert Feeds Group</div>
                <div className="schema-field-row"><span className="field-name">GET /api/attacks</span><span className="field-type">Returns list with query filters</span></div>
                <div className="schema-field-row"><span className="field-name">POST /api/attacks/{"{id}"}/status</span><span className="field-type">Update to RESOLVED/ASSIGNED</span></div>
                <div className="schema-field-row"><span className="field-name">GET /api/attacks/stats</span><span className="field-type">Aggregated distribution totals</span></div>
              </div>

              <div className="schema-block font-mono text-xs">
                <div className="schema-title">Cognitive Assistant Group</div>
                <div className="schema-field-row"><span className="field-name">POST /api/agent/chat</span><span className="field-type">Submit message to Ollama llama3.1</span></div>
                <div className="schema-field-row"><span className="field-name">GET /api/agent/status</span><span className="field-type">Checks model availability lists</span></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'threat_engine' && (
          <div className="blueprint-grid-2">
            <div className="card-cyber module-card">
              <div className="module-title-box">
                <Eye className="text-cyan" size={16} />
                <h3>Rule-Based Detection Signatures</h3>
              </div>
              <p className="module-content font-mono text-xs">
                The threat detection engine validates HTTP payload elements using distinct regex patterns:
              </p>
              
              <div className="schema-block font-mono text-xs">
                <div className="schema-title">SQL Injection (SQLi)</div>
                <p className="text-muted">Matches statements like OR/UNION/SELECT database queries:</p>
                <div className="field-name">Pattern: (?i)(\b(select|union|insert|update|delete|drop|alter)\b|'|--|#)</div>
              </div>

              <div className="schema-block font-mono text-xs">
                <div className="schema-title">Cross-Site Scripting (XSS)</div>
                <p className="text-muted">Matches script embeds, tags, and standard injection vectors:</p>
                <div className="field-name">Pattern: (?i)(&lt;script|script&gt;|onerror|onload|javascript:)</div>
              </div>

              <div className="schema-block font-mono text-xs">
                <div className="schema-title">Directory Traversal</div>
                <p className="text-muted">Matches attempts to read system file paths:</p>
                <div className="field-name">Pattern: (?i)(\.\./|\.\.\\|/etc/passwd|/windows/win\.ini)</div>
              </div>
            </div>

            <div className="card-cyber module-card">
              <div className="module-title-box">
                <Settings className="text-purple" size={16} />
                <h3>Mitigation & Recommendations System</h3>
              </div>
              <p className="module-content">
                On threat classification, the engine logs custom incident responses directly to SQLite raw metadata:
              </p>
              <div className="schema-block font-mono text-xs">
                <div className="schema-title">T1190: Exploit Public-Facing Application</div>
                <p className="text-muted"><strong>Recommendation:</strong> Use parameterization queries, enforce strict input length caps, and restrict SQL user permissions.</p>
              </div>
              <div className="schema-block font-mono text-xs">
                <div className="schema-title">T1083: File and Directory Discovery</div>
                <p className="text-muted"><strong>Recommendation:</strong> Sanitize path routes, restrict read rights on config targets, and reject dots/slashes in paths.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'roadmap' && (
          <div className="card-cyber module-card">
            <div className="module-title-box">
              <GitCommit className="text-cyan" size={16} />
              <h3>Development Roadmap</h3>
            </div>
            
            <div className="roadmap-timeline">
              <div className="timeline-node-item completed">
                <span className="timeline-dot"></span>
                <div className="timeline-node-header">
                  <span className="timeline-phase-title font-mono text-green">PHASE 0: Workspace Baseline Setup</span>
                  <span className="badge badge-low">Completed</span>
                </div>
                <p className="timeline-desc">Initialized directory, python virtual environments, Vite skeleton templates, and validated local Git parameters.</p>
              </div>

              <div className="timeline-node-item completed">
                <span className="timeline-dot"></span>
                <div className="timeline-node-header">
                  <span className="timeline-phase-title font-mono text-green">PHASE 1: Backend System Foundations</span>
                  <span className="badge badge-low">Completed</span>
                </div>
                <p className="timeline-desc">Implemented settings configurations loader, database ORM entities engine, error routers, and pytest test suite integrations.</p>
              </div>

              <div className="timeline-node-item completed">
                <span className="timeline-dot"></span>
                <div className="timeline-node-header">
                  <span className="timeline-phase-title font-mono text-green">PHASE 2: Full-Stack Integration Shell</span>
                  <span className="badge badge-low">Completed</span>
                </div>
                <p className="timeline-desc">Coded mock telemetry endpoints, dashboard summary charts, and configured client fetch wrappers.</p>
              </div>

              <div className="timeline-node-item completed">
                <span className="timeline-dot"></span>
                <div className="timeline-node-header">
                  <span className="timeline-phase-title font-mono text-green">PHASE 3: HTTP Honeypot & Detection</span>
                  <span className="badge badge-low">Completed</span>
                </div>
                <p className="timeline-desc">Constructed daemon HTTP listener on port 8088. Implemented regex patterns matcher classifying 9 vectors and writing raw metadata.</p>
              </div>

              <div className="timeline-node-item completed">
                <span className="timeline-dot"></span>
                <div className="timeline-node-header">
                  <span className="timeline-phase-title font-mono text-green">PHASE 4A: UI Polish & Skeletons</span>
                  <span className="badge badge-low">Completed</span>
                </div>
                <p className="timeline-desc">Polished global colors, added animated loading skeletons, added header live clock card, and CPU/RAM usage meters.</p>
              </div>

              <div className="timeline-node-item completed">
                <span className="timeline-dot"></span>
                <div className="timeline-node-header">
                  <span className="timeline-phase-title font-mono text-green">PHASE 4B: Interactive Blueprint Console</span>
                  <span className="badge badge-low">Active</span>
                </div>
                <p className="timeline-desc">Designed an interactive dashboard explaining network flows, data schemas, regex rules, and completed timeline charts.</p>
              </div>

              <div className="timeline-node-item upcoming">
                <span className="timeline-dot"></span>
                <div className="timeline-node-header">
                  <span className="timeline-phase-title font-mono text-purple">PHASE 4C: AI Agent Ingestion</span>
                  <span className="badge badge-high">Upcoming</span>
                </div>
                <p className="timeline-desc">Connect chat input to local Ollama llama3.1 backend model, mapping ingested threat alerts dynamically.</p>
              </div>

              <div className="timeline-node-item upcoming">
                <span className="timeline-dot"></span>
                <div className="timeline-node-header">
                  <span className="timeline-phase-title font-mono text-purple">PHASE 5: CSV/PDF Reports Compiler</span>
                  <span className="badge badge-high">Upcoming</span>
                </div>
                <p className="timeline-desc">Implement backend log export scripts and UI actions allowing operators to download attack timelines.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
