import { test, expect } from '@playwright/test';

/**
 * Protótipo das comandas (modo demonstração): o fluxo atravessa os três papéis
 * no mesmo navegador. Só o hash muda entre as telas, então o estado persiste.
 */

test('cliente abre a comanda, o garçom confirma e lança, o gerente vê o consumo', async ({
  page,
}) => {
  // --- Cliente ---
  await page.goto('./#/comanda');
  await expect(page.getByTestId('aviso-prototipo')).toBeVisible();

  await page.getByLabel('Nome', { exact: true }).fill('Teste Silva');
  await page.getByLabel('Celular com DDD').fill('51 99999-0909');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Abrir minha comanda' }).click();

  const minha = page.getByTestId('minha-comanda');
  await expect(minha).toContainText('Teste Silva');
  await expect(minha).toContainText('Celular informado');

  // --- Garçom ---
  await page.goto('./#/garcom');
  await page.getByRole('button', { name: 'Entrar como Carlos' }).click();
  await page.getByLabel('Buscar comanda').fill('0909'); // 4 últimos dígitos
  await page
    .getByTestId('resultados')
    .getByRole('button', { name: /Teste Silva/ })
    .click();

  const painel = page.getByTestId('painel-comanda');
  await painel.getByRole('button', { name: 'Confirmar celular' }).click();
  await expect(painel.getByText('Celular confirmado')).toBeVisible();

  await painel.getByLabel('Item').fill('3 chop'); // abreviação + quantidade
  await painel
    .getByTestId('sugestoes')
    .getByRole('button', { name: /3× Chopp/ })
    .click();
  await expect(painel.getByRole('status')).toContainText('Lançado: 3× Chopp');
  await expect(painel.getByTestId('resumo-garcom')).toContainText('3×');

  // --- Cliente vê o próprio consumo ---
  await page.goto('./#/comanda');
  await expect(page.getByTestId('consumo-cliente')).toContainText('Chopp');
  await expect(page.getByTestId('minha-comanda')).toContainText('Celular confirmado');

  // --- Gerente ---
  await page.goto('./#/gerente');
  await page.getByRole('button', { name: 'Entrar como Marina' }).click();
  await page.getByLabel('Buscar').fill('Teste');
  const cartao = page.locator('[data-testid^="comanda-"]', { hasText: 'Teste Silva' });
  await expect(cartao).toContainText('Celular confirmado');
  await expect(cartao).toContainText('Chopp');
  await expect(cartao).toContainText('(51) 99999-0909'); // o gerente vê o celular inteiro
});

test('item digitado novo vira sugestão e o gerente cura o catálogo', async ({ page }) => {
  await page.goto('./#/garcom');
  await page.getByRole('button', { name: 'Entrar como Carlos' }).click();
  await page
    .getByTestId('resultados')
    .getByRole('button', { name: /Bruno Lima/ })
    .click();

  const painel = page.getByTestId('painel-comanda');
  await painel.getByLabel('Item').fill('suco de maracujá gelado');
  await painel
    .getByRole('button', { name: /Adicionar “suco de maracujá gelado” como novo item/ })
    .click();
  await expect(painel.getByRole('status')).toContainText('novo item');

  await page.goto('./#/gerente');
  await page.getByRole('button', { name: 'Entrar como Marina' }).click();
  await page.getByRole('tab', { name: 'Catálogo' }).click();
  const sugeridos = page.getByTestId('sugeridos');
  await expect(sugeridos.getByLabel('Nome do item suco de maracujá gelado')).toBeVisible();

  await sugeridos
    .locator('div', { has: page.getByLabel('Nome do item suco de maracujá gelado') })
    .getByRole('button', { name: 'Aprovar' })
    .first()
    .click();
  await expect(
    page.getByTestId('aprovados').getByLabel('Nome do item suco de maracujá gelado'),
  ).toBeVisible();
});

test('o mesmo celular não abre duas comandas no mesmo dia', async ({ page }) => {
  await page.goto('./#/comanda');
  await page.getByLabel('Nome', { exact: true }).fill('Outra Pessoa');
  await page.getByLabel('Celular com DDD').fill('(51) 99999-0101'); // celular da Ana, na demonstração
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Abrir minha comanda' }).click();

  await expect(page.getByRole('alert')).toContainText('já tem uma comanda hoje');
  await expect(page.getByTestId('minha-comanda')).toHaveCount(0);
});

test('a equipe pendente não entra; o gerente ativa o acesso', async ({ page }) => {
  await page.goto('./#/garcom');
  await expect(page.getByText('João: aguardando o gerente ativar o acesso')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar como João' })).toHaveCount(0);

  await page.goto('./#/gerente');
  await page.getByRole('button', { name: 'Entrar como Marina' }).click();
  await page.getByRole('tab', { name: /Equipe/ }).click();
  await page.locator('li', { hasText: 'João' }).getByRole('button', { name: 'Ativar' }).click();

  await page.goto('./#/garcom');
  await expect(page.getByRole('button', { name: 'Entrar como João' })).toBeVisible();
});
