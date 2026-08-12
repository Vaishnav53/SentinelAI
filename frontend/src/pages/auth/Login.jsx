import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import './Auth.css';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username/email and password.');
      return;
    }

    try {
      setError('');
      setIsSubmitting(true);
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <Shield className="w-7 h-7 text-blue-400" />
          </div>

          <h1 className="auth-title">SentinelAI SOC Portal</h1>
          <p className="auth-subtitle">Autonomous Security Operations Platform</p>
        </div>

        {error && (
          <div className="auth-error-box">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label className="auth-label">Username or Email</label>
            <div className="auth-input-wrapper">
              <User className="auth-input-icon w-4 h-4" />
              <input
                type="text"
                className="auth-input"
                placeholder="analyst@sentinel.ai"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label">Security Password</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon w-4 h-4" />
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              <>
                Sign In to SOC
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have a SentinelAI account?{' '}
          <Link to="/register" className="auth-link">
            Register Analyst Account
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Login;
