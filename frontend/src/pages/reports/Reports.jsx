import React, { useState, useEffect } from 'react';
import { FileText, Download, Play, Trash2, ShieldAlert, Cpu, FileSpreadsheet, CheckCircle, Clock } from 'lucide-react';
import apiClient from '../../api/client';
import './Reports.css';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  
  // Selection state
  const [reportType, setReportType] = useState('Threat Incident');
  const [targetId, setTargetId] = useState('');
  const [targets, setTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  
  // Summary & Preview State
  const [generating, setGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [reportReady, setReportReady] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/reports/jobs');
      setJobs(data);
    } catch (e) {
      console.error("Failed to fetch jobs:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTargets = async (type) => {
    try {
      setTargetsLoading(true);
      setTargetId('');
      const data = await apiClient.get(`/reports/options?type=${encodeURIComponent(type)}`);
      setTargets(data);
      if (data.length > 0) {
        setTargetId(data[0].value);
      }
    } catch (e) {
      console.error("Failed to fetch targets options:", e);
    } finally {
      setTargetsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchTargets(reportType);
  }, []);

  const handleTypeChange = (newType) => {
    setReportType(newType);
    fetchTargets(newType);
    setReportReady(false);
    setAiSummary('');
  };

  const handleGenerateAISummary = async () => {
    if (!targetId) return;
    try {
      setGenerating(true);
      setReportReady(false);
      setAiSummary('');
      
      const res = await apiClient.post('/reports/generate-ai-summary', {
        type: reportType,
        target_id: targetId
      });
      
      setAiSummary(res.markdown);
      setReportReady(true);
      setCurrentJobId(res.id);
      
      // Refresh historical job index
      fetchJobs();
    } catch (e) {
      console.error("Failed to compile AI summary report:", e);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to permanently delete this report artifact?")) return;
    try {
      await apiClient.delete(`/reports/jobs/${jobId}`);
      setJobs(jobs.filter(j => j.id !== jobId));
      if (currentJobId === jobId) {
        setReportReady(false);
        setAiSummary('');
        setCurrentJobId(null);
      }
    } catch (e) {
      console.error("Failed to delete report job:", e);
    }
  };

  const handleSelectHistoricalJob = async (job) => {
    try {
      setGenerating(true);
      setReportReady(false);
      
      // Fetch report markdown directly using the download endpoint
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/reports/download/${job.id}`;
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        setAiSummary(text);
        setReportReady(true);
        setCurrentJobId(job.id);
        
        // Try to reconstruct target selection if filters match
        if (job.filters) {
          try {
            const parsed = JSON.parse(job.filters);
            if (parsed.type) setReportType(parsed.type);
            if (parsed.target_id) setTargetId(parsed.target_id);
          } catch(err) {}
        }
      }
    } catch (err) {
      console.error("Failed to read report details:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!aiSummary) return;
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    
    // Simple markdown parsing to HTML
    const formattedHtml = aiSummary
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/### (.*?)(<br>)/g, '<h3>$1</h3>')
      .replace(/## (.*?)(<br>)/g, '<h2>$1</h2>')
      .replace(/# (.*?)(<br>)/g, '<h1>$1</h1>');

    printWindow.document.write(`
      <html>
        <head>
          <title>Compliance Security Audit Report - ${targetId}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              padding: 50px;
              line-height: 1.6;
              background-color: #ffffff;
            }
            h1 { border-bottom: 2px solid #111827; padding-bottom: 10px; font-size: 24px; color: #111827; margin-top: 0; }
            h2 { color: #1f2937; margin-top: 35px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; font-size: 18px; }
            h3 { color: #374151; margin-top: 25px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
            p { margin: 12px 0; font-size: 13px; color: #374151; }
            strong { color: #111827; }
            .footer { margin-top: 60px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div>${formattedHtml}</div>
          <div class="footer">SentinelAI Compliance Center • Confidential SOC Document</div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportCSV = async () => {
    if (!targetId) return;
    try {
      const url = `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/reports/export-csv?type=${encodeURIComponent(reportType)}&id=${encodeURIComponent(targetId)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to download CSV");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `export_${reportType.replace(/\s+/g, '_')}_${targetId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download CSV:", err);
    }
  };

  // Internal Markdown rendering helper
  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="md-h1 text-cyan">{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="md-h2 text-cyan">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="md-h3 text-white font-mono">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return <li key={idx} className="md-li text-muted font-mono">{line.substring(2)}</li>;
      }
      if (line.trim() === '---') {
        return <hr key={idx} className="md-hr" />;
      }
      
      // Inline code blocks render
      let elements = [line];
      if (line.includes('`')) {
        const parts = line.split('`');
        elements = parts.map((part, i) => i % 2 === 1 ? <code key={i} className="md-code bg-surface font-mono text-xxs">{part}</code> : part);
      }
      
      // Bold text render
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={idx} className="md-p font-mono">
            {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part)}
          </p>
        );
      }
      return <p key={idx} className="md-p font-mono">{elements}</p>;
    });
  };

  return (
    <div className="reports-root">
      <div className="reports-grid">
        {/* Left Column Controls */}
        <div className="reports-sidebar-left">
          
          {/* Generate Panel */}
          <div className="generate-card card-cyber">
            <h5 className="section-title text-cyan"><Play size={14} /> AI Compliance Report Compiler</h5>
            <div className="generate-form">
              <div className="form-row">
                <label>Report Type Target</label>
                <select value={reportType} onChange={(e) => handleTypeChange(e.target.value)}>
                  <option value="Threat Incident">Threat Incident (SOC Case)</option>
                  <option value="Honeypot Request">Honeypot Request (Aetheris Traffic)</option>
                  <option value="Sandbox Upload">Sandbox Upload (Decoy Scan)</option>
                  <option value="Attacker Dossier">Attacker Dossier (Profile IP)</option>
                </select>
              </div>
              
              <div className="form-row">
                <label>Target Object Selection</label>
                {targetsLoading ? (
                  <div className="targets-fetching font-mono">Loading options...</div>
                ) : (
                  <select 
                    value={targetId} 
                    onChange={(e) => {
                      setTargetId(e.target.value);
                      setReportReady(false);
                      setAiSummary('');
                    }}
                    disabled={targets.length === 0}
                  >
                    {targets.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                    {targets.length === 0 && (
                      <option value="">No items available in database</option>
                    )}
                  </select>
                )}
              </div>

              <button 
                className="generate-btn font-mono" 
                onClick={handleGenerateAISummary}
                disabled={generating || !targetId}
              >
                {generating ? 'Synthesizing report...' : 'Compile AI Summary'}
              </button>
            </div>
          </div>

          {/* Historical Listing */}
          <div className="history-card card-cyber mt-4">
            <h5 className="section-title text-cyan"><FileText size={14} /> Compliance Report Logs</h5>
            {loading ? (
              <div className="loading-jobs">Synchronizing logs...</div>
            ) : (
              <div className="jobs-list">
                {jobs.map((job) => (
                  <div key={job.id} className="job-item" onClick={() => handleSelectHistoricalJob(job)} style={{ cursor: 'pointer' }}>
                    <div className="job-meta">
                      <FileText className="text-cyan animate-pulse" size={16} />
                      <div className="job-title-box">
                        <span className="job-name">{job.job_type} Compliance Audit</span>
                        <span className="job-date font-mono">#{job.id} • {new Date(job.created_at).toLocaleDateString()} {new Date(job.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                    <div className="job-actions">
                      <button 
                        className="download-btn btn-trash-action" 
                        title="Delete report log"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                      >
                        <Trash2 size={12} className="text-red" />
                      </button>
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && (
                  <div className="empty-jobs">No report logs generated.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column Preview */}
        <div className="reports-main-preview waf-panel card-cyber">
          {generating ? (
            <div className="preview-loading-state font-mono">
              <Cpu size={24} className="text-cyan animate-spin mb-3" />
              <span>SentinelAI Auditor is analyzing threat telemetry...</span>
              <span className="text-muted text-xxs mt-1">Invoking local LLM model to synthesize security compliance checks...</span>
            </div>
          ) : reportReady ? (
            <div className="preview-content-box animate-slide-in">
              
              {/* Header Action Controls */}
              <div className="preview-header-bar">
                <div className="badge-row">
                  <CheckCircle size={14} className="text-green" />
                  <span className="badge-ready font-mono text-green">Report ready</span>
                </div>
                
                <div className="export-actions">
                  <button className="btn-export btn-pdf" onClick={handleExportPDF}>
                    <Download size={12} style={{ marginRight: '6px' }} />
                    Export PDF
                  </button>
                  <button className="btn-export btn-csv" onClick={handleExportCSV}>
                    <FileSpreadsheet size={12} style={{ marginRight: '6px' }} />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Rendered Markdown Preview Area */}
              <div className="report-markdown-container">
                {renderMarkdown(aiSummary)}
              </div>
            </div>
          ) : (
            <div className="preview-empty-state font-mono">
              <ShieldAlert size={32} className="text-muted mb-3" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Compliance Audit Preview</span>
              <p className="text-muted text-center mt-2" style={{ maxWidth: '400px', fontSize: '11px' }}>
                Select a report type target and dynamically choose a database entity in the panel on the left, then click <strong>Compile AI Summary</strong> to run an automated audit synthesis.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
