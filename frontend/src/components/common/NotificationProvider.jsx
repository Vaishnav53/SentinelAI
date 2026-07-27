import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import NotificationToast from './NotificationToast';
import ConfirmDialog from './ConfirmDialog';
import './Notification.css';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const confirmResolverRef = useRef(null);
  const recentNotificationsRef = useRef(new Map());

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback((options) => {
    const {
      type = 'info',
      title = 'Notification',
      message = '',
      duration,
      persistent = false
    } = typeof options === 'string' ? { message: options } : options;

    // Deduplication check: prevent exact same title+message within 2 seconds
    const key = `${type}:${title}:${message}`;
    const now = Date.now();
    const lastTime = recentNotificationsRef.current.get(key);
    if (lastTime && now - lastTime < 2000) {
      return;
    }
    recentNotificationsRef.current.set(key, now);

    const id = `notif_${now}_${Math.random().toString(36).substr(2, 6)}`;

    // Default durations (ms)
    let autoDismissTime = 4000;
    if (duration !== undefined) {
      autoDismissTime = duration;
    } else {
      switch (type) {
        case 'success':
          autoDismissTime = 3000;
          break;
        case 'info':
          autoDismissTime = 4000;
          break;
        case 'warning':
          autoDismissTime = 5000;
          break;
        case 'error':
          autoDismissTime = 10000;
          break;
        case 'critical':
          autoDismissTime = 0; // Persistent
          break;
        default:
          autoDismissTime = 4000;
      }
    }

    if (persistent) {
      autoDismissTime = 0;
    }

    const newNotif = { id, type, title, message };

    setNotifications((prev) => {
      // Keep max 4 visible notifications
      const updated = [newNotif, ...prev];
      return updated.slice(0, 4);
    });

    if (autoDismissTime > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, autoDismissTime);
    }

    return id;
  }, [removeNotification]);

  // Helper shortcuts
  notify.success = (title, message, opts = {}) => notify({ type: 'success', title, message, ...opts });
  notify.info = (title, message, opts = {}) => notify({ type: 'info', title, message, ...opts });
  notify.warning = (title, message, opts = {}) => notify({ type: 'warning', title, message, ...opts });
  notify.error = (title, message, opts = {}) => notify({ type: 'error', title, message, ...opts });
  notify.critical = (title, message, opts = {}) => notify({ type: 'critical', title, message, ...opts });

  const confirmAction = useCallback((config) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmConfig(config);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(true);
      confirmResolverRef.current = null;
    }
    setConfirmConfig(null);
  }, []);

  const handleCancel = useCallback(() => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
    setConfirmConfig(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, confirmAction }}>
      {children}

      {/* Floating Toast Notification Stack */}
      <div className="toast-container">
        <AnimatePresence>
          {notifications.map((n) => (
            <NotificationToast
              key={n.id}
              notification={n}
              onClose={removeNotification}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Modal Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmConfig)}
        config={confirmConfig}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
