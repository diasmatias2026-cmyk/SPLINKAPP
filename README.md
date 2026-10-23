# Splink Zap / SplinkApp

Extensão para organizar atendimento no WhatsApp Web: biblioteca, campanhas persistentes, funis, fluxos visuais, respostas por gatilhos, contatos e relatórios.

**Estado: piloto local em validação.** API Oficial, licenças, painel administrativo, página de vendas e pagamentos ainda não estão conectados nesta versão. A implementação anterior permanece separada.

## Instalar no Edge ou Chrome

1. Execute `npm run check` usando Node.js 22 ou superior. Não há dependências para instalar nesta etapa.
2. Abra `edge://extensions` ou `chrome://extensions` e habilite o modo de desenvolvedor.
3. Selecione **Carregar sem compactação** e escolha `extension/dist`.
4. Recarregue o WhatsApp Web. Clique no ícone da extensão ou em **Abrir Splink**.
5. Prepare um conteúdo, crie uma campanha pausada e confira conta, contatos e mensagens antes de iniciar.

O pacote distribuível é gerado em `artifacts/splink-zap-2.0.0.zip`, junto do checksum SHA-256. Para instalar a partir do ZIP, extraia e carregue a pasta que contém `manifest.json`.

## Desenvolvimento

- `npm run dev`: prévia em `http://127.0.0.1:4178`, sem transporte de mensagens.
- `npm test`: testes de domínio, fila, segurança, transporte simulado e ZIP.
- `npm run test:coverage`: cobertura dos módulos carregados pelos testes Node.
- `npm run check`: validação estática, testes e pacote completo.

Os testes de navegador estão em `extension/tests/browser.cjs` e `extension/tests/extension.cjs`. Consulte [TESTS.md](TESTS.md) para execução e limites da evidência.

## Comportamento operacional

Os dados ficam no IndexedDB do perfil do navegador. Exporte backups regularmente. Desinstalar a extensão, limpar os dados ou trocar de perfil pode remover o acesso aos dados locais.

A fila mantém conta, destinatário, conteúdo e estado de cada execução. Uma operação com resultado incerto não é reenviada automaticamente. “Aceito” significa sucesso do transporte; entrega e leitura dependem dos eventos observados. A pausa e o cancelamento afetam as próximas etapas; uma chamada já iniciada pode terminar.

O motor local depende do navegador e do WhatsApp Web abertos e disponíveis. Suspensão da aba, atualização do WhatsApp ou desconexão podem atrasar tarefas. A compatibilidade com uma conta real ainda precisa de homologação controlada.

## Próximas etapas

Veja [STATUS.md](docs/STATUS.md), [API-OFICIAL.md](docs/API-OFICIAL.md) e [MERCADO-PAGO.md](docs/MERCADO-PAGO.md). A prioridade aprovada é estabilizar o sistema, publicar painel e página de vendas e integrar Mercado Pago por último.

Nunca inclua chaves privadas do Supabase, tokens Meta, credenciais de pagamento ou dados de clientes em commits. `.env.example` contém somente nomes de variáveis e valores públicos de configuração.

Biblioteca de transporte: WPPConnect WA-JS, projeto independente da Meta. Licença e avisos em [extension/THIRD-PARTY-NOTICES.md](extension/THIRD-PARTY-NOTICES.md). Código proprietário de outras extensões não foi incorporado.
