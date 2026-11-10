import { ComandaError, type ComandaErrorCode } from './types';

/** Texto para o usuário de cada código de erro do contrato. */
const MESSAGES: Record<ComandaErrorCode, string> = {
  'invalid-name': 'Informe o nome.',
  'invalid-phone': 'Informe um celular válido com DDD, por exemplo 51 99999-0000.',
  'phone-already-open':
    'Este celular já tem uma comanda hoje. Chame o garçom para recuperar o acesso.',
  'daily-cap': 'Não foi possível abrir a comanda agora. Chame o garçom.',
  'not-found': 'Não encontramos esta comanda.',
  'tab-not-found': 'Não encontramos esta comanda.',
  'tab-not-open-today':
    'Esta comanda não aceita mais alterações (fechada, anulada ou de outro dia).',
  'tab-closed': 'Esta conta já foi fechada.',
  'invalid-qty': 'Quantidade inválida (de 1 a 99).',
  'empty-name': 'Informe o nome do item.',
  'unpriced-items':
    'Há itens sem preço nesta conta. Defina o preço no catálogo ou feche mesmo assim.',
  'invalid-payment-method': 'Escolha como a conta foi paga.',
  'cannot-reopen': 'Só é possível reabrir uma conta fechada hoje.',
  'cannot-deactivate-self': 'Você não pode desativar a si mesmo.',
  'cannot-change-own-role': 'Você não pode mudar o seu próprio papel.',
  'name-taken': 'Já existe um item com esse nome.',
  'invalid-price': 'Preço inválido.',
  forbidden: 'Você não tem permissão para isso. Entre de novo ou fale com o gerente.',
  network: 'Sem conexão. Verifique a internet e tente de novo.',
  unknown: 'Algo deu errado. Tente de novo.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ComandaError) return MESSAGES[error.code];
  return MESSAGES.unknown;
}
