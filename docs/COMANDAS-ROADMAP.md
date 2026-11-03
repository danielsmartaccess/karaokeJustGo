# Comandas: roteiro de produto (venda, pedido e pagamento)

Complementa [COMANDAS.md](COMANDAS.md) (desenho técnico). Aqui fica o **porquê** e a **ordem**.
Nada abaixo da Fase 2 existe em código: são decisões de produto e riscos, para o dono validar antes
de qualquer integração com dinheiro.

## 1. Diagnóstico

**Problema.** O bar perde venda e tempo no ponto mais frequente da noite: o garçom anota consumo.
Digitar é lento, erro se corrige mal, ninguém sugere o que vender junto, e o gerente só sabe o que
vendeu na hora de fechar o caixa.

**Causa raiz.** A comanda de papel (ou a anotação só de texto) não tem preço, não tem catálogo e
não tem memória do que costuma sair junto.

**Impacto esperado (hipóteses a medir no piloto, não promessas):** menos tempo por lançamento,
mais itens por comanda (venda sugestiva), menos erro de conta, decisão de cardápio com dado.

## 2. Fases

| Fase | Entrega                                                                                   | Estado                             |
| ---- | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| F1   | Anotação rápida: cardápio em grade, "−", "Desfazer", digitação `3 chopp`, catálogo curado | Protótipo pronto                   |
| F2   | Preço, total parcial, relatório de vendas, venda sugestiva                                | Protótipo pronto                   |
| F0   | Banco real: Auth da equipe, tabelas restritas, RLS, funções `open_tab` e `get_my_tab`     | **Pendente, bloqueia tudo abaixo** |
| F2b  | Taxa de serviço (opcional), divisão da conta, fechamento no sistema                       | A decidir                          |
| F3   | Pedido pelo cliente: carrinho no QR, aprovação do garçom, fila do bar e da cozinha        | Desenho                            |
| F4   | Pagamento: Pix com o valor da conta e cartão                                              | Desenho                            |
| F5   | Fiscal: NFC-e por integrador                                                              | Depende da UF e do regime do bar   |

Regra de ordem: **F0 antes de qualquer coisa com dado real ou dinheiro.** O protótipo roda em
`localStorage`, sem banco e sem login.

## 3. Pedido pelo cliente (F3)

- O cliente monta o pedido no celular, a partir do mesmo catálogo; o pedido **não vira consumo
  sozinho**: o garçom aprova (ou a regra do bar libera sem aprovação para itens simples).
- Pedido aprovado cai numa fila por estação (bar, cozinha) e vira linha no livro-razão, com autoria
  ("pedido pelo cliente, aprovado por Carlos").
- Risco: pedido de celular que não é da mesa. Mitigação: QR por mesa e comanda confirmada pelo garçom.

## 4. Pagamento pelo app (F4)

Escolhas de princípio, que valem qualquer que seja o provedor:

- **O app nunca toca em dados de cartão.** Cartão só por checkout hospedado do provedor de pagamento
  (PSP). Isso mantém o escopo de conformidade (PCI) no mínimo.
- **Pix dinâmico**: o PSP gera a cobrança com o valor da conta e devolve QR e "copia e cola". A
  confirmação chega por **webhook**; o app não presume pagamento pelo clique do cliente.
- **Idempotência** em toda criação de cobrança e em todo webhook (o mesmo aviso pode chegar duas
  vezes). **Conciliação** diária entre o que o PSP liquidou e o que a comanda cobrou.
- Valor cobrado = total conferido e **congelado** no momento do pagamento; consumo lançado depois
  gera nova cobrança, não altera a paga.
- Estorno e disputa (chargeback) precisam de dono e de processo antes de ligar o cartão.

## 5. Indicadores do piloto (Armazém Anita)

| Indicador                 | Como medir                                              |
| ------------------------- | ------------------------------------------------------- |
| Tempo por lançamento      | Tempo entre abrir a comanda e o 1º item; entre itens    |
| Itens por comanda         | Relatório de vendas (já existe no protótipo)            |
| Ticket médio              | Relatório de vendas                                     |
| Adoção da venda sugestiva | Toques em "Costuma sair junto" sobre sugestões exibidas |
| Divergência com o caixa   | Total da comanda x total fechado no caixa físico        |
| Itens sem preço           | Alerta do relatório (meta: zero)                        |

## 6. Riscos

- **Total parcial confundido com conta final.** Mitigação: aviso em todas as telas ("sujeito a
  conferência no caixa") até existir fechamento.
- **Preço desatualizado no catálogo.** O preço da hora fica gravado no lançamento; o gerente edita
  o catálogo pelo celular. Venda sem preço é sinalizada.
- **Sugestão enviesada** pelo histórico (o que já vende mais vende ainda mais). Contagem simples,
  transparente, revisável; avaliar no piloto se amplia ou só repete.
- **LGPD**: nome e telefone guardados para sempre (decisão do dono) convivem mal com prazo de guarda
  e pedido de exclusão; ver seção 10 de COMANDAS.md. Registro financeiro e dado pessoal devem ser
  separáveis.
- **Fiscal**: vender pelo app exige emissão correta de documento fiscal; é obrigação do bar.

## 7. O que NÃO foi verificado

- Custo de cada meio de pagamento (taxa do cartão, tarifa do Pix) e qual PSP escolher.
- Se o PSP escolhido libera Pix dinâmico e checkout hospedado para o porte do bar.
- Qual sistema de caixa/PDV o bar usa hoje e se emite NFC-e; exigência fiscal da UF.
- Se o bar quer taxa de serviço e como divide a conta.
- Tempo real de lançamento com garçons de verdade (o protótipo não foi testado em campo).

## 8. Próximo passo recomendado

1. Dono valida o protótipo (cardápio, vendas, preços de exemplo).
2. Levantar PDV e fiscal do bar (perguntas acima).
3. Fase 0: homologação separada da produção no Supabase (decisão de custo pendente do dono).
4. Piloto só com F1 e F2 e medir os indicadores antes de F3 e F4.
