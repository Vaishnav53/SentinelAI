import React, { useState, useEffect } from 'react';
import { Bot, Shield, Check, ShieldAlert, Cpu, ArrowRight, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CopilotPanel({ latestAttack }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(64);

  // Dynamic progress animation
  useEffect(() => {
    setProgress(20);
    const timer = setTimeout(() => setProgress(64), 300);
    return () => clearTimeout(timer);
  }, [latestAttack]);

  const targetIp = latestAttack?.source_ip || '127.0.0.1';
  const attackType = latestAttack?.attack_type || 'Path Traversal';

  return (
    <div className="copilot-twin-row">
      {/* 1. Left Card: AI Security Copilot */}
      <div className="copilot-subcard ai-copilot-card">
        <div className="copilot-subcard-header">
          <div className="copilot-header-title">
            <Bot className="text-purple" size={16} />
            <h4 className="copilot-title-text font-mono">AI SECURITY COPILOT</h4>
          </div>
          <div className="copilot-cloud-badge font-mono">
            <span className="cloud-diamond text-purple">◇</span>
            <span>Groq Cloud</span>
            <span className="badge-status-pill online">ONLINE</span>
          </div>
        </div>

        <div className="copilot-subcard-body">
          <div className="ai-status-headline font-mono">
            <span>AI STATUS: </span>
            <span className="text-purple font-bold">ANALYZING THREATS</span>
          </div>

          <div className="ai-checklist-grid">
            <div className="ai-checklist-col">
              <div className="ai-check-item font-mono">
                <span className="check-disc"><Check size={11} /></span>
                <span>Scanning Honeypot Telemetry</span>
              </div>
              <div className="ai-check-item font-mono">
                <span className="check-disc"><Check size={11} /></span>
                <span>Correlating Threat Patterns</span>
              </div>
              <div className="ai-check-item font-mono">
                <span className="check-disc"><Check size={11} /></span>
                <span>Evaluating Risk Level</span>
              </div>
              <div className="ai-check-item font-mono">
                <span className="check-disc"><Check size={11} /></span>
                <span>Generating Recommendations</span>
              </div>
            </div>

            {/* Glowing Holographic Brain Orb */}
            <div className="ai-brain-orb-wrapper shrink-0">
              <div className="ai-brain-orb">
                <div className="orb-ring ring-1"></div>
                <div className="orb-ring ring-2"></div>
                <div className="orb-ring ring-3"></div>
                <Cpu size={22} className="orb-core-icon text-purple animate-live-pulse" />
              </div>
            </div>
          </div>

          {/* Progress Bar Row */}
          <div className="ai-progress-row">
            <div className="ai-progress-track">
              <div 
                className="ai-progress-bar"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="ai-progress-num font-mono">{progress}%</span>
          </div>
        </div>

        <div className="copilot-subcard-footer">
          <button 
            className="btn-copilot-action font-mono purple-theme"
            onClick={() => navigate('/agent')}
          >
            <span>Open AI Assistant</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 2. Right Card: Recommended Actions */}
      <div className="copilot-subcard recommended-actions-card">
        <div className="copilot-subcard-header">
          <div className="copilot-header-title">
            <Shield className="text-cyan" size={16} />
            <h4 className="copilot-title-text font-mono">RECOMMENDED ACTIONS</h4>
          </div>
          <span className="copilot-auto-pill font-mono">Auto</span>
        </div>

        <div className="copilot-subcard-body">
          <div className="recommended-action-list">
            {/* Action Item 1 */}
            <div 
              className="action-item-card action-critical"
              onClick={() => navigate('/waf')}
              title="Click to apply WAF containment rule"
            >
              <div className="action-icon-circle bg-red-dim">
                <ShieldAlert size={14} className="text-red" />
              </div>
              <div className="action-text-block font-mono">
                <div className="action-title-row">
                  <span className="action-main-title">BLOCK IP: {targetIp}</span>
                  <span className="action-sev-badge sev-critical">CRITICAL</span>
                </div>
                <div className="action-desc-text">
                  Repeated {attackType.toLowerCase()} attempts detected.
                </div>
              </div>
            </div>

            {/* Action Item 2 */}
            <div 
              className="action-item-card action-high"
              onClick={() => navigate('/waf')}
              title="Click to update WAF security rules"
            >
              <div className="action-icon-circle bg-orange-dim">
                <Shield size={14} className="text-orange" />
              </div>
              <div className="action-text-block font-mono">
                <div className="action-title-row">
                  <span className="action-main-title">ENABLE WAF PROTECTION</span>
                  <span className="action-sev-badge sev-high">HIGH</span>
                </div>
                <div className="action-desc-text">
                  Increase rules for /api and vulnerable endpoints.
                </div>
              </div>
            </div>

            {/* Action Item 3 */}
            <div 
              className="action-item-card action-medium"
              onClick={() => navigate('/sensors')}
              title="Click to manage honeypot sensor network"
            >
              <div className="action-icon-circle bg-blue-dim">
                <Layers size={14} className="text-blue" />
              </div>
              <div className="action-text-block font-mono">
                <div className="action-title-row">
                  <span className="action-main-title">INCREASE HONEYPOT INTERACTION</span>
                  <span className="action-sev-badge sev-medium">MEDIUM</span>
                </div>
                <div className="action-desc-text">
                  More decoy resources detected for this pattern.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="copilot-subcard-footer">
          <button 
            className="btn-copilot-action font-mono cyan-theme"
            onClick={() => navigate('/agent')}
          >
            <span>View Full Analysis</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
