# Decisões técnicas — Financeiro 3.1

Estas decisões complementam a especificação sem alterar suas regras de negócio.

## Fonte oficial e visualizações

`04 - Movimentações` é o único livro de eventos financeiros. `02 - Receitas` é uma visualização lógica derivada dos movimentos de tipo `RECEITA`; por isso não é fonte de dados nem recebe lançamentos próprios. Dashboard e Relatório WhatsApp também são visualizações regeneráveis.

## Valores planejados e realizados

Movimentações possuem colunas separadas para `Valor Planejado`, `Valor Realizado` e `Valor Pago`.

- Uma recorrência mensal nasce com valor planejado e sem valor realizado.
- Uma despesa avulsa registrada pelo formulário possui, por informação explícita do usuário, o mesmo valor planejado e realizado, mas nasce com `Pago = Não`.
- A compra no cartão recebe valor realizado e participa do Resultado Atual por meio do agregado `Cartão (Despesas)`. Seu valor planejado, quando informado, também compõe o Custo Planejado — que é sempre a soma do planejado de despesas, faturas do cartão e compras no cartão, refletida em tempo real a qualquer correção.
- Ao registrar explicitamente um pagamento sem valor pago, o valor planejado preenche o valor realizado somente se ele ainda estiver vazio. Isso é consequência da confirmação de pagamento e não altera o estado por cálculo.

## Cartão

Compras no cartão são movimentos de tipo `COMPRA_CARTAO`. O total agregado é calculado em memória para cada competência e não é persistido como um segundo movimento, evitando dupla contagem. `Cartão Atual` é uma configuração persistida sob a chave `CARTAO_ATUAL::<competência>`; cada competência mantém seu próprio valor manual. Alterações são auditadas no Histórico.

## Patrimônio

Cada atualização grava uma nova posição, nunca substitui a anterior. O campo técnico `Ativo ID` identifica a série de um ativo; o patrimônio apresentado é a soma da posição mais recente de cada ativo. Essa soma é apenas um indicador e não atualiza os valores registrados.

## Recorrências e competência

Uma recorrência é criada uma única vez por par `Cadastro Despesa ID + Competência`. A geração é idempotente. Quando o dia de vencimento não existe no mês, usa-se o último dia daquele mês. Atualizar valor planejado muda o cadastro para competências futuras e atualiza a recorrência não realizada da competência informada; meses passados permanecem históricos.

## Semáforo

`Pago` é o único estado operacional. O semáforo é recalculado visualmente: `VERDE` para pago, `AMARELO` para não pago ainda não vencido e `VERMELHO` para não pago vencido. A atualização diária do semáforo não altera dados de negócio.

## Correções e auditoria

Correções atualizam o movimento alvo e registram valor anterior, novo valor e motivo no Histórico. O campo `Pago` não é corrigível por esse caminho: somente a operação explícita **Registrar pagamento** muda o estado de pagamento.

## Consistência transacional

O código valida antes de alterar dados e usa `LockService` para serializar operações. Escritas em registros e visualizações são registradas em uma transação compensável; se uma etapa falhar, os dados restauráveis são revertidos e apenas o log de erro permanece.

## Cargas de estado autorizadas

As cargas de julho e agosto de 2026 são operações técnicas de inicialização com marcadores próprios, execução transacional e histórico completo. A atualização de agosto exige a carga de julho, só aceita uma base sem movimentos prévios de agosto e registra como pagos exclusivamente Telefone, Internet e Academia, conforme autorização explícita. Os demais vencimentos, inclusive o Cartão, permanecem pendentes.

## Apresentação definida nesta implementação

O Dashboard mostra competência, entradas, custo planejado, resultado teórico, resultado atual, cartão atual, cartão (despesas), patrimônio e a lista de lançamentos pendentes. O Relatório WhatsApp usa a mesma sequência, com emojis fixos e uma seção de lançamentos sempre exibida.
