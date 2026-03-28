import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-[2px] transition-opacity"
          onClick={onClose}
        />

        <div
          className={`relative glass-white ${sizeClasses[size]} w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col`}
          style={{ borderRadius: '16px' }}
        >
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200/60">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900 pr-2">{title}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-full p-1 flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
