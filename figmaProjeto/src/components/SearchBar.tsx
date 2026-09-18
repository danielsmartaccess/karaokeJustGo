import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = 'Pesquise por música ou artista...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-4 py-3.5 bg-slate-900 border border-slate-700 hover:border-purple-500/50 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25 rounded-xl text-slate-200 placeholder-slate-500 outline-none transition-all duration-200"
        />
      </div>
      <button
        type="submit"
        className="px-6 py-3.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold rounded-xl transition-all duration-200 neon-glow-purple shrink-0"
      >
        Buscar
      </button>
    </form>
  );
}
