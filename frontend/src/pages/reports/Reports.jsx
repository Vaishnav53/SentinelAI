import React, { useState, useEffect } from 'react';
import { FileText, Download, Play, AlertTriangle } from 'lucide-react';
import apiClient from '../../api/client';
import './Reports.css';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('PDF');
  const [generating, setGenerating] = useState(false);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/reports/jobs');
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const newJob = await apiClient.post('/reports/jobs', {
        format: selectedFormat,
        filters: {}
      });
      setJobs([newJob, ...jobs]);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="reports-root">
      <div className="reports-grid">
        {/* Generate Report Card */}
        <div className="generate-card card-cyber">
          <h5 className="section-title"><Play size={14} /> Generate Compliance Report</h5>
          <div className="generate-form">
            <div className="form-row">
              <label>Report Format:</label>
              <select value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)}>
                <option value="PDF">PDF Document (.pdf)</option>
                <option value="CSV">CSV Spreadsheet (.csv)</option>
                <option value="JSON">JSON Raw Telemetry (.json)</option>
              </select>
            </div>
            
            <div className="form-row">
              <label>Include Scope:</label>
              <div className="checkbox-group font-mono">
                <label><input type="checkbox" defaultChecked /> Ingested Attacks</label>
                <label><input type="checkbox" defaultChecked /> Sensor Statuses</label>
                <label><input type="checkbox" defaultChecked /> AI Advisories</label>
              </div>
            </div>

            <button 
              className="generate-btn font-mono" 
              onClick={handleGenerateReport}
              disabled={generating}
            >
              {generating ? 'Compiling Report...' : 'Compile Incident Summary'}
            </button>
          </div>
        </div>

        {/* Generated Reports List */}
        <div className="history-card card-cyber">
          <h5 className="section-title"><FileText size={14} /> Available Report Artifacts</h5>
          {loading ? (
            <div className="loading-jobs">Loading report index...</div>
          ) : (
            <div className="jobs-list">
              {jobs.map((job) => (
                <div key={job.id} className="job-item">
                  <div className="job-meta">
                    <FileText className="text-cyan" size={18} />
                    <div className="job-title-box">
                      <span className="job-name">{job.job_type} Report - Job #{job.id}</span>
                      <span className="job-date font-mono">Created: {new Date(job.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="job-actions">
                    <span className="badge badge-online">Completed</span>
                    <button className="download-btn" title="Download Artifact">
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {jobs.length === 0 && (
                <div className="empty-jobs">No report summaries compiled yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
