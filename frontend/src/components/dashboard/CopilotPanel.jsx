import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CopilotPanel({ latestAttack }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  // Animate the progress bar dynamically
  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 88) {
          clearInterval(interval);
          return 88;
        }
        return prev + 2;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [latestAttack]);

  const targetIp = latestAttack?.source_ip || '192.168.1.105';

  return (
    <div className="copilot-controls-row mt-3">
      {/* Left: AI Security Copilot Status & Progress */}
      <div className="card-cyber ai-advisor-box-v2 flex-1">
        <div className="ai-advisor-header">
          <Terminal className="text-purple" size={14} />
          <h3 className="chart-title text-purple text-glow">AI SECURITY COPILOT</h3>
          <div className="ai-status-pulse ms-auto"></div>
        </div>
        
        <div className="ai-advisor-content mt-2 flex gap-3">
          {/* Animated AI Brain Orb */}
          <div className="ai-brain-viz-v2 relative shrink-0" style={{ width: '60px', height: '60px', margin: 0 }}>
            <span className="brain-core-pulse"></span>
            <span className="brain-orbit-path orbit-1"></span>
            <span className="brain-orbit-path orbit-2"></span>
            <span className="brain-orbit-path orbit-3"></span>
            <span className="brain-scan-sweep"></span>
          </div>

          <div className="ai-reasoning-details font-mono text-xxs flex-1">
            <div className="text-purple font-bold">AI STATUS: ANALYZING_THREATS<span className="blinking-cursor">_</span></div>
            <ul className="ai-bullets-list mt-2 text-muted">
              <li>• Scanning Honeypot Telemetry</li>
              <li>• Correlating Threat Patterns</li>
              <li>• Evaluating Risk Level</li>
              <li>• Generating Recommendations</li>
            </ul>
            
            {/* Progress Bar */}
            <div className="ai-progress-container mt-2">
              <div className="ai-progress-bar-bg">
                <div className="ai-progress-bar-fill bg-purple" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="ai-progress-label text-purple text-right mt-1">{progress}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Recommended actions panel */}
      <div className="card-cyber recommended-actions-box flex-1">
        <div className="ai-advisor-header">
          <h3 className="chart-title text-cyan">RECOMMENDED ACTIONS</h3>
        </div>
        
        <div className="actions-buttons-grid font-mono text-xxs mt-3 flex flex-col gap-2">
          <button 
            className="act-btn-cyber btn-critical"
            onClick={() => alert(`IP Address ${targetIp} successfully isolated.`)}
          >
            <span>BLOCK IP: {targetIp}</span>
            <span className="badge-critical ml-auto">CRITICAL</span>
          </button>
          
          <button 
            className="act-btn-cyber btn-orange"
            onClick={() => alert('WAF Policies successfully enforced.')}
          >
            <span>ENABLE WAF PROTECTION</span>
            <span className="badge-high ml-auto">HIGH</span>
          </button>
          
          <button 
            className="act-btn-cyber btn-yellow"
            onClick={() => alert('Interaction threshold level increased.')}
          >
            <span>INCREASE HONEYPOT INTERACTION</span>
            <span className="badge-medium ml-auto">MEDIUM</span>
          </button>

          <button 
            className="btn-copilot-dashboard mt-2 py-1.5"
            onClick={() => navigate('/agent')}
          >
            VIEW FULL ANALYSIS →
          </button>
        </div>
      </div>
    </div>
  );
}
