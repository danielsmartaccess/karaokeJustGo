import { test, expect } from '@playwright/test';

/**
 * Smoke das três experiências do produto: participante, telão e Host.
 * Roda contra o build de produção servido no base path do GitHub Pages.
 */

test('participante busca uma música e envia para aprovação', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Escolha sua música' })).toBeVisible();

  await page.getByPlaceholder(/pesquise por música ou artista/i).fill('Evidências');
  await page.getByRole('button', { name: 'Buscar' }).click();

  // Primeiro resultado da busca (API real ou catálogo de demonstração).
  await page.getByRole('button', { name: 'Cantar' }).first().click();

  await expect(page.getByRole('heading', { name: 'Quem vai cantar?' })).toBeVisible();
  await page.getByPlaceholder(/ana, dj carlos/i).fill('Teste E2E');
  await page.getByRole('button', { name: /enviar para aprovação/i }).click();

  await expect(page.getByRole('heading', { name: 'Aguardando aprovação!' })).toBeVisible();
  await expect(page.getByText('Teste E2E')).toBeVisible();
});

test('modo palco abre pela própria rota', async ({ page }) => {
  await page.goto('./#/telao');

  await expect(page.getByText('AO VIVO')).toBeVisible();
});

test('catálogo de karaokê aparece e filtra por gênero', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByText('As mais pedidas no karaokê')).toBeVisible();
  await expect(page.getByText('Evidências')).toBeVisible();

  await page.getByRole('button', { name: 'Rock internacional' }).click();
  // Sertanejo sai de cena quando o filtro muda.
  await expect(page.getByText('Evidências')).toHaveCount(0);
  await expect(page.getByText('Bohemian Rhapsody')).toBeVisible();
});

test('host entra sem senha e alcança o controle do telão', async ({ page }) => {
  await page.goto('./#/host');

  await expect(page.getByRole('heading', { name: 'Entrar como Host' })).toBeVisible();
  await page.getByLabel('Nome do Host').fill('Dani');
  await page.getByRole('button', { name: 'ENTRAR NO KARAOKÊ' }).click();

  await expect(page.getByRole('button', { name: /telão/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /^📺 Telão$/ }).click();
  await expect(page.getByText('Status do Telão')).toBeVisible();
  await expect(page.getByText('Preview do Telão')).toBeVisible();
});

test('host alcança a fila e vê o estado vazio', async ({ page }) => {
  await page.goto('./#/host');
  await page.getByLabel('Nome do Host').fill('Dani');
  await page.getByRole('button', { name: 'ENTRAR NO KARAOKÊ' }).click();

  await page.getByRole('button', { name: /^Fila/ }).click();

  // Sem ninguém na fila, o painel mostra o estado vazio previsto na
  // especificação. O botão de chamar no WhatsApp exige participante com
  // telefone, então sua cobertura fica nos testes unitários (whatsapp.test.ts)
  // e no scripts/verifica-sincronia.mjs, que monta o cenário de ponta a ponta.
  await expect(page.getByText('Fila vazia')).toBeVisible();
});
