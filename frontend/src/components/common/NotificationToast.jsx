import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Info, TriangleAlert, XCircle, ShieldAlert, X } from 'lucide-react';

export default function NotificationToast({ notification, onClose }) {
  const { id, type = 'info', title, message } = notification;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} />;
      case 'info':
        return <Info size={18} />;
      case 'warning':
        return <TriangleAlert size={18} />;
      case 'error':
        return <XCircle size={18} />;
      case 'critical':
        return <ShieldAlert size={18} />;
      default:
        return <Info size={18} />;
    }
  };

  const isAlert = type === 'error' || type === 'critical';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`toast-item toast-item--${type}`}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
    >
      <div className="toast-icon-wrapper">
        {getIcon()}
      </div>
      <div className="toast-content">
        <div className="toast-title">
          <span>{title}</span>
          <span className={`toast-badge toast-badge--${type}`}>{type}</span>
        </div>
        {message && <div className="toast-message">{message}</div>}
      </div>
      <button
        type="button"
        className="toast-close-btn"
        onClick={() => onClose(id)}
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
