# Mercado Pago: configuração do Pix para a fase de cobrança

Este documento prepara a etapa final do projeto. A integração de pagamentos **ainda não está habilitada**. A ordem combinada é: estabilizar a extensão → painel administrativo e página de vendas → Mercado Pago.

## O que será vendido

Nomes e preços mensais confirmados pelo responsável pelo produto:

| Plano | Mensalidade | Situação nesta fase |
|---|---:|---|
| Gratuito | R$ 0,00 | Sem cobrança |
| Ilimitado | R$ 49,90 | Checkout a implementar na fase de cobrança |
| API Oficial | R$ 99,90 | Depende também da homologação da integração Meta |

O nome Ilimitado se refere ao limite comercial da Splink. Não é promessa de ausência de limites, bloqueios ou regras do WhatsApp/Meta. Não habilitar a compra de uma capacidade que ainda não esteja disponível.

## 1. Preparar a conta Mercado Pago

1. Use a conta do titular responsável pelo recebimento das vendas. Conclua as verificações solicitadas pelo Mercado Pago.
2. Entre no [painel de desenvolvedores](https://www.mercadopago.com.br/developers/panel/app).
3. Em **Suas integrações**, crie ou selecione a aplicação da Splink Zap.
4. Para Pix com QR Code no próprio site, a trilha prevista é **Checkout API / Payments**. Os nomes exatos dos menus podem variar; siga a documentação correspondente à aplicação.
5. Confira os requisitos de Pix e credenciais apresentados para a sua conta. Esta preparação não cria cobranças.

Referência: [Integração Pix com Payments](https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/integration-configuration/integrate-pix?scope=prod).

## 2. Separar teste e produção

Use as credenciais de teste durante a homologação e as de produção apenas no ambiente de produção. As contas e dados de teste devem seguir as instruções do Mercado Pago; não substitua valores arbitrários por dados de clientes reais.

Variáveis previstas no **servidor da Vercel**:

```dotenv
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_ENVIRONMENT=test
APP_URL=https://SEU-DOMINIO
```

- `MERCADOPAGO_ACCESS_TOKEN`: credencial privada que autoriza a API de pagamentos.
- `MERCADOPAGO_WEBHOOK_SECRET`: assinatura secreta obtida na configuração de notificações.
- `MERCADOPAGO_ENVIRONMENT`: seleção explícita do ambiente da aplicação.
- `APP_URL`: domínio definitivo do backend/site; ainda será informado após a publicação.

Não enviar essas credenciais para a extensão, variáveis `NEXT_PUBLIC_*`, arquivos do GitHub, capturas de tela ou logs. No repositório devem existir somente os nomes das variáveis e exemplos vazios. A chave pública de um provedor tem finalidade diferente de um Access Token privado.

## 3. Criar uma cobrança Pix no backend

O fluxo previsto para a implementação é:

1. Cliente autenticado escolhe um plano. O navegador envia o identificador do plano e uma chave de idempotência, **sem controlar o preço**.
2. O servidor consulta o plano no Supabase, verifica disponibilidade e determina o preço em centavos: 4.990 ou 9.990 para as mensalidades confirmadas.
3. O servidor cria um pedido interno vinculado ao usuário. Uma tentativa repetida deve reutilizar esse pedido.
4. O servidor envia `POST https://api.mercadopago.com/v1/payments`, com `payment_method_id: "pix"`, valor em reais, dados do pagador exigidos pelo provedor, referência do pedido e `X-Idempotency-Key`.
5. O QR Code/copia e cola retornados são exibidos ao comprador. Um QR Code gerado não equivale a pagamento aprovado.
6. A tela acompanha o estado do pedido consultando o backend. O usuário pode fechar e reabrir a página sem gerar outra cobrança por acidente.

O contrato final do endpoint da Splink será definido na fase de cobrança. Não existe endpoint de checkout pronto nesta entrega.

## 4. Configurar o webhook quando o domínio existir

1. No painel da aplicação Mercado Pago, abra **Webhooks / Notificações**.
2. Configure o endereço HTTPS do endpoint implementado pela Splink. Exemplo de formato futuro:

   `https://SEU-DOMINIO/api/webhooks/mercadopago`

3. Habilite o evento correspondente a **pagamentos** no ambiente correto.
4. Guarde a assinatura secreta nas variáveis privadas do servidor.
5. Use a ferramenta de teste do provedor e confira os registros da Vercel sem imprimir segredos.

O endereço acima é uma proposta para a implementação futura, não uma rota já publicada. Configurar notificações para uma rota inexistente não conclui a integração.

Referência: [Webhooks do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks).

## 5. Confirmar pagamento antes de liberar a licença

O backend deverá:

- Validar a assinatura `x-signature` de acordo com a documentação, incluindo os campos de identificação exigidos.
- Tratar a notificação como um aviso para consultar o pagamento diretamente na API do Mercado Pago.
- Conferir pedido/referência externa, recebedor quando aplicável, usuário do pedido, moeda BRL, valor exato, método Pix e ambiente.
- Liberar acesso somente com estado efetivamente aprovado. `pending`, redirecionamento do navegador e mensagem do frontend não liberam acesso.
- Aplicar a liberação em transação no Supabase, com identificador único por pagamento. Repetir o mesmo webhook não pode duplicar dias de acesso.
- Tratar reembolso, cancelamento, estorno e alterações posteriores segundo a política comercial definida.
- Responder rapidamente e aceitar que notificações podem ser repetidas ou chegar fora de ordem.

Referência: [Orientações de webhooks do SDK oficial Node.js](https://github.com/mercadopago/sdk-nodejs/blob/master/docs/webhooks.md).

## 6. Homologação obrigatória

Antes de habilitar vendas:

| Cenário | Resultado esperado |
|---|---|
| Gerar Pix | Um pedido, um valor e um QR Code válidos |
| Clique repetido / recarga | Reutiliza a cobrança, sem duplicar pedido |
| Pagamento pendente | Acesso pago continua bloqueado |
| Pagamento aprovado | Acesso correto liberado uma vez |
| Webhook repetido | Não renova a licença duas vezes |
| Assinatura inválida | Nenhuma alteração de licença |
| Valor/moeda/pedido divergentes | Nenhuma liberação; caso fica auditável |
| Supabase ou provedor indisponível | Pedido preservado, recuperação segura |
| Notificações fora de ordem | Consulta ao provedor determina o estado atual |
| Reembolso/estorno | Regra de revogação aplicada conforme a política |
| Vencimento da licença | Regras de acesso respeitadas pela extensão |

A política de duração mensal, renovação, cancelamento e reembolso deve estar definida antes de vender. Um Pix avulso mensal não é, por si só, uma assinatura com cobrança automática.

## O que precisaremos na fase final

Domínio publicado, conta Mercado Pago verificada, credenciais corretas inseridas no servidor, webhook implementado e validado, planos no banco e política comercial aprovada. Até lá, manter pagamentos desabilitados e continuar os testes do sistema.
