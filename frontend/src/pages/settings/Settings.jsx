import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import apiClient from '../../api/client';
import './Settings.css';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Settings state values
  const [appName, setAppName] = useState('SentinelAI');
  const [apiHost, setApiHost] = useState('127.0.0.1');
  const [apiPort, setApiPort] = useState(8000);
  const [ollamaHost, setOllamaHost] = useState('http://127.0.0.1:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.1');
  const [retentionDays, setRetentionDays] = useState(30);
  const [collectorInterval, setCollectorInterval] = useState(5);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get('/settings');
        
        if (data.app_name) setAppName(data.app_name);
        if (data.api_host) setApiHost(data.api_host);
        if (data.api_port) setApiPort(data.api_port);
        if (data.ollama_host) setOllamaHost(data.ollama_host);
        if (data.ollama_model) setOllamaModel(data.ollama_model);
        if (data.retention_days) setRetentionDays(data.retention_days);
        if (data.collector_interval) setCollectorInterval(data.collector_interval);
        
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load system settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSuccess(false);
    setError(null);

    // Simple validation
    if (!apiHost.trim() || !appName.trim()) {
      setError('App Name and API Host are required fields.');
      return;
    }

    try {
      const payload = {
        app_name: appName,
        api_host: apiHost,
        api_port: parseInt(apiPort),
        ollama_host: ollamaHost,
        ollama_model: ollamaModel,
        retention_days: parseInt(retentionDays),
        collector_interval: parseInt(collectorInterval)
      };

      await apiClient.put('/settings', payload);
      setSuccess(true);
      
      // Auto-hide success banner
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message || 'Failed to save system settings');
    }
  };

  if (loading) {
    return <div className="loading-state">Initialising Configuration Console...</div>;
  }

  return (
    <div className="settings-root">
      <div className="settings-card card-cyber">
        <div className="settings-header">
          <Settings className="text-cyan" size={20} />
          <h5 className="section-title">System Settings Console</h5>
        </div>

        {success && (
          <div className="banner success-banner font-mono">
            <CheckCircle size={16} />
            <span>Settings saved successfully. Configuration updated.</span>
          </div>
        )}

        {error && (
          <div className="banner error-banner font-mono">
            <AlertTriangle size={16} />
            <span>Error: {error}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="settings-form">
          <div className="form-grid">
            {/* General Section */}
            <div className="form-section">
              <h6 className="form-section-title font-mono">General Configurations</h6>
              
              <div className="form-field">
                <label>Platform Name:</label>
                <input 
                  type="text" 
                  value={appName} 
                  onChange={(e) => setAppName(e.target.value)} 
                />
              </div>

              <div className="form-field">
                <label>Data Retention (Days):</label>
                <input 
                  type="number" 
                  value={retentionDays} 
                  onChange={(e) => setRetentionDays(e.target.value)} 
                  min="1"
                  max="365"
                />
              </div>

              <div className="form-field">
                <label>Metric Collector Poll (Sec):</label>
                <input 
                  type="number" 
                  value={collectorInterval} 
                  onChange={(e) => setCollectorInterval(e.target.value)} 
                  min="1"
                  max="60"
                />
              </div>
            </div>

            {/* Network Section */}
            <div className="form-section">
              <h6 className="form-section-title font-mono">Network & API Bindings</h6>

              <div className="form-row-network">
                <div className="form-field">
                  <label>API Host:</label>
                  <input 
                    type="text" 
                    value={apiHost} 
                    onChange={(e) => setApiHost(e.target.value)} 
                  />
                </div>
                <div className="form-field">
                  <label>Port:</label>
                  <input 
                    type="number" 
                    value={apiPort} 
                    onChange={(e) => setApiPort(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Ollama Endpoint:</label>
                <input 
                  type="text" 
                  value={ollamaHost} 
                  onChange={(e) => setOllamaHost(e.target.value)} 
                />
              </div>

              <div className="form-field">
                <label>Preferred LLM Model:</label>
                <input 
                  type="text" 
                  value={ollamaModel} 
                  onChange={(e) => setOllamaModel(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <button type="submit" className="save-btn font-mono">
            <Save size={16} />
            Commit Configuration
          </button>
        </form>
      </div>
    </div>
  );
}
