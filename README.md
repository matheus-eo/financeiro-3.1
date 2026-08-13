# Financeiro 3.1

Implementação em Google Apps Script do sistema definido na especificação oficial Financeiro 3.1.

## Conteúdo

- `src/`: arquivos a serem adicionados a um projeto vinculado ao Google Sheets.
- `build/create_template.mjs`: gera o modelo local da planilha para posterior importação ao Google Sheets.
- `tests/run-tests.mjs`: testes automatizados das regras puras.
- `docs/TECHNICAL_DECISIONS.md`: decisões técnicas que não alteram regras de negócio.

## Implantação

1. Crie ou importe o arquivo `outputs/Financeiro_3.1.xlsx` no Google Sheets. Ele contém a carga inicial autorizada de julho e a atualização autorizada de agosto de 2026.
2. Abra **Extensões → Apps Script** na planilha e copie os arquivos de `src/` para o projeto.
3. Atualize o manifesto `appsscript.json` no editor do Apps Script.
4. Execute `setupFinanceiro3_1` uma vez e conceda as permissões solicitadas.
5. No menu **Financeiro 3.1**, execute **Criar/atualizar Formulário Inteligente**.
6. Opcionalmente, instale os gatilhos de manutenção diária pelo mesmo menu.

O formulário é o ponto oficial de entrada. As abas de Dashboard, Receitas e Relatório WhatsApp são visualizações derivadas; não devem ser usadas para edição de dados.

Se optar por iniciar em uma planilha vazia, execute `loadInitialStateJuly2026` pelo menu após a configuração e, em seguida, `loadAugust2026Update`. As duas funções usam marcadores de conclusão e impedem duplicidade. Não as execute sobre o arquivo já carregado.

## Operação

- Use **Gerar recorrências da competência atual** no primeiro uso do mês ou deixe o gatilho diário fazer isso.
- Use **Reconstruir visualizações** para recalcular as saídas a partir da base oficial, sem modificar estados de pagamento.
- O cartão atual é salvo por competência em Configurações e nunca é derivado das compras no cartão.

## Limites de implantação

O projeto usa apenas Google Sheets, Google Forms e Google Apps Script. A criação da planilha e do formulário exige execução dentro de uma conta Google autorizada; o código-fonte e o template local não podem conceder permissões ou criar recursos na conta do usuário por conta própria.
