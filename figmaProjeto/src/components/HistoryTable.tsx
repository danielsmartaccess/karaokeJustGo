import React from 'react';
import { QueueEntry } from '../types';
import Badge from './ui/Badge';

interface HistoryTableProps {
  entries: QueueEntry[];
}

export default function HistoryTable({ entries }: HistoryTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-slate-600 font-display">
        Nenhuma apresentação registrada.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/40">
            <th className="text-left py-3 px-5 text-slate-400 font-medium">Participante</th>
            <th className="text-left py-3 px-5 text-slate-400 font-medium">Música</th>
            <th className="text-left py-3 px-5 text-slate-400 font-medium">Início</th>
            <th className="text-left py-3 px-5 text-slate-400 font-medium">Duração</th>
            <th className="text-left py-3 px-5 text-slate-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-slate-800/20 transition-colors">
              <td className="py-3.5 px-5 text-slate-200 font-medium">{entry.participant}</td>
              <td className="py-3.5 px-5">
                <div className="text-slate-200">{entry.song.title}</div>
                <div className="text-slate-500 text-xs mt-0.5">{entry.song.artist}</div>
              </td>
              <td className="py-3.5 px-5 text-slate-400 font-mono text-xs">
                {entry.startedAt ?? '—'}
              </td>
              <td className="py-3.5 px-5 text-slate-400 font-mono text-xs">
                {entry.startedAt ? entry.song.duration : '—'}
              </td>
              <td className="py-3.5 px-5">
                <Badge status={entry.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
