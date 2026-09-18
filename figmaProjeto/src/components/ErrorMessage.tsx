import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  title: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ title, message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 bg-red-500/8 border border-red-500/25 rounded-xl text-center">
      <AlertCircle className="w-8 h-8 text-red-400 shrink-0" />
      <div>
        <p className="text-red-300 font-semibold">{title}</p>
        {message && <p className="text-red-400/70 text-sm mt-1">{message}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
