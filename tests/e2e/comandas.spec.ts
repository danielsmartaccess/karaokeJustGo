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

  // Um toque no cardápio = +1, com o total parcial atualizando na hora.
  const chopp = painel.getByRole('button', { name: 'Adicionar Chopp' });
  await chopp.click();
  await chopp.click();
  await chopp.click();
  await expect(painel.getByTestId('qtd-chopp')).toHaveText('3×');
  await expect(painel.getByTestId('total-comanda')).toHaveText(/R\$\s*36,00/);

  // Errou? "−" tira uma unidade; "Desfazer" cancela o último toque.
  await painel.getByRole('button', { name: 'Tirar um Chopp' }).click();
  await expect(painel.getByTestId('total-comanda')).toHaveText(/R\$\s*24,00/);
  await chopp.click();
  await painel.getByRole('button', { name: 'Desfazer' }).click();
  await expect(painel.getByTestId('total-comanda')).toHaveText(/R\$\s*24,00/);
  await expect(painel.getByTestId('resumo-garcom')).toContainText('2×');

  // --- Cliente vê o próprio consumo e o total parcial ---
  await page.goto('./#/comanda');
  await expect(page.getByTestId('consumo-cliente')).toContainText('Chopp');
  await expect(page.getByTestId('total-cliente')).toHaveText(/R\$\s*24,00/);
  await expect(page.getByTestId('pagamento-em-breve').getByRole('button')).toBeDisabled();
  await expect(page.getByTestId('minha-comanda')).toContainText('Celular confirmado');

  // --- Gerente ---
  await page.goto('./#/gerente');
  await page.getByRole('button', { name: 'Entrar como Marina' }).click();
  await page.getByRole('tab', { name: 'Comandas' }).click();
  await page.getByLabel('Buscar').fill('Teste');
  const cartao = page.locator('[data-testid^="comanda-"]', { hasText: 'Teste Silva' });
  await expect(cartao).toContainText('Celular confirmado');
  await expect(cartao).toContainText('Chopp');
  await expect(cartao).toContainText('(51) 99999-0909'); // o gerente vê o celular inteiro
  await expect(cartao.getByTestId(/^total-/)).toHaveText(/R\$\s*24,00/);
});

test('o garçom lança por texto ("2 caipirinha") e recebe a sugestão do que costuma sair junto', async ({
  page,
}) => {
  await page.goto('./#/garcom');
  await page.getByRole('button', { name: 'Entrar como Carlos' }).click();
  await page.getByTestId('resultados').getByRole('button', { name: /Carla/ }).click();

  const painel = page.getByTestId('painel-comanda');
  // A comanda da Carla já tem caipirinha; nas outras comandas ela saiu com isca de frango.
  const junto = painel.getByTestId('costuma-sair-junto');
  await expect(junto).toContainText('Isca de frango');
  await expect(junto).toContainText('com Caipirinha');

  await painel.getByLabel('Item').fill('2 gin');
  await painel
    .getByTestId('sugestoes')
    .getByRole('button', { name: /2× Gin tônica/ })
    .click();
  await expect(painel.getByRole('status')).toContainText('Lançado: 2× Gin tônica');
  await expect(painel.getByTestId('total-comanda')).toHaveText(/R\$\s*100,00/); // 2x22 + 2x28

  await junto.getByRole('button', { name: /Isca de frango/ }).click();
  await expect(painel.getByTestId('total-comanda')).toHaveText(/R\$\s*138,00/); // + 38
  // Já está na comanda: deixa de ser oferecida (outras sugestões podem citá-la como motivo).
  await expect(junto.getByRole('button', { name: /^\+ Isca de frango/ })).toHaveCount(0);
});

test('o gerente acompanha as vendas e precifica o item vendido sem preço', async ({ page }) => {
  // Venda sem preço: item digitado na hora.
  await page.goto('./#/garcom');
  await page.getByRole('button', { name: 'Entrar como Carlos' }).click();
  await page
    .getByTestId('resultados')
    .getByRole('button', { name: /Bruno Lima/ })
    .click();
  const painel = page.getByTestId('painel-comanda');
  await painel.getByLabel('Item').fill('petisco da casa');
  await painel.getByRole('button', { name: /Adicionar “petisco da casa” como novo item/ }).click();

  await page.goto('./#/gerente');
  await page.getByRole('button', { name: 'Entrar como Marina' }).click();

  // Aba Vendas é a primeira: KPIs do dia e alerta de item sem preço.
  const vendas = page.getByTestId('vendas');
  await expect(vendas.getByTestId('kpi-comandas')).toHaveText('3');
  await expect(vendas.getByTestId('mais-vendidos')).toContainText('Chopp');
  const alerta = vendas.getByTestId('alerta-sem-preco');
  await expect(alerta).toContainText('petisco da casa');
  const faturamentoAntes = await vendas.getByTestId('kpi-faturamento').innerText();

  // Precifica no catálogo: o alerta some e o faturamento sobe.
  await page.getByRole('tab', { name: 'Catálogo' }).click();
  await page.getByLabel('Preço de petisco da casa').fill('15,50');
  await page.getByLabel('Preço de petisco da casa').blur();
  await page.getByRole('tab', { name: 'Vendas' }).click();
  await expect(vendas.getByTestId('alerta-sem-preco')).toHaveCount(0);
  await expect(vendas.getByTestId('kpi-faturamento')).not.toHaveText(faturamentoAntes);
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
