import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  open: boolean;
  title?: string;
  itemName?: string;
  itemNames?: string[];
  description?: string;
  confirmLabel?: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  open,
  title = 'Are you sure?',
  itemName,
  itemNames,
  description,
  confirmLabel,
  isDeleting = false,
  onCancel,
  onConfirm
}) => {
  if (!open) return null;

  const hasBatchNames = Array.isArray(itemNames) && itemNames.length > 0;
  const previewNames = hasBatchNames ? itemNames.slice(0, 6) : [];
  const remainingCount = hasBatchNames ? Math.max(0, itemNames.length - previewNames.length) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/40 p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="confirm-delete-title" className="text-base font-black text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {description
                  ? description
                  : hasBatchNames
                  ? `Are you sure you want to permanently remove ${itemNames.length} selected ${
                      itemNames.length === 1 ? 'file' : 'files'
                    }? This action cannot be undone.`
                  : itemName
                  ? `Kya aap waqai "${itemName}" ko delete karna chahte hain?`
                  : 'Kya aap waqai is item ko permanently delete karna chahte hain?'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Close confirmation"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {hasBatchNames && (
          <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-1.5 max-h-40 overflow-y-auto">
            <div className="text-[10px] font-black uppercase tracking-wider text-rose-300">
              Selected Files ({itemNames.length})
            </div>
            <ul className="space-y-1 text-xs text-slate-200">
              {previewNames.map((name, idx) => (
                <li key={`${idx}_${name}`} className="flex items-center gap-2 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
            {remainingCount > 0 && (
              <div className="text-[11px] font-semibold text-slate-400 pt-0.5">
                + {remainingCount} more {remainingCount === 1 ? 'file' : 'files'}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {isDeleting
                ? 'Deleting...'
                : confirmLabel ||
                  (hasBatchNames ? `Delete ${itemNames.length} Selected` : 'Yes, Delete')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
