import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Activity, 
  Radio, 
  Terminal, 
  FileText, 
  Server,
  AlertTriangle,
  Menu,
  X,
  Clock,
  ShieldAlert,
  Globe,
  LogOut,
  User,
  ChevronDown
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatLocalTime } from '../utils/dateUtils';
import { getAttackWebSocketUrl } from '../utils/wsUtils';
import './DashboardLayout.css';


export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);


  const [backendStatus, setBackendStatus] = useState('CHECKING');
  const [groqStatus, setGroqStatus] = useState('CHECKING');
  const [honeypotStatus, setHoneypotStatus] = useState('CHECKING');
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const location = useLocation();

  // Automatically close logout confirmation modal on route changes
  useEffect(() => {
    setShowLogoutModal(false);
  }, [location.pathname]);


  // Notification SOC center hooks
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [thresholds, setThresholds] = useState({ severity: 'HIGH', score: 70.0 });

  // Clock Widget timer
  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userMenuRef = useRef(null);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format Date for Clock matching reference: e.g. Mon, Sep 14, 2026
  const formatDate = (date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Format Time for Clock matching reference: e.g. 12:08:49 PM
  const formatTime = (date) => {
    let hrs = date.getHours();
    let mins = date.getMinutes();
    let secs = date.getSeconds();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    mins = mins < 10 ? '0' + mins : mins;
    secs = secs < 10 ? '0' + secs : secs;
    return `${hrs}:${mins}:${secs} ${ampm}`;
  };

  // Query health and status indicators dynamically
  const checkStatus = async () => {
    try {
      const [health, hpStatus, systemMetrics] = await Promise.all([
        apiClient.get('/health/services'),
        apiClient.get('/honeypot/status'),
        apiClient.get('/monitoring/current')
      ]);
      setBackendStatus(health.database.status === 'ONLINE' ? 'ONLINE' : 'DEGRADED');
      setGroqStatus(health.groq ? health.groq.status : 'ONLINE');
      setHoneypotStatus(hpStatus.status);
      setCpuUsage(systemMetrics.cpu_percent);
      setMemoryUsage(systemMetrics.memory_percent);
    } catch (e) {
      setBackendStatus('OFFLINE');
      setGroqStatus('UNAVAILABLE');
      setHoneypotStatus('OFFLINE');
    }
  };

  useEffect(() => {
    checkStatus();
    // Efficient 7 second background polling refresh
    const interval = setInterval(checkStatus, 7000);
    return () => clearInterval(interval);
  }, []);

  // Load configured thresholds
  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const data = await apiClient.get('/settings');
        setThresholds({
          severity: data.alert_severity_threshold || 'HIGH',
          score: parseFloat(data.alert_score_threshold || 70.0)
        });
      } catch (e) {
        console.warn("Failed to fetch settings thresholds:", e);
      }
    };
    fetchThresholds();
  }, [location.pathname]);

  // WebSocket live alerts alerts connector
  useEffect(() => {
    const wsUrl = getAttackWebSocketUrl();
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_attack') {
          const attack = payload.data;
          
          const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
          const threshIdx = severities.indexOf(thresholds.severity.toUpperCase());
          const attackIdx = severities.indexOf(attack.severity.toUpperCase());
          
          const matchesSeverity = attackIdx >= (threshIdx === -1 ? 2 : threshIdx);
          const matchesScore = attack.threat_score >= thresholds.score;

          if (matchesSeverity || matchesScore) {
            setToasts(prev => {
              if (prev.some(t => t.id === attack.id)) return prev;
              return [attack, ...prev].slice(0, 3);
            });
            
            setUnreadCount(prev => prev + 1);
            setNotifications(prev => {
              if (prev.some(n => n.id === attack.id)) return prev;
              return [attack, ...prev].slice(0, 10);
            });

            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== attack.id));
            }, 6000);
          }
        } else if (payload.type === 'waf_rule_created') {
          const rule = payload.data;
          const wafToast = {
            id: `WAF-${rule.id}`,
            attack_type: "AUTO WAF BLOCK INITIATED",
            severity: "CRITICAL",
            threat_score: 10.0,
            source_ip: rule.ip_address || "Global",
            created_at: rule.created_at
          };
          
          setToasts(prev => {
            if (prev.some(t => t.id === wafToast.id)) return prev;
            return [wafToast, ...prev].slice(0, 3);
          });
          setUnreadCount(prev => prev + 1);
          setNotifications(prev => {
            if (prev.some(n => n.id === wafToast.id)) return prev;
            return [wafToast, ...prev].slice(0, 10);
          });
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== wafToast.id));
          }, 6000);
        } else if (payload.type === 'new_correlated_incident') {
          const incident = payload.data;
          const correlationToast = {
            id: `COR-${incident.id}`,
            attack_type: "CORRELATED ATTACK CHAIN MATCH",
            severity: incident.severity || "HIGH",
            threat_score: incident.confidence * 10.0,
            source_ip: "Security Operations Center",
            created_at: incident.created_at
          };
          
          setToasts(prev => {
            if (prev.some(t => t.id === correlationToast.id)) return prev;
            return [correlationToast, ...prev].slice(0, 3);
          });
          setUnreadCount(prev => prev + 1);
          setNotifications(prev => {
            if (prev.some(n => n.id === correlationToast.id)) return prev;
            return [correlationToast, ...prev].slice(0, 10);
          });
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== correlationToast.id));
          }, 6000);
        } else if (payload.type === 'new_sandbox_file') {
          const sfile = payload.data;
          if (sfile.status !== 'CLEAN') {
            const sandboxToast = {
              id: `SND-${sfile.id}`,
              attack_type: "DECOY UPLOAD THREAT MATCH",
              severity: sfile.status === 'MALICIOUS' ? 'CRITICAL' : 'HIGH',
              threat_score: sfile.threat_score * 10.0,
              source_ip: "File Sandbox Threat Scan",
              created_at: sfile.created_at
            };
            
            setToasts(prev => {
              if (prev.some(t => t.id === sandboxToast.id)) return prev;
              return [sandboxToast, ...prev].slice(0, 3);
            });
            setUnreadCount(prev => prev + 1);
            setNotifications(prev => {
              if (prev.some(n => n.id === sandboxToast.id)) return prev;
              return [sandboxToast, ...prev].slice(0, 10);
            });
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== sandboxToast.id));
            }, 6000);
          }
        }
      } catch (err) {
        console.error("Failed to parse WebSocket alert:", err);
      }
    };

    return () => socket.close();
  }, [thresholds]);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: Activity },
    { name: 'AI Assistant', path: '/agent', icon: Terminal },
    { name: 'Threat Intelligence', path: '/attackers', icon: Globe },
    { name: 'Live Attack Feed', path: '/attacks', icon: AlertTriangle },
    { name: 'Honeypot Lab', path: '/sensors', icon: Radio },
    { name: 'WAF Manager', path: '/waf', icon: ShieldAlert },
    { name: 'Reports', path: '/reports', icon: FileText }
  ];

  const currentRouteName = () => {
    if (location.pathname === '/' || location.pathname === '/dashboard') return 'DASHBOARD';
    const match = menuItems.find(i => i.path === location.pathname);
    return match ? match.name.toUpperCase() : 'CYBER DEFENSE SOC';
  };

  return (
    <div className="layout-root">
      {/* Sidebar navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-logo">
          <div className="logo-shield-badge">
            <svg viewBox="0 0 32 36" width="26" height="30" fill="none">
              <defs>
                <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5ff" />
                  <stop offset="100%" stopColor="#2f8cff" />
                </linearGradient>
              </defs>
              <path d="M16 2 L30 7 L30 18 C30 26 16 34 16 34 C16 34 2 26 2 18 L2 7 Z" stroke="url(#shieldGrad)" strokeWidth="2.2" fill="rgba(0, 229, 255, 0.08)" />
              <path d="M11 12 C11 10.5 13 9 16 9 C19 9 21 10.5 21 12 C21 15 11 15 11 19 C11 22.5 13 24 16 24 C19 24 21 22.5 21 21" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <div className="logo-text-block">
            <span className="logo-brand">SENTINELAI</span>
            <span className="logo-tagline">AI CYBER DEFENSE PLATFORM</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isAttacks = item.path === '/attacks';
            const isDashboard = item.path === '/' && (location.pathname === '/' || location.pathname === '/dashboard');
            return (
              <NavLink 
                key={item.path} 
                to={item.path} 
                className={({ isActive }) => `nav-item ${isActive || isDashboard ? 'active' : ''}`}
              >
                <Icon size={17} className="item-icon" />
                <span className="item-name">{item.name}</span>
                {isAttacks && (
                  <span className="nav-badge-pill">{unreadCount > 0 ? unreadCount : '7'}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
        
        {/* Sidebar Compact System Status Box */}
        <div className="sidebar-footer">
          <div className="sidebar-system-monitor font-mono">
            <div className="sys-mon-row">
              <span className="sys-mon-label">CPU</span>
              <div className="sys-mon-bar-bg">
                <div className="sys-mon-bar-fill fill-cyan" style={{ width: `${cpuUsage ? Math.min(100, Math.max(5, cpuUsage)) : 45.9}%` }}></div>
              </div>
              <span className="sys-mon-value">{cpuUsage ? `${cpuUsage.toFixed(1)}%` : '45.9%'}</span>
            </div>
            <div className="sys-mon-row">
              <span className="sys-mon-label">RAM</span>
              <div className="sys-mon-bar-bg">
                <div className="sys-mon-bar-fill fill-purple" style={{ width: `${memoryUsage ? Math.min(100, Math.max(5, memoryUsage)) : 77.1}%` }}></div>
              </div>
              <span className="sys-mon-value">{memoryUsage ? `${memoryUsage.toFixed(1)}%` : '77.1%'}</span>
            </div>
          </div>
          <div className="sys-status font-mono">
            <span className="status-dot online animate-live-pulse"></span>
            <span className="status-label">Sentinel v0.1.0</span>
            <span className="status-state text-green ms-auto">Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-viewport">
        <header className="viewport-header">
          <button 
            className="toggle-sidebar-btn" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle Sidebar"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          
          <div className="header-meta">
            <div className="header-icon-badge">
              <Shield className="text-cyan" size={18} />
            </div>
            <div className="header-title-stack">
              <h1 className="header-page-title">
                {currentRouteName()}
              </h1>
              <div className="header-page-subtitle">
                AI-POWERED CYBER DEFENSE COMMAND CENTER
              </div>
            </div>
          </div>

          <div className="header-right-cluster">
            {/* System Online Badge */}
            <div className="header-system-status">
              <span className={`system-status-led ${backendStatus.toLowerCase() === 'offline' ? 'offline' : 'online'} animate-live-pulse`}></span>
              <div className="system-status-stack">
                <span className="system-status-title">System {backendStatus === 'OFFLINE' ? 'Offline' : 'Online'}</span>
                <span className="system-status-subtitle">{backendStatus === 'OFFLINE' ? 'Core Service Degraded' : 'All Services Operational'}</span>
              </div>
            </div>

            {/* Real-time Notifications Bell */}
            <div className="notification-bell-container">
              <button 
                className={`bell-btn ${showDropdown ? 'active' : ''}`}
                onClick={() => {
                  setShowDropdown(!showDropdown);
                  setUnreadCount(0);
                }}
                title="Incident Notifications Hub"
              >
                <ShieldAlert size={16} />
                {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
              </button>

              {showDropdown && (
                <div className="notification-dropdown">
                  <div className="notif-header">
                    <h6>SOC TELEMETRY ALERTS</h6>
                    <button className="clear-notif-btn" onClick={() => setNotifications([])}>Clear All</button>
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">No active notifications logged.</div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          className="notif-item"
                          onClick={() => {
                            setShowDropdown(false);
                            navigate('/attacks');
                          }}
                        >
                          <span className="notif-item-title">{notif.attack_type}</span>
                          <span className="notif-item-desc">IP: {notif.source_ip} | Severity: {notif.severity}</span>
                          <span className="notif-item-time">{formatLocalTime(notif.created_at)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Real-time Digital Clock Widget */}
            <div className="header-digital-clock font-mono">
              <div className="clock-time-val">{formatTime(currentTime)}</div>
              <div className="clock-date-val">{formatDate(currentTime)}</div>
            </div>

            {/* User Profile Pill */}
            <div className="header-user-pill-container" ref={userMenuRef}>
              <button 
                className="header-user-pill"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                aria-expanded={showUserDropdown}
              >
                <div className="user-avatar-circle">
                  <User size={14} className="text-cyan" />
                </div>
                <div className="user-text-stack">
                  <span className="user-name-text">{user?.username || 'admin'}</span>
                  <span className="user-role-text">{user?.role === 'admin' ? 'Administrator' : 'Analyst'}</span>
                </div>
                <ChevronDown size={14} className={`user-chevron ${showUserDropdown ? 'rotated' : ''}`} />
              </button>

              {showUserDropdown && (
                <div className="user-dropdown-popover animate-fade-in">
                  <div className="user-dropdown-header">
                    <span className="user-popover-name">{user?.username || 'admin'}</span>
                    <span className="user-popover-role">{user?.role === 'admin' ? 'SYSTEM ADMINISTRATOR' : 'SOC ANALYST'}</span>
                  </div>
                  <div className="user-dropdown-divider"></div>
                  <button 
                    className="user-dropdown-btn logout"
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowLogoutModal(true);
                    }}
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        <main className="viewport-content">
          <Outlet />
        </main>

        {/* Floating Real-time SOC Toasts */}
        {(location.pathname === '/' || location.pathname === '/dashboard') && (
          <div className="toast-container">
            {toasts.map((toast) => (
              <div key={toast.id} className={`toast-card ${toast.severity.toLowerCase()}`}>
                <div className={`toast-icon-box ${toast.severity.toLowerCase()}`}>
                  <ShieldAlert size={18} className="pulse" />
                </div>
                <div className="toast-body">
                  <div className="toast-title">{toast.attack_type}</div>
                  <div className="toast-desc">
                    Intrusion signature detected from {toast.source_ip}. Severity: <strong>{toast.severity}</strong> (Score: {toast.threat_score}/10).
                  </div>
                  <div className="toast-footer">
                    <span className="toast-time">{formatLocalTime(toast.created_at)}</span>
                    <span
                      className="toast-view-link"
                      onClick={() => {
                        setToasts(toasts.filter(t => t.id !== toast.id));
                        navigate('/attacks');
                      }}
                    >
                      View Details
                    </span>
                  </div>
                </div>
                <button
                  className="toast-close-btn"
                  onClick={() => setToasts(toasts.filter(t => t.id !== toast.id))}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Viewport-level Logout Confirmation Modal */}
        {showLogoutModal && (
          <div
            className="sentinel-modal-overlay animate-fade-in"
            onClick={() => setShowLogoutModal(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowLogoutModal(false); }}
            tabIndex={0}
          >
            <div
              className="sentinel-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sentinel-modal-header">
                <div className="sentinel-modal-icon-box">
                  <LogOut size={20} />
                </div>
                <div>
                  <h3 className="sentinel-modal-title">
                    SIGN OUT OF SENTINELAI?
                  </h3>
                  <p className="sentinel-modal-subtitle">
                    SOC Session Termination Confirmation
                  </p>
                </div>
              </div>

              <div className="sentinel-modal-body">
                Are you sure you want to end your current SOC session?
              </div>

              <div className="sentinel-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="sentinel-modal-btn-cancel"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutModal(false);
                    logout();
                    navigate('/login');
                  }}
                  className="sentinel-modal-btn-confirm"
                >
                  YES, LOG OUT
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
