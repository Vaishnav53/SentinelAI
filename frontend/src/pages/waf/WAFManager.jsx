import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Shield,
  ShieldAlert,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Search,
  RefreshCw,
  Edit2,
  X,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
  Clock,
  Activity,
  Radio,
  Layers,
  Terminal,
  FileText
} from 'lucide-react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './WAFManager.css';

const ATTACKER_ITEM_HEIGHT = 88; // 80px card + 8px gap
const OVERSCAN = 5;

// Memoized Honeypot Attacker Row
const HoneypotAttackerRow = React.memo(function HoneypotAttackerRow({
  source,
  isAdmin,
  actionLoadingIp,
  onBlock,
  onUnblock,
  onCopyIp,
  copiedIp,
  top
}) {
  const isActionLoading = actionLoadingIp === source.ip_address;
  const sev = (source.severity || 'LOW').toUpperCase();

  return (
    <div
      className="waf-attacker-card"
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: 0,
        right: 0,
        height: '80px',
        boxSizing: 'border-box'
      }}
    >
      <div className="attacker-card-top">
        <div className="attacker-ip-group">
          <span className="attacker-ip font-mono">{source.ip_address}</span>
          <button
            className="btn-mini-copy"
            onClick={() => onCopyIp(source.ip_address)}
            title="Copy IP Address"
          >
            {copiedIp === source.ip_address ? <Check size={11} className="text-green" /> : <Copy size={11} />}
          </button>
          {source.is_local && <span className="badge-lan font-mono">LAN</span>}
        </div>

        <div className="attacker-badges-group font-mono">
          <span className={`badge-sev sev-${sev.toLowerCase()}`}>
            {sev}
          </span>
          <span className={`badge-contain ${source.is_blocked ? 'contain-blocked' : 'contain-monitored'}`}>
            {source.is_blocked ? 'BLOCKED' : 'MONITORED'}
          </span>
        </div>
      </div>

      <div className="attacker-card-meta font-mono">
        <div className="meta-left">
          <div className="services-chips">
            {(source.services && source.services.length > 0) ? (
              source.services.slice(0, 2).map((svc, idx) => (
                <span key={idx} className="chip-service font-mono">{svc}</span>
              ))
            ) : (source.threat_types && source.threat_types.length > 0) ? (
              source.threat_types.slice(0, 2).map((t, idx) => (
                <span key={idx} className="chip-service font-mono">{t}</span>
              ))
            ) : (
              <span className="text-muted text-xxs">Honeypot Decoy</span>
            )}
          </div>
          <span className="events-count">
            <strong className="text-cyan">{source.event_count}</strong> events
          </span>
        </div>

        <div className="meta-right">
          <span className="last-seen-text text-muted" title={source.last_seen}>
            <Clock size={10} className="inline mr-1" />
            {source.last_seen ? source.last_seen.split(' ')[1] || source.last_seen : 'Recent'}
          </span>

          {source.is_blocked ? (
            <button
              className={`btn-waf-action btn-waf-unblock ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => onUnblock(source.rule_id, source.ip_address)}
              disabled={!isAdmin || isActionLoading}
              title={isAdmin ? "Remove WAF block rule" : "Administrator privileges required"}
            >
              {isActionLoading ? <RefreshCw size={11} className="animate-spin" /> : <Unlock size={11} />}
              <span>{isActionLoading ? '...' : 'UNBLOCK'}</span>
            </button>
          ) : (
            <button
              className={`btn-waf-action btn-waf-block ${(!isAdmin || source.is_local) ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => onBlock(source.ip_address)}
              disabled={!isAdmin || source.is_local || isActionLoading}
              title={
                source.is_local
                  ? "Local RFC 1918 addresses cannot be blocked via perimeter WAF"
                  : (isAdmin ? "Deploy immediate WAF containment block" : "Administrator privileges required")
              }
            >
              {isActionLoading ? <RefreshCw size={11} className="animate-spin" /> : <Lock size={11} />}
              <span>{isActionLoading ? '...' : (source.is_local ? 'LAN IP' : 'BLOCK')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// Virtualized Honeypot Attackers List
function VirtualHoneypotAttackerList({
  items,
  isAdmin,
  actionLoadingIp,
  onBlock,
  onUnblock,
  onCopyIp,
  copiedIp
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    setContainerHeight(el.clientHeight || 500);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalCount = items.length;
  const totalHeight = totalCount * ATTACKER_ITEM_HEIGHT;

  const startIndex = Math.max(0, Math.floor(scrollTop / ATTACKER_ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + containerHeight) / ATTACKER_ITEM_HEIGHT) + OVERSCAN);

  const visibleSlice = useMemo(() => {
    return items.slice(startIndex, endIndex).map((source, idx) => ({
      source,
      top: (startIndex + idx) * ATTACKER_ITEM_HEIGHT
    }));
  }, [items, startIndex, endIndex]);

  return (
    <div
      className="waf-attackers-scroll"
      ref={containerRef}
      onScroll={handleScroll}
      style={{ position: 'relative', overflowY: 'auto', flex: 1 }}
    >
      {totalCount === 0 ? (
        <div className="empty-waf-state font-mono">
          <AlertTriangle size={24} className="text-muted mb-2" />
          <span className="text-white text-xs font-semibold">No Honeypot Attackers Detected</span>
          <p className="text-muted text-xxs mt-1">
            No source IPs matching the current criteria were captured in honeypot telemetry.
          </p>
        </div>
      ) : (
        <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
          {visibleSlice.map(({ source, top }) => (
            <HoneypotAttackerRow
              key={source.ip_address}
              source={source}
              isAdmin={isAdmin}
              actionLoadingIp={actionLoadingIp}
              onBlock={onBlock}
              onUnblock={onUnblock}
              onCopyIp={onCopyIp}
              copiedIp={copiedIp}
              top={top}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WAFManager() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Loading and Syncing States
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionLoadingIp, setActionLoadingIp] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Status Stats
  const [stats, setStats] = useState({
    blocked_count: 0,
    quarantined_count: 0,
    active_rules_count: 0,
    auto_rules_count: 0,
    manual_rules_count: 0,
    honeypot_attackers_count: 0,
    blocked_attackers_count: 0
  });

  // Core Data Lists
  const [rules, setRules] = useState([]);
  const [hits, setHits] = useState([]);
  const [observedSources, setObservedSources] = useState([]);

  // Right Panel Tab State: 'rules' | 'hits'
  const [activeRightTab, setActiveRightTab] = useState('rules');

  // Search & Filter
  const [attackerSearch, setAttackerSearch] = useState('');
  const deferredAttackerSearch = useDeferredValue(attackerSearch);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [ruleActionFilter, setRuleActionFilter] = useState('');

  // Modal & Form State for Rule Management
  const [showAddModal, setShowAddModal] = useState(false);
  const [formIp, setFormIp] = useState('');
  const [formAction, setFormAction] = useState('BLOCK');
  const [formReason, setFormReason] = useState('');
  const [formExpiry, setFormExpiry] = useState('24');
  const [formAnalyst, setFormAnalyst] = useState('SOC Lead');
  const [editingRule, setEditingRule] = useState(null);

  // Clipboard Feedback
  const [copiedIp, setCopiedIp] = useState(null);

  // Fetch core WAF telemetry data
  const fetchData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setIsSyncing(true);

      const [rulesData, hitsData, statsData, observedData] = await Promise.all([
        apiClient.get('/waf/rules'),
        apiClient.get('/waf/hits'),
        apiClient.get('/waf/status'),
        apiClient.get('/waf/observed-sources')
      ]);

      setRules(Array.isArray(rulesData) ? rulesData : []);
      setHits(Array.isArray(hitsData) ? hitsData : []);
      if (statsData) setStats(statsData);
      setObservedSources(Array.isArray(observedData) ? observedData : []);
    } catch (err) {
      console.error("Failed to load WAF telemetry:", err);
    } finally {
      if (!isSilent) setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Initial load and controlled 8-second background polling
  useEffect(() => {
    fetchData();

    let isPolling = false;
    const interval = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        await fetchData(true);
      } finally {
        isPolling = false;
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Copy IP Address
  const handleCopyIp = useCallback((ip) => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  }, []);

  // Block a honeypot attacker IP via WAF Rule API
  const handleBlockObservedSource = useCallback(async (ip) => {
    if (!isAdmin) {
      setFeedbackMessage({ type: 'error', text: 'Administrator privileges required to create WAF block rules.' });
      return;
    }
    try {
      setActionLoadingIp(ip);
      await apiClient.post('/waf/rules', {
        ip_address: ip,
        action: 'BLOCK',
        reason: 'Containment block deployed from WAF Honeypot Attackers console',
        is_enabled: 1,
        analyst_attribution: user?.username || 'SOC Lead'
      });
      setFeedbackMessage({ type: 'success', text: `WAF Block rule successfully deployed for ${ip}` });
      await fetchData(true);
    } catch (err) {
      console.error("Failed to block source:", err);
      setFeedbackMessage({ type: 'error', text: err.message || `Failed to deploy block rule for ${ip}` });
    } finally {
      setActionLoadingIp(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  }, [isAdmin, user, fetchData]);

  // Unblock a honeypot attacker IP via WAF Rule API
  const handleUnblockObservedSource = useCallback(async (ruleId, ip) => {
    if (!isAdmin) {
      setFeedbackMessage({ type: 'error', text: 'Administrator privileges required to remove WAF block rules.' });
      return;
    }
    try {
      setActionLoadingIp(ip);
      let targetRuleId = ruleId;
      if (!targetRuleId) {
        const matched = rules.find(r => r.ip_address === ip && r.action === 'BLOCK' && r.is_enabled === 1);
        if (matched) targetRuleId = matched.id;
      }

      if (targetRuleId) {
        await apiClient.delete(`/waf/rules/${targetRuleId}`);
        setFeedbackMessage({ type: 'success', text: `WAF Block rule removed for ${ip}` });
      } else {
        throw new Error("Matching active WAF rule not found.");
      }
      await fetchData(true);
    } catch (err) {
      console.error("Failed to unblock source:", err);
      setFeedbackMessage({ type: 'error', text: err.message || `Failed to unblock ${ip}` });
    } finally {
      setActionLoadingIp(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  }, [isAdmin, rules, fetchData]);

  // Toggle enable/disable on a WAF rule policy
  const handleToggleRule = async (rule) => {
    if (!isAdmin) return;
    try {
      const nextState = rule.is_enabled === 1 ? 0 : 1;
      const updated = await apiClient.put(`/waf/rules/${rule.id}`, { is_enabled: nextState });
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
      const updatedStats = await apiClient.get('/waf/status');
      if (updatedStats) setStats(updatedStats);
      await fetchData(true);
    } catch (err) {
      console.error("Failed to toggle rule state:", err);
    }
  };

  // Delete a WAF rule policy
  const handleDeleteRule = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to permanently delete this defensive containment rule?")) return;
    try {
      await apiClient.delete(`/waf/rules/${id}`);
      setRules(prev => prev.filter(r => r.id !== id));
      const updatedStats = await apiClient.get('/waf/status');
      if (updatedStats) setStats(updatedStats);
      await fetchData(true);
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  // Submit Add / Edit Rule Form
  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      let expiresAt = null;
      if (formExpiry !== 'never') {
        const date = new Date();
        date.setHours(date.getHours() + parseInt(formExpiry, 10));
        expiresAt = date.toISOString();
      }

      const payload = {
        ip_address: formIp.trim() || null,
        action: formAction,
        reason: formReason.trim() || 'Manual configuration via WAF control console',
        expires_at: expiresAt,
        analyst_attribution: formAnalyst.trim() || user?.username || 'SOC Lead',
        is_enabled: 1
      };

      if (editingRule) {
        const updated = await apiClient.put(`/waf/rules/${editingRule.id}`, payload);
        setRules(prev => prev.map(r => r.id === editingRule.id ? updated : r));
      } else {
        const created = await apiClient.post('/waf/rules', payload);
        setRules(prev => [created, ...prev]);
      }

      setShowAddModal(false);
      setEditingRule(null);
      setFormIp('');
      setFormAction('BLOCK');
      setFormReason('');
      setFormExpiry('24');

      await fetchData(true);
    } catch (err) {
      console.error("Failed to save WAF rule:", err);
    }
  };

  // Open Edit Rule Modal
  const handleOpenEdit = (rule) => {
    if (!isAdmin) return;
    setEditingRule(rule);
    setFormIp(rule.ip_address || '');
    setFormAction(rule.action);
    setFormReason(rule.reason || '');
    setFormAnalyst(rule.analyst_attribution || user?.username || 'SOC Lead');
    setFormExpiry('never');
    setShowAddModal(true);
  };

  // Memoized Filtered Honeypot Attackers
  const filteredAttackers = useMemo(() => {
    const q = deferredAttackerSearch.toLowerCase().trim();
    return observedSources.filter(source => {
      // 1. Severity filter
      if (severityFilter !== 'ALL') {
        if (severityFilter === 'BLOCKED' && !source.is_blocked) return false;
        if (severityFilter === 'UNBLOCKED' && source.is_blocked) return false;
        if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severityFilter)) {
          if ((source.severity || 'LOW').toUpperCase() !== severityFilter) return false;
        }
      }

      // 2. Search query match
      if (!q) return true;
      const ipMatch = (source.ip_address || '').toLowerCase().includes(q);
      const sevMatch = (source.severity || '').toLowerCase().includes(q);
      const typesMatch = (source.threat_types || []).some(t => t.toLowerCase().includes(q));
      const servicesMatch = (source.services || []).some(s => s.toLowerCase().includes(q));
      return ipMatch || sevMatch || typesMatch || servicesMatch;
    });
  }, [observedSources, deferredAttackerSearch, severityFilter]);

  // Memoized Filtered WAF Rules
  const filteredRules = useMemo(() => {
    if (!ruleActionFilter) return rules;
    return rules.filter(r => r.action === ruleActionFilter);
  }, [rules, ruleActionFilter]);

  // Memoized Counts for KPI strip
  const totalHoneypotAttackers = observedSources.length;
  const blockedHoneypotCount = useMemo(() => {
    return observedSources.filter(s => s.is_blocked).length;
  }, [observedSources]);

  return (
    <div className="waf-root">
      {/* 1. Header & Status Tag */}
      <div className="waf-header-row">
        <div>
          <h2 className="waf-title font-mono title-cyber">
            <Shield size={18} className="text-cyan inline mr-2" />
            WEB APPLICATION FIREWALL (WAF)
          </h2>
          <div className="waf-subtitle font-mono">
            Active perimeter defense, honeypot attacker containment, and rule policies
          </div>
        </div>

        <div className="waf-header-actions font-mono">
          <span className="waf-status-indicator">
            <Radio size={12} className="text-green animate-pulse" />
            <span>ACTIVE DEFENSE</span>
          </span>
          <button
            className="btn-waf-refresh"
            onClick={() => fetchData(false)}
            disabled={isSyncing}
            title="Refresh WAF Telemetry & Rules"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'SYNCING...' : 'REFRESH'}</span>
          </button>
        </div>
      </div>

      {/* 2. Compact 4-Card KPI Strip */}
      <div className="waf-kpi-strip">
        <div className="waf-kpi-card">
          <span className="kpi-label font-mono">WAF ENGINE STATUS</span>
          <div className="kpi-val-row font-mono">
            <span className="kpi-val text-cyan">ACTIVE / ENFORCING</span>
            <Shield size={15} className="text-cyan" />
          </div>
        </div>

        <div className="waf-kpi-card">
          <span className="kpi-label font-mono">HONEYPOT ATTACKERS</span>
          <div className="kpi-val-row font-mono">
            <span className="kpi-val text-white">{totalHoneypotAttackers.toLocaleString()}</span>
            <ShieldAlert size={15} className="text-amber" />
          </div>
        </div>

        <div className="waf-kpi-card">
          <span className="kpi-label font-mono">CURRENTLY BLOCKED</span>
          <div className="kpi-val-row font-mono">
            <span className="kpi-val text-red">{blockedHoneypotCount.toLocaleString()}</span>
            <Lock size={15} className="text-red" />
          </div>
        </div>

        <div className="waf-kpi-card">
          <span className="kpi-label font-mono">RECENT WAF EVENTS</span>
          <div className="kpi-val-row font-mono">
            <span className="kpi-val text-orange">{(stats.blocked_count + stats.quarantined_count).toLocaleString()}</span>
            <Activity size={15} className="text-orange" />
          </div>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedbackMessage && (
        <div className={`waf-feedback-banner ${feedbackMessage.type} font-mono animate-slide-in`}>
          {feedbackMessage.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
          <span>{feedbackMessage.text}</span>
          <button className="btn-close-toast" onClick={() => setFeedbackMessage(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* 3. Main Two-Panel Grid */}
      <div className="waf-main-grid">
        {/* LEFT PANEL: Honeypot Attacker Telemetry */}
        <div className="waf-panel card-cyber attackers-panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-amber" />
              <h5 className="panel-title font-mono">HONEYPOT ATTACKER TELEMETRY</h5>
            </div>
            <span className="badge-count font-mono">{filteredAttackers.length.toLocaleString()}</span>
          </div>

          {/* Search & Severity Filter Bar */}
          <div className="attackers-filter-bar">
            <div className="search-input-box">
              <Search size={13} className="text-muted" />
              <input
                type="text"
                placeholder="Search by IP, threat type, service, or severity..."
                value={attackerSearch}
                onChange={(e) => setAttackerSearch(e.target.value)}
                className="font-mono text-xs"
              />
              {attackerSearch && (
                <button className="clear-search-btn" onClick={() => setAttackerSearch('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              className="filter-select font-mono"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="ALL">All Threat Levels</option>
              <option value="CRITICAL">Critical Severity</option>
              <option value="HIGH">High Severity</option>
              <option value="MEDIUM">Medium Severity</option>
              <option value="LOW">Low Severity</option>
              <option value="BLOCKED">Blocked Only</option>
              <option value="UNBLOCKED">Monitored Only</option>
            </select>
          </div>

          {/* Virtualized Attacker List */}
          <VirtualHoneypotAttackerList
            items={filteredAttackers}
            isAdmin={isAdmin}
            actionLoadingIp={actionLoadingIp}
            onBlock={handleBlockObservedSource}
            onUnblock={handleUnblockObservedSource}
            onCopyIp={handleCopyIp}
            copiedIp={copiedIp}
          />
        </div>

        {/* RIGHT PANEL: WAF Rule Policies & Intrusion Timeline */}
        <div className="waf-panel card-cyber rules-timeline-panel">
          {/* Panel Tab Navigation */}
          <div className="panel-tab-header">
            <button
              className={`panel-tab-btn font-mono ${activeRightTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveRightTab('rules')}
            >
              <Layers size={13} className="inline mr-1" />
              <span>Active Policies ({rules.length})</span>
            </button>
            <button
              className={`panel-tab-btn font-mono ${activeRightTab === 'hits' ? 'active' : ''}`}
              onClick={() => setActiveRightTab('hits')}
            >
              <Activity size={13} className="inline mr-1" />
              <span>Intrusion Timeline ({hits.length})</span>
            </button>
          </div>

          {activeRightTab === 'rules' ? (
            <div className="rules-tab-content">
              {/* Rules Toolbar */}
              <div className="rules-toolbar">
                <select
                  className="filter-select font-mono"
                  value={ruleActionFilter}
                  onChange={(e) => setRuleActionFilter(e.target.value)}
                >
                  <option value="">All Rule Actions</option>
                  <option value="BLOCK">Block Actions</option>
                  <option value="QUARANTINE">Quarantine Actions</option>
                  <option value="ALLOW">Allow Actions</option>
                </select>

                <button
                  className={`btn-create-rule font-mono ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (!isAdmin) return;
                    setEditingRule(null);
                    setFormIp('');
                    setFormAction('BLOCK');
                    setFormReason('');
                    setFormExpiry('24');
                    setShowAddModal(true);
                  }}
                  disabled={!isAdmin}
                  title={isAdmin ? "Create new manual defensive rule" : "Administrator privileges required"}
                >
                  <Plus size={13} />
                  <span>New Rule</span>
                </button>
              </div>

              {/* Rules List */}
              <div className="rules-list-scroll">
                {filteredRules.map((rule) => (
                  <div key={rule.id} className={`rule-card font-mono ${rule.is_enabled !== 1 ? 'rule-disabled' : ''}`}>
                    <div className="rule-card-top">
                      <div className="rule-target-group">
                        <span className="rule-ip">{rule.ip_address || 'GLOBAL (ANY IP)'}</span>
                        <span className={`badge-action badge-action-${rule.action.toLowerCase()}`}>
                          {rule.action}
                        </span>
                        <span className="type-tag">{rule.rule_type}</span>
                      </div>

                      <div className="rule-controls">
                        <button
                          className="btn-toggle-rule"
                          onClick={() => handleToggleRule(rule)}
                          disabled={!isAdmin}
                          title={rule.is_enabled === 1 ? 'Disable rule' : 'Enable rule'}
                        >
                          {rule.is_enabled === 1 ? (
                            <ToggleRight size={18} className="text-cyan" />
                          ) : (
                            <ToggleLeft size={18} className="text-muted" />
                          )}
                        </button>
                        <button
                          className="btn-rule-icon text-cyan"
                          onClick={() => handleOpenEdit(rule)}
                          disabled={!isAdmin}
                          title="Edit rule"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          className="btn-rule-icon text-red"
                          onClick={() => handleDeleteRule(rule.id)}
                          disabled={!isAdmin}
                          title="Delete rule"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="rule-card-body">
                      <div className="rule-reason text-muted text-xxs">{rule.reason}</div>
                      <div className="rule-meta-row text-xxxs text-muted mt-1">
                        <span>Triggers: <strong className="text-white">{rule.trigger_count}</strong></span>
                        <span className="divider">•</span>
                        <span>Analyst: {rule.analyst_attribution || 'System'}</span>
                        <span className="divider">•</span>
                        <span>Expires: {rule.expires_at ? new Date(rule.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredRules.length === 0 && (
                  <div className="empty-waf-state font-mono">
                    <Layers size={24} className="text-muted mb-2" />
                    <span className="text-white text-xs font-semibold">No WAF Policies Configured</span>
                    <p className="text-muted text-xxs mt-1">
                      {ruleActionFilter ? `No rules match action '${ruleActionFilter}'.` : 'Click "+ New Rule" to create a defensive containment rule.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="hits-tab-content">
              <div className="hits-timeline-scroll">
                {hits.map((hit) => (
                  <div key={hit.id} className="hit-card font-mono">
                    <div className="hit-top-row">
                      <div className="flex items-center gap-2">
                        <span className={`hit-dot bg-${hit.action.toLowerCase()}`}></span>
                        <span className="hit-ip text-white">{hit.ip_address}</span>
                      </div>
                      <span className="hit-time text-muted text-xxs">
                        {new Date(hit.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="hit-desc text-xxs mt-1">
                      <span className="text-muted">Intercept: </span>
                      <strong className="text-cyan">{hit.method}</strong> <span className="text-white">{hit.path}</span>
                      <span className={`badge-action ml-2 badge-action-${hit.action.toLowerCase()}`}>
                        {hit.action}
                      </span>
                    </div>

                    {hit.payload && (
                      <pre className="hit-payload-box text-xxxs mt-2">{hit.payload}</pre>
                    )}
                  </div>
                ))}

                {hits.length === 0 && (
                  <div className="empty-waf-state font-mono">
                    <Activity size={24} className="text-muted mb-2" />
                    <span className="text-white text-xs font-semibold">No WAF Intercepts Recorded</span>
                    <p className="text-muted text-xxs mt-1">
                      Active Defense Engine idle. Perimeter intrusion events will appear here in real time.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Add / Edit Rule Modal */}
      {showAddModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="modal-content card-cyber font-mono" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title font-mono title-cyber">
                {editingRule ? "EDIT WAF POLICY RULE" : "CONFIGURE WAF POLICY RULE"}
              </h5>
              <button className="close-modal-btn" onClick={() => setShowAddModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveRule}>
              <div className="modal-body">
                <div className="form-field-waf">
                  <label>Target IP Address (or leave blank for all):</label>
                  <input
                    type="text"
                    value={formIp}
                    placeholder="e.g. 198.51.100.12"
                    onChange={(e) => setFormIp(e.target.value)}
                  />
                </div>

                <div className="form-field-waf">
                  <label>Action Policy:</label>
                  <select value={formAction} onChange={(e) => setFormAction(e.target.value)}>
                    <option value="BLOCK">BLOCK (Deny Connection)</option>
                    <option value="QUARANTINE">QUARANTINE (Isolate Node)</option>
                    <option value="ALLOW">ALLOW (Whitelist Exception)</option>
                  </select>
                </div>

                <div className="form-field-waf">
                  <label>Rule Justification / Reason:</label>
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
                <button type="button" className="btn-waf-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-waf-primary">
                  {editingRule ? "Save Changes" : "Deploy Rule Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
