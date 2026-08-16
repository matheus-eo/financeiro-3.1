// Configuração da API (Apps Script Web App do Financeiro 3.1).
const API_URL = 'https://script.google.com/macros/s/AKfycbxKavPigKXlf916RCVWWKUsEFbmu577Xlu30axCeq_AymxCxkrMZyyw1sUokhUtFVhK/exec';

let idToken = sessionStorage.getItem('idToken') || '';

// Mensagens que o servidor devolve quando o idToken está ausente, expirado ou inválido.
// Nesses casos o app precisa voltar para a tela de login em vez de só mostrar um aviso.
const AUTH_ERROR_MESSAGES = [
  'Faça login para continuar.',
  'Sessão expirada. Faça login novamente.',
  'Token não pertence a este app.',
  'E-mail não verificado.',
  'Conta não autorizada.'
];

function isAuthError_(message) {
  return AUTH_ERROR_MESSAGES.indexOf(message) >= 0;
}

function formatMoney(value) {
  const number = Number(value) || 0;
  return 'R$ ' + number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

async function apiGet(action) {
  const url = API_URL + '?action=' + encodeURIComponent(action) + '&idToken=' + encodeURIComponent(idToken);
  const response = await fetch(url);
  const data = await response.json();
  if (!data.ok) {
    if (isAuthError_(data.error)) showLogin(data.error);
    throw new Error(data.error || 'Erro desconhecido.');
  }
  return data;
}

async function apiPost(action, payload) {
  const body = Object.assign({ action: action, idToken: idToken }, payload);
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!data.ok) {
    if (isAuthError_(data.error)) showLogin(data.error);
    throw new Error(data.error || 'Erro desconhecido.');
  }
  return data;
}

function renderSnapshot(snapshot) {
  document.getElementById('competencia-atual').textContent = 'Competência ' + snapshot.competence;
  document.getElementById('resumo-entradas').textContent = formatMoney(snapshot.entries);
  document.getElementById('resumo-planejado').textContent = formatMoney(snapshot.plannedCost);

  const atual = document.getElementById('resumo-atual');
  atual.textContent = formatMoney(snapshot.currentResult);
  atual.className = 'valor ' + (snapshot.currentResult >= 0 ? 'positivo' : 'negativo');

  document.getElementById('resumo-pendentes').textContent = snapshot.launches.length;
}

async function loadSnapshot() {
  try {
    const data = await apiGet('snapshot');
    renderSnapshot(data.snapshot);
  } catch (error) {
    document.getElementById('competencia-atual').textContent = 'Não foi possível carregar o resumo.';
  }
}

async function loadCategories() {
  const selects = [document.getElementById('categoria'), document.getElementById('categoria-cartao')];
  try {
    const data = await apiGet('categories');
    const options = '<option value="">Selecione…</option>' +
      data.categories.map(function(category) {
        return '<option value="' + category + '">' + category + '</option>';
      }).join('');
    selects.forEach(function(select) { select.innerHTML = options; });
  } catch (error) {
    selects.forEach(function(select) { select.innerHTML = '<option value="">Erro ao carregar categorias</option>'; });
  }
}

function movementLabel_(movement) {
  const planned = formatMoney(movement.plannedValue);
  const realized = movement.realizedValue === '' || movement.realizedValue === null ? '—' : formatMoney(movement.realizedValue);
  return movement.description + ' — Plan.: ' + planned + ' / Real.: ' + realized + ' (' + movement.tipo + ')';
}

async function loadRecentMovements() {
  const select = document.getElementById('lancamento-correcao');
  try {
    const data = await apiGet('recentMovements');
    select.innerHTML = '<option value="">Selecione…</option>' +
      data.movements.map(function(movement) {
        return '<option value="' + movement.id + '">' + movementLabel_(movement) + '</option>';
      }).join('');
  } catch (error) {
    select.innerHTML = '<option value="">Erro ao carregar lançamentos</option>';
  }
}

function showMessage(elementId, text, isError) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = 'mensagem ' + (isError ? 'erro' : 'sucesso');
  // Erros ficam visíveis até a próxima ação: um aviso que some sozinho pode passar
  // despercebido e dar a falsa impressão de que o lançamento foi salvo.
  if (!isError) {
    setTimeout(function() { el.className = 'mensagem'; }, 6000);
  }
}

function setupForm() {
  const dataInput = document.getElementById('data');
  dataInput.value = todayISO();

  const checkboxVencimento = document.getElementById('possui-vencimento');
  const blocoVencimento = document.getElementById('bloco-vencimento');
  const dataVencimento = document.getElementById('data-vencimento');
  checkboxVencimento.addEventListener('change', function() {
    blocoVencimento.style.display = checkboxVencimento.checked ? 'block' : 'none';
    if (checkboxVencimento.checked && !dataVencimento.value) dataVencimento.value = todayISO();
  });

  const form = document.getElementById('form-despesa');
  const botaoSalvar = document.getElementById('botao-salvar');

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando…';
    try {
      const payload = {
        description: document.getElementById('descricao').value,
        value: document.getElementById('valor').value,
        category: document.getElementById('categoria').value,
        date: document.getElementById('data').value,
        hasDueDate: checkboxVencimento.checked,
        dueDate: checkboxVencimento.checked ? dataVencimento.value : null,
        note: document.getElementById('observacao').value
      };
      const result = await apiPost('registerExpense', payload);
      renderSnapshot(result.snapshot);
      showMessage('mensagem-despesa', 'Despesa registrada com sucesso.', false);
      form.reset();
      dataInput.value = todayISO();
      blocoVencimento.style.display = 'none';
    } catch (error) {
      showMessage('mensagem-despesa', error.message, true);
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = 'Salvar despesa';
    }
  });
}

function setupCardPurchaseForm() {
  const dataInput = document.getElementById('data-cartao');
  dataInput.value = todayISO();

  const form = document.getElementById('form-cartao');
  const botaoSalvar = document.getElementById('botao-salvar-cartao');

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando…';
    try {
      const payload = {
        description: document.getElementById('descricao-cartao').value,
        value: document.getElementById('valor-cartao').value,
        category: document.getElementById('categoria-cartao').value,
        date: dataInput.value,
        note: document.getElementById('observacao-cartao').value
      };
      const result = await apiPost('registerCardPurchase', payload);
      renderSnapshot(result.snapshot);
      showMessage('mensagem-cartao', 'Compra no cartão registrada com sucesso.', false);
      form.reset();
      dataInput.value = todayISO();
    } catch (error) {
      showMessage('mensagem-cartao', error.message, true);
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = 'Salvar compra no cartão';
    }
  });
}

function setupCorrectionForm() {
  const form = document.getElementById('form-correcao');
  const botaoSalvar = document.getElementById('botao-salvar-correcao');

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando…';
    try {
      const payload = {
        movementId: document.getElementById('lancamento-correcao').value,
        field: document.getElementById('campo-correcao').value,
        newValue: document.getElementById('novo-valor-correcao').value,
        reason: document.getElementById('motivo-correcao').value
      };
      const result = await apiPost('correctMovement', payload);
      renderSnapshot(result.snapshot);
      showMessage('mensagem-correcao', 'Correção registrada com sucesso.', false);
      form.reset();
      loadRecentMovements();
    } catch (error) {
      showMessage('mensagem-correcao', error.message, true);
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = 'Salvar correção';
    }
  });
}

function dashboardLinha_(rotulo, valor) {
  return '<div class="linha"><span>' + rotulo + '</span><strong>' + valor + '</strong></div>';
}

async function loadDashboard() {
  const container = document.getElementById('dashboard-conteudo');
  container.innerHTML = '<p class="texto-suave">Carregando…</p>';
  try {
    const data = await apiGet('dashboard');
    const d = data.dashboard;
    let html = '';
    html += dashboardLinha_('Competência', d.competence);
    html += dashboardLinha_('Entradas', formatMoney(d.entries));
    html += dashboardLinha_('Custo planejado', formatMoney(d.plannedCost));
    html += dashboardLinha_('Resultado teórico', formatMoney(d.theoreticalResult));
    html += dashboardLinha_('Resultado atual', formatMoney(d.currentResult));
    html += dashboardLinha_('Cartão atual', formatMoney(d.cardCurrent));
    html += dashboardLinha_('Cartão (despesas)', formatMoney(d.cardExpenses));
    html += dashboardLinha_('Patrimônio', formatMoney(d.netWorth));

    html += '<div class="secao-titulo">Lançamentos pendentes</div>';
    if (d.launches.length) {
      d.launches.forEach(function(launch) {
        html += dashboardLinha_(launch.dueDate + ' — ' + launch.description, formatMoney(launch.plannedValue));
      });
    } else {
      html += '<p class="texto-suave">Nenhum lançamento pendente.</p>';
    }

    html += '<div class="secao-titulo">Cartão por categoria</div>';
    if (d.cardBreakdown.length) {
      d.cardBreakdown.forEach(function(item) {
        html += dashboardLinha_(item.category, formatMoney(item.realizedValue));
      });
    } else {
      html += '<p class="texto-suave">Sem compras no cartão.</p>';
    }

    html += '<div class="secao-titulo">Patrimônio</div>';
    if (d.assets.length) {
      d.assets.forEach(function(asset) {
        html += dashboardLinha_(asset.description, formatMoney(asset.value));
      });
    } else {
      html += '<p class="texto-suave">Nenhum patrimônio registrado.</p>';
    }

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<p class="mensagem erro">' + error.message + '</p>';
  }
}

async function loadWhatsAppReport() {
  const container = document.getElementById('whatsapp-conteudo');
  container.textContent = 'Carregando…';
  try {
    const data = await apiGet('whatsappReport');
    container.textContent = data.report;
  } catch (error) {
    container.textContent = 'Erro: ' + error.message;
  }
}

function setupWhatsAppCopy() {
  const botao = document.getElementById('botao-copiar-whatsapp');
  botao.addEventListener('click', async function() {
    const texto = document.getElementById('whatsapp-conteudo').textContent;
    try {
      await navigator.clipboard.writeText(texto);
      showMessage('mensagem-whatsapp', 'Relatório copiado.', false);
    } catch (error) {
      showMessage('mensagem-whatsapp', 'Não foi possível copiar automaticamente. Selecione o texto manualmente.', true);
    }
  });
}

function setupNavigation() {
  const menu = document.getElementById('menu-lateral');
  const overlay = document.getElementById('menu-overlay');
  const botaoMenu = document.getElementById('botao-menu');
  const botaoFechar = document.getElementById('botao-fechar-menu');
  const itens = document.querySelectorAll('.menu-item');
  const paginas = document.querySelectorAll('.pagina');

  function abrirMenu() {
    menu.classList.add('aberto');
    overlay.classList.add('visivel');
  }

  function fecharMenu() {
    menu.classList.remove('aberto');
    overlay.classList.remove('visivel');
  }

  function irPara(pagina) {
    paginas.forEach(function(p) { p.classList.toggle('ativa', p.dataset.page === pagina); });
    itens.forEach(function(i) { i.classList.toggle('ativo', i.dataset.page === pagina); });
    if (pagina === 'dashboard') loadDashboard();
    if (pagina === 'whatsapp') loadWhatsAppReport();
    fecharMenu();
  }

  botaoMenu.addEventListener('click', abrirMenu);
  botaoFechar.addEventListener('click', fecharMenu);
  overlay.addEventListener('click', fecharMenu);
  itens.forEach(function(item) {
    item.addEventListener('click', function() { irPara(item.dataset.page); });
  });

  irPara('cartao');
}

function setupRecurrences() {
  const botao = document.getElementById('botao-recorrencias');
  botao.addEventListener('click', async function() {
    if (!confirm('Gerar as recorrências do mês atual agora?')) return;
    botao.disabled = true;
    botao.textContent = 'Gerando…';
    try {
      const result = await apiPost('generateRecurrences', {});
      renderSnapshot(result.snapshot);
      showMessage('mensagem-recorrencias', result.generated + ' recorrência(s) gerada(s).', false);
    } catch (error) {
      showMessage('mensagem-recorrencias', error.message, true);
    } finally {
      botao.disabled = false;
      botao.textContent = 'Gerar recorrências do mês atual';
    }
  });
}

function setupServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').then(function(registration) {
      // O navegador só checa atualização automaticamente a cada 24h. Forçamos
      // a checagem a cada abertura para que correções cheguem sem demora.
      registration.update().catch(function() {});
    }).catch(function() {});
  }
}

function showApp() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadCategories();
  loadSnapshot();
  loadRecentMovements();
}

function showLogin(message) {
  idToken = '';
  sessionStorage.removeItem('idToken');
  document.getElementById('app').style.display = 'none';
  document.getElementById('tela-login').style.display = 'flex';
  if (message) showMessage('mensagem-login', message, true);
}

// Chamado pelo Google Identity Services após o login bem-sucedido.
function handleGoogleSignIn(response) {
  idToken = response.credential;
  sessionStorage.setItem('idToken', idToken);
  showApp();
}

setupForm();
setupCardPurchaseForm();
setupCorrectionForm();
setupRecurrences();
setupWhatsAppCopy();
setupNavigation();
setupServiceWorker();

if (idToken) {
  showApp();
}
