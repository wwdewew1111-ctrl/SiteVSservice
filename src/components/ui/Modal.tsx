import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClass?: string;
  stickyClose?: boolean;
}

export function Modal({ open, onClose, title, children, widthClass = 'max-w-2xl', stickyClose = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[92vh] w-full ${widthClass} animate-slide-up overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className={`${stickyClose ? 'sticky float-right -mb-9' : 'absolute'} right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
