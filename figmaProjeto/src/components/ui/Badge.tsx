import React from 'react';
import { QueueStatus } from '../../types';

const config: Record<QueueStatus, { label: string; cls: string; pulse?: boolean }> = {
  pending: {
    label: 'PENDENTE',
    cls: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    pulse: true,
  },
  playing: {
    label: 'EM EXECUÇÃO',
    cls: 'bg-green-500/15 text-green-400 border-green-500/40',
    pulse: true,
  },
  next: {
    label: 'PRÓXIMO',
    cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
  },
  waiting: {
    label: 'AGUARDANDO',
    cls: 'bg-slate-700/50 text-slate-400 border-slate-600/60',
  },
  completed: {
    label: 'CONCLUÍDO',
    cls: 'bg-purple-500/15 text-purple-400 border-purple-500/40',
  },
  cancelled: {
    label: 'CANCELADO',
    cls: 'bg-red-500/15 text-red-400 border-red-500/40',
  },
};

interface BadgeProps {
  status: QueueStatus;
  className?: string;
}

export default function Badge({ status, className = '' }: BadgeProps) {
  const { label, cls, pulse } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium tracking-widest border ${cls} ${className}`}
    >
      {pulse && <span className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${status === 'pending' ? 'bg-amber-400' : 'bg-green-400'}`} />}
      {label}
    </span>
  );
}
