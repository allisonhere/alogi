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
    iconClass: 'text-emerald-500',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-500',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-500',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
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
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 p-4 pb-0">
              <div className={cn("flex-shrink-0 mt-0.5", config.iconClass)}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-lg">
                  {dialog.title}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 pl-[52px]">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {dialog.message}
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {confirmLabels.cancel}
                  </button>
                  <button
                    onClick={handleConfirm}
                    autoFocus
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", config.buttonClass)}
                  >
                    {confirmLabels.confirm}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleClose}
                  autoFocus
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", config.buttonClass)}
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
