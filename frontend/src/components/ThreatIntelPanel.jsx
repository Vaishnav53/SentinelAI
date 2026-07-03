import React, { useState, useEffect } from 'react';
import { X, Shield, Globe, Cpu, AlertTriangle, Server } from 'lucide-react';
import apiClient from '../api/client';
import './ThreatIntelPanel.css';

export default function ThreatIntelPanel({ ip, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ip) {
      setData(null);
      return;
    }

    const fetchIntel = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiClient.get(`/threat-intel/enrich/ip/${ip}`);
        setData(result);
      } catch (err) {
        setError(err.message || 'Failed to load threat intelligence profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchIntel();
  }, [ip]);

  if (!ip) return null;

  const getRiskColor = (level) => {
    if (level === 'CRITICAL') return 'var(--critical-red)';
    if (level === 'HIGH') return 'var(--orange)';
    if (level === 'MEDIUM') return 'var(--purple)';
    return 'var(--green)';
  };

  return (
    <div className={`threat-intel-drawer ${ip ? 'open' : ''}`}>
      <div className="drawer-header border-bottom">
        <div className="flex items-center gap-2">
          <Shield className="text-cyan animate-pulse" size={16} />
          <span className="font-mono text-xs font-bold text-cyan">THREAT_INTEL_PROFILE</span>
        </div>
        <button className="btn-close-drawer" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="drawer-content scroll-bar font-mono text-xs">
        {loading && (
          <div className="drawer-loader text-center py-8">
            <div className="spinner-border animate-spin mb-2"></div>
            <div className="text-muted text-xxs">ENRICHING_TARGET_OCTETS...</div>
          </div>
        )}

        {error && (
          <div className="drawer-error text-center py-6 text-red">
            <AlertTriangle className="mx-auto mb-2" size={18} />
            <div>{error}</div>
          </div>
        )}

        {data && (
          <div className="intel-profile-layout animate-fade-in">
            {/* IP Header details */}
            <div className="intel-section-card target-ip-card mb-3">
              <span className="text-xxs text-muted">TARGET IP ADDRESS</span>
              <div className="target-ip-text text-white font-bold text-base mt-1">{data.ip}</div>
            </div>

            {/* Visual Threat Meter */}
            <div className="intel-section-card threat-meter-card mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted text-xxs">THREAT REPUTATION INDEX</span>
                <span className="font-bold text-xxs" style={{ color: getRiskColor(data.risk_level) }}>
                  {data.risk_level}
                </span>
              </div>
              <div className="threat-bar-container">
                <div 
                  className="threat-bar-fill" 
                  style={{ 
                    width: `${data.threat_score}%`, 
                    backgroundColor: getRiskColor(data.risk_level),
                    boxShadow: `0 0 10px ${getRiskColor(data.risk_level)}`
                  }}
                ></div>
              </div>
              <div className="flex justify-between items-center mt-1 text-xxs text-muted">
                <span>SCORE: {data.threat_score}/100</span>
                <span>CONFIDENCE: {(data.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Geolocation metadata */}
            <div className="intel-section-card mb-3">
              <div className="section-title-tag text-cyan mb-2">
                <Globe size={12} className="inline mr-1" />
                GEOLOCATION_REGISTRY
              </div>
              <div className="intel-data-grid">
                <div className="intel-grid-row">
                  <span className="text-muted">Country:</span>
                  <span className="text-white ml-auto">{data.country} ({data.country_code})</span>
                </div>
                <div className="intel-grid-row mt-1">
                  <span className="text-muted">City:</span>
                  <span className="text-white ml-auto">{data.city}</span>
                </div>
              </div>
            </div>

            {/* Network routing metadata */}
            <div className="intel-section-card mb-3">
              <div className="section-title-tag text-cyan mb-2">
                <Cpu size={12} className="inline mr-1" />
                ROUTING_AUTONOMOUS_SYSTEM
              </div>
              <div className="intel-data-grid">
                <div className="intel-grid-row">
                  <span className="text-muted">ASN:</span>
                  <span className="text-cyan ml-auto">{data.asn}</span>
                </div>
                <div className="intel-grid-row mt-1">
                  <span className="text-muted">ISP:</span>
                  <span className="text-white ml-auto">{data.isp}</span>
                </div>
              </div>
            </div>

            {/* Reputation Description summaries */}
            <div className="intel-section-card mb-3">
              <div className="section-title-tag text-purple mb-2">
                <AlertTriangle size={12} className="inline mr-1 text-purple" />
                THREAT_SUMMARY
              </div>
              <p className="reputation-desc text-muted leading-relaxed text-xxs">
                {data.reputation_summary}
              </p>
            </div>

            {/* Providers status list */}
            <div className="intel-section-card mb-3">
              <div className="section-title-tag text-cyan mb-2">
                <Server size={12} className="inline mr-1" />
                INTELLIGENCE_FEEDS
              </div>
              <div className="provider-status-list">
                {Object.entries(data.provider_statuses).map(([name, status]) => (
                  <div key={name} className="provider-row flex justify-between items-center py-1 border-bottom">
                    <span className="text-white text-xxs">{name.replace('_', ' ')}</span>
                    <span className={`provider-badge text-xxxs ${status.toLowerCase()}`}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
