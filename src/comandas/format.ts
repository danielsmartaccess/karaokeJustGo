import type { PhoneStatus } from './types';

/** 5551999990101 -> +55 (51) 99999-0101. Devolve o texto original se não casar. */
export function formatPhone(phone: string): string {
  const m = phone.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}` : phone;
}

/** O garçom nunca vê o número inteiro: só o final. */
export function maskedPhone(last4?: string): string {
  return last4 ? `•••• ${last4}` : 'sem celular';
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const PHONE_STATUS_LABEL: Record<PhoneStatus, string> = {
  informado: 'Celular informado',
  confirmado: 'Celular confirmado',
  sem_celular: 'Sem celular',
};

export const PHONE_STATUS_CLASS: Record<PhoneStatus, string> = {
  informado: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  confirmado: 'bg-green-500/15 text-green-300 border-green-500/40',
  sem_celular: 'bg-slate-700/40 text-slate-300 border-slate-600',
};
