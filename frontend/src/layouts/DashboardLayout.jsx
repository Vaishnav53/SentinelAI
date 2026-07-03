import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Activity, 
  Radio, 
  Terminal, 
  FileText, 
  Settings, 
  Cpu, 
  Server,
  AlertTriangle,
  Menu,
  X,
  Database,
  BookOpen,
  Clock,
  ShieldAlert
} from 'lucide-react';
import apiClient from '../api/client';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backendStatus, setBackendStatus] = useState('CHECKING');
  const [ollamaStatus, setOllamaStatus] = useState('CHECKING');
  const [honeypotStatus, setHoneypotStatus] = useState('CHECKING');
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const location = useLocation();

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

  // Format Date for Clock
  const formatDate = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Format Time for Clock
  const formatTime = (date) => {
    let hrs = date.getHours();
    let mins = date.getMinutes();
    let secs = date.getSeconds();
    const ampm = hrs >= 12 ? 'pm' : 'am';
    
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12; // 12-hour format conversion
    
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
      setOllamaStatus(health.ollama.status);
      setHoneypotStatus(hpStatus.status);
      setCpuUsage(systemMetrics.cpu_percent);
      setMemoryUsage(systemMetrics.memory_percent);
    } catch (e) {
      setBackendStatus('OFFLINE');
      setOllamaStatus('OFFLINE');
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
  }, [location.pathname]); // Refresh when settings might have changed

  // WebSocket live alerts alerts connector
  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname || '127.0.0.1'}:8000/api/attacks/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_attack') {
          const attack = payload.data;
          
          // Verify if it exceeds our settings alerts thresholds
          const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
          const threshIdx = severities.indexOf(thresholds.severity.toUpperCase());
          const attackIdx = severities.indexOf(attack.severity.toUpperCase());
          
          const matchesSeverity = attackIdx >= (threshIdx === -1 ? 2 : threshIdx);
          const matchesScore = attack.threat_score >= thresholds.score;

          if (matchesSeverity || matchesScore) {
            // Push toast alert card
            setToasts(prev => {
              if (prev.some(t => t.id === attack.id)) return prev;
              return [attack, ...prev].slice(0, 3);
            });
            
            // Increment unread count & add to notifications log list
            setUnreadCount(prev => prev + 1);
            setNotifications(prev => {
              if (prev.some(n => n.id === attack.id)) return prev;
              return [attack, ...prev].slice(0, 10);
            });

            // Auto dismiss toast alert card after 6 seconds
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
        }
      } catch (err) {
        console.error("Failed to parse WebSocket alert:", err);
      }
    };

    return () => socket.close();
  }, [thresholds]);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: Activity },
    { name: 'Incident Response', path: '/attacks', icon: Shield },
    { name: 'WAF Manager', path: '/waf', icon: ShieldAlert },
    { name: 'Honeypot Lab', path: '/sensors', icon: Radio },
    { name: 'AI Assistant', path: '/agent', icon: Terminal },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Blueprint', path: '/blueprint', icon: BookOpen },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="layout-root">
      {/* Sidebar navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-logo">
          <Shield className="logo-icon text-cyan pulse" size={22} />
          <span className="logo-text title-cyber">SentinelAI</span>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink 
                key={item.path} 
                to={item.path} 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={16} className="item-icon" />
                <span className="item-name">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
        
        {/* Sidebar Compact System Status Box */}
        <div className="sidebar-footer">
          <div className="sidebar-system-monitor font-mono">
            <div className="sys-mon-row">
              <span className="sys-mon-label">CPU:</span>
              <div className="sys-mon-bar-bg">
                <div className="sys-mon-bar-fill fill-cyan" style={{ width: `${cpuUsage}%` }}></div>
              </div>
              <span className="sys-mon-value">{cpuUsage}%</span>
            </div>
            <div className="sys-mon-row">
              <span className="sys-mon-label">RAM:</span>
              <div className="sys-mon-bar-bg">
                <div className="sys-mon-bar-fill fill-purple" style={{ width: `${memoryUsage}%` }}></div>
              </div>
              <span className="sys-mon-value">{memoryUsage}%</span>
            </div>
          </div>
          <div className="sys-status font-mono">
            <Server size={12} />
            <span className="status-label">Sentinel v0.1.0</span>
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
            <span className="current-route-title font-mono title-cyber">
              {menuItems.find(i => i.path === location.pathname)?.name.toUpperCase() || 'CYBER DEFENSE SOC'}
            </span>
            {location.pathname === '/' && (
              <div className="header-subtitle font-mono">
                AI-POWERED CYBER DEFENSE COMMAND CENTER
              </div>
            )}
          </div>

          {/* Active status checkers */}
          <div className="header-status-indicators">
            <div className="status-indicator">
              <span className="status-name">CORE:</span>
              <span className={`status-dot ${backendStatus.toLowerCase()}`}></span>
              <span className="status-text">{backendStatus}</span>
            </div>

            <div className="status-indicator">
              <span className="status-name">LOCAL AI:</span>
              <span className={`status-dot ${ollamaStatus.toLowerCase()}`}></span>
              <span className="status-text">{ollamaStatus}</span>
            </div>

            <div className="status-indicator">
              <span className="status-name">H-DECOY:</span>
              <span className={`status-dot ${honeypotStatus.toLowerCase()}`}></span>
              <span className="status-text">{honeypotStatus}</span>
            </div>
          </div>

          {/* Real-time Notifications Bell */}
          <div className="notification-bell-container" style={{ marginRight: '10px' }}>
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
                        <span className="notif-item-time">{new Date(notif.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Real-time Clock Widget */}
          <div className="header-clock-widget font-mono">
            <Clock size={16} className="clock-icon text-cyan" />
            <div className="clock-details">
              <div className="clock-time">{formatTime(currentTime)}</div>
              <div className="clock-date">{formatDate(currentTime)}</div>
            </div>
          </div>
        </header>

        <main className="viewport-content">
          <Outlet />
        </main>

        {/* Floating Real-time SOC Toasts */}
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
                  <span className="toast-time">{new Date(toast.created_at).toLocaleTimeString()}</span>
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
      </div>
    </div>
  );
}
