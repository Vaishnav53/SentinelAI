import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, User, Mail, AlertCircle, UserPlus } from 'lucide-react';
import './Auth.css';

export const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setError('Please provide a valid corporate email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register(username.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.message || 'Registration failed. Username or email may already be in use.';
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

          <h1 className="auth-title">Register SOC Account</h1>
          <p className="auth-subtitle">SentinelAI Cybersecurity Operations</p>
        </div>

        {error && (
          <div className="auth-error-box">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label className="auth-label">Analyst Username</label>
            <div className="auth-input-wrapper">
              <User className="auth-input-icon w-4 h-4" />
              <input
                type="text"
                className="auth-input"
                placeholder="soc_analyst_1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label">Corporate Email</label>
            <div className="auth-input-wrapper">
              <Mail className="auth-input-icon w-4 h-4" />
              <input
                type="email"
                className="auth-input"
                placeholder="analyst@sentinel.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon w-4 h-4" />
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label">Confirm Password</label>
            <div className="auth-input-wrapper">
              <Lock className="auth-input-icon w-4 h-4" />
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
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
                Creating Account...
              </span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Create SentinelAI Account
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already registered?{' '}
          <Link to="/login" className="auth-link">
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
