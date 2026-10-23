# Estado de implementação

Atualização: 23/10/2026. Produto em piloto; não declarar paridade total com a análise competitiva nem funcionamento sem erros.

## Implementado no motor local

Biblioteca de texto, áudio, mídia, documento e contato; favoritos e busca; funis; editor de fluxos com rascunho e publicação; nós de conteúdo, espera, resposta e sorteio; campanhas por item/funil/fluxo com snapshots; agenda, pausa, cancelamento, retry de falha anterior ao envio; gatilhos de palavras e cooldown; contatos, etiquetas locais e opt-out; relatórios; backup de dados e blobs; tema e diagnóstico; resolução PN/LID nas operações de seleção e extração.

Persistência de fila, proteção por conta, tratamento de envio incerto, deduplicação de entrada e de solicitação de campanha têm testes. A interface e IndexedDB foram exercitados em navegador, e a extensão foi carregada com transporte sintético. Ainda falta homologação na conta real para comprovar compatibilidade de envio e recepção com a versão corrente do WhatsApp.

Também implementados: conversão de funil em rascunho independente de fluxo; adicionar, mover e remover etiquetas em lote na lista filtrada; limpeza por categoria com confirmação e bloqueio quando há execuções pendentes. Esta etapa tem 45 testes Node aprovados e ensaios de interface/IndexedDB e extensão com transporte simulado.

## Ainda necessário para completar o escopo

1. Completar e verificar capacidades locais restantes da matriz: captura de mensagens recebidas, barra rápida, opções de mídia/menções/presença suportadas, elegibilidade e conflitos de gatilhos, horários de operação, melhorias do editor, sincronização opcional de etiquetas WhatsApp e histórico de alterações.
2. Portar e homologar API Oficial conforme `API-OFICIAL.md`, incluindo conexão Meta, coexistência, webhooks e métricas reais. Depende de aplicativo/provedor Meta configurado, credenciais e número elegível para ensaio.
3. Configurar autenticação, banco, RLS e licenciamento com Supabase, mantendo o modo local independente da indisponibilidade do servidor conforme política comercial a definir.
4. Construir e publicar painel administrativo e página de vendas via GitHub/Vercel. Planos confirmados: Gratuito; Ilimitado R$49,90/mês; API Oficial R$99,90/mês.
5. Implementar Mercado Pago por último, primeiro em teste. Guia em `MERCADO-PAGO.md`.

Notificação e comandos pelo WhatsApp para o agente foram adiados pelo proprietário. Não fazem parte da etapa atual.

## Regra de conclusão

Um recurso só é concluído quando há implementação e evidência de teste correspondente. Recursos externos precisam de homologação real; testes com simuladores não comprovam aprovação Meta, entrega real, cobrança ou publicação.
