import { test, expect } from '@playwright/test';

/**
 * Smoke test da FASE 1: o app carrega, mostra a home do participante e navega.
 * Os fluxos críticos (seção 43) entram nas fatias correspondentes.
 */
test('home do participante carrega e navega para o telão', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: /karaokê/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /entrar na sessão/i })).toBeVisible();

  await page.getByRole('button', { name: /ver o telão/i }).click();
  await expect(page.getByText(/telão/i).first()).toBeVisible();
});
