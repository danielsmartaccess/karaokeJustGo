import { useState } from 'react';
import { useBackend, useQuery } from './backend/hooks';
import { errorMessage } from './backend/messages';
import { ComandaError } from './backend/types';
import { ComandaShell, StatusChip } from './ComandaShell';
import { formatBRL } from './format';
import { serviceDay } from './rules';
import { cardClass, ghostButton, inputClass, primaryButton, primaryStyle } from './ui';

const MY_TAB_KEY = 'jg-comanda:my-tab';

interface Pointer {
  tabId: string;
  secret: string;
}

/** A comanda do cliente fica ligada ao aparelho (sem login): id e segredo no navegador. */
function readPointer(): Pointer | null {
  try {
    const raw = localStorage.getItem(MY_TAB_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pointer>;
    return typeof p.tabId === 'string' && typeof p.secret === 'string'
      ? { tabId: p.tabId, secret: p.secret }
      : null;
  } catch {
    return null;
  }
}
/**
 * Recuperação de acesso: o garçom mostra um QR com o segredo novo
 * (`?t=<comanda>&s=<segredo>`). Guardamos no aparelho e tiramos o segredo do
 * endereço na hora, para não ficar no histórico do navegador.
 */
function consumeAccessLink(): Pointer | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const tabId = params.get('t');
    const secret = params.get('s');
    if (!tabId || !secret) return null;
    params.delete('t');
    params.delete('s');
    const rest = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
    );
    const pointer = { tabId, secret };
    writePointer(pointer);
    return pointer;
  } catch {
    return null;
  }
}

function writePointer(p: Pointer | null) {
  try {
    if (p) localStorage.setItem(MY_TAB_KEY, JSON.stringify(p));
    else localStorage.removeItem(MY_TAB_KEY);
  } catch {
    // sem armazenamento: a comanda vale só enquanto a página estiver aberta
  }
}

/**
 * Tela do cliente: lê o QR, informa nome e celular, acompanha o consumo, pede a
 * conta e vê o valor final quando o gerente fecha. Sem login.
 */
export default function ClienteView() {
  const backend = useBackend();
  const [pointer, setPointer] = useState<Pointer | null>(
    () => consumeAccessLink() ?? readPointer(),
  );

  const trocar = (p: Pointer | null) => {
    writePointer(p);
    setPointer(p);
  };

  const mine = useQuery(
    () => backend.getMyTab(pointer!.tabId, pointer!.secret),
    [pointer?.tabId, pointer?.secret],
    { every: 8000, enabled: pointer !== null },
  );

  // --- Formulário de abertura ---
  const [nome, setNome] = useState('');
  const [celular, setCelular] = useState('');
  const [mesa, setMesa] = useState('');
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const abrir = async () => {
    setErro('');
    if (!aceito) {
      setErro('Aceite o aviso de privacidade para continuar.');
      return;
    }
    setOcupado(true);
    try {
      const r = await backend.openTab({ name: nome, phone: celular, table: mesa });
      trocar({ tabId: r.tabId, secret: r.secret });
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setOcupado(false);
    }
  };

  const pedirConta = async () => {
    if (!pointer) return;
    setErro('');
    try {
      await backend.requestBill(pointer.tabId, pointer.secret);
      await mine.reload();
    } catch (e) {
      setErro(errorMessage(e));
    }
  };

  if (pointer) {
    const tab = mine.data;
    const perdida = mine.error instanceof ComandaError && mine.error.code === 'not-found';

    if (perdida || (tab && tab.serviceDay !== serviceDay(Date.now()))) {
      return (
        <ComandaShell papel="cliente" titulo="Minha comanda">
          <div className={cardClass}>
            <p className="text-slate-300 text-sm mb-3">
              {perdida
                ? 'Não encontramos esta comanda neste aparelho. Se você já tinha uma hoje, chame o garçom para recuperar o acesso.'
                : 'Sua comanda anterior era de outro dia e já não aceita itens. Cada dia tem uma comanda nova.'}
            </p>
            <button onClick={() => trocar(null)} className={primaryButton} style={primaryStyle}>
              Abrir uma comanda de hoje
            </button>
          </div>
        </ComandaShell>
      );
    }

    if (!tab) {
      return (
        <ComandaShell papel="cliente" titulo="Minha comanda">
          <p className="text-slate-500 text-sm">
            {mine.error ? errorMessage(mine.error) : 'Carregando a sua comanda…'}
          </p>
        </ComandaShell>
      );
    }

    const fechada = tab.status === 'fechada';
    const total = fechada ? (tab.closedTotalCents ?? tab.totalCents) : tab.totalCents;

    return (
      <ComandaShell papel="cliente" titulo="Minha comanda">
        <div className={`${cardClass} text-center mb-4`} data-testid="minha-comanda">
          <p className="text-xs font-mono tracking-[0.3em] text-pink-400 uppercase">Comanda</p>
          <p className="text-7xl font-display font-black text-white leading-none my-2">
            {tab.code}
          </p>
          <p className="text-slate-300">
            {tab.customerName}
            {tab.tableLabel ? ` · mesa ${tab.tableLabel}` : ''}
          </p>
          <div className="mt-2">
            <StatusChip status={tab.phoneStatus} />
          </div>
          {tab.phoneStatus === 'informado' && (
            <p className="text-amber-200/90 text-sm mt-3">
              Chame o garçom e diga o número da comanda para confirmar o seu celular.
            </p>
          )}
        </div>

        {tab.status === 'conta_pedida' && (
          <div
            className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 mb-4 text-sky-200 text-sm"
            data-testid="conta-pedida"
          >
            <strong>Conta pedida.</strong> O gerente foi avisado e vai fechar a sua conta. Você
            ainda pode pedir mais itens ao garçom.
          </div>
        )}
        {fechada && (
          <div
            className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 mb-4 text-green-200 text-sm"
            data-testid="conta-final"
          >
            <strong>Conta fechada.</strong> Valor final {formatBRL(total)}. O pagamento é feito no
            caixa.
          </div>
        )}
        {tab.status === 'anulada' && (
          <div className="rounded-xl border border-slate-700 p-3 mb-4 text-slate-400 text-sm">
            Esta comanda foi anulada. Fale com o garçom se isso foi um engano.
          </div>
        )}

        <div className={cardClass}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300">Consumo de hoje</h2>
            <span className="text-xs text-slate-500">
              {tab.units} {tab.units === 1 ? 'item' : 'itens'}
            </span>
          </div>
          {tab.lines.length === 0 ? (
            <p className="text-slate-500 text-sm">
              Nenhum item ainda. O garçom lança aqui e esta lista atualiza sozinha.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800" data-testid="consumo-cliente">
              {tab.lines.map((l) => (
                <li key={l.catalogItemId} className="flex items-center gap-3 py-2.5">
                  <span className="text-pink-400 font-mono font-bold w-10">{l.qty}×</span>
                  <span className="text-slate-200 flex-1">{l.name}</span>
                  {l.totalCents > 0 && (
                    <span className="text-slate-400 text-sm">{formatBRL(l.totalCents)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {tab.lines.length > 0 && (
            <div className="border-t border-slate-800 mt-3 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-400">
                  {fechada ? 'Total da conta' : 'Total até agora'}
                </span>
                <span
                  className="text-2xl font-display font-black text-white"
                  data-testid="total-cliente"
                >
                  {formatBRL(total)}
                </span>
              </div>
              {!fechada && (
                <p className="text-xs text-slate-600 mt-1">
                  Valor parcial, sujeito a conferência no caixa
                  {tab.unpricedUnits > 0 && ` (${tab.unpricedUnits} item(ns) ainda sem preço)`}.
                </p>
              )}
            </div>
          )}
        </div>

        {erro && (
          <p role="alert" className="text-red-400 text-sm mt-3">
            {erro}
          </p>
        )}

        {tab.status === 'aberta' && (
          <button
            onClick={() => void pedirConta()}
            data-testid="pedir-conta"
            className={`${primaryButton} w-full mt-4`}
            style={primaryStyle}
          >
            Pedir a conta
          </button>
        )}

        {/* Roteiro: pagamento pelo app (Pix com o valor da conta e cartão) ainda não existe. */}
        {!fechada && (
          <div className={`${cardClass} mt-4 opacity-70`} data-testid="pagamento-em-breve">
            <p className="text-sm font-semibold text-slate-300">Pagar pelo app</p>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              Em breve: pagar com Pix (valor da conta) ou cartão, sem esperar a conta. Por enquanto,
              o pagamento é no caixa.
            </p>
            <button disabled className={`${primaryButton} w-full`} style={primaryStyle}>
              Pagar pelo app (em breve)
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          <button onClick={() => trocar(null)} className={ghostButton}>
            Não sou {tab.customerName.split(' ')[0]} (sair)
          </button>
        </div>
      </ComandaShell>
    );
  }

  return (
    <ComandaShell papel="cliente" titulo="Abrir minha comanda">
      <div className={cardClass}>
        <p className="text-slate-400 text-sm mb-4">
          Informe seu nome e celular. O garçom vai confirmar o número com você na mesa.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-slate-400 text-sm mb-1.5">Nome</span>
            <input
              className={inputClass}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ana"
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="block text-slate-400 text-sm mb-1.5">Celular com DDD</span>
            <input
              className={inputClass}
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              placeholder="51 99999-0000"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="block">
            <span className="block text-slate-400 text-sm mb-1.5">
              Mesa ou onde você está sentado (opcional)
            </span>
            <input
              className={inputClass}
              value={mesa}
              onChange={(e) => setMesa(e.target.value)}
              placeholder="Ex.: mesa 4, balcão"
            />
          </label>
          <label className="flex items-start gap-2.5 text-xs text-slate-400 leading-snug">
            <input
              type="checkbox"
              checked={aceito}
              onChange={(e) => setAceito(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Declaro ser o titular do celular informado. Meu nome e celular ficam guardados pelo
              bar para a comanda e para contato operacional. Posso pedir a exclusão a qualquer
              momento.
            </span>
          </label>
          {erro && (
            <p role="alert" className="text-red-400 text-sm">
              {erro}
            </p>
          )}
          <button
            onClick={() => void abrir()}
            disabled={ocupado}
            className={`${primaryButton} w-full`}
            style={primaryStyle}
          >
            Abrir minha comanda
          </button>
        </div>
      </div>
    </ComandaShell>
  );
}
