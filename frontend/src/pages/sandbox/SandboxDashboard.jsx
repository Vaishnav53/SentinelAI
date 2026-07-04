import React, { useState, useEffect } from 'react';
import { Layers, ShieldAlert, Cpu, HardDrive, Shield, Search, Copy, Check, Trash2, ShieldX, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import './SandboxDashboard.css';

export default function SandboxDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Status Metrics
  const [statusMetrics, setStatusMetrics] = useState({
    total_scanned: 0,
    malicious_count: 0,
    suspicious_count: 0,
    clean_count: 0,
    storage_bytes: 0
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [filesData, metricsData] = await Promise.all([
        apiClient.get('/sandbox/files'),
        apiClient.get('/sandbox/status')
      ]);
      setFiles(filesData);
      setStatusMetrics(metricsData);
      
      if (filesData.length > 0) {
        if (!selectedFile) {
          setSelectedFile(filesData[0]);
        } else {
          const current = filesData.find(f => f.id === selectedFile.id);
          setSelectedFile(current || filesData[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sandbox details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Copy hash helper
  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Contain file action
  const handleContain = async (fileId) => {
    if (!window.confirm("Are you sure you want to quarantine this file and block the uploader IP?")) return;
    try {
      await apiClient.post(`/sandbox/files/${fileId}/contain`);
      await fetchData();
    } catch (err) {
      console.error("Containment action failed:", err);
    }
  };

  // Helper to format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filtered files
  const filteredFiles = files.filter(f => {
    const matchesSearch = f.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.ip_address.includes(searchQuery) ||
                          f.sha256.includes(searchQuery);
    const matchesStatus = statusFilter === '' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="sandbox-root">
      {/* Top metrics widgets */}
      <div className="metrics-grid">
        <div className="metric-card card-cyber">
          <div className="metric-icon bg-cyan">
            <Layers size={20} className="text-cyan" />
          </div>
          <div className="metric-details">
            <span className="metric-label font-mono">FILES ANALYZED</span>
            <span className="metric-value font-mono">{statusMetrics.total_scanned}</span>
          </div>
        </div>

        <div className="metric-card card-cyber">
          <div className="metric-icon bg-red">
            <ShieldAlert size={20} className="text-red" />
          </div>
          <div className="metric-details">
            <span className="metric-label font-mono">MALWARE DETECTED</span>
            <span className="metric-value font-mono text-red">{statusMetrics.malicious_count}</span>
          </div>
        </div>

        <div className="metric-card card-cyber">
          <div className="metric-icon bg-orange">
            <ShieldAlert size={20} className="text-orange" />
          </div>
          <div className="metric-details">
            <span className="metric-label font-mono">SUSPICIOUS INJECTS</span>
            <span className="metric-value font-mono text-orange">{statusMetrics.suspicious_count}</span>
          </div>
        </div>

        <div className="metric-card card-cyber">
          <div className="metric-icon bg-green">
            <HardDrive size={20} className="text-green" />
          </div>
          <div className="metric-details">
            <span className="metric-label font-mono">SANDBOX STORAGE</span>
            <span className="metric-value font-mono text-green">{formatBytes(statusMetrics.storage_bytes)}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="waf-filter-bar card-cyber">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search filename, MD5, SHA-256, source IP..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filters-selectors">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Threat States</option>
            <option value="CLEAN">Clean Only</option>
            <option value="SUSPICIOUS">Suspicious Only</option>
            <option value="MALICIOUS">Malicious Only</option>
            <option value="QUARANTINED">Quarantined Only</option>
          </select>
        </div>
      </div>

      {/* Main split grid */}
      {files.length === 0 ? (
        <div className="empty-sandbox-container card-cyber animate-slide-in">
          <div className="empty-sandbox-header font-mono text-cyan">
            <Layers size={20} />
            <span>Decoy Sandbox Analysis Console</span>
          </div>
          <div className="empty-sandbox-content mt-4">
            <div className="sandbox-guide-left font-mono">
              <h4 className="text-white">Waiting for Decoy File Uploads...</h4>
              <p className="text-muted mt-2" style={{ fontSize: '11px', lineHeight: '1.8' }}>
                The Sandbox analyzer partition captures file payloads uploaded directly into our simulated decoy networks. It processes uploaded assets in an isolated container away from real filesystems.
              </p>
              
              <h5 className="text-cyan mt-4 font-semibold">How to Trigger an Ingest Action:</h5>
              <ul className="text-muted mt-2" style={{ fontSize: '11px', lineHeight: '1.8' }}>
                <li>Open the Aetheris Honeypot Portal (available on port <code className="text-cyan">8088</code>).</li>
                <li>Log in using standard user handles (e.g. <code className="text-cyan">user1@123</code> or <code className="text-cyan">user2@123</code>).</li>
                <li>Go to the <strong>Asset Repository</strong> and upload corporate logs, avatar designs, or script packages.</li>
                <li>Upload script extensions (e.g. <code className="text-cyan">.php</code>, <code className="text-cyan">.py</code>, <code className="text-cyan">.exe</code>, <code className="text-cyan">.sh</code>) to trigger immediate malware scans.</li>
              </ul>
            </div>

            <div className="sandbox-guide-right font-mono">
              <h4 className="text-white">Analysis Pipeline Sequence</h4>
              <p className="text-muted mt-2" style={{ fontSize: '11px', lineHeight: '1.8' }}>
                Once uploaded, files flow through the following automatic security scanners pipeline:
              </p>
              
              <div className="sandbox-preview-box">
                <div className="sandbox-steps-list">
                  <div className="sandbox-step-row">
                    <div className="step-badge">1</div>
                    <span className="text-secondary">Save files inside the isolated decoy sandbox directory</span>
                  </div>
                  <div className="sandbox-step-row">
                    <div className="step-badge">2</div>
                    <span className="text-secondary">Calculate md5, sha-1, and sha-256 hashes checks</span>
                  </div>
                  <div className="sandbox-step-row">
                    <div className="step-badge">3</div>
                    <span className="text-secondary">Consult VirusTotal database reputation lookups</span>
                  </div>
                  <div className="sandbox-step-row">
                    <div className="step-badge">4</div>
                    <span className="text-secondary">Flag malware description &amp; recommend blocks playbooks</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="waf-main-grid">
          {/* Uploads history */}
          <div className="waf-panel card-cyber list-panel-correlation" style={{ flex: 3.2 }}>
            <div className="panel-header">
              <h5 className="panel-title font-mono">Decoy Sandboxed Telemetry Logs</h5>
            </div>
            <div className="panel-body">
              <div className="waf-table-container">
                <table className="waf-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Size</th>
                      <th>Source IP Address</th>
                      <th>Threat Score</th>
                      <th>Security Assessment</th>
                      <th>Timestamp</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((f) => {
                      const isSelected = selectedFile?.id === f.id;
                      return (
                        <tr 
                          key={f.id}
                          className={isSelected ? 'active-row' : ''}
                          onClick={() => setSelectedFile(f)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="font-mono text-cyan" style={{ fontWeight: 'bold' }}>{f.filename}</td>
                          <td className="font-mono">{formatBytes(f.size_bytes)}</td>
                          <td className="font-mono">{f.ip_address}</td>
                          <td className="font-mono" style={{ color: f.threat_score >= 0.8 ? 'var(--red)' : f.threat_score >= 0.4 ? 'var(--orange)' : 'var(--green)' }}>
                            {(f.threat_score * 10.0).toFixed(1)}/10.0
                          </td>
                          <td>
                            <span className={`badge badge-${f.status.toLowerCase()}`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="font-mono text-muted text-xxs">{new Date(f.created_at).toLocaleString()}</td>
                          <td><ChevronRight size={14} className="chevron-row" /></td>
                        </tr>
                      );
                    })}
                    {filteredFiles.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }} className="text-muted font-mono">
                          No sandbox logs recorded. Scan engine ready.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed File Inspector */}
          <div className="waf-panel card-cyber graph-panel" style={{ flex: 1.8 }}>
            {selectedFile ? (
              <div className="correlation-drawer-details animate-slide-in" style={{ padding: '20px 0' }}>
                <div className="panel-header" style={{ borderBottom: 'none', padding: '0 20px' }}>
                  <h5 className="panel-title font-mono" style={{ color: 'var(--red)' }}>MALWARE INTEGRITY EXAMINER</h5>
                </div>

                {/* Integrity overview stats */}
                <div className="drawer-stats" style={{ margin: '15px 20px' }}>
                  <div className="d-stat">
                    <span className="d-label font-mono">Score Assessment</span>
                    <span className="d-val font-mono" style={{ color: selectedFile.threat_score >= 0.8 ? 'var(--red)' : selectedFile.threat_score >= 0.4 ? 'var(--orange)' : 'var(--green)' }}>
                      {(selectedFile.threat_score * 10.0).toFixed(1)}/10.0
                    </span>
                  </div>
                  <div className="d-stat">
                    <span className="d-label font-mono">Reputation Matches</span>
                    <span className="d-val font-mono text-cyan" style={{ fontSize: '9px' }}>{selectedFile.vt_reputation || '0/72 Clean'}</span>
                  </div>
                </div>

                {/* Cryptographic Hashes copy box */}
                <div className="drawer-section" style={{ margin: '0 20px' }}>
                  <h5 className="section-title">Cryptographic Signatures</h5>
                  
                  <div className="hash-copy-field">
                    <span className="hash-label font-mono">SHA-256</span>
                    <input type="text" readOnly value={selectedFile.sha256} className="font-mono" />
                    <button onClick={() => handleCopy(selectedFile.sha256, 'sha256')}>
                      {copiedField === 'sha256' ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                    </button>
                  </div>

                  <div className="hash-copy-field" style={{ marginTop: '8px' }}>
                    <span className="hash-label font-mono">MD5</span>
                    <input type="text" readOnly value={selectedFile.md5} className="font-mono" />
                    <button onClick={() => handleCopy(selectedFile.md5, 'md5')}>
                      {copiedField === 'md5' ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                    </button>
                  </div>

                  <div className="hash-copy-field" style={{ marginTop: '8px' }}>
                    <span className="hash-label font-mono">SHA-1</span>
                    <input type="text" readOnly value={selectedFile.sha1} className="font-mono" />
                    <button onClick={() => handleCopy(selectedFile.sha1, 'sha1')}>
                      {copiedField === 'sha1' ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                {/* Danger Heuristics flagged */}
                <div className="drawer-section" style={{ margin: '20px 20px 0 20px' }}>
                  <h5 className="section-title">Flagged Scan Details</h5>
                  <div className="scan-reasons-reputation" style={{ marginTop: '10px' }}>
                    <div className="reason-item">
                      <span className="font-mono label">File Status:</span>
                      <span className={`badge badge-${selectedFile.status.toLowerCase()}`}>{selectedFile.status}</span>
                    </div>
                    <div className="reason-item" style={{ marginTop: '8px' }}>
                      <span className="font-mono label">Threat description:</span>
                      <span className="value">{selectedFile.malware_description || 'No dangerous patterns flagged.'}</span>
                    </div>
                    <div className="reason-item" style={{ marginTop: '8px' }}>
                      <span className="font-mono label">Sandbox Path:</span>
                      <span className="value font-mono" style={{ fontSize: '8px', wordBreak: 'break-all' }}>{selectedFile.sandbox_path}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="drawer-section" style={{ margin: '25px 20px 0 20px' }}>
                  <button 
                    className="btn-action btn-analyze-ai"
                    style={{ width: '100%', borderColor: 'rgba(139, 92, 246, 0.4)', color: 'var(--purple)', backgroundColor: 'rgba(139, 92, 246, 0.05)', marginBottom: '10px' }}
                    onClick={() => navigate(`/agent?analyze_sandbox=${selectedFile.id}`)}
                  >
                    <Cpu size={14} style={{ marginRight: '6px' }} />
                    Analyze File Payload with AI
                  </button>

                  {selectedFile.status !== 'QUARANTINED' && (
                    <button 
                      className="btn-action btn-quarantine"
                      style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--red)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                      onClick={() => handleContain(selectedFile.id)}
                    >
                      <ShieldX size={14} style={{ marginRight: '6px' }} />
                      Quarantine File &amp; Block Attacker
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-drawer">No sandbox file selected.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
