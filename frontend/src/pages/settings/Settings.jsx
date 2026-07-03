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
  const [abuseipdbApiKey, setAbuseipdbApiKey] = useState('');
  const [virustotalApiKey, setVirustotalApiKey] = useState('');
  
  // Alert & Notification SOC states
  const [alertSeverityThreshold, setAlertSeverityThreshold] = useState('HIGH');
  const [alertScoreThreshold, setAlertScoreThreshold] = useState(70);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [alertEmailRecipient, setAlertEmailRecipient] = useState('');

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
        if (data.abuseipdb_api_key) setAbuseipdbApiKey(data.abuseipdb_api_key);
        if (data.virustotal_api_key) setVirustotalApiKey(data.virustotal_api_key);
        
        if (data.alert_severity_threshold) setAlertSeverityThreshold(data.alert_severity_threshold);
        if (data.alert_score_threshold) setAlertScoreThreshold(data.alert_score_threshold);
        if (data.slack_webhook_url) setSlackWebhookUrl(data.slack_webhook_url);
        if (data.discord_webhook_url) setDiscordWebhookUrl(data.discord_webhook_url);
        if (data.alert_email_recipient) setAlertEmailRecipient(data.alert_email_recipient);
        
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
        collector_interval: parseInt(collectorInterval),
        abuseipdb_api_key: abuseipdbApiKey,
        virustotal_api_key: virustotalApiKey,
        alert_severity_threshold: alertSeverityThreshold,
        alert_score_threshold: parseFloat(alertScoreThreshold),
        slack_webhook_url: slackWebhookUrl,
        discord_webhook_url: discordWebhookUrl,
        alert_email_recipient: alertEmailRecipient
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

          <div className="form-section mt-4" style={{ marginTop: '24px' }}>
            <h6 className="form-section-title font-mono">Threat Intelligence Integrations</h6>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-field">
                <label>AbuseIPDB API Key:</label>
                <input 
                  type="password" 
                  value={abuseipdbApiKey} 
                  placeholder="Enter AbuseIPDB API key"
                  onChange={(e) => setAbuseipdbApiKey(e.target.value)} 
                />
              </div>
              <div className="form-field">
                <label>VirusTotal API Key (Future Phase):</label>
                <input 
                  type="password" 
                  value={virustotalApiKey} 
                  placeholder="Enter VirusTotal API key (Not active)"
                  onChange={(e) => setVirustotalApiKey(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="form-section mt-4" style={{ marginTop: '24px' }}>
            <h6 className="form-section-title font-mono">SOC Alert Rules &amp; Thresholds</h6>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-field">
                <label>Notification Severity Threshold:</label>
                <select 
                  value={alertSeverityThreshold} 
                  onChange={(e) => setAlertSeverityThreshold(e.target.value)}
                  style={{ width: '100%', background: 'var(--surface-secondary)', border: '1px solid var(--border-primary)', color: 'white', padding: '12px', borderRadius: '6px', outline: 'none' }}
                >
                  <option value="LOW">Low &amp; Above</option>
                  <option value="MEDIUM">Medium &amp; Above</option>
                  <option value="HIGH">High &amp; Above</option>
                  <option value="CRITICAL">Critical Only</option>
                </select>
              </div>
              <div className="form-field">
                <label>Notification Threat Score Threshold:</label>
                <input 
                  type="number" 
                  value={alertScoreThreshold} 
                  min="0"
                  max="100"
                  onChange={(e) => setAlertScoreThreshold(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="form-section mt-4" style={{ marginTop: '24px' }}>
            <h6 className="form-section-title font-mono">Notification Channels (SMTP / Webhooks)</h6>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-field" style={{ gridColumn: 'span 2' }}>
                <label>Slack Webhook URL:</label>
                <input 
                  type="text" 
                  value={slackWebhookUrl} 
                  placeholder="https://hooks.slack.com/services/..."
                  onChange={(e) => setSlackWebhookUrl(e.target.value)} 
                />
              </div>
              <div className="form-field" style={{ gridColumn: 'span 2' }}>
                <label>Discord Webhook URL:</label>
                <input 
                  type="text" 
                  value={discordWebhookUrl} 
                  placeholder="https://discord.com/api/webhooks/..."
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)} 
                />
              </div>
              <div className="form-field" style={{ gridColumn: 'span 2' }}>
                <label>SMTP Alert Recipient Email:</label>
                <input 
                  type="email" 
                  value={alertEmailRecipient} 
                  placeholder="admin-alerts@sentinelai.local"
                  onChange={(e) => setAlertEmailRecipient(e.target.value)} 
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
