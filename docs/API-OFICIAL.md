# API Oficial: requisitos e critérios de aceite

O proprietário confirmou que a versão anterior conectava pelo botão que abria a configuração do Facebook. Preservar essa experiência é requisito. A versão nova ainda não implementa esse transporte; não apresentar a conexão como pronta.

## Conexão em um clique

Manter **Conectar com Facebook**, utilizando Embedded Signup da Meta ou um provedor cuja integração e titularidade sejam verificadas. A extensão solicita uma sessão ao backend autenticado; o backend gera estado único, com expiração, e valida origem, usuário e associação da conta no retorno. O frontend recebe estado de conexão, nunca um token permanente. Tokens e permissões ficam no servidor, associados ao cliente correto.

Critérios: retorno correto ao produto, tratamento de cancelamento e permissão negada, reconexão, prevenção de replay, validação do identificador da empresa/número e isolamento entre clientes. O proxy OAuth encontrado no sistema anterior não deve ser adotado sem confirmar contrato, controle e validações.

## Coexistência

Objetivo: permitir o uso do mesmo número no WhatsApp Business App e na Cloud API, quando a conta for elegível e a Meta permitir o fluxo de adesão. Verificar requisitos atuais de elegibilidade na implementação. Não prometer suporte irrestrito para qualquer número ou sincronização ilimitada de histórico.

Modelar explicitamente a origem de cada evento: API, aplicativo ou extensão local. Deduplicar por conta e ID da mensagem; mensagens próprias e ecos de sincronização não disparam respostas automáticas. Reconciliação deve lidar com eventos atrasados, repetidos e fora de ordem.

Critérios: adesão elegível, envio/recepção pelos dois canais, eco sem duplicação, reconexão, interrupção de sessão, mídia e tratamento claro de recursos não disponíveis em cada canal. Exigir ensaio real autorizado para declarar funcionamento.

## Estatísticas

Persistir mensagem, campanha, template, conta, tentativa e timestamps de eventos. Separar solicitação aceita, enviada, entregue, lida e falha. Aplicar estados sem regressão por webhook fora de ordem. Registrar código de falha com informação suficiente para diagnóstico, sem expor credenciais.

Entregas do painel:

- Volume por dia, campanha, número e template.
- Entregues/enviadas e lidas/entregues, com numerador, denominador, período e casos sem confirmação visíveis.
- Respostas recebidas, taxa de resposta por destinatário e tempo até primeira resposta, segundo uma janela de atribuição definida.
- Custos observados quando disponíveis e estimativas identificadas separadamente.
- Saúde da conexão, última sincronização, falhas e qualidade/limites do número quando disponibilizados pela Meta.

Cliques exigem links ou eventos rastreados. Vendas/conversões exigem sinal do CRM, checkout ou outra fonte real; leitura não significa conversão. Coexistência exige atribuição de canal para evitar contar ecos como mensagens novas.

## Backend necessário

Webhook HTTPS com verificação da Meta e validação da assinatura sobre o corpo original; eventos persistidos antes da confirmação; processamento idempotente; fila, retries limitados e diagnóstico; isolamento por cliente e RLS no Supabase; política de retenção e exclusão; testes de autorização e reprocessamento.

Templates devem ser consultados com paginação, idiomas, status e componentes suportados. O envio deve validar os parâmetros e respeitar as regras vigentes da Meta. Automações devem compartilhar o mesmo motor de regras sem misturar disponibilidade local com execução no servidor.

## Referências de implementação

- [Meta: onboarding de usuários do Business App](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [Meta: mensagens e status por webhook](https://www.postman.com/meta/whatsapp-business-platform/request/rgtfq23/message-status-update-notifications)
- [Meta: WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)

Este documento define requisitos. Não é evidência de integração já concluída nem de aprovação do aplicativo na Meta.
