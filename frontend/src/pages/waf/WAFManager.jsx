import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
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
  Activity,
  Radio,
  Layers,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Sparkles,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatLocalTime } from '../../utils/dateUtils';
import './WAFManager.css';

const ITEMS_PER_PAGE = 15;

export default function WAFManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Loading and Synchronization States
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionLoadingIp, setActionLoadingIp] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Status Stats from /waf/status
  const [stats, setStats] = useState({
    blocked_count: 0,
    quarantined_count: 0,
    active_rules_count: 0,
    auto_rules_count: 0,
    manual_rules_count: 0,
    honeypot_attackers_count: 0,
    blocked_attackers_count: 0
  });

  // Core Telemetry Data
  const [rules, setRules] = useState([]);
  const [hits, setHits] = useState([]);
  const [observedSources, setObservedSources] = useState([]);

  // Active Main Navigation Tab: 'attackers' | 'rules' | 'hits'
  const [activeTab, setActiveTab] = useState('attackers');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [ruleActionFilter, setRuleActionFilter] = useState('ALL');
  const [hitActionFilter, setHitActionFilter] = useState('ALL');

  // Pagination States per Tab
  const [attackersPage, setAttackersPage] = useState(1);
  const [rulesPage, setRulesPage] = useState(1);
  const [hitsPage, setHitsPage] = useState(1);

  // Modal State for Add / Edit Rule
  const [showAddModal, setShowAddModal] = useState(false);
  const [formIp, setFormIp] = useState('');
  const [formAction, setFormAction] = useState('BLOCK');
  const [formReason, setFormReason] = useState('');
  const [formExpiry, setFormExpiry] = useState('24');
  const [formAnalyst, setFormAnalyst] = useState('SOC Lead');
  const [editingRule, setEditingRule] = useState(null);

  // Inspection Drawer State
  const [inspectedItem, setInspectedItem] = useState(null);
  const [inspectedType, setInspectedType] = useState(null); // 'attacker' | 'hit' | 'rule'

  // Clipboard State
  const [copiedIp, setCopiedIp] = useState(null);

  // Fetch Core Telemetry Data
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

  // Initial Load and Visibility-Aware 10s Background Polling
  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData(true);
      }
    }, 8000);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData]);

  // Copy IP Address Helper
  const handleCopyIp = useCallback((ip) => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2000);
  }, []);

  // Block Observed Honeypot Attacker
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
        reason: 'Perimeter containment block deployed from WAF console',
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

  // Unblock Observed Honeypot Attacker
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

  // Toggle Rule Policy Enabled/Disabled State
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

  // Delete a Rule Policy
  const handleDeleteRule = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Permanently delete this defensive containment rule?")) return;
    try {
      await apiClient.delete(`/waf/rules/${id}`);
      setRules(prev => prev.filter(r => r.id !== id));
      const updatedStats = await apiClient.get('/waf/status');
      if (updatedStats) setStats(updatedStats);
      await fetchData(true);
      if (inspectedItem?.id === id && inspectedType === 'rule') {
        setInspectedItem(null);
      }
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

      setFeedbackMessage({
        type: 'success',
        text: editingRule ? 'WAF Rule updated successfully.' : 'New WAF policy rule deployed.'
      });
      await fetchData(true);
    } catch (err) {
      console.error("Failed to save WAF rule:", err);
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to save WAF rule.' });
    } finally {
      setTimeout(() => setFeedbackMessage(null), 4000);
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

  // Reset tab page on search or filter change
  useEffect(() => {
    setAttackersPage(1);
    setRulesPage(1);
    setHitsPage(1);
  }, [deferredSearch, severityFilter, ruleActionFilter, hitActionFilter]);

  // Filtered Observed Honeypot Attackers
  const filteredAttackers = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return observedSources.filter(source => {
      if (severityFilter !== 'ALL') {
        if (severityFilter === 'BLOCKED' && !source.is_blocked) return false;
        if (severityFilter === 'MONITORED' && source.is_blocked) return false;
        if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severityFilter)) {
          if ((source.severity || 'LOW').toUpperCase() !== severityFilter) return false;
        }
      }
      if (!q) return true;
      const ipMatch = (source.ip_address || '').toLowerCase().includes(q);
      const sevMatch = (source.severity || '').toLowerCase().includes(q);
      const typesMatch = (source.threat_types || []).some(t => t.toLowerCase().includes(q));
      const servicesMatch = (source.services || []).some(s => s.toLowerCase().includes(q));
      return ipMatch || sevMatch || typesMatch || servicesMatch;
    });
  }, [observedSources, deferredSearch, severityFilter]);

  // Paginated Attackers Slice
  const totalAttackerPages = Math.max(1, Math.ceil(filteredAttackers.length / ITEMS_PER_PAGE));
  const paginatedAttackers = useMemo(() => {
    const start = (attackersPage - 1) * ITEMS_PER_PAGE;
    return filteredAttackers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAttackers, attackersPage]);

  // Filtered WAF Rules
  const filteredRules = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return rules.filter(r => {
      if (ruleActionFilter !== 'ALL' && r.action !== ruleActionFilter) return false;
      if (!q) return true;
      const ipMatch = (r.ip_address || 'GLOBAL ANY').toLowerCase().includes(q);
      const reasonMatch = (r.reason || '').toLowerCase().includes(q);
      const analystMatch = (r.analyst_attribution || '').toLowerCase().includes(q);
      const typeMatch = (r.rule_type || '').toLowerCase().includes(q);
      return ipMatch || reasonMatch || analystMatch || typeMatch;
    });
  }, [rules, deferredSearch, ruleActionFilter]);

  // Paginated Rules Slice
  const totalRulePages = Math.max(1, Math.ceil(filteredRules.length / ITEMS_PER_PAGE));
  const paginatedRules = useMemo(() => {
    const start = (rulesPage - 1) * ITEMS_PER_PAGE;
    return filteredRules.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRules, rulesPage]);

  // Filtered WAF Hits
  const filteredHits = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return hits.filter(h => {
      if (hitActionFilter !== 'ALL' && h.action !== hitActionFilter) return false;
      if (!q) return true;
      const ipMatch = (h.ip_address || '').toLowerCase().includes(q);
      const pathMatch = (h.path || '').toLowerCase().includes(q);
      const methodMatch = (h.method || '').toLowerCase().includes(q);
      const payloadMatch = (h.payload || '').toLowerCase().includes(q);
      return ipMatch || pathMatch || methodMatch || payloadMatch;
    });
  }, [hits, deferredSearch, hitActionFilter]);

  // Paginated Hits Slice
  const totalHitPages = Math.max(1, Math.ceil(filteredHits.length / ITEMS_PER_PAGE));
  const paginatedHits = useMemo(() => {
    const start = (hitsPage - 1) * ITEMS_PER_PAGE;
    return filteredHits.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHits, hitsPage]);

  // Derived KPI Counts
  const totalObservedCount = observedSources.length;
  const blockedObservedCount = useMemo(() => observedSources.filter(s => s.is_blocked).length, [observedSources]);
  const activeRulesCount = useMemo(() => rules.filter(r => r.is_enabled === 1).length, [rules]);

  return (
    <div className="waf-soc-root animate-fade-in">
      {/* 1. Header Bar with Security Posture Status */}
      <div className="waf-soc-header">
        <div className="header-left">
          <div className="title-row">
            <Shield className="text-cyan title-icon" size={22} />
            <h1 className="waf-soc-title font-mono">WEB APPLICATION FIREWALL (WAF)</h1>
            <span className="soc-engine-tag font-mono">
              <span className="live-pulse-dot"></span>
              ACTIVE PERIMETER DEFENSE
            </span>
          </div>
          <p className="waf-soc-subtitle font-mono">
            Automated boundary inspection, honeypot telemetry containment, and policy enforcement
          </p>
        </div>

        <div className="header-right font-mono">
          <button
            className="btn-waf-action-outline"
            onClick={() => fetchData(false)}
            disabled={isSyncing}
            title="Synchronize WAF telemetry"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'SYNCING...' : 'REFRESH'}</span>
          </button>

          {isAdmin && (
            <button
              className="btn-waf-primary"
              onClick={() => {
                setEditingRule(null);
                setFormIp('');
                setFormAction('BLOCK');
                setFormReason('');
                setFormExpiry('24');
                setFormAnalyst(user?.username || 'SOC Lead');
                setShowAddModal(true);
              }}
              title="Deploy a new perimeter containment rule"
            >
              <Plus size={15} />
              <span>DEPLOY POLICY RULE</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Cyber SOC 4-Card KPI Strip */}
      <div className="waf-kpi-grid font-mono">
        {/* Card 1: WAF Engine State */}
        <div className="waf-kpi-box">
          <div className="kpi-header">
            <span className="kpi-label">DEFENSE POSTURE</span>
            <ShieldCheck size={16} className="text-cyan" />
          </div>
          <div className="kpi-value text-cyan">ACTIVE / ENFORCING</div>
          <div className="kpi-meta text-muted">
            Perimeter Shield Active · {activeRulesCount} Rules Armed
          </div>
        </div>

        {/* Card 2: Monitored Threat Actors */}
        <div className="waf-kpi-box">
          <div className="kpi-header">
            <span className="kpi-label">MONITORED THREAT SOURCES</span>
            <ShieldAlert size={16} className="text-amber" />
          </div>
          <div className="kpi-value text-white">{totalObservedCount.toLocaleString()}</div>
          <div className="kpi-meta text-muted">
            Derived from Honeypot & Attack Telemetry
          </div>
        </div>

        {/* Card 3: Contained Threat Sources */}
        <div className="waf-kpi-box">
          <div className="kpi-header">
            <span className="kpi-label">CONTAINMENT BLOCKS</span>
            <Lock size={16} className="text-red" />
          </div>
          <div className="kpi-value text-red">{blockedObservedCount.toLocaleString()}</div>
          <div className="kpi-meta text-muted">
            Actively Drop Inbound Traffic
          </div>
        </div>

        {/* Card 4: Intercepted Ingress Events */}
        <div className="waf-kpi-box">
          <div className="kpi-header">
            <span className="kpi-label">INTERCEPTED INTRUSIONS</span>
            <Activity size={16} className="text-orange" />
          </div>
          <div className="kpi-value text-orange">{(stats.blocked_count + stats.quarantined_count).toLocaleString()}</div>
          <div className="kpi-meta text-muted">
            {stats.blocked_count} Blocked · {stats.quarantined_count} Quarantined
          </div>
        </div>
      </div>

      {/* 3. Feedback Banner */}
      {feedbackMessage && (
        <div className={`waf-toast-banner ${feedbackMessage.type} font-mono animate-slide-in`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button className="btn-close-banner" onClick={() => setFeedbackMessage(null)}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* 4. Navigation Segmented Control */}
      <div className="waf-tabs-nav font-mono">
        <button
          className={`waf-tab-btn ${activeTab === 'attackers' ? 'active' : ''}`}
          onClick={() => setActiveTab('attackers')}
        >
          <ShieldAlert size={15} />
          <span>Threat Sources & Containment</span>
          <span className="tab-badge">{filteredAttackers.length}</span>
        </button>

        <button
          className={`waf-tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <Layers size={15} />
          <span>Active Policy Rules</span>
          <span className="tab-badge">{filteredRules.length}</span>
        </button>

        <button
          className={`waf-tab-btn ${activeTab === 'hits' ? 'active' : ''}`}
          onClick={() => setActiveTab('hits')}
        >
          <Activity size={15} />
          <span>Live Intrusion Log</span>
          <span className="tab-badge">{filteredHits.length}</span>
        </button>
      </div>

      {/* 5. Search & Filter Toolbar */}
      <div className="waf-toolbar font-mono">
        <div className="search-box">
          <Search size={14} className="text-muted search-icon" />
          <input
            type="text"
            className="waf-search-input"
            placeholder={
              activeTab === 'attackers'
                ? "Search threat sources by IP, vector, targeted service, or severity..."
                : activeTab === 'rules'
                ? "Search rules by IP, reason, analyst, or rule type..."
                : "Search intrusion log by IP, URI path, method, or payload..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Tab-Specific Dropdown Filters */}
        {activeTab === 'attackers' && (
          <select
            className="waf-select-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">All Threat Severities</option>
            <option value="CRITICAL">Critical Severity</option>
            <option value="HIGH">High Severity</option>
            <option value="MEDIUM">Medium Severity</option>
            <option value="LOW">Low Severity</option>
            <option value="BLOCKED">Contained (Blocked Only)</option>
            <option value="MONITORED">Monitored Only</option>
          </select>
        )}

        {activeTab === 'rules' && (
          <select
            className="waf-select-filter"
            value={ruleActionFilter}
            onChange={(e) => setRuleActionFilter(e.target.value)}
          >
            <option value="ALL">All Rule Actions</option>
            <option value="BLOCK">BLOCK Policy Only</option>
            <option value="QUARANTINE">QUARANTINE Policy Only</option>
            <option value="ALLOW">ALLOW (Whitelist) Only</option>
          </select>
        )}

        {activeTab === 'hits' && (
          <select
            className="waf-select-filter"
            value={hitActionFilter}
            onChange={(e) => setHitActionFilter(e.target.value)}
          >
            <option value="ALL">All Intercept Actions</option>
            <option value="BLOCK">Blocked Intercepts</option>
            <option value="QUARANTINE">Quarantined Intercepts</option>
            <option value="ALLOW">Allowed Traffic</option>
          </select>
        )}
      </div>

      {/* 6. Main Tab Content Views */}
      <div className="waf-content-area">
        {loading && !observedSources.length && !rules.length && !hits.length ? (
          <div className="waf-card-table-wrap">
            <div className="waf-empty-state font-mono">
              <RefreshCw size={26} className="animate-spin text-cyan" />
              <div className="empty-title">INITIALIZING WAF TELEMETRY</div>
              <div className="empty-desc">Loading perimeter rules, observed sources, and intrusion logs...</div>
            </div>
          </div>
        ) : (
          <>
            {/* VIEW 1: Observed Threat Sources & Containment */}
            {activeTab === 'attackers' && (
          <div className="waf-card-table-wrap">
            <div className="table-responsive">
              <table className="waf-table font-mono">
                <thead>
                  <tr>
                    <th>SOURCE IP</th>
                    <th>SEVERITY</th>
                    <th>OBSERVED VECTORS</th>
                    <th>EVENT COUNT</th>
                    <th>CONTAINMENT STATUS</th>
                    <th>LAST DETECTED</th>
                    <th className="text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttackers.map((source) => {
                    const isActionLoading = actionLoadingIp === source.ip_address;
                    const sev = (source.severity || 'LOW').toUpperCase();

                    return (
                      <tr key={source.ip_address} className="waf-table-row">
                        {/* Source IP */}
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`status-dot dot-${sev.toLowerCase()}`}></span>
                            <span className="ip-text font-bold text-white">{source.ip_address}</span>
                            <button
                              className="btn-copy-sm"
                              onClick={() => handleCopyIp(source.ip_address)}
                              title="Copy IP"
                            >
                              {copiedIp === source.ip_address ? <Check size={11} className="text-green" /> : <Copy size={11} />}
                            </button>
                            {source.is_local && <span className="badge-lan">LAN</span>}
                          </div>
                        </td>

                        {/* Severity */}
                        <td>
                          <span className={`badge-sev badge-${sev.toLowerCase()}`}>
                            {sev}
                          </span>
                        </td>

                        {/* Observed Vectors & Services */}
                        <td>
                          <div className="vectors-chip-wrap">
                            {source.threat_types && source.threat_types.length > 0 ? (
                              source.threat_types.slice(0, 2).map((t, i) => (
                                <span key={i} className="chip-vector">{t}</span>
                              ))
                            ) : source.services && source.services.length > 0 ? (
                              source.services.slice(0, 2).map((s, i) => (
                                <span key={i} className="chip-vector">{s}</span>
                              ))
                            ) : (
                              <span className="text-muted text-xs">Honeypot Decoy</span>
                            )}
                            {(source.threat_types?.length > 2 || source.services?.length > 2) && (
                              <span className="chip-more">+{Math.max(source.threat_types?.length || 0, source.services?.length || 0) - 2}</span>
                            )}
                          </div>
                        </td>

                        {/* Event Count */}
                        <td>
                          <span className="font-bold text-cyan">{source.event_count}</span>
                          <span className="text-muted text-xs ml-1">events</span>
                        </td>

                        {/* Containment Status */}
                        <td>
                          {source.is_blocked ? (
                            <span className="badge-status-blocked">
                              <Lock size={12} />
                              <span>BLOCKED</span>
                            </span>
                          ) : (
                            <span className="badge-status-monitored">
                              <Radio size={12} />
                              <span>MONITORED</span>
                            </span>
                          )}
                        </td>

                        {/* Last Detected */}
                        <td className="text-muted text-xs">
                          {source.last_seen ? source.last_seen.split(' ')[1] || source.last_seen : 'Recent'}
                        </td>

                        {/* Action Controls */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="btn-inspect-sm"
                              onClick={() => {
                                setInspectedItem(source);
                                setInspectedType('attacker');
                              }}
                              title="Inspect threat source dossier"
                            >
                              <Eye size={12} />
                              <span>INSPECT</span>
                            </button>

                            {source.is_blocked ? (
                              <button
                                className={`btn-waf-unblock-sm ${!isAdmin ? 'disabled' : ''}`}
                                onClick={() => handleUnblockObservedSource(source.rule_id, source.ip_address)}
                                disabled={!isAdmin || isActionLoading}
                                title={isAdmin ? "Remove WAF block rule" : "Admin privileges required"}
                              >
                                {isActionLoading ? <RefreshCw size={12} className="animate-spin" /> : <Unlock size={12} />}
                                <span>{isActionLoading ? '...' : 'UNBLOCK'}</span>
                              </button>
                            ) : (
                              <button
                                className={`btn-waf-block-sm ${(!isAdmin || source.is_local) ? 'disabled' : ''}`}
                                onClick={() => handleBlockObservedSource(source.ip_address)}
                                disabled={!isAdmin || source.is_local || isActionLoading}
                                title={
                                  source.is_local
                                    ? "Local RFC 1918 addresses cannot be blocked via perimeter WAF"
                                    : (isAdmin ? "Deploy immediate WAF containment block" : "Admin privileges required")
                                }
                              >
                                {isActionLoading ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
                                <span>{isActionLoading ? '...' : (source.is_local ? 'LAN' : 'BLOCK')}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedAttackers.length === 0 && (
                    <tr>
                      <td colSpan="7" className="empty-table-cell">
                        <div className="empty-state font-mono">
                          <ShieldAlert size={28} className="text-muted mb-2" />
                          <span className="text-white text-sm font-semibold">No Threat Sources Matched</span>
                          <p className="text-muted text-xs mt-1">
                            No source IPs matching the current search query or filter criteria were found.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalAttackerPages > 1 && (
              <div className="waf-pagination font-mono">
                <span className="pagination-info text-muted text-xs">
                  Showing Page <strong className="text-white">{attackersPage}</strong> of <strong className="text-white">{totalAttackerPages}</strong> ({filteredAttackers.length} total)
                </span>
                <div className="pagination-buttons">
                  <button
                    className="btn-page"
                    onClick={() => setAttackersPage(p => Math.max(1, p - 1))}
                    disabled={attackersPage === 1}
                  >
                    <ChevronLeft size={14} />
                    <span>PREV</span>
                  </button>
                  <button
                    className="btn-page"
                    onClick={() => setAttackersPage(p => Math.min(totalAttackerPages, p + 1))}
                    disabled={attackersPage === totalAttackerPages}
                  >
                    <span>NEXT</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Active Policy Rules */}
        {activeTab === 'rules' && (
          <div className="waf-card-table-wrap">
            <div className="table-responsive">
              <table className="waf-table font-mono">
                <thead>
                  <tr>
                    <th>TARGET IP</th>
                    <th>POLICY ACTION</th>
                    <th>RULE TYPE</th>
                    <th>JUSTIFICATION</th>
                    <th>TRIGGERS</th>
                    <th>ATTRIBUTION</th>
                    <th>EXPIRY</th>
                    <th>STATUS</th>
                    <th className="text-right">MANAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRules.map((rule) => {
                    const isEnabled = rule.is_enabled === 1;

                    return (
                      <tr key={rule.id} className={`waf-table-row ${!isEnabled ? 'row-disabled' : ''}`}>
                        {/* Target IP */}
                        <td>
                          <span className="ip-text font-bold text-white">
                            {rule.ip_address || 'GLOBAL (ANY IP)'}
                          </span>
                        </td>

                        {/* Action */}
                        <td>
                          <span className={`badge-action badge-action-${rule.action.toLowerCase()}`}>
                            {rule.action}
                          </span>
                        </td>

                        {/* Rule Type */}
                        <td>
                          <span className="badge-rule-type">{rule.rule_type}</span>
                        </td>

                        {/* Reason */}
                        <td className="rule-reason-cell">
                          <span className="reason-text text-muted" title={rule.reason}>
                            {rule.reason || 'Manual security configuration'}
                          </span>
                        </td>

                        {/* Triggers */}
                        <td>
                          <span className="font-bold text-cyan">{rule.trigger_count}</span>
                        </td>

                        {/* Analyst Attribution */}
                        <td className="text-muted text-xs">
                          {rule.analyst_attribution || 'System'}
                        </td>

                        {/* Expiry */}
                        <td className="text-muted text-xs">
                          {rule.expires_at ? new Date(rule.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Permanent'}
                        </td>

                        {/* Status Toggle */}
                        <td>
                          <button
                            className="btn-toggle-switch"
                            onClick={() => handleToggleRule(rule)}
                            disabled={!isAdmin}
                            title={isEnabled ? "Disable Rule" : "Enable Rule"}
                          >
                            {isEnabled ? (
                              <span className="toggle-label text-green flex items-center gap-1">
                                <ToggleRight size={20} className="text-cyan" />
                                <span>ARMED</span>
                              </span>
                            ) : (
                              <span className="toggle-label text-muted flex items-center gap-1">
                                <ToggleLeft size={20} />
                                <span>MUTED</span>
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Manage Controls */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="btn-edit-sm"
                              onClick={() => handleOpenEdit(rule)}
                              disabled={!isAdmin}
                              title="Edit rule"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className="btn-delete-sm"
                              onClick={() => handleDeleteRule(rule.id)}
                              disabled={!isAdmin}
                              title="Delete rule"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedRules.length === 0 && (
                    <tr>
                      <td colSpan="9" className="empty-table-cell">
                        <div className="empty-state font-mono">
                          <Layers size={28} className="text-muted mb-2" />
                          <span className="text-white text-sm font-semibold">No WAF Rules Configured</span>
                          <p className="text-muted text-xs mt-1">
                            {ruleActionFilter !== 'ALL'
                              ? `No rules match action '${ruleActionFilter}'.`
                              : 'Click "+ Deploy Policy Rule" to create a new perimeter defense rule.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalRulePages > 1 && (
              <div className="waf-pagination font-mono">
                <span className="pagination-info text-muted text-xs">
                  Showing Page <strong className="text-white">{rulesPage}</strong> of <strong className="text-white">{totalRulePages}</strong> ({filteredRules.length} total)
                </span>
                <div className="pagination-buttons">
                  <button
                    className="btn-page"
                    onClick={() => setRulesPage(p => Math.max(1, p - 1))}
                    disabled={rulesPage === 1}
                  >
                    <ChevronLeft size={14} />
                    <span>PREV</span>
                  </button>
                  <button
                    className="btn-page"
                    onClick={() => setRulesPage(p => Math.min(totalRulePages, p + 1))}
                    disabled={rulesPage === totalRulePages}
                  >
                    <span>NEXT</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: Intrusion Timeline Logs (WAF Hits) */}
        {activeTab === 'hits' && (
          <div className="waf-card-table-wrap">
            <div className="table-responsive">
              <table className="waf-table font-mono">
                <thead>
                  <tr>
                    <th>TIMESTAMP</th>
                    <th>SOURCE IP</th>
                    <th>HTTP METHOD</th>
                    <th>INTERCEPT PATH</th>
                    <th>WAF ACTION</th>
                    <th>INSPECTED PAYLOAD</th>
                    <th className="text-right">DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHits.map((hit) => (
                    <tr key={hit.id} className="waf-table-row">
                      {/* Timestamp */}
                      <td className="text-muted text-xs">
                        {formatLocalTime(hit.created_at)}
                      </td>

                      {/* Source IP */}
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="ip-text font-bold text-white">{hit.ip_address}</span>
                          <button
                            className="btn-copy-sm"
                            onClick={() => handleCopyIp(hit.ip_address)}
                            title="Copy IP"
                          >
                            {copiedIp === hit.ip_address ? <Check size={11} className="text-green" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </td>

                      {/* Method */}
                      <td>
                        <span className="badge-method">{hit.method}</span>
                      </td>

                      {/* Path */}
                      <td className="path-cell">
                        <span className="text-cyan font-mono text-xs">{hit.path}</span>
                      </td>

                      {/* Action */}
                      <td>
                        <span className={`badge-action badge-action-${hit.action.toLowerCase()}`}>
                          {hit.action}
                        </span>
                      </td>

                      {/* Payload Snippet */}
                      <td className="payload-cell">
                        {hit.payload ? (
                          <span className="payload-snippet font-mono text-xs text-muted" title={hit.payload}>
                            {hit.payload.slice(0, 48)}{hit.payload.length > 48 ? '...' : ''}
                          </span>
                        ) : (
                          <span className="text-muted text-xs italic">Header / Protocol probe</span>
                        )}
                      </td>

                      {/* Details View */}
                      <td className="text-right">
                        <button
                          className="btn-inspect-sm"
                          onClick={() => {
                            setInspectedItem(hit);
                            setInspectedType('hit');
                          }}
                          title="View complete intrusion intercept payload"
                        >
                          <Eye size={12} />
                          <span>DETAILS</span>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {paginatedHits.length === 0 && (
                    <tr>
                      <td colSpan="7" className="empty-table-cell">
                        <div className="empty-state font-mono">
                          <Activity size={28} className="text-muted mb-2" />
                          <span className="text-white text-sm font-semibold">No WAF Intercepts Recorded</span>
                          <p className="text-muted text-xs mt-1">
                            {hitActionFilter !== 'ALL'
                              ? `No intrusion events match action '${hitActionFilter}'.`
                              : 'Perimeter active defense engine idle. Intrusion events will appear here live.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalHitPages > 1 && (
              <div className="waf-pagination font-mono">
                <span className="pagination-info text-muted text-xs">
                  Showing Page <strong className="text-white">{hitsPage}</strong> of <strong className="text-white">{totalHitPages}</strong> ({filteredHits.length} total)
                </span>
                <div className="pagination-buttons">
                  <button
                    className="btn-page"
                    onClick={() => setHitsPage(p => Math.max(1, p - 1))}
                    disabled={hitsPage === 1}
                  >
                    <ChevronLeft size={14} />
                    <span>PREV</span>
                  </button>
                  <button
                    className="btn-page"
                    onClick={() => setHitsPage(p => Math.min(totalHitPages, p + 1))}
                    disabled={hitsPage === totalHitPages}
                  >
                    <span>NEXT</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* 7. Slide-Out Inspection Drawer */}
      {inspectedItem && (
        <div className="waf-drawer-overlay animate-fade-in" onClick={() => setInspectedItem(null)}>
          <div className="waf-drawer font-mono" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="flex items-center gap-2">
                <Shield className="text-cyan" size={16} />
                <span className="font-bold text-white">
                  {inspectedType === 'attacker' ? 'THREAT SOURCE DOSSIER' : 'INTRUSION INTERCEPT DETAILS'}
                </span>
              </div>
              <button className="btn-close-drawer" onClick={() => setInspectedItem(null)}>
                <X size={15} />
              </button>
            </div>

            <div className="drawer-body">
              {inspectedType === 'attacker' && (
                <div className="drawer-section">
                  <div className="detail-row">
                    <span className="detail-key">Target IP:</span>
                    <span className="detail-val font-bold text-white">{inspectedItem.ip_address}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Severity Level:</span>
                    <span className={`badge-sev badge-${(inspectedItem.severity || 'LOW').toLowerCase()}`}>
                      {(inspectedItem.severity || 'LOW').toUpperCase()}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Containment:</span>
                    <span className={inspectedItem.is_blocked ? 'text-red font-bold' : 'text-amber'}>
                      {inspectedItem.is_blocked ? 'ACTIVE PERIMETER BLOCK' : 'MONITORED ONLY'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Total Ingress Events:</span>
                    <span className="text-cyan font-bold">{inspectedItem.event_count}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">First Observed:</span>
                    <span className="text-muted">{inspectedItem.first_seen || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Last Detected:</span>
                    <span className="text-muted">{inspectedItem.last_seen || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Targeted Services:</span>
                    <span className="text-white">{(inspectedItem.services || []).join(', ') || 'HTTP Honeypot'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Observed Threat Types:</span>
                    <span className="text-white">{(inspectedItem.threat_types || []).join(', ') || 'General scanning'}</span>
                  </div>

                  <div className="drawer-actions mt-4">
                    <button
                      className="btn-drawer-nav"
                      onClick={() => navigate(`/attackers?ip=${encodeURIComponent(inspectedItem.ip_address)}`)}
                    >
                      <ExternalLink size={13} />
                      <span>Investigate in Threat Intelligence</span>
                    </button>
                    <button
                      className="btn-drawer-nav"
                      onClick={() => navigate(`/agent?analyze_attacker=${encodeURIComponent(inspectedItem.ip_address)}`)}
                    >
                      <Sparkles size={13} className="text-cyan" />
                      <span>Analyze with AI Security Agent</span>
                    </button>
                  </div>
                </div>
              )}

              {inspectedType === 'hit' && (
                <div className="drawer-section">
                  <div className="detail-row">
                    <span className="detail-key">Intercept ID:</span>
                    <span className="text-white">{inspectedItem.id}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Source IP:</span>
                    <span className="text-white font-bold">{inspectedItem.ip_address}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">HTTP Request:</span>
                    <span className="text-cyan font-bold">{inspectedItem.method} {inspectedItem.path}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Action Enforced:</span>
                    <span className={`badge-action badge-action-${inspectedItem.action.toLowerCase()}`}>
                      {inspectedItem.action}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">Timestamp:</span>
                    <span className="text-muted">{formatLocalTime(inspectedItem.created_at)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-key">User-Agent:</span>
                    <span className="text-muted text-xs break-all">{inspectedItem.user_agent || 'Unknown'}</span>
                  </div>

                  <div className="mt-3">
                    <span className="detail-key block mb-1">Payload / Request Body:</span>
                    <pre className="payload-full-box font-mono text-xs">
                      {inspectedItem.payload || 'No request body attached (Header or query inspect)'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 8. Add / Edit Rule Modal */}
      {showAddModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="modal-content font-mono" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Shield className="text-cyan" size={16} />
                <h5 className="modal-title font-mono text-white font-bold">
                  {editingRule ? "EDIT WAF POLICY RULE" : "DEPLOY NEW WAF POLICY RULE"}
                </h5>
              </div>
              <button className="close-modal-btn" onClick={() => setShowAddModal(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveRule}>
              <div className="modal-body">
                <div className="form-field-waf">
                  <label>Target IP Address (or leave blank for Global Rule):</label>
                  <input
                    type="text"
                    value={formIp}
                    placeholder="e.g. 198.51.100.12 or leave empty"
                    onChange={(e) => setFormIp(e.target.value)}
                  />
                </div>

                <div className="form-field-waf">
                  <label>Policy Action:</label>
                  <select value={formAction} onChange={(e) => setFormAction(e.target.value)}>
                    <option value="BLOCK">BLOCK (Drop all inbound packets)</option>
                    <option value="QUARANTINE">QUARANTINE (Redirect to sandbox)</option>
                    <option value="ALLOW">ALLOW (Whitelist perimeter traffic)</option>
                  </select>
                </div>

                <div className="form-field-waf">
                  <label>Justification / Reason:</label>
                  <textarea
                    rows="3"
                    value={formReason}
                    placeholder="Enter security justification for this containment policy..."
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
                  <label>Policy Expiration:</label>
                  <select value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)}>
                    <option value="never">Permanent (Never Expire)</option>
                    <option value="1">Expire in 1 Hour</option>
                    <option value="24">Expire in 24 Hours</option>
                    <option value="168">Expire in 7 Days</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  {editingRule ? "Save Rule Updates" : "Deploy Rule Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
