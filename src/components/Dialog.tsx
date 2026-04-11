'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type DialogVariant = 'success' | 'error' | 'warning' | 'info';

interface DialogOptions {
  title: string;
  message: string;
  variant?: DialogVariant;
}

interface ConfirmOptions extends DialogOptions {
  confirmLabel?: string;
  cancelLabel?: string;
}

interface DialogState extends DialogOptions {
  type: 'alert' | 'confirm';
  resolve?: (value: boolean) => void;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => void;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

const variantConfig: Record<DialogVariant, { icon: typeof CheckCircle; iconClass: string; buttonClass: string }> = {
  success: {
    icon: CheckCircle,
    iconClass: 'text-[var(--success)]',
    buttonClass: 'ui-button ui-button-primary',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-[var(--danger)]',
    buttonClass: 'ui-button ui-button-primary',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-[var(--warning)]',
    buttonClass: 'ui-button ui-button-primary',
  },
  info: {
    icon: Info,
    iconClass: 'text-[var(--accent)]',
    buttonClass: 'ui-button ui-button-primary',
  },
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [confirmLabels, setConfirmLabels] = useState<{ confirm: string; cancel: string }>({
    confirm: 'Confirm',
    cancel: 'Cancel',
  });

  const showDialog = useCallback((options: DialogOptions) => {
    setDialog({
      ...options,
      type: 'alert',
      variant: options.variant || 'info',
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmLabels({
        confirm: options.confirmLabel || 'Confirm',
        cancel: options.cancelLabel || 'Cancel',
      });
      setDialog({
        ...options,
        type: 'confirm',
        variant: options.variant || 'warning',
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (dialog?.type === 'confirm' && dialog.resolve) {
      dialog.resolve(false);
    }
    setDialog(null);
  }, [dialog]);

  const handleConfirm = useCallback(() => {
    if (dialog?.resolve) {
      dialog.resolve(true);
    }
    setDialog(null);
  }, [dialog]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter' && dialog?.type === 'alert') {
      handleClose();
    }
  }, [handleClose, dialog?.type]);

  const variant = dialog?.variant || 'info';
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <DialogContext.Provider value={{ showDialog, showConfirm }}>
      {children}

      {dialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
          onKeyDown={handleKeyDown}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            className="ui-card w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-4 pb-0">
              <div className={cn("flex-shrink-0 mt-0.5", config.iconClass)}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="dialog-title" className="font-semibold text-primary text-lg">
                  {dialog.title}
                </h3>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close dialog"
                className="flex-shrink-0 p-1 rounded-md text-muted hover:text-primary hover:bg-[var(--surface-hover)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 pl-[52px]">
              <p className="text-sm text-secondary whitespace-pre-wrap">
                {dialog.message}
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-subtle bg-[var(--surface-bg)]">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={handleClose}
                    className="ui-button ui-button-secondary px-4 py-2 text-sm font-medium"
                  >
                    {confirmLabels.cancel}
                  </button>
                  <button
                    onClick={handleConfirm}
                    autoFocus
                    className={cn("px-4 py-2 text-sm font-medium", config.buttonClass)}
                  >
                    {confirmLabels.confirm}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleClose}
                  autoFocus
                  className={cn("px-4 py-2 text-sm font-medium", config.buttonClass)}
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
