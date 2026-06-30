import React, { useState, useEffect } from 'react';
import { Radio, Power, AlertTriangle, ShieldCheck } from 'lucide-react';
import apiClient from '../../api/client';
import './HoneypotLab.css';

export default function HoneypotLab() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSensors = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/sensors');
      setSensors(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensors();
  }, []);

  const handleToggleState = async (id, currentState) => {
    try {
      const endpoint = currentState === 'ONLINE' ? `/sensors/${id}/stop` : `/sensors/${id}/start`;
      const updated = await apiClient.post(endpoint);
      setSensors(sensors.map(s => s.id === id ? updated : s));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && sensors.length === 0) {
    return <div className="loading-state">Initialising Honeypot Lab Telemetry...</div>;
  }

  return (
    <div className="lab-root">
      <div className="lab-header card-cyber">
        <div className="lab-header-info">
          <Radio className="text-cyan pulse" size={24} />
          <div className="lab-header-title">
            <h4 className="title-cyber">Honeypot Lab Sensor Grid</h4>
            <p className="text-muted">Control simulated network ports and bait attackers in isolated sandbox environments.</p>
          </div>
        </div>
      </div>

      {/* Grid of Sensor cards */}
      <div className="sensor-grid">
        {sensors.map((sensor) => {
          const isOnline = sensor.state === 'ONLINE';
          
          return (
            <div key={sensor.id} className={`sensor-card card-cyber ${sensor.state.toLowerCase()}`}>
              <div className="sensor-card-header">
                <span className={`badge badge-${sensor.state.toLowerCase()}`}>{sensor.state}</span>
                <button 
                  className={`power-btn ${isOnline ? 'active' : ''}`}
                  onClick={() => handleToggleState(sensor.id, sensor.state)}
                  title={isOnline ? "Stop Listener" : "Start Listener"}
                >
                  <Power size={14} />
                </button>
              </div>

              <div className="sensor-card-body">
                <h4 className="sensor-name">{sensor.name}</h4>
                <div className="sensor-meta font-mono">
                  <div className="sm-row">
                    <span className="sm-label">Port:</span>
                    <span className="sm-val">{sensor.port}</span>
                  </div>
                  <div className="sm-row">
                    <span className="sm-label">Protocol:</span>
                    <span className="sm-val">{sensor.type}</span>
                  </div>
                  <div className="sm-row">
                    <span className="sm-label">Host Binding:</span>
                    <span className="sm-val">{sensor.host}</span>
                  </div>
                  <div className="sm-row">
                    <span className="sm-label">Heartbeat:</span>
                    <span className="sm-val">
                      {sensor.last_heartbeat ? new Date(sensor.last_heartbeat).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="sensor-card-footer">
                {isOnline ? (
                  <div className="sensor-status-msg text-green">
                    <ShieldCheck size={14} />
                    <span>Listening on Port {sensor.port}</span>
                  </div>
                ) : (
                  <div className="sensor-status-msg text-muted">
                    <AlertTriangle size={14} />
                    <span>Port is closed</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
