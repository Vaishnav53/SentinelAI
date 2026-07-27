import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TriangleAlert, ShieldAlert, Info, X } from 'lucide-react';

export default function ConfirmDialog({ isOpen, config, onConfirm, onCancel }) {
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const triggerElementRef = useRef(document.activeElement);

  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement;
      // Focus cancel button by default to prevent accidental destructive enter keypress
      setTimeout(() => {
        if (cancelBtnRef.current) {
          cancelBtnRef.current.focus();
        }
      }, 50);
    } else {
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        // Simple focus trap
        const focusables = [cancelBtnRef.current, confirmBtnRef.current].filter(Boolean);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !config) return null;

  const {
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger" // "danger" | "warning" | "info"
  } = config;

  const getHeaderIcon = () => {
    switch (variant) {
      case 'danger':
        return <ShieldAlert size={20} />;
      case 'warning':
        return <TriangleAlert size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  return (
    <AnimatePresence>
      <div className="confirm-backdrop" onClick={onCancel}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className={`confirm-card confirm-card--${variant}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          <div className="confirm-header">
            <div className={`confirm-header-icon confirm-header-icon--${variant}`}>
              {getHeaderIcon()}
            </div>
            <h3 id="confirm-dialog-title" className="confirm-title">{title}</h3>
          </div>

          <div id="confirm-dialog-message" className="confirm-body">
            {message}
          </div>

          <div className="confirm-footer">
            <button
              ref={cancelBtnRef}
              type="button"
              className="confirm-btn confirm-btn-cancel"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              className={`confirm-btn confirm-btn-${variant}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
