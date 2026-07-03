import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Plus, ToggleLeft, ToggleRight, Trash2, Search, Filter, RefreshCw, Clock, Edit2, Play, Users, LayoutDashboard, Terminal } from 'lucide-react';
import apiClient from '../../api/client';
import './WAFManager.css';

export default function WAFManager() {
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Status stats
  const [stats, setStats] = useState({
    blocked_count: 0,
    quarantined_count: 0,
    active_rules_count: 0,
    auto_rules_count: 0,
    manual_rules_count: 0
  });

  // Lists
  const [rules, setRules] = useState([]);
  const [hits, setHits] = useState([]);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Modal & Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formIp, setFormIp] = useState('');
  const [formAction, setFormAction] = useState('BLOCK');
  const [formReason, setFormReason] = useState('');
  const [formExpiry, setFormExpiry] = useState('24'); // hours, or 'never'
  const [formAnalyst, setFormAnalyst] = useState('SOC Lead');

  // Edit State
  const [editingRule, setEditingRule] = useState(null);

  // Fetch core data
  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setIsSyncing(true);
      
      const [rulesData, hitsData, statsData] = await Promise.all([
        apiClient.get('/waf/rules', {
          params: {
            search: searchQuery || undefined,
            action: actionFilter || undefined
          }
        }),
        apiClient.get('/waf/hits'),
        apiClient.get('/waf/status')
      ]);

      setRules(rulesData);
      setHits(hitsData);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to load WAF telemetry:", err);
    } finally {
      if (!isSilent) setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, actionFilter]);

  // Background refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [searchQuery, actionFilter]);

  const handleToggleRule = async (rule) => {
    try {
      const nextState = rule.is_enabled === 1 ? 0 : 1;
      const updated = await apiClient.put(`/waf/rules/${rule.id}`, { is_enabled: nextState });
      setRules(rules.map(r => r.id === rule.id ? updated : r));
      // Refresh status count
      const updatedStats = await apiClient.get('/waf/status');
      setStats(updatedStats);
    } catch (err) {
      console.error("Failed to toggle rule state:", err);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this defensive rule?")) return;
    try {
      await apiClient.delete(`/waf/rules/${id}`);
      setRules(rules.filter(r => r.id !== id));
      const updatedStats = await apiClient.get('/waf/status');
      setStats(updatedStats);
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    try {
      let expiresAt = null;
      if (formExpiry !== 'never') {
        const date = new Date();
        date.setHours(date.getHours() + parseInt(formExpiry));
        expiresAt = date.toISOString();
      }

      const payload = {
        ip_address: formIp.trim() || null,
        action: formAction,
        reason: formReason.trim() || 'Manual configuration via WAF control console',
        expires_at: expiresAt,
        analyst_attribution: formAnalyst.trim() || 'SOC Lead',
        is_enabled: 1
      };

      if (editingRule) {
        const updated = await apiClient.put(`/waf/rules/${editingRule.id}`, payload);
        setRules(rules.map(r => r.id === editingRule.id ? updated : r));
      } else {
        const created = await apiClient.post('/waf/rules', payload);
        setRules([created, ...rules]);
      }

      setShowAddModal(false);
      setEditingRule(null);
      // Reset Form fields
      setFormIp('');
      setFormAction('BLOCK');
      setFormReason('');
      setFormExpiry('24');
      
      const updatedStats = await apiClient.get('/waf/status');
      setStats(updatedStats);
    } catch (err) {
      console.error("Failed to save WAF rule:", err);
    }
  };

  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    setFormIp(rule.ip_address || '');
    setFormAction(rule.action);
    setFormReason(rule.reason || '');
    setFormAnalyst(rule.analyst_attribution || 'SOC Lead');
    setFormExpiry('never');
    setShowAddModal(true);
  };

  return (
    <div className="waf-root">
      {/* 1. Status Stats Widgets */}
      <div className="waf-stats-grid">
        <div className="waf-stat-card border-red">
          <div className="stat-icon-box bg-red">
            <ShieldAlert size={20} className="text-red" />
          </div>
          <div className="stat-details">
            <span className="stat-label font-mono">Blocked Intrusions</span>
            <span className="stat-val font-mono">{stats.blocked_count}</span>
          </div>
        </div>

        <div className="waf-stat-card border-orange">
          <div className="stat-icon-box bg-orange">
            <ShieldAlert size={20} className="text-orange" />
          </div>
          <div className="stat-details">
            <span className="stat-label font-mono">Quarantined Hosts</span>
            <span className="stat-val font-mono">{stats.quarantined_count}</span>
          </div>
        </div>

        <div className="waf-stat-card border-cyan">
          <div className="stat-icon-box bg-cyan">
            <Shield size={20} className="text-cyan" />
          </div>
          <div className="stat-details">
            <span className="stat-label font-mono">Active Rules</span>
            <span className="stat-val font-mono">{stats.active_rules_count}</span>
          </div>
        </div>

        <div className="waf-stat-card border-purple">
          <div className="stat-icon-box bg-purple">
            <Users size={20} className="text-purple" />
          </div>
          <div className="stat-details">
            <span className="stat-label font-mono">Auto / Manual Rules</span>
            <span className="stat-val font-mono">{stats.auto_rules_count} / {stats.manual_rules_count}</span>
          </div>
        </div>
      </div>

      {/* 2. Rule filters & search */}
      <div className="waf-filter-bar card-cyber">
        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search IP pattern, analyst, reason..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filters-selectors">
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            <option value="ALLOW">Allow</option>
            <option value="BLOCK">Block</option>
            <option value="QUARANTINE">Quarantine</option>
          </select>

          <button 
            className="btn-action-soc btn-create-rule"
            onClick={() => {
              setEditingRule(null);
              setFormIp('');
              setFormAction('BLOCK');
              setFormReason('');
              setFormExpiry('24');
              setShowAddModal(true);
            }}
          >
            <Plus size={14} style={{ marginRight: '6px' }} />
            New Rule
          </button>

          <button 
            className={`sync-btn ${isSyncing ? 'syncing' : ''}`}
            onClick={() => fetchData(true)}
            title="Force synchronization"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* 3. Main Split View: Rules list vs Hit Audit timeline */}
      <div className="waf-main-grid">
        {/* Rules Table */}
        <div className="waf-panel card-cyber rules-panel">
          <div className="panel-header">
            <h5 className="panel-title font-mono">WAF Rule Policies Console</h5>
          </div>
          <div className="panel-body">
            <div className="waf-table-container">
              <table className="waf-table">
                <thead>
                  <tr>
                    <th>Target IP</th>
                    <th>Action</th>
                    <th>Type</th>
                    <th>Triggers</th>
                    <th>Reason / Attribution</th>
                    <th>Expiration</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className={rule.is_enabled !== 1 ? 'rule-disabled-row' : ''}>
                      <td className="font-mono" style={{ color: rule.ip_address ? '#ffffff' : 'var(--text-muted)' }}>
                        {rule.ip_address || 'ANY (GLOBAL)'}
                      </td>
                      <td>
                        <span className={`badge badge-action-${rule.action.toLowerCase()}`}>
                          {rule.action}
                        </span>
                      </td>
                      <td>
                        <span className={`type-tag type-${rule.rule_type.toLowerCase()}`}>
                          {rule.rule_type}
                        </span>
                      </td>
                      <td className="font-mono">{rule.trigger_count}</td>
                      <td>
                        <div className="reason-text">{rule.reason}</div>
                        <div className="attribution-text font-mono">By: {rule.analyst_attribution || 'System'}</div>
                      </td>
                      <td className="font-mono" style={{ fontSize: '10px' }}>
                        {rule.expires_at ? new Date(rule.expires_at).toLocaleString() : 'Never'}
                      </td>
                      <td>
                        <button 
                          className="toggle-status-btn"
                          onClick={() => handleToggleRule(rule)}
                          title={rule.is_enabled === 1 ? 'Disable Rule' : 'Enable Rule'}
                        >
                          {rule.is_enabled === 1 ? (
                            <ToggleRight size={20} className="text-cyan" />
                          ) : (
                            <ToggleLeft size={20} className="text-muted" />
                          )}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="rule-icon-btn text-cyan" onClick={() => handleOpenEdit(rule)}>
                            <Edit2 size={12} />
                          </button>
                          <button className="rule-icon-btn text-red" onClick={() => handleDeleteRule(rule.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rules.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }} className="text-muted font-mono">
                        No active firewall rules defined.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live WAF Hits timeline */}
        <div className="waf-panel card-cyber hits-panel">
          <div className="panel-header">
            <h5 className="panel-title font-mono">Intrusion Prevention Timeline</h5>
          </div>
          <div className="panel-body hits-timeline-body">
            <div className="hits-timeline">
              {hits.map((hit) => (
                <div key={hit.id} className="hit-timeline-item">
                  <div className={`hit-badge bg-${hit.action.toLowerCase()}`}></div>
                  <div className="hit-header">
                    <span className="hit-ip font-mono">{hit.ip_address}</span>
                    <span className="hit-time font-mono">{new Date(hit.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="hit-desc font-mono">
                    Blocked request: <strong>{hit.method} {hit.path}</strong>. Action: <strong>{hit.action}</strong>
                  </div>
                  {hit.payload && (
                    <pre className="hit-payload font-mono">{hit.payload}</pre>
                  )}
                </div>
              ))}
              {hits.length === 0 && (
                <div className="text-muted font-mono text-center" style={{ padding: '30px 0' }}>
                  No WAF events captured. Active Defense Engine idle.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Add Rule */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content card-cyber">
            <div className="modal-header">
              <h5 className="modal-title font-mono">{editingRule ? "Edit Rule Policy" : "Configure WAF Rule Policy"}</h5>
              <button className="close-modal-btn" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddRule}>
              <div className="modal-body">
                <div className="form-field-waf">
                  <label>Target Client IP Address:</label>
                  <input 
                    type="text" 
                    value={formIp}
                    placeholder="e.g. 192.168.1.105 (Leave blank for generic check signatures)"
                    onChange={(e) => setFormIp(e.target.value)}
                  />
                </div>

                <div className="form-field-waf">
                  <label>Action Override Policy:</label>
                  <select value={formAction} onChange={(e) => setFormAction(e.target.value)}>
                    <option value="BLOCK">BLOCK (Deny Connection)</option>
                    <option value="QUARANTINE">QUARANTINE (Isolate Asset Node)</option>
                    <option value="ALLOW">ALLOW (Whitelist Exception)</option>
                  </select>
                </div>

                <div className="form-field-waf">
                  <label>Intrusion Rule Justification Reason:</label>
                  <textarea 
                    rows="3" 
                    value={formReason}
                    placeholder="Explain why this containment action has been initiated..."
                    onChange={(e) => setFormReason(e.target.value)}
                  />
                </div>

                <div className="form-field-waf">
                  <label>Analyst Attribution Tag:</label>
                  <input 
                    type="text" 
                    value={formAnalyst}
                    placeholder="SOC Analyst signature name"
                    onChange={(e) => setFormAnalyst(e.target.value)}
                  />
                </div>

                <div className="form-field-waf">
                  <label>Rule Expiry Policy:</label>
                  <select value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)}>
                    <option value="never">Never Expire (Static Rule)</option>
                    <option value="1">Expire in 1 Hour</option>
                    <option value="24">Expire in 24 Hours</option>
                    <option value="168">Expire in 7 Days</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-action-soc btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-action-soc btn-submit">{editingRule ? "Save Changes" : "Apply Rule Policy"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
