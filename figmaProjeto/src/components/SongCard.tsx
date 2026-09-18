import React from 'react';
import { Song } from '../types';
import { Clock, AlertTriangle, Mic2 } from 'lucide-react';

interface SongCardProps {
  song: Song;
  onSing: (song: Song) => void;
}

const FALLBACK = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=160&h=112&fit=crop&auto=format';

export default function SongCard({ song, onSing }: SongCardProps) {
  return (
    <div className="flex gap-4 items-center bg-slate-900 hover:bg-slate-800/70 border border-slate-800 hover:border-purple-500/30 rounded-xl p-4 transition-all duration-200 group">
      <div className="relative w-20 h-14 shrink-0 rounded-lg overflow-hidden bg-slate-800">
        <img
          src={song.thumbnail}
          alt={`${song.title} thumbnail`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK;
          }}
        />
        {!song.available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-slate-100 font-semibold truncate group-hover:text-purple-300 transition-colors leading-tight">
          {song.title}
        </h3>
        <p className="text-slate-400 text-sm truncate">{song.artist}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-slate-500 text-xs">
            <Clock className="w-3 h-3" />
            {song.duration}
          </span>
          {!song.available && (
            <span className="text-red-400 text-xs font-medium">Vídeo indisponível</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onSing(song)}
        disabled={!song.available}
        className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
          song.available
            ? 'bg-purple-600 hover:bg-purple-500 text-white neon-glow-purple'
            : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
        }`}
      >
        {song.available ? (
          <>
            <Mic2 className="w-4 h-4" />
            Cantar
          </>
        ) : (
          'Indisponível'
        )}
      </button>
    </div>
  );
}
