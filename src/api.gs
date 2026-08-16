/** API HTTP para o Web App instalável (PWA). Camada fina sobre as regras já existentes. */
function getOAuthClientId_() {
  return '54102108105-ob1jh5lh8ugs52n3qo2fn8j9ujk06nsc.apps.googleusercontent.com';
}

function getAllowedEmails_() {
  return ['matcash@gmail.com'];
}

// Verifica o ID token do Google Sign-In direto com o endpoint do Google
// (sem lib de JWT), conferindo audiência, e-mail permitido e verificação de e-mail.
function checkGoogleIdToken_(idToken) {
  assert_(idToken, 'Faça login para continuar.');
  var response = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
    muteHttpExceptions: true
  });
  assert_(response.getResponseCode() === 200, 'Sessão expirada. Faça login novamente.');
  var info = JSON.parse(response.getContentText());
  assert_(info.aud === getOAuthClientId_(), 'Token não pertence a este app.');
  assert_(info.email_verified === 'true' || info.email_verified === true, 'E-mail não verificado.');
  assert_(getAllowedEmails_().indexOf(info.email) >= 0, 'Conta não autorizada.');
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
    checkGoogleIdToken_(e.parameter.idToken);
    if (action === 'categories') {
      var categories = getActiveCategories_().map(function(c) { return c.Categoria; });
      return jsonOutput_({ ok: true, categories: categories });
    }
    if (action === 'snapshot') {
      return jsonOutput_({ ok: true, snapshot: snapshotForApi_() });
    }
    return jsonOutput_({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    checkGoogleIdToken_(body.idToken);
    var action = body.action;

    if (action === 'registerExpense') {
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

    if (action === 'generateRecurrences') {
      var lock = getFinanceLock_();
      lock.waitLock(30000);
      var tx = new FinanceTransaction_();
      try {
        var generated = ensureRecurringForCompetence_(tx, getActiveCompetence_());
        generated.forEach(function(movement) {
          appendHistory_(tx, {
            operation: 'Gerar despesa recorrente (app)', table: FIN.SHEETS.MOVEMENTS,
            recordId: movement.ID, next: movement
          });
        });
        refreshAllVisualizations_(tx);
        tx.commit();
        return jsonOutput_({ ok: true, generated: generated.length, snapshot: snapshotForApi_() });
      } catch (innerError) {
        tx.rollback();
        throw innerError;
      } finally {
        lock.releaseLock();
      }
    }

    return jsonOutput_({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (error) {
    return jsonOutput_({ ok: false, error: error.message });
  }
}
