import { useState, type FormEvent } from 'react';
import Logo from '../components/Logo';
import { Star } from 'lucide-react';

/**
 * Entrada do Host — sem senha, por decisão do MVP.
 *
 * O Host conduz a noite e precisa assumir o painel em segundos, muitas vezes
 * num aparelho emprestado. A troca é consciente: conveniência operacional
 * agora, Supabase Auth quando a operação sair de um único bar.
 * Ver docs/SECURITY.md.
 */
export default function HostLogin({ onEnter }: { onEnter: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Informe o nome do Host para entrar.');
      return;
    }
    onEnter(trimmed);
  };

  return (
    <div className="min-h-screen bg-[#06000e] flex flex-col items-center justify-center px-5 pb-24">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Logo size="lg" showTagline />
        </div>

        <div className="bg-slate-900/60 border border-pink-900/30 rounded-2xl p-6 retro-border">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Star className="w-5 h-5 text-pink-400" />
            <h1 className="text-2xl font-display font-black text-white">Entrar como Host</h1>
          </div>
          <p className="text-slate-500 text-sm mb-6">
            Você vai conduzir a fila e o telão desta noite.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="host-name" className="block text-slate-400 text-sm mb-2">
                Nome do Host
              </label>
              <input
                id="host-name"
                type="text"
                value={name}
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
                placeholder="Ex.: Dani"
                className={`w-full px-4 py-3 bg-slate-800 border rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all focus:ring-2 focus:ring-pink-500/30 ${
                  error ? 'border-red-500' : 'border-slate-700 focus:border-pink-500'
                }`}
              />
              {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 text-white font-black rounded-xl transition-all neon-glow-pink text-base"
              style={{ background: '#e91e8c' }}
            >
              ENTRAR NO KARAOKÊ
            </button>
          </form>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6 font-mono">
          MVP sem senha — acesso restrito por combinação operacional
        </p>
      </div>
    </div>
  );
}
