import React, { useState, useEffect } from 'react';
import { Sliders, Plus, Terminal, Workflow, Trash2, CheckCircle, AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import apiClient from '../../api/client';
import './PlaybooksConsole.css';

export default function PlaybooksConsole() {
  const [playbooks, setPlaybooks] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Playbook Creator state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrigger, setNewTrigger] = useState('MANUAL');
  const [actionsList, setActionsList] = useState([]);
  const [availableActionTypes] = useState([
    { value: 'BLOCK_IP', label: 'WAF Containment: Block IP' },
    { value: 'QUARANTINE_IP', label: 'WAF Containment: Quarantine IP' },
    { value: 'CREATE_INCIDENT', label: 'Incident response: Create SOC Case' },
    { value: 'ASSIGN_ANALYST', label: 'Incident response: Assign Analyst Rivera' },
    { value: 'ADD_COMMENT', label: 'Incident response: Append Playbook run log' },
    { value: 'NOTIFY_TEAM', label: 'Alerting: Notify Teams/Slack Channels' }
  ]);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [playbooksData, executionsData] = await Promise.all([
        apiClient.get('/playbooks'),
        apiClient.get('/playbooks/executions')
      ]);
      setPlaybooks(playbooksData);
      setExecutions(executionsData);
    } catch (err) {
      console.error("Failed to load playbooks console details:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add action step to creator list
  const handleAddAction = (actionType) => {
    setActionsList([...actionsList, { action: actionType }]);
  };

  // Remove action step from list
  const handleRemoveAction = (index) => {
    setActionsList(actionsList.filter((_, idx) => idx !== index));
  };

  // Create Playbook submit
  const handleCreatePlaybook = async (e) => {
    e.preventDefault();
    if (!newName || actionsList.length === 0) {
      alert("Please enter a playbook name and add at least one execution step.");
      return;
    }

    try {
      await apiClient.post('/playbooks', {
        name: newName,
        description: newDesc,
        trigger_type: newTrigger,
        actions: actionsList
      });

      // Clear Form
      setNewName('');
      setNewDesc('');
      setNewTrigger('MANUAL');
      setActionsList([]);
      
      // Reload details
      fetchData();
    } catch (err) {
      console.error("Failed to save custom playbook workflow:", err);
    }
  };

  return (
    <div className="playbooks-root">
      {/* Top refresh header */}
      <div className="waf-filter-bar card-cyber">
        <div className="d-flex align-items-center gap-2 font-mono" style={{ color: 'var(--cyan-primary)' }}>
          <Workflow size={16} />
          <span>Active Threat Orchestration Playbook Console</span>
        </div>
        
        <button 
          className="btn-action font-mono"
          onClick={fetchData}
          disabled={refreshing}
          style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          SYNC LOGS
        </button>
      </div>

      {/* Main split dashboard */}
      <div className="waf-main-grid">
        {/* Playbooks list and Custom creator */}
        <div className="playbook-left-flow" style={{ flex: 3.2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active playbooks cards */}
          <div className="waf-panel card-cyber">
            <div className="panel-header">
              <h5 className="panel-title font-mono text-cyan">Active Playbook Orchestration Cards</h5>
            </div>
            <div className="panel-body playbooks-deck">
              {playbooks.map((p) => (
                <div key={p.id} className="playbook-card card-cyber font-mono">
                  <div className="card-top">
                    <h5 className="p-title text-cyan">{p.name}</h5>
                    <span className="p-trigger">{p.trigger_type}</span>
                  </div>
                  <p className="p-desc text-muted mt-1">{p.description}</p>
                  
                  {/* Visual list of execution steps */}
                  <div className="p-steps-block mt-3">
                    <div className="steps-title">Execution Sequence Steps:</div>
                    <div className="steps-dots-row">
                      {JSON.parse(p.actions_data || "[]").map((act, idx) => (
                        <div key={idx} className="step-dot">
                          <div className="number">{idx + 1}</div>
                          <div className="name">{act.action}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {playbooks.length === 0 && !loading && (
                <div className="empty-text">No orchestration playbooks configured.</div>
              )}
            </div>
          </div>

          {/* Dynamic Playbook Creator Form */}
          <div className="waf-panel card-cyber">
            <div className="panel-header">
              <h5 className="panel-title font-mono text-orange">Custom Playbook Orchestrator Studio</h5>
            </div>
            <div className="panel-body">
              <form onSubmit={handleCreatePlaybook} className="playbook-form">
                <div className="form-row">
                  <div className="input-group">
                    <label>Playbook Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Restrict Malicious Traversal IP" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Activation Trigger</label>
                    <select value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)}>
                      <option value="MANUAL">Manual Trigger</option>
                      <option value="ON_MALICIOUS_UPLOAD">On Decoy Malicious Upload</option>
                      <option value="ON_CORRELATED_INCIDENT">On Correlated Incident Trigger</option>
                    </select>
                  </div>
                </div>

                <div className="input-group mt-3">
                  <label>Description</label>
                  <textarea 
                    placeholder="Provide a functional summary describing the security response goals of this playbook..." 
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                {/* Steps configuration panels */}
                <div className="actions-selector-block mt-4">
                  <label className="section-label">Configure Sequential Execution Steps</label>
                  <div className="selector-buttons mt-2">
                    {availableActionTypes.map((act) => (
                      <button 
                        key={act.value}
                        type="button"
                        className="btn-add-step"
                        onClick={() => handleAddAction(act.value)}
                      >
                        <Plus size={10} />
                        {act.label}
                      </button>
                    ))}
                  </div>

                  {/* Configured steps list */}
                  <div className="configured-steps-list mt-3">
                    {actionsList.map((act, index) => (
                      <div key={index} className="configured-step-item font-mono">
                        <span className="step-num">{index + 1}</span>
                        <span className="step-label text-cyan">{act.action}</span>
                        <button 
                          type="button" 
                          className="btn-delete-step"
                          onClick={() => handleRemoveAction(index)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {actionsList.length === 0 && (
                      <div className="empty-small font-mono text-muted text-center py-3">
                        No execution steps added. Select from the actions panel above.
                      </div>
                    )}
                  </div>
                </div>

                <button type="submit" className="btn-submit-playbook mt-4">
                  Save Playbook Workflow
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* Playbook Run Execution History */}
        <div className="waf-panel card-cyber list-panel-correlation" style={{ flex: 1.8 }}>
          <div className="panel-header">
            <h5 className="panel-title font-mono text-cyan">Playbook Execution Logs Feed</h5>
          </div>
          <div className="panel-body">
            <div className="executions-timeline">
              {executions.map((ex) => (
                <div key={ex.id} className="execution-timeline-item font-mono">
                  <div className="ex-header">
                    <span className="p-name text-cyan">ID-{ex.playbook_id} Run</span>
                    <span className={`ex-status badge-${ex.status.toLowerCase()}`}>{ex.status}</span>
                  </div>
                  
                  <div className="ex-meta mt-1">
                    <span className="lbl text-muted">Target Attacker:</span>
                    <span className="val text-orange"> {ex.target_ip}</span>
                  </div>
                  
                  <div className="ex-meta">
                    <span className="lbl text-muted">Launched At:</span>
                    <span className="val"> {new Date(ex.created_at).toLocaleString()}</span>
                  </div>

                  {/* Logs details */}
                  {ex.logs_data && (
                    <div className="ex-details-box mt-2">
                      {JSON.parse(ex.logs_data).map((log, idx) => (
                        <div key={idx} className="ex-log-line">
                          <span className={log.status === 'FAILED' ? 'text-red' : 'text-green'}>✓</span> {log.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {executions.length === 0 && (
                <div className="empty-text">No playbooks triggered. Ready for orchestration inputs.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
