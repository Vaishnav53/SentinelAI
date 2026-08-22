import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import {
  Shield,
  ShieldAlert,
  Skull,
  Cpu,
  MapPin,
  Search,
  Play,
  RefreshCw,
  X,
  Copy,
  Check,
  AlertTriangle,
  Globe,
  Activity,
  Lock,
  Unlock,
  Clock,
  FileText,
  ChevronRight,
  Sparkles,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './AttackerProfiles.css';

const ITEM_HEIGHT = 86; // 78px card height + 8px gap
const OVERSCAN = 5;

// Memoized Dossier Card Row
const DossierRow = React.memo(function DossierRow({
  item,
  isSelected,
  onSelect,
  top
}) {
  const riskLvl = (item.risk_level || item.highest_severity || 'LOW').toUpperCase();
  const score = item.risk_score !== undefined ? item.risk_score : (riskLvl === 'CRITICAL' ? 88 : (riskLvl === 'HIGH' ? 65 : 30));

  return (
    <div
      className={`dossier-card ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: 0,
        right: 0,
        height: '78px',
        boxSizing: 'border-box'
      }}
      onClick={() => onSelect(item.ip_address)}
    >
      <div className="dossier-card-top">
        <div className="ip-block">
          <span className="ip-text font-mono">{item.ip_address}</span>
          {item.is_local && <span className="badge-local font-mono">LAN</span>}
        </div>

        <div className="badges-group">
          <span className={`risk-badge ${riskLvl.toLowerCase()} font-mono`}>
            {riskLvl}
          </span>
          <span className={`contain-badge ${item.is_blocked ? 'blocked' : 'monitored'} font-mono`}>
            {item.is_blocked ? 'BLOCKED' : 'MONITORED'}
          </span>
        </div>
      </div>

      <div className="dossier-card-meta font-mono">
        <div className="meta-row">
          <span className="meta-k">Location:</span>
          <span className="meta-v text-muted">{item.city ? `${item.city}, ${item.country}` : (item.country || 'Unknown')}</span>
        </div>
        <div className="meta-row">
          <span className="meta-k">Events:</span>
          <span className="meta-v text-cyan font-bold">{item.total_events || (item.attack_count + item.waf_count + item.sandbox_count)}</span>
        </div>
      </div>

      <div className="dossier-card-footer font-mono">
        <span className="score-label">Risk Score: <strong className={riskLvl === 'CRITICAL' ? 'text-red' : (riskLvl === 'HIGH' ? 'text-orange' : 'text-cyan')}>{score}/100</strong></span>
        {item.last_seen && (
          <span className="time-label text-muted" title={item.last_seen}>
            <Clock size={10} className="inline mr-1" />
            {new Date(item.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
});

// Virtualized List Component
function VirtualDossierList({ items, selectedIp, onSelect }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);

  // Measure container height dynamically
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
  const totalHeight = totalCount * ITEM_HEIGHT;

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN);

  const visibleSlice = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, idx) => ({
      item,
      index: startIndex + idx,
      top: (startIndex + idx) * ITEM_HEIGHT
    }));
  }, [items, startIndex, endIndex]);

  return (
    <div
      className="dossier-list-scroll"
      ref={containerRef}
      onScroll={handleScroll}
      style={{ position: 'relative', overflowY: 'auto', flex: 1 }}
    >
      {totalCount === 0 ? (
        <div className="empty-search-state font-mono">
          <AlertTriangle size={20} className="text-muted mb-2" />
          <span className="text-white text-xs font-semibold">No Matching Attacker Dossiers</span>
          <p className="text-muted text-xxs mt-1">
            No records match the query. Try searching by IP or threat tag.
          </p>
        </div>
      ) : (
        <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
          {visibleSlice.map(({ item, top }) => (
            <DossierRow
              key={item.ip_address}
              item={item}
              isSelected={selectedIp === item.ip_address}
              onSelect={onSelect}
              top={top}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AttackerProfiles() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Core data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attackers, setAttackers] = useState([]);
  const [selectedIp, setSelectedIp] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [playbooks, setPlaybooks] = useState([]);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('');
  const [executingPlaybook, setExecutingPlaybook] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);

  // Search & Filter (Immediate input state + deferred query for background filtering)
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Clipboard copy feedback
  const [copiedIp, setCopiedIp] = useState(false);

  // WAF Blocking action states
  const [blockingAction, setBlockingAction] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // AI Analysis Modal / Drawer state (Triggered explicitly ONLY on user click)
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [copiedAiReport, setCopiedAiReport] = useState(false);

  // Selected IP ref to preserve across background polling
  const selectedIpRef = useRef(selectedIp);
  useEffect(() => {
    selectedIpRef.current = selectedIp;
  }, [selectedIp]);

  // Fetch all attackers list
  const fetchList = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setRefreshing(true);
      const listData = await apiClient.get('/attacker/profiles');
      const safeList = Array.isArray(listData) ? listData : [];
      setAttackers(safeList);

      // Selection preservation & fallback
      if (safeList.length > 0) {
        const currentIp = selectedIpRef.current;
        if (!currentIp || !safeList.some(a => a.ip_address === currentIp)) {
          setSelectedIp(safeList[0].ip_address);
        }
      } else {
        setSelectedIp(null);
        setProfile(null);
      }
    } catch (err) {
      console.error("Failed to load attacker list:", err);
    } finally {
      if (!isBackground) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Fetch detailed profile for selected IP
  const fetchProfile = useCallback(async (ip, isSilent = false) => {
    if (!ip) {
      setProfile(null);
      return;
    }
    try {
      if (!isSilent) setProfileLoading(true);
      const detail = await apiClient.get(`/attacker/profiles/${ip}`);
      setProfile(detail);
    } catch (err) {
      console.error(`Failed to load profile for ${ip}:`, err);
      if (!isSilent) setProfile(null);
    } finally {
      if (!isSilent) setProfileLoading(false);
    }
  }, []);

  // Fetch available playbooks
  const fetchPlaybooks = useCallback(async () => {
    try {
      const data = await apiClient.get('/playbooks');
      const safePlaybooks = Array.isArray(data) ? data : [];
      setPlaybooks(safePlaybooks);
      if (safePlaybooks.length > 0 && !selectedPlaybookId) {
        setSelectedPlaybookId(safePlaybooks[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to load playbooks list:", err);
    }
  }, [selectedPlaybookId]);

  // Initial load
  useEffect(() => {
    fetchList();
    fetchPlaybooks();

    // 8-second background polling without destroying UI state
    let isPolling = false;
    const interval = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        await fetchList(true);
        if (selectedIpRef.current) {
          await fetchProfile(selectedIpRef.current, true);
        }
      } finally {
        isPolling = false;
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchList, fetchProfile, fetchPlaybooks]);

  // When selected IP changes, fetch fresh details and reset transient logs
  useEffect(() => {
    if (selectedIp) {
      fetchProfile(selectedIp);
      setExecutionLogs([]);
      setActionError(null);
      setActionSuccess(null);
    }
  }, [selectedIp, fetchProfile]);

  // Copy IP address
  const handleCopyIp = useCallback((ipToCopy) => {
    if (!ipToCopy) return;
    navigator.clipboard.writeText(ipToCopy);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  }, []);

  // Selection handler passed to memoized rows
  const handleSelectDossier = useCallback((ip) => {
    setSelectedIp(ip);
  }, []);

  // Execute Playbook workflow
  const handleExecutePlaybook = async () => {
    if (!selectedPlaybookId || !selectedIp) return;
    try {
      setExecutingPlaybook(true);
      setExecutionLogs([{ step: 'INITIATING', status: 'RUNNING', message: 'Starting orchestrator workflow execution thread...' }]);

      const res = await apiClient.post(`/playbooks/execute/${selectedPlaybookId}`, {
        target_ip: selectedIp
      });

      if (res.logs_data) {
        try {
          const parsed = JSON.parse(res.logs_data);
          setExecutionLogs(parsed);
        } catch {
          setExecutionLogs([{ step: 'COMPLETED', status: 'SUCCESS', message: 'Playbook execution completed.' }]);
        }
      }

      await Promise.all([fetchProfile(selectedIp, true), fetchList(true)]);
    } catch (err) {
      console.error("Playbook execution failed:", err);
      setExecutionLogs(prev => [...prev, { step: 'SYSTEM_ERROR', status: 'FAILED', message: `Execution failed: ${err.message || err}` }]);
    } finally {
      setExecutingPlaybook(false);
    }
  };

  // Block or Unblock IP via real WAF backend APIs
  const handleToggleBlock = async () => {
    if (!profile || !profile.ip_address) return;
    if (!isAdmin) {
      setActionError("Administrator privileges required to manage WAF containment rules.");
      return;
    }
    if (profile.is_local) {
      setActionError("Local loopback and private RFC 1918 network addresses cannot be blocked via perimeter WAF.");
      return;
    }

    try {
      setBlockingAction(true);
      setActionError(null);
      setActionSuccess(null);

      if (profile.is_blocked) {
        let ruleIdToDelete = profile.waf_rule_id;
        if (!ruleIdToDelete) {
          const rules = await apiClient.get('/waf/rules');
          const matched = rules.find(r => r.ip_address === profile.ip_address && r.action === 'BLOCK' && r.is_enabled === 1);
          if (matched) ruleIdToDelete = matched.id;
        }

        if (ruleIdToDelete) {
          await apiClient.delete(`/waf/rules/${ruleIdToDelete}`);
          setActionSuccess(`WAF Block successfully removed for ${profile.ip_address}`);
        } else {
          throw new Error("Active WAF rule not found for target IP.");
        }
      } else {
        await apiClient.post('/waf/rules', {
          ip_address: profile.ip_address,
          action: 'BLOCK',
          reason: 'Manual containment enforcement from Threat Intelligence dossier',
          is_enabled: 1,
          analyst_attribution: user?.username || 'SOC Lead'
        });
        setActionSuccess(`Active WAF containment block deployed for ${profile.ip_address}`);
      }

      await Promise.all([fetchProfile(profile.ip_address, true), fetchList(true)]);
    } catch (err) {
      console.error("WAF Action failed:", err);
      setActionError(err.message || "Failed to update WAF rule state.");
    } finally {
      setBlockingAction(false);
      setTimeout(() => {
        setActionSuccess(null);
        setActionError(null);
      }, 5000);
    }
  };

  // Explicit AI Analysis trigger (runs ONLY upon button click)
  const handleAnalyzeWithAI = async () => {
    if (!profile || !profile.ip_address || aiLoading) return;
    try {
      setAiLoading(true);
      setAiError(null);
      setAiAnalysis(null);
      setAiModalOpen(true);

      const prompt = `Conduct a comprehensive Threat Intelligence Assessment for attacker IP ${profile.ip_address} (Location: ${profile.city}, ${profile.country}, ASN: ${profile.asn || 'N/A'}). Total events recorded: ${profile.total_events || profile.attack_count}. Observed threat vectors: ${(profile.attack_types || []).join(', ') || 'General scanning'}. Targeted endpoints: ${(profile.targeted_paths || []).slice(0, 5).join(', ') || 'N/A'}. Evaluate risk score, attack pattern progression, MITRE tactics, and recommend containment.`;

      const response = await apiClient.post('/agent/chat', {
        message: prompt,
        model: 'openai/gpt-oss-120b',
        response_mode: 'security_analysis',
        context: {
          attacker_ip: profile.ip_address
        }
      });

      if (response && response.message) {
        setAiAnalysis(response);
      } else {
        throw new Error("No analysis response returned from AI service.");
      }
    } catch (err) {
      console.error("AI Analysis failed:", err);
      setAiError(err.message || "Failed to generate AI Threat Assessment. Verify Groq connectivity or retry.");
    } finally {
      setAiLoading(false);
    }
  };

  // Copy AI Report
  const handleCopyAiReport = useCallback(() => {
    if (!aiAnalysis?.message) return;
    navigator.clipboard.writeText(aiAnalysis.message);
    setCopiedAiReport(true);
    setTimeout(() => setCopiedAiReport(false), 2000);
  }, [aiAnalysis]);

  // Memoized Filtered Attackers List (using deferred search query for lag-free typing)
  const filteredAttackers = useMemo(() => {
    const q = deferredSearchQuery.toLowerCase().trim();
    if (!q) return attackers;

    return attackers.filter(a => {
      const ipMatch = (a.ip_address || '').toLowerCase().includes(q);
      const countryMatch = (a.country || '').toLowerCase().includes(q);
      const cityMatch = (a.city || '').toLowerCase().includes(q);
      const typesMatch = (a.attack_types || []).some(t => t.toLowerCase().includes(q));
      const tagsMatch = (a.tags || []).some(t => t.toLowerCase().includes(q));
      const sevMatch = (a.highest_severity || '').toLowerCase().includes(q) || (a.risk_level || '').toLowerCase().includes(q);
      return ipMatch || countryMatch || cityMatch || typesMatch || tagsMatch || sevMatch;
    });
  }, [attackers, deferredSearchQuery]);

  // Memoized KPI metrics calculation
  const { totalDossiers, highRiskCount, totalEventsSum, activeBlockedCount } = useMemo(() => {
    let highRisk = 0;
    let totalEvents = 0;
    let activeBlocked = 0;
    for (let i = 0; i < attackers.length; i++) {
      const a = attackers[i];
      const r = (a.risk_level || a.highest_severity || '').toUpperCase();
      if (r === 'CRITICAL' || r === 'HIGH') highRisk++;
      totalEvents += (a.total_events || (a.attack_count + a.waf_count + a.sandbox_count) || 0);
      if (a.is_blocked) activeBlocked++;
    }
    return {
      totalDossiers: attackers.length,
      highRiskCount: highRisk,
      totalEventsSum: totalEvents,
      activeBlockedCount: activeBlocked
    };
  }, [attackers]);

  return (
    <div className="threat-intel-root">
      {/* 1. Header & Page Subtitle */}
      <div className="threat-intel-header-row">
        <div>
          <h2 className="threat-intel-title font-mono title-cyber">
            <Globe size={18} className="text-cyan inline mr-2" />
            THREAT INTELLIGENCE
          </h2>
          <div className="threat-intel-subtitle font-mono">
            Real-time attacker profiling, telemetry aggregation, and threat correlation
          </div>
        </div>

        <div className="header-actions-group">
          <button
            className="btn-threat-refresh font-mono"
            onClick={() => fetchList(false)}
            disabled={refreshing}
            title="Refresh Attacker Telemetry"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'SYNCING...' : 'REFRESH'}</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Real-Data KPI Strip */}
      <div className="threat-kpi-strip">
        <div className="threat-kpi-card">
          <span className="kpi-label">TRACKED ATTACKERS</span>
          <div className="kpi-val-row">
            <span className="kpi-val text-white">{totalDossiers.toLocaleString()}</span>
            <Skull size={14} className="text-cyan" />
          </div>
        </div>

        <div className="threat-kpi-card">
          <span className="kpi-label">HIGH / CRITICAL RISK</span>
          <div className="kpi-val-row">
            <span className="kpi-val text-red">{highRiskCount.toLocaleString()}</span>
            <AlertTriangle size={14} className="text-red" />
          </div>
        </div>

        <div className="threat-kpi-card">
          <span className="kpi-label">TOTAL THREAT EVENTS</span>
          <div className="kpi-val-row">
            <span className="kpi-val text-cyan">{totalEventsSum.toLocaleString()}</span>
            <Activity size={14} className="text-cyan" />
          </div>
        </div>

        <div className="threat-kpi-card">
          <span className="kpi-label">ACTIVE WAF BLOCKS</span>
          <div className="kpi-val-row">
            <span className="kpi-val text-orange">{activeBlockedCount.toLocaleString()}</span>
            <ShieldAlert size={14} className="text-orange" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="threat-filter-bar card-cyber">
        <div className="search-box">
          <Search size={14} className="search-icon text-muted" />
          <input
            type="text"
            placeholder="Search by IP, country, location, attack vector, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')} title="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="filter-count font-mono text-muted text-xxs">
          Showing {filteredAttackers.length.toLocaleString()} of {totalDossiers.toLocaleString()} records
        </div>
      </div>

      {/* 4. Main Two-Panel Layout */}
      {attackers.length === 0 && !loading ? (
        <div className="empty-attacker-container card-cyber animate-slide-in">
          <div className="empty-attacker-header font-mono text-cyan">
            <Skull size={18} />
            <span>Telemetry Attacker Dossier Hub</span>
          </div>
          <div className="empty-attacker-content mt-3">
            <div className="attacker-guide-left font-mono">
              <h4 className="text-white">Waiting for Attacker IP Attributions...</h4>
              <p className="text-muted mt-2" style={{ fontSize: '11px', lineHeight: '1.7' }}>
                Attacker Profiles act as dynamic threat dossiers, collecting telemetry events from repeated honeypot probes, login bypass attempts, WAF intercepts, and malicious uploads associated with a source IP.
              </p>
              <h5 className="text-cyan mt-3 font-semibold">Real Telemetry Sources:</h5>
              <ul className="text-muted mt-2" style={{ fontSize: '11px', lineHeight: '1.7' }}>
                <li>Honeypot Sensor attack events &amp; payload captures.</li>
                <li>Aetheris portal authentication &amp; feedback telemetry.</li>
                <li>WAF rule triggers and perimeter intercept logs.</li>
                <li>Decoy sandbox payload inspection results.</li>
              </ul>
            </div>
            <div className="attacker-guide-right font-mono">
              <div className="attacker-preview-card">
                <div className="text-white text-xs font-semibold mb-2">DYNAMIC INTELLIGENCE METRICS</div>
                <div className="attacker-dossier-items-list">
                  <div className="attacker-dossier-step-row">
                    <div className="dossier-badge">1</div>
                    <span className="text-secondary">MITRE ATT&CK Indicator &amp; Technique matching</span>
                  </div>
                  <div className="attacker-dossier-step-row">
                    <div className="dossier-badge">2</div>
                    <span className="text-secondary">Deterministic SentinelAI Risk Assessment calculation</span>
                  </div>
                  <div className="attacker-dossier-step-row">
                    <div className="dossier-badge">3</div>
                    <span className="text-secondary">Direct WAF Active Defense Containment controls</span>
                  </div>
                  <div className="attacker-dossier-step-row">
                    <div className="dossier-badge">4</div>
                    <span className="text-secondary">Consult GPT-OSS 120B AI Security Copilot</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="threat-main-grid">
          {/* LEFT PANEL: Virtualized Telemetry Attacker Dossiers List */}
          <div className="threat-panel card-cyber dossiers-list-panel">
            <div className="panel-header">
              <div className="flex items-center gap-2">
                <Skull size={14} className="text-cyan" />
                <h5 className="panel-title font-mono">TELEMETRY ATTACKER DOSSIERS</h5>
              </div>
              <span className="badge-count font-mono">{filteredAttackers.length.toLocaleString()}</span>
            </div>

            <VirtualDossierList
              items={filteredAttackers}
              selectedIp={selectedIp}
              onSelect={handleSelectDossier}
            />
          </div>

          {/* RIGHT PANEL: Dossier Details */}
          <div className="threat-panel card-cyber dossier-detail-panel">
            {profileLoading ? (
              <div className="detail-loading-state font-mono">
                <div className="spinner-border animate-spin mb-3"></div>
                <span className="text-cyan text-xs">SYNCHRONIZING_DOSSIER_TELEMETRY...</span>
              </div>
            ) : profile ? (
              <div className="dossier-detail-view animate-fade-in">
                {/* Banner Header */}
                <div className="detail-top-banner">
                  <div className="banner-left">
                    <div className="ip-heading-row">
                      <h3 className="detail-ip font-mono text-cyan">{profile.ip_address}</h3>
                      <button
                        className="btn-icon-copy"
                        onClick={() => handleCopyIp(profile.ip_address)}
                        title="Copy IP Address"
                      >
                        {copiedIp ? <Check size={13} className="text-green" /> : <Copy size={13} />}
                      </button>
                      <span className={`badge-risk-banner ${(profile.risk_level || profile.highest_severity || 'LOW').toLowerCase()} font-mono`}>
                        {profile.risk_level || profile.highest_severity || 'LOW'} RISK · {profile.risk_score || (profile.highest_severity === 'CRITICAL' ? 88 : 45)}/100
                      </span>
                    </div>

                    <div className="location-asn-row font-mono text-muted text-xxs mt-1">
                      <MapPin size={11} className="text-cyan" />
                      <span>{profile.city}, {profile.country} {profile.latitude && profile.longitude ? `(${profile.latitude.toFixed(2)}, ${profile.longitude.toFixed(2)})` : ''}</span>
                      <span className="divider">•</span>
                      <Globe size={11} className="text-cyan" />
                      <span>ASN: {profile.asn || (profile.is_local ? 'Local Infrastructure' : 'N/A')}</span>
                      <span className="divider">•</span>
                      <span className={profile.is_blocked ? 'text-red font-bold' : 'text-orange font-bold'}>
                        {profile.is_blocked ? (profile.waf_rule_id ? `BLOCKED (WAF RULE #${profile.waf_rule_id})` : 'BLOCKED') : 'MONITORED'}
                      </span>
                    </div>

                    {/* Action Feedback Messages */}
                    {actionSuccess && (
                      <div className="action-feedback-box success font-mono mt-2">
                        <Check size={12} />
                        <span>{actionSuccess}</span>
                      </div>
                    )}
                    {actionError && (
                      <div className="action-feedback-box error font-mono mt-2">
                        <AlertTriangle size={12} />
                        <span>{actionError}</span>
                      </div>
                    )}
                  </div>

                  {/* 3 Real Action Buttons */}
                  <div className="banner-actions-group font-mono">
                    {/* Action 1: Investigate */}
                    <button
                      className="btn-action btn-investigate"
                      onClick={() => navigate(`/agent?analyze_attacker=${profile.ip_address}`)}
                      title="Open dedicated investigation session in AI Assistant"
                    >
                      <Cpu size={13} />
                      <span>Investigate</span>
                    </button>

                    {/* Action 2: Block IP */}
                    <button
                      className={`btn-action ${profile.is_blocked ? 'btn-unblock' : 'btn-block'}`}
                      onClick={handleToggleBlock}
                      disabled={blockingAction || profile.is_local || !isAdmin}
                      title={
                        profile.is_local
                          ? "Local RFC 1918 addresses cannot be blocked via perimeter WAF"
                          : (!isAdmin ? "Administrator privileges required" : (profile.is_blocked ? "Remove WAF containment block" : "Deploy immediate WAF containment block"))
                      }
                    >
                      {blockingAction ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : profile.is_blocked ? (
                        <Unlock size={13} />
                      ) : (
                        <Lock size={13} />
                      )}
                      <span>
                        {blockingAction ? 'UPDATING...' : (profile.is_local ? 'LAN IP' : (profile.is_blocked ? 'Unblock IP' : 'Block IP'))}
                      </span>
                    </button>

                    {/* Action 3: Analyze with AI */}
                    <button
                      className="btn-action btn-ai-analyze"
                      onClick={handleAnalyzeWithAI}
                      disabled={aiLoading}
                      title="Generate on-demand threat intelligence assessment with GPT-OSS 120B"
                    >
                      <Sparkles size={13} className="text-cyan" />
                      <span>{aiLoading ? 'Analyzing...' : 'Analyze with AI'}</span>
                    </button>
                  </div>
                </div>

                {/* Metric Strip Overview */}
                <div className="dossier-metrics-grid font-mono mt-3">
                  <div className="dossier-metric-box">
                    <span className="m-title">TOTAL EVENTS</span>
                    <span className="m-val text-white">{profile.total_events || profile.attack_count + profile.waf_count + profile.sandbox_count}</span>
                  </div>
                  <div className="dossier-metric-box">
                    <span className="m-title">FIRST SEEN</span>
                    <span className="m-val text-muted text-xxs">
                      {profile.first_seen ? new Date(profile.first_seen).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unavailable'}
                    </span>
                  </div>
                  <div className="dossier-metric-box">
                    <span className="m-title">LAST SEEN</span>
                    <span className="m-val text-cyan text-xxs">
                      {profile.last_seen ? new Date(profile.last_seen).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Unavailable'}
                    </span>
                  </div>
                  <div className="dossier-metric-box">
                    <span className="m-title">ASSESSMENT SOURCE</span>
                    <span className="m-val text-orange text-xxs">SentinelAI Engine</span>
                  </div>
                </div>

                {/* Observed Threat Vectors & Targeted Endpoints */}
                <div className="detail-section-grid mt-3">
                  <div className="detail-subcard font-mono">
                    <span className="subcard-title">
                      <Layers size={12} className="text-cyan inline mr-1" />
                      OBSERVED ATTACK VECTORS
                    </span>
                    <div className="tags-container mt-2">
                      {(profile.attack_types && profile.attack_types.length > 0) ? (
                        profile.attack_types.map((type, idx) => (
                          <span key={idx} className="attack-vector-tag font-mono">
                            {type}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted text-xxs">No specialized attack signatures logged yet.</span>
                      )}
                    </div>
                  </div>

                  <div className="detail-subcard font-mono">
                    <span className="subcard-title">
                      <Globe size={12} className="text-cyan inline mr-1" />
                      TARGETED SERVICES &amp; PATHS
                    </span>
                    <div className="paths-container mt-2">
                      {(profile.targeted_paths && profile.targeted_paths.length > 0) ? (
                        profile.targeted_paths.slice(0, 6).map((path, idx) => (
                          <div key={idx} className="path-row text-muted text-xxs">
                            <ChevronRight size={10} className="text-cyan inline mr-1" />
                            <span className="path-text text-white">{path}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-muted text-xxs">No path telemetry recorded.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Evidence Samples: Payloads & User Agents */}
                {((profile.payload_samples && profile.payload_samples.length > 0) || (profile.user_agents && profile.user_agents.length > 0)) && (
                  <div className="detail-subcard font-mono mt-3">
                    <span className="subcard-title">
                      <FileText size={12} className="text-cyan inline mr-1" />
                      CAPTURED PAYLOAD &amp; TELEMETRY EVIDENCE
                    </span>
                    <div className="evidence-box-scroll mt-2">
                      {profile.payload_samples && profile.payload_samples.map((payload, idx) => (
                        <div key={idx} className="evidence-item">
                          <span className="evidence-label text-cyan text-xxxs">PAYLOAD SAMPLE #{idx + 1}</span>
                          <pre className="evidence-code">{payload}</pre>
                        </div>
                      ))}
                      {profile.user_agents && profile.user_agents.map((ua, idx) => (
                        <div key={idx} className="evidence-item">
                          <span className="evidence-label text-purple text-xxxs">USER AGENT #{idx + 1}</span>
                          <div className="evidence-text text-muted text-xxs">{ua}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* MITRE ATT&CK Indicators */}
                <div className="mt-3">
                  <h5 className="section-title font-mono mb-2">MITRE ATT&CK Indicators</h5>
                  <div className="mitre-cards-grid">
                    {profile.mitre_techniques && profile.mitre_techniques.map((t) => (
                      <div key={t.id} className="mitre-card font-mono">
                        <span className="t-id">{t.id}</span>
                        <span className="t-name">{t.name}</span>
                        <span className="t-tactic text-muted">{t.tactic}</span>
                        <div className="t-count badge-cyan mt-1">{t.count} match events</div>
                      </div>
                    ))}
                    {(!profile.mitre_techniques || profile.mitre_techniques.length === 0) && (
                      <div className="empty-small font-mono text-muted">
                        No technique patterns registered yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Response Playbook Widget */}
                <div className="playbook-widget card-cyber mt-3">
                  <h5 className="panel-title font-mono text-orange mb-2">Automated Threat Mitigation Playbooks</h5>
                  <div className="playbook-launcher-row mt-2">
                    <select
                      value={selectedPlaybookId}
                      onChange={(e) => setSelectedPlaybookId(e.target.value)}
                      disabled={executingPlaybook}
                    >
                      {playbooks.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      className="btn-run-playbook"
                      onClick={handleExecutePlaybook}
                      disabled={executingPlaybook || !selectedPlaybookId}
                    >
                      <Play size={12} />
                      <span>Run Playbook Workflow</span>
                    </button>
                  </div>

                  {/* Execution Logs */}
                  {executionLogs.length > 0 && (
                    <div className="playbook-logs-container mt-3 font-mono">
                      <div className="logs-title">Execution Console Output:</div>
                      <div className="logs-list">
                        {executionLogs.map((log, idx) => (
                          <div key={idx} className="log-line">
                            <span className="log-time text-muted">[{new Date(log.time || Date.now()).toLocaleTimeString()}]</span>
                            <span className={`log-step ${log.status === 'FAILED' ? 'text-red' : 'text-cyan'}`}>[{log.step}]</span>
                            <span className="log-msg"> {log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chronological Threat Activity Timeline */}
                <div className="timeline-block mt-3">
                  <h5 className="section-title font-mono mb-2">Chronological Threat Activity Timeline</h5>
                  <div className="campaign-timeline">
                    {profile.timeline && profile.timeline.map((item, index) => (
                      <div key={index} className="timeline-item">
                        <div className="timeline-marker"></div>
                        <div className="timeline-content">
                          <div className="flex justify-between items-center">
                            <span className="time-lbl font-mono text-muted">{new Date(item.time).toLocaleString()}</span>
                            <span className={`badge badge-${(item.severity || 'LOW').toLowerCase()}`}>{item.severity || 'LOW'}</span>
                          </div>
                          <p className="desc-text font-mono text-xs mt-1">{item.description}</p>
                          {item.path && (
                            <div className="timeline-path-tag font-mono text-xxs text-muted mt-1">
                              Target: <span className="text-cyan">{item.path}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!profile.timeline || profile.timeline.length === 0) && (
                      <div className="empty-small font-mono text-muted">No chronological timeline entries available.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-dossier-selected font-mono">
                <Skull size={32} className="text-muted mb-2" />
                <span className="text-white text-xs font-semibold">No Attacker Selected</span>
                <p className="text-muted text-xxs mt-1">
                  Select an attacker dossier to inspect correlated threat activity.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Explicit AI Threat Assessment Modal */}
      {aiModalOpen && (
        <div className="ai-modal-overlay animate-fade-in" onClick={() => setAiModalOpen(false)}>
          <div className="ai-modal-box card-cyber" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan animate-pulse" />
                <h4 className="modal-title font-mono title-cyber">
                  AI THREAT ASSESSMENT · {profile?.ip_address}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="ai-model-badge font-mono">GPT-OSS 120B</span>
                <button className="modal-close-btn" onClick={() => setAiModalOpen(false)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="ai-modal-body font-mono">
              {aiLoading ? (
                <div className="ai-modal-loading text-center py-8">
                  <div className="spinner-border animate-spin mb-3"></div>
                  <div className="text-white text-xs font-semibold">Synthesizing Attacker Dossier Intelligence...</div>
                  <p className="text-muted text-xxs mt-1">
                    Evaluating attack chains, payload signatures, and containment recommendations with GPT-OSS 120B.
                  </p>
                </div>
              ) : aiError ? (
                <div className="ai-modal-error text-center py-6 text-red">
                  <AlertTriangle size={24} className="mx-auto mb-2" />
                  <div className="text-xs font-bold">AI Analysis Failed</div>
                  <p className="text-muted text-xxs mt-1">{aiError}</p>
                  <button className="btn-action btn-investigate mt-3 mx-auto" onClick={handleAnalyzeWithAI}>
                    Retry Analysis
                  </button>
                </div>
              ) : aiAnalysis ? (
                <div className="ai-modal-report animate-slide-in">
                  <div className="report-markdown-content">
                    {aiAnalysis.message}
                  </div>
                  <div className="report-meta-footer mt-3 flex justify-between items-center text-xxs text-muted">
                    <span>Generated in {aiAnalysis.latency ? aiAnalysis.latency.toFixed(2) : '1.2'}s · Model: {aiAnalysis.model || 'GPT-OSS 120B'}</span>
                    <button className="btn-copy-report" onClick={handleCopyAiReport}>
                      {copiedAiReport ? <Check size={12} className="text-green inline mr-1" /> : <Copy size={12} className="inline mr-1" />}
                      <span>{copiedAiReport ? 'Copied' : 'Copy Report'}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ai-modal-footer font-mono">
              <button className="btn-threat-secondary" onClick={() => setAiModalOpen(false)}>
                Close
              </button>
              <button
                className="btn-action btn-investigate"
                onClick={() => {
                  setAiModalOpen(false);
                  navigate(`/agent?analyze_attacker=${profile?.ip_address}`);
                }}
              >
                <Cpu size={13} />
                <span>Open in AI Assistant</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
