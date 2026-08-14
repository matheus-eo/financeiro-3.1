// Configuração da API (Apps Script Web App do Financeiro 3.1).
const API_URL = 'https://script.google.com/macros/s/AKfycbxKavPigKXlf916RCVWWKUsEFbmu577Xlu30axCeq_AymxCxkrMZyyw1sUokhUtFVhK/exec';

let idToken = sessionStorage.getItem('idToken') || '';

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
  if (!data.ok) throw new Error(data.error || 'Erro desconhecido.');
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
  if (!data.ok) throw new Error(data.error || 'Erro desconhecido.');
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
  const select = document.getElementById('categoria');
  try {
    const data = await apiGet('categories');
    select.innerHTML = '<option value="">Selecione…</option>' +
      data.categories.map(function(category) {
        return '<option value="' + category + '">' + category + '</option>';
      }).join('');
  } catch (error) {
    select.innerHTML = '<option value="">Erro ao carregar categorias</option>';
  }
}

function showMessage(elementId, text, isError) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = 'mensagem ' + (isError ? 'erro' : 'sucesso');
  setTimeout(function() { el.className = 'mensagem'; }, 6000);
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
    navigator.serviceWorker.register('service-worker.js').catch(function() {});
  }
}

function showApp() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadCategories();
  loadSnapshot();
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
setupRecurrences();
setupServiceWorker();

if (idToken) {
  showApp();
}
