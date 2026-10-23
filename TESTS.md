# Evidências e execução de testes

Em 23/10/2026: 45 testes Node passaram. O relatório `node --experimental-test-coverage` mediu 84,05% de linhas dos módulos carregados, com 100% das linhas do motor. Não representa cobertura de toda a interface ou do produto completo.

`npm run check` executa sintaxe/manifesto, testes e build/ZIP. A integridade do ZIP tem teste de CRC, bytes e diretório. O manifesto limita os hosts ao WhatsApp Web e usa CSP sem execução remota na página da extensão.

## Registro por risco

| ID | Risco | Evidência |
|---|---|---|
| T01 | Corrupção de CSV e número | `extension/tests/domain.test.mjs`, `security.test.mjs` |
| T02 | Duplicação, concorrência e retomada insegura | `extension/tests/engine.test.mjs`, `security.test.mjs` |
| T03 | Conta incorreta, opt-out e respostas repetidas | `extension/tests/engine.test.mjs`, `transport.test.mjs` |
| T04 | Rascunho virar execução ou snapshot mudar | `extension/tests/domain.test.mjs`, `security.test.mjs` |
| T05 | Backup malicioso ou perda de arquivo | `extension/tests/security.test.mjs`, `browser.cjs` |
| T06 | Injeção HTML e perda de persistência | `extension/tests/browser.cjs` |
| T07 | CSP, service worker e origem não autorizada | `extension/tests/extension.cjs` |
| T08 | LID tratado como telefone | `extension/tests/transport.test.mjs` |
| T09 | ACK associado à conta errada ou regredir | `extension/tests/engine.test.mjs` |
| T10 | Pacote inválido | `extension/tests/package.test.mjs` |
| T11 | Conversão alterar sequência, lote perder opt-out ou limpeza fora do escopo | `extension/tests/workspace.test.mjs`, `browser.cjs` |

## Navegador

Instale Playwright em um ambiente de testes separado ou use uma instalação existente. Em `extension`, execute `node tests/browser.cjs` com o servidor `npm run preview` ativo. Execute `node tests/extension.cjs` após o build.

As variáveis `SPLINK_PLAYWRIGHT_PATH` (caminho absoluto de um `package.json` próximo ao módulo Playwright) e `SPLINK_BROWSER` (executável Chromium/Edge) permitem apontar para as instalações locais. A CI configura esses caminhos automaticamente.

Os testes utilizam perfis isolados. No ensaio da extensão, toda a URL do WhatsApp é interceptada por um documento sintético e WPP simulado; não há conta real nem envio real. Capturas e resultados ficam em `extension/artifacts`, ignorado pelo Git.

O ensaio da interface verifica biblioteca, segurança de texto, favoritos, recarga, funil, publicação de fluxo, contato e etiqueta, campanha pausada, transações concorrentes, exportação/restauração de Blob, preservação de dados diante de backup inválido, bloqueio de restore durante operação e layout de 390px sem overflow.

## Lacunas de homologação

Não foram realizados envios em conta real; falta confirmar tipos de mídia, eventos recebidos/ACK e suspensão/retomada em ambiente real. API Oficial, OAuth Meta, coexistência, Supabase Auth/RLS, licenças, Vercel e Mercado Pago não têm implementação validada nesta etapa.
