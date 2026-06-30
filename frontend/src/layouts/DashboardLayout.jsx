import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
  BookOpen
} from 'lucide-react';
import apiClient from '../api/client';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backendStatus, setBackendStatus] = useState('CHECKING');
  const [ollamaStatus, setOllamaStatus] = useState('CHECKING');
  const [honeypotStatus, setHoneypotStatus] = useState('CHECKING');
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const location = useLocation();

  // Clock Widget timer
  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Format Date for Clock
  const formatDate = (date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()}`;
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

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: Activity },
    { name: 'Attack Feed', path: '/attacks', icon: Shield },
    { name: 'Sensors Lab', path: '/sensors', icon: Radio },
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

          {/* Real-time Clock Widget */}
          <div className="header-clock-widget font-mono">
            <div className="clock-date">{formatDate(currentTime)}</div>
            <div className="clock-time">{formatTime(currentTime)}</div>
          </div>
        </header>

        <main className="viewport-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
