import React from 'react';
import './Dialog.css';

interface DialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'confirm' | 'info' | 'success' | 'error';
  showCancel?: boolean;
}

const Dialog: React.FC<DialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  type = 'confirm',
  showCancel = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className={`dialog-container ${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{title}</h3>
        </div>
        <div className="dialog-content">
          {typeof message === 'string' ? (
            message.includes('<') ? (
              <p dangerouslySetInnerHTML={{ __html: message }}></p>
            ) : (
              <p>{message}</p>
            )
          ) : (
            message
          )}
        </div>
        <div className="dialog-actions">
          {showCancel && (
            <button className="dialog-cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button 
            className={`dialog-confirm ${type === 'confirm' ? 'confirm' : type}`} 
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dialog;