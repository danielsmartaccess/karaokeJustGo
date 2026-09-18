import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4 select-none">{icon}</div>
      <h3 className="text-lg font-display font-semibold text-slate-300 mb-2">{title}</h3>
      {description && <p className="text-slate-500 text-sm max-w-xs mb-6">{description}</p>}
      {action}
    </div>
  );
}
