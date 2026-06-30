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
  AlertTriangle,
  Menu,
  X
} from 'lucide-react';
import apiClient from '../api/client';
import './DashboardLayout.css';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [backendStatus, setBackendStatus] = useState('CHECKING');
  const [ollamaStatus, setOllamaStatus] = useState('CHECKING');
  const location = useLocation();

  // Query health and agent status on mount and periodic intervals
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const health = await apiClient.get('/health/services');
        setBackendStatus(health.database.status === 'ONLINE' ? 'ONLINE' : 'DEGRADED');
        setOllamaStatus(health.ollama.status);
      } catch (e) {
        setBackendStatus('OFFLINE');
        setOllamaStatus('OFFLINE');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: Activity },
    { name: 'Attack Feed', path: '/attacks', icon: Shield },
    { name: 'Sensors Lab', path: '/sensors', icon: Radio },
    { name: 'AI Assistant', path: '/agent', icon: Terminal },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="layout-root">
      {/* Sidebar navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-logo">
          <Shield className="logo-icon text-cyan" size={24} />
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
                <Icon size={18} className="item-icon" />
                <span className="item-name">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
        
        <div className="sidebar-footer">
          <div className="sys-status">
            <span className="status-label">Engine v0.1.0</span>
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
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <div className="header-meta">
            <span className="current-route-title">
              {menuItems.find(i => i.path === location.pathname)?.name || 'Cyber Defense Platform'}
            </span>
          </div>

          <div className="header-status-indicators">
            {/* Backend Indicator */}
            <div className="status-indicator">
              <span className="status-name">SYS CORE:</span>
              <span className={`status-dot ${backendStatus.toLowerCase()}`}></span>
              <span className="status-text">{backendStatus}</span>
            </div>

            {/* Ollama AI Indicator */}
            <div className="status-indicator">
              <span className="status-name">LOCAL AI:</span>
              <span className={`status-dot ${ollamaStatus.toLowerCase()}`}></span>
              <span className="status-text">{ollamaStatus}</span>
            </div>
          </div>
        </header>

        <main className="viewport-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
