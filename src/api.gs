/** API HTTP para o Web App instalável (PWA). Camada fina sobre as regras já existentes. */
function getOAuthClientId_() {
  return '54102108105-ob1jh5lh8ugs52n3qo2fn8j9ujk06nsc.apps.googleusercontent.com';
}

// O dono é fixo no código e sempre tem acesso total, inclusive às Configurações de acesso.
// Editores e leitores adicionais são geridos pelo próprio app e ficam guardados em Configurações.
function getOwnerEmail_() {
  return 'matcash@gmail.com';
}

function parseEmailList_(raw) {
  return String(raw || '').split(',').map(function(email) {
    return email.trim().toLowerCase();
  }).filter(function(email) { return email; });
}

function normalizeEmailList_(value) {
  var raw = Array.isArray(value) ? value.join(',') : String(value || '');
  var seen = {};
  var result = [];
  parseEmailList_(raw).forEach(function(email) {
    assert_(email.indexOf('@') > 0, 'E-mail inválido: ' + email + '.');
    if (!seen[email]) { seen[email] = true; result.push(email); }
  });
  return result;
}

function getEditorEmails_() {
  var list = parseEmailList_(getConfigValue_('ACESSO_EDITORES', ''));
  if (list.indexOf(getOwnerEmail_()) === -1) list.push(getOwnerEmail_());
  return list;
}

function getViewerEmails_() {
  return parseEmailList_(getConfigValue_('ACESSO_LEITORES', ''));
}

// Verifica o ID token do Google Sign-In direto com o endpoint do Google (sem lib de JWT),
// conferindo audiência e e-mail verificado, e resolve o papel do usuário (dono/editor/leitor).
function authenticate_(idToken) {
  assert_(idToken, 'Faça login para continuar.');
  var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
    muteHttpExceptions: true
  });
  assert_(response.getResponseCode() === 200, 'Sessão expirada. Faça login novamente.');
  var info = JSON.parse(response.getContentText());
  assert_(info.aud === getOAuthClientId_(), 'Token não pertence a este app.');
  assert_(info.email_verified === 'true' || info.email_verified === true, 'E-mail não verificado.');
  var email = String(info.email).toLowerCase();
  var isOwner = email === getOwnerEmail_();
  var isEditor = isOwner || getEditorEmails_().indexOf(email) >= 0;
  var isViewer = isEditor || getViewerEmails_().indexOf(email) >= 0;
  assert_(isViewer, 'Conta não autorizada.');
  return { email: email, isOwner: isOwner, isEditor: isEditor };
}

function requireEditor_(auth) {
  assert_(auth.isEditor, 'Sua conta só tem acesso de leitura neste app.');
}

function requireOwner_(auth) {
  assert_(auth.isOwner, 'Apenas o desenvolvedor pode alterar isso.');
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function snapshotForApi_() {
  var snapshot = getFinancialSnapshot_(getActiveCompetence_());
  return {
    competence: snapshot.competence,
    entries: snapshot.entries,
    plannedCost: snapshot.plannedCost,
    theoreticalResult: snapshot.theoreticalResult,
    currentResult: snapshot.currentResult,
    cardCurrent: snapshot.cardCurrent,
    cardExpenses: snapshot.cardExpenses,
    netWorth: snapshot.netWorth,
    launches: snapshot.launches.map(function(launch) {
      return {
        description: launch.description,
        dueDate: formatDate_(launch.dueDate, 'yyyy-MM-dd'),
        plannedValue: launch.plannedValue,
        semaphore: launch.semaphore
      };
    })
  };
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    var auth = authenticate_(e.parameter.idToken);

    if (action === 'session') {
      return jsonOutput_({ ok: true, email: auth.email, isOwner: auth.isOwner, isEditor: auth.isEditor });
    }
    if (action === 'categories') {
      var categories = getActiveCategories_().map(function(c) { return c.Categoria; });
      return jsonOutput_({ ok: true, categories: categories });
    }
    if (action === 'snapshot') {
      return jsonOutput_({ ok: true, snapshot: snapshotForApi_() });
    }
    if (action === 'recentMovements') {
      var competence = e.parameter.competence || getActiveCompetence_();
      var scope = e.parameter.scope || 'all';
      var tipoFilter = e.parameter.tipo || '';
      // A fatura do cartão (FATURA_CARTAO) não aparece pra edição: seu
      // planejado é sempre derivado da soma das compras no cartão da
      // competência, então corrigi-la diretamente não teria efeito algum.
      var movements = findRecords_(FIN.SHEETS.MOVEMENTS, function(m) {
        if (m.Competência !== competence || m.Tipo === FIN.TYPES.CARD_BILL) return false;
        if (scope !== 'deletable' && m.Tipo === FIN.TYPES.REVENUE) return false;
        if (scope === 'manual' && m.Origem !== FIN.ORIGINS.FORM) return false;
        // Despesas fixas do mês ainda não confirmadas (pra "Confirmar despesa do mês").
        if (scope === 'pending' && (m.Tipo !== FIN.TYPES.EXPENSE || isPaymentConfirmed_(m.Pago))) return false;
        if (tipoFilter && m.Tipo !== tipoFilter) return false;
        return true;
      }).sort(function(a, b) {
        return new Date(b['Criado Em']).getTime() - new Date(a['Criado Em']).getTime();
      }).slice(0, 25).map(function(m) {
        return {
          id: m.ID, description: m.Descrição, tipo: m.Tipo,
          plannedValue: m['Valor Planejado'], realizedValue: m['Valor Realizado'],
          date: m.Data ? formatDate_(m.Data, 'dd/MM/yyyy') : '',
          dueDate: m['Data de Vencimento'] ? formatDate_(m['Data de Vencimento'], 'dd/MM/yyyy') : ''
        };
      });
      return jsonOutput_({ ok: true, movements: movements });
    }
    if (action === 'cardCategories') {
      var cardSnapshot = getFinancialSnapshot_(getActiveCompetence_());
      return jsonOutput_({ ok: true, categories: cardSnapshot.cardBreakdown });
    }
    if (action === 'monthRolloverPreview') {
      return jsonOutput_({ ok: true, preview: buildMonthRolloverPreview_() });
    }
    if (action === 'dashboard') {
      var dashboardSnapshot = getFinancialSnapshot_(getActiveCompetence_());
      return jsonOutput_({
        ok: true,
        dashboard: {
          competence: dashboardSnapshot.competence,
          entries: dashboardSnapshot.entries,
          plannedCost: dashboardSnapshot.plannedCost,
          theoreticalResult: dashboardSnapshot.theoreticalResult,
          currentResult: dashboardSnapshot.currentResult,
          cardCurrent: dashboardSnapshot.cardCurrent,
          cardExpenses: dashboardSnapshot.cardExpenses,
          netWorth: dashboardSnapshot.netWorth,
          launches: dashboardSnapshot.launches.map(function(launch) {
            return {
              description: launch.description,
              dueDate: formatDate_(launch.dueDate, 'dd/MM/yyyy'),
              plannedValue: launch.plannedValue,
              semaphore: launch.semaphore
            };
          }),
          cardBreakdown: dashboardSnapshot.cardBreakdown,
          revenues: dashboardSnapshot.revenues,
          assets: dashboardSnapshot.assets.map(function(asset) {
            return { description: asset.Descrição, value: asset.Valor };
          })
        }
      });
    }
    if (action === 'whatsappReport') {
      return jsonOutput_({ ok: true, report: buildWhatsAppReport_(getFinancialSnapshot_(getActiveCompetence_())) });
    }
    if (action === 'accessList') {
      requireOwner_(auth);
      return jsonOutput_({
        ok: true,
        owner: getOwnerEmail_(),
        editors: getEditorEmails_().filter(function(email) { return email !== getOwnerEmail_(); }),
        viewers: getViewerEmails_()
      });
    }
    return jsonOutput_({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var auth = authenticate_(body.idToken);
    var action = body.action;

    if (action === 'registerExpense') {
      requireEditor_(auth);
      var command = {
        operation: FIN.OPERATIONS.EXPENSE,
        competence: body.competence || getActiveCompetence_(),
        date: body.date ? new Date(body.date) : now_(),
        category: body.category,
        description: body.description,
        value: body.value,
        hasDueDate: body.hasDueDate ? FIN.YES : FIN.NO,
        dueDate: body.hasDueDate && body.dueDate ? new Date(body.dueDate) : null,
        note: body.note || ''
      };
      var result = executeFinancialCommand_(command);
      return jsonOutput_({ ok: true, id: result.movement.ID, snapshot: snapshotForApi_() });
    }

    if (action === 'registerCardPurchase') {
      requireEditor_(auth);
      var cardCommand = {
        operation: FIN.OPERATIONS.CARD,
        competence: body.competence || getActiveCompetence_(),
        date: body.date ? new Date(body.date) : now_(),
        category: body.category,
        description: body.description || '',
        value: body.value,
        note: body.note || ''
      };
      var cardResult = executeFinancialCommand_(cardCommand);
      return jsonOutput_({ ok: true, id: cardResult.movement.ID, snapshot: snapshotForApi_() });
    }

    if (action === 'registerPayment') {
      requireEditor_(auth);
      var paymentCommand = {
        operation: FIN.OPERATIONS.PAYMENT,
        movementId: body.movementId,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : now_(),
        paidValue: body.paidValue,
        note: body.note || ''
      };
      var paymentResult = executeFinancialCommand_(paymentCommand);
      return jsonOutput_({ ok: true, id: paymentResult.movement.ID, snapshot: snapshotForApi_() });
    }

    if (action === 'correctMovement') {
      requireEditor_(auth);
      var correctionCommand = {
        operation: FIN.OPERATIONS.CORRECTION,
        movementId: body.movementId,
        field: body.field,
        newValue: body.newValue,
        reason: body.reason
      };
      var correctionResult = executeFinancialCommand_(correctionCommand);
      return jsonOutput_({ ok: true, id: correctionResult.movement.ID, snapshot: snapshotForApi_() });
    }

    if (action === 'deleteMovement') {
      requireEditor_(auth);
      var deleteCommand = {
        operation: FIN.OPERATIONS.DELETE,
        movementId: body.movementId,
        reason: body.reason
      };
      executeFinancialCommand_(deleteCommand);
      return jsonOutput_({ ok: true, snapshot: snapshotForApi_() });
    }

    if (action === 'setCardCategoryPlanned') {
      requireEditor_(auth);
      var categoryLock = getFinanceLock_();
      categoryLock.waitLock(30000);
      var categoryTx = new FinanceTransaction_();
      try {
        var categoryCompetence = body.competence || getActiveCompetence_();
        var categoryReason = requireText_(body.reason, 'Motivo');
        var categoryAmount = requireAmount_(body.value, 'Novo valor planejado da categoria');
        setCardCategoryPlanned_(categoryTx, categoryCompetence, requireText_(body.category, 'Categoria'), categoryAmount, categoryReason);
        refreshAllVisualizations_(categoryTx);
        categoryTx.commit();
        return jsonOutput_({ ok: true, snapshot: snapshotForApi_() });
      } catch (innerError) {
        categoryTx.rollback();
        appendFailureHistory_('Ajustar valor planejado (categoria do cartão)', innerError);
        throw innerError;
      } finally {
        categoryLock.releaseLock();
      }
    }

    if (action === 'monthRollover') {
      requireEditor_(auth);
      var rollover = rolloverToNextCompetence_();
      return jsonOutput_({
        ok: true, fromCompetence: rollover.fromCompetence, toCompetence: rollover.toCompetence,
        generated: rollover.generated, snapshot: snapshotForApi_()
      });
    }

    if (action === 'updateNetWorth') {
      requireEditor_(auth);
      var netWorthCommand = {
        operation: FIN.OPERATIONS.NET_WORTH,
        date: body.date ? new Date(body.date) : now_(),
        description: body.description,
        value: body.value,
        note: body.note || ''
      };
      executeFinancialCommand_(netWorthCommand);
      return jsonOutput_({ ok: true, snapshot: snapshotForApi_() });
    }

    if (action === 'updateCardCurrent') {
      requireEditor_(auth);
      var cardCurrentCommand = {
        operation: FIN.OPERATIONS.CARD_CURRENT,
        competence: body.competence || getActiveCompetence_(),
        value: body.value,
        note: body.note || ''
      };
      executeFinancialCommand_(cardCurrentCommand);
      return jsonOutput_({ ok: true, snapshot: snapshotForApi_() });
    }

    if (action === 'updateAccessList') {
      requireOwner_(auth);
      var lock = getFinanceLock_();
      lock.waitLock(30000);
      var tx = new FinanceTransaction_();
      try {
        var editors = normalizeEmailList_(body.editors);
        var viewers = normalizeEmailList_(body.viewers);
        var previous = { editors: getEditorEmails_(), viewers: getViewerEmails_() };
        setConfigValue_(tx, 'ACESSO_EDITORES', editors.join(','), 'E-mails com acesso total ao app, além do dono.');
        setConfigValue_(tx, 'ACESSO_LEITORES', viewers.join(','), 'E-mails com acesso somente leitura ao app.');
        appendHistory_(tx, {
          operation: 'Atualizar acesso ao app', table: FIN.SHEETS.CONFIG, recordId: 'ACESSO',
          previous: previous, next: { editors: editors, viewers: viewers }
        });
        tx.commit();
        return jsonOutput_({ ok: true, editors: editors, viewers: viewers });
      } catch (innerError) {
        tx.rollback();
        throw innerError;
      } finally {
        lock.releaseLock();
      }
    }

    if (action === 'generateRecurrences') {
      requireEditor_(auth);
      var lock2 = getFinanceLock_();
      lock2.waitLock(30000);
      var tx2 = new FinanceTransaction_();
      try {
        var generated = ensureRecurringForCompetence_(tx2, getActiveCompetence_());
        generated.forEach(function(movement) {
          appendHistory_(tx2, {
            operation: 'Gerar despesa recorrente (app)', table: FIN.SHEETS.MOVEMENTS,
            recordId: movement.ID, next: movement
          });
        });
        refreshAllVisualizations_(tx2);
        tx2.commit();
        return jsonOutput_({ ok: true, generated: generated.length, snapshot: snapshotForApi_() });
      } catch (innerError) {
        tx2.rollback();
        throw innerError;
      } finally {
        lock2.releaseLock();
      }
    }

    return jsonOutput_({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  }
}
