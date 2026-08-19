/** Configuração central do Financeiro 3.1. */
var FIN = {
  VERSION: '3.1',
  TIMEZONE: 'America/Sao_Paulo',
  SHEETS: {
    CONFIG: '01 - Configurações',
    REVENUES: '02 - Receitas',
    EXPENSE_CATALOG: '03 - Cadastro de Despesas',
    MOVEMENTS: '04 - Movimentações',
    CATEGORIES: '05 - Categorias',
    NET_WORTH: '06 - Patrimônio',
    HISTORY: '07 - Histórico',
    DASHBOARD: '08 - Dashboard',
    REPORT: '09 - Relatório WhatsApp'
  },
  HEADERS: {
    CONFIG: ['ID', 'Nome', 'Valor', 'Descrição', 'Atualizado Em'],
    REVENUES: ['ID Movimento', 'Competência', 'Data', 'Descrição', 'Categoria', 'Valor Realizado', 'Observação', 'Origem'],
    EXPENSE_CATALOG: ['ID', 'Descrição', 'Categoria ID', 'Categoria', 'Valor Planejado', 'Possui Vencimento', 'Dia do Vencimento', 'Recorrente', 'Ativa', 'Observação', 'Criado Em', 'Atualizado Em'],
    MOVEMENTS: ['ID', 'Competência', 'Data', 'Tipo', 'Origem', 'Cadastro Despesa ID', 'Descrição', 'Categoria ID', 'Categoria', 'Valor Planejado', 'Valor Realizado', 'Valor Pago', 'Possui Vencimento', 'Data de Vencimento', 'Pago', 'Data do Pagamento', 'Observação', 'Criado Em', 'Atualizado Em'],
    CATEGORIES: ['ID', 'Categoria', 'Ativa', 'Observação', 'Criado Em', 'Atualizado Em'],
    NET_WORTH: ['ID', 'Ativo ID', 'Descrição', 'Valor', 'Data', 'Observação', 'Origem', 'Registrado Em'],
    HISTORY: ['ID', 'Data', 'Hora', 'Usuário', 'Operação', 'Tabela', 'Registro', 'Valor Anterior', 'Valor Novo', 'Resultado', 'Erro']
  },
  TYPES: {
    REVENUE: 'RECEITA',
    EXPENSE: 'DESPESA',
    CARD_PURCHASE: 'COMPRA_CARTAO',
    CARD_BILL: 'FATURA_CARTAO',
    ADJUSTMENT: 'AJUSTE'
  },
  YES: 'Sim',
  NO: 'Não',
  NOT_APPLICABLE: 'N/A',
  ORIGINS: { FORM: 'FORMULÁRIO', RECURRENCE: 'RECORRÊNCIA', SYSTEM: 'SISTEMA' },
  OPERATIONS: {
    REVENUE: 'Registrar receita',
    EXPENSE: 'Registrar despesa',
    CARD: 'Registrar compra no cartão',
    PAYMENT: 'Registrar pagamento',
    CARD_CURRENT: 'Atualizar Cartão Atual',
    NET_WORTH: 'Atualizar patrimônio',
    CORRECTION: 'Corrigir lançamento',
    PLANNED_VALUE: 'Atualizar valor planejado',
    DELETE: 'Excluir lançamento'
  },
  SEMAPHORE: { GREEN: 'VERDE', YELLOW: 'AMARELO', RED: 'VERMELHO', NONE: '—' },
  CARD_CURRENT_PREFIX: 'CARTAO_ATUAL::',
  CONFIG_KEYS: {
    CURRENT_MONTH: 'MÊS_ATUAL',
    CURRENT_YEAR: 'ANO_ATUAL',
    CURRENCY: 'MOEDA',
    USER_NAME: 'NOME_USUÁRIO',
    FORM_ID: 'FORM_ID',
    FORM_URL: 'FORM_URL'
  },
  INITIAL_CATEGORIES: ['Alimentação', 'Gasolina', 'Matheus', 'Miranda', 'Spotify', 'Academia', 'Moradia', 'Educação', 'Saúde', 'Lazer', 'Outras'],
  EDITABLE_CORRECTION_FIELDS: ['Descrição', 'Categoria', 'Valor Planejado', 'Valor Realizado', 'Possui Vencimento', 'Data de Vencimento', 'Data', 'Competência', 'Observação']
};
