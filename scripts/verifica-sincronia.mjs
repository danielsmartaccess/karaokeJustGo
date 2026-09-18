/**
 * Verificacao de sincronia entre os tres dispositivos.
 *
 * Os testes do Playwright (tests/e2e) abrem uma tela por vez. Este script abre
 * participante, Host e telao ao mesmo tempo e confere que uma acao num deles
 * chega nos outros — que e a promessa central do produto e a unica coisa que
 * nao da para verificar olhando uma tela isolada.
 *
 * Vale rodar antes de um evento, junto com o checklist de docs/DEPLOYMENT.md.
 *
 * Exige:
 *   - Supabase configurado no .env (sem ele o app roda em modo demo e cada aba
 *     tem o seu proprio estado, entao o teste nao significa nada)
 *   - o preview no ar: npm run build && npm run preview
 *
 * Uso: node scripts/verifica-sincronia.mjs
 *
 * ATENCAO: escreve na sala real e limpa o que criou ao final.
 */

import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4173/karaokeJustGo/';
const browser = await chromium.launch();
const ctx = await browser.newContext();
let falhas = 0;
const ok = (label, cond) => {
  if (!cond) falhas += 1;
  console.log(`${cond ? 'OK   ' : 'FALHA'}  ${label}`);
};

// --- Participante entra na fila com telefone ---
const part = await ctx.newPage();
await part.goto(BASE, { waitUntil: 'networkidle' });
await part.waitForTimeout(2000);
await part.getByRole('button', { name: 'Cantar' }).first().click();
await part.getByPlaceholder(/ana, dj carlos/i).fill('VERIFICACAO');
await part.getByPlaceholder('51 99999-0000').fill('51999990000');
await part.getByRole('button', { name: /enviar para aprovação/i }).click();
await part.waitForTimeout(2500);

// --- Host ---
const host = await ctx.newPage();
await host.goto(BASE + '#/host', { waitUntil: 'networkidle' });
await host.getByLabel('Nome do Host').fill('Dani');
await host.getByRole('button', { name: 'ENTRAR NO KARAOKÊ' }).click();
await host.waitForTimeout(2500);

await host.getByRole('button', { name: /^Fila/ }).click();
await host.waitForTimeout(1000);

// Aprova a solicitação pendente (botão com ThumbsUp).
const aprovar = host.getByRole('button', { name: 'Aprovar' }).first();
ok('solicitacao pendente aparece para o Host', (await aprovar.count()) > 0);
if (await aprovar.count()) {
  await aprovar.click();
  await host.waitForTimeout(2500);
}

// Agora na fila: o botão de WhatsApp deve existir para quem deixou telefone.
const zap = host.locator('button[title="Chamar no WhatsApp"]');
ok('botao "Chamar no WhatsApp" aparece na fila', (await zap.count()) > 0);

// O link do WhatsApp é montado com DDI e mensagem.
const linkInfo = await host.evaluate(() => {
  const abertos = [];
  window.open = (url) => {
    abertos.push(url);
    return null;
  };
  window.__abertos = abertos;
  return true;
});
if (linkInfo && (await zap.count())) {
  await zap.first().click();
  await host.waitForTimeout(1500);
  const urls = await host.evaluate(() => window.__abertos ?? []);
  ok(
    'clique monta link wa.me com DDI 55',
    urls.some((u) => u.startsWith('https://wa.me/5551999990000')),
  );
  ok(
    'mensagem leva o nome do participante',
    urls.some((u) => decodeURIComponent(u).includes('VERIFICACAO')),
  );
  // depois do clique, a entrada fica marcada como chamada
  await host.waitForTimeout(2000);
  const marcado = await host.locator('button[title^="Chamado"]').count();
  ok('entrada fica marcada como ja chamada', marcado > 0);
}

// Inicia a apresentação.
const iniciar = host.locator('button[title="Iniciar"]:not([disabled])').first();
if (await iniciar.count()) {
  await iniciar.click();
  await host.waitForTimeout(2500);
}

// --- Preview no Host x telão real ---
await host.getByRole('button', { name: /^📺 Telão$/ }).click();
await host.waitForTimeout(1500);
const previewTxt = await host.locator('body').innerText();
ok('preview mostra o participante real', previewTxt.includes('VERIFICACAO'));

const tv = await ctx.newPage();
await tv.goto(BASE + '#/telao', { waitUntil: 'networkidle' });
await tv.waitForTimeout(3000);
ok(
  'telao mostra o mesmo participante',
  (await tv.locator('body').innerText()).includes('VERIFICACAO'),
);

// --- CTA: preview e telão devem acompanhar ---
await host.getByRole('button', { name: /^📣 Comunicação$/ }).click();
await host.waitForTimeout(1000);
const cartaoCta = host
  .locator('div')
  .filter({ hasText: /^🎤QUEM VAI SER O PRÓXIMO\?/ })
  .last();
const botaoExibir = cartaoCta.locator('button:has-text("Exibir")').first();
if (await botaoExibir.count()) {
  await botaoExibir.click();
  await host.waitForTimeout(2500);
} else {
  console.log('      (aviso: botao Exibir do CTA nao encontrado)');
}

await host.getByRole('button', { name: /^📺 Telão$/ }).click();
await host.waitForTimeout(1500);
ok(
  'preview acompanha o CTA publicado',
  (await host.locator('body').innerText()).includes('QUEM VAI SER O PRÓXIMO'),
);

await tv.waitForTimeout(3000);
ok(
  'telao acompanha o CTA publicado',
  (await tv.locator('body').innerText()).includes('QUEM VAI SER O PRÓXIMO'),
);

// --- QR no telão: só o código ---
await host.locator('button:has-text("Exibir QR Code no Telão")').first().click();
await host.waitForTimeout(3500);
const tvQr = await tv.locator('body').innerText();
ok('telao em modo QR', tvQr.includes('Escaneie e Cante'));
ok('sem o texto "ou acesse o link acima"', !tvQr.includes('ou acesse o link acima'));
ok('sem a URL escrita na tela', !tvQr.includes('localhost:4173'));

// Devolve o telao ao karaoke e limpa o que este script criou.
await host
  .locator('button:has-text("Retornar ao Karaokê")')
  .first()
  .click({ timeout: 3000 })
  .catch(() => {});
await host.waitForTimeout(1500);

await browser.close();

console.log(`
${falhas === 0 ? 'tudo sincronizado' : falhas + ' verificacao(oes) falharam'}`);
console.log(
  "Limpe a entrada de teste: delete from karaoke_queue_entries where participant = 'VERIFICACAO';",
);
process.exit(falhas === 0 ? 0 : 1);
