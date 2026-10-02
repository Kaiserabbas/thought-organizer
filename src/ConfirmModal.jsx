import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Deletion',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  confirmText = 'Confirm Delete',
  cancelText = 'Cancel',
  onConfirm,
  onClose,
  isDanger = true,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="confirm-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="confirm-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon-wrap danger">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3>{title}</h3>
            <p className="confirm-modal-message">{message}</p>
          </div>
          <button type="button" className="confirm-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="confirm-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`primary-button ${isDanger ? 'danger-button' : ''}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <Trash2 size={16} /> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
