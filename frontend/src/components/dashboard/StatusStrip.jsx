import React from 'react';
import { Shield, Radio, Box, Bot, Database, Activity } from 'lucide-react';

export default function StatusStrip({ sensorCount = 4, totalThreats = 7539, isDegraded = false }) {
  return (
    <footer className="soc-bottom-status-bar font-mono text-xxs">
      <div className="status-bar-left">
        <div className="status-bar-item platform-main">
          <span className={`status-bar-dot ${isDegraded ? 'dot-degraded' : 'dot-online'} animate-live-pulse`}></span>
          <span className="status-bar-label">Platform Status:</span>
          <span className={`status-bar-value ${isDegraded ? 'text-orange' : 'text-green'}`}>
            {isDegraded ? 'Degraded' : 'Operational'}
          </span>
        </div>

        <span className="status-bar-divider">|</span>

        <div className="status-bar-item">
          <Shield size={12} className="status-module-icon text-cyan" />
          <span className="status-bar-label">Firewall:</span>
          <span className="status-bar-value text-cyan">Online</span>
        </div>

        <span className="status-bar-divider">|</span>

        <div className="status-bar-item">
          <Radio size={12} className="status-module-icon text-cyan" />
          <span className="status-bar-label">Honeypots:</span>
          <span className="status-bar-value text-cyan">Deployed</span>
        </div>

        <span className="status-bar-divider">|</span>

        <div className="status-bar-item">
          <Box size={12} className="status-module-icon text-cyan" />
          <span className="status-bar-label">Docker:</span>
          <span className="status-bar-value text-cyan">Running</span>
        </div>

        <span className="status-bar-divider">|</span>

        <div className="status-bar-item">
          <Bot size={12} className="status-module-icon text-cyan" />
          <span className="status-bar-label">AI:</span>
          <span className="status-bar-value text-cyan">Connected</span>
        </div>

        <span className="status-bar-divider">|</span>

        <div className="status-bar-item">
          <Database size={12} className="status-module-icon text-cyan" />
          <span className="status-bar-label">Database:</span>
          <span className="status-bar-value text-cyan">Connected</span>
        </div>
      </div>

      <div className="status-bar-right ms-auto">
        <Activity size={12} className="text-cyan animate-live-pulse" />
        <span className="status-bar-telemetry">
          Monitoring {sensorCount} sensors • {totalThreats.toLocaleString()} total threats
        </span>
      </div>
    </footer>
  );
}
