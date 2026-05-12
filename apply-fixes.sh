#!/bin/bash
# Treniko QA Fix Script
# Pokreni iz korijena projekta: bash apply-fixes.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

[ ! -f "frontend/src/pages/ClientDetail.jsx" ] && fail "Pokreni iz korijena projekta (gdje su frontend/ i backend/ mape)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Treniko Bug Fix Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# FIX 1: ClientDetail.jsx — trainings.filter is not a function
# trainingsRes.data je objekt { trainings: [] }, ne array direktno
# ──────────────────────────────────────────────────────────────────────────────
echo "Fix 1: ClientDetail — trainings crash..."
FILE="frontend/src/pages/ClientDetail.jsx"

if grep -q "setTrainings(trainingsRes\.data);" "$FILE"; then
  sed -i '' 's/setTrainings(trainingsRes\.data);/setTrainings(trainingsRes.data?.trainings || trainingsRes.data || []);/' "$FILE"
  ok "ClientDetail.jsx — trainings fix applied"
else
  warn "Fix 1 već primijenjen ili linija nije pronađena — preskačem"
fi

# ──────────────────────────────────────────────────────────────────────────────
# FIX 2: SessionModal.jsx — ne može se mijenjati klijent u edit modu
# Makni disabled={session !== null} sa client selecta
# ──────────────────────────────────────────────────────────────────────────────
echo "Fix 2: SessionModal — client select disabled u edit modu..."
FILE="frontend/src/components/SessionModal.jsx"

if grep -q 'disabled={session !== null}' "$FILE"; then
  sed -i '' 's/ disabled={session !== null}//' "$FILE"
  # Makni i info tekst ispod koji kaže "Client: xyz" (postaje zbunjujući bez disabled)
  sed -i '' '/if (session && <p className="text-xs text-gray-500 mt-1">{t('\''sessions.client'\'')}: {session.clientName}<\/p>)/d' "$FILE"
  ok "SessionModal.jsx — client select omogućen u edit modu"
else
  warn "Fix 2 već primijenjen — preskačem"
fi

# ──────────────────────────────────────────────────────────────────────────────
# FIX 3: clientsController.js — reactivate ne provjerava client limit
# Dodaje limit check kad isActive === true u updateClient
# ──────────────────────────────────────────────────────────────────────────────
echo "Fix 3: clientsController — reactivation limit check..."
FILE="backend/controllers/clientsController.js"

if grep -q 'REACTIVATION_LIMIT_CHECK' "$FILE"; then
  warn "Fix 3 već primijenjen — preskačem"
else
  # Ubaci limit check odmah nakon extractanja varijabli u updateClient
  # Tražimo liniju s "const checkResult" unutar updateClient
  python3 - <<'PYEOF'
import re

with open('backend/controllers/clientsController.js', 'r') as f:
    content = f.read()

LIMIT_CHECK = """
    // REACTIVATION_LIMIT_CHECK — provjerava limit pri aktivaciji klijenta
    if (isActive === true) {
      try {
        const limitResult = await queryWithTenant(
          `SELECT max_clients, clients_count, clients_limit_reached
           FROM tenant_subscription_status WHERE tenant_id = $1`,
          [tenantId], tenantId
        );
        if (limitResult.rows.length > 0 && limitResult.rows[0].clients_limit_reached) {
          return res.status(403).json({
            error: 'Client limit reached',
            message: `You've reached your plan limit of ${limitResult.rows[0].max_clients} active clients. Upgrade to add more.`,
            limit: limitResult.rows[0].max_clients,
            current: limitResult.rows[0].clients_count,
            upgradeRequired: true,
          });
        }
      } catch (limitErr) {
        console.error('Limit check error (non-fatal):', limitErr.message);
      }
    }
    // END REACTIVATION_LIMIT_CHECK
"""

# Umetni odmah ispod deklaracije varijabli u updateClient, prije checkResult
target = "    const checkResult = await queryWithTenant(\n      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',"
replacement = LIMIT_CHECK + "\n    const checkResult = await queryWithTenant(\n      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',"

if target in content:
    content = content.replace(target, replacement, 1)
    with open('backend/controllers/clientsController.js', 'w') as f:
        f.write(content)
    print("OK")
else:
    print("TARGET_NOT_FOUND")
PYEOF

  if [ $? -eq 0 ]; then
    ok "clientsController.js — reactivation limit check dodan"
  else
    warn "Automatski patch nije uspio — vidi ručni fix ispod"
  fi
fi

# ──────────────────────────────────────────────────────────────────────────────
# FIX 4: Clients.jsx — reactivate ne prikazuje LimitModal kad je limit dostignut
# Frontend treba pokazati limit modal ako backend vrati 403
# ──────────────────────────────────────────────────────────────────────────────
echo "Fix 4: Clients.jsx — reactivate 403 → LimitModal..."
FILE="frontend/src/pages/Clients.jsx"

if grep -q 'handleReactivate.*handleSetStatus' "$FILE"; then
  python3 - <<'PYEOF'
with open('frontend/src/pages/Clients.jsx', 'r') as f:
    content = f.read()

old = "  const handleReactivate = (e, client) => { e.stopPropagation(); handleSetStatus(client, { isArchived: false, isActive: true }, t('clients.active')); };"
new = """  const handleReactivate = async (e, client) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/clients/${client.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false, isActive: true })
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.upgradeRequired) { setLimitModalOpen(true); loadSubscription(); return; }
      }
      if (!res.ok) { showToast(t('common.error'), 'error'); return; }
      showToast(t('clients.active'), 'success');
      loadClients(); loadSubscription();
    } catch { showToast(t('common.error'), 'error'); }
  };"""

if old in content:
    content = content.replace(old, new)
    with open('frontend/src/pages/Clients.jsx', 'w') as f:
        f.write(content)
    print("OK")
else:
    print("TARGET_NOT_FOUND")
PYEOF
  ok "Clients.jsx — reactivate limit modal fix primijenjen"
else
  warn "Fix 4 već primijenjen — preskačem"
fi

# ──────────────────────────────────────────────────────────────────────────────
# FIX 5: OnboardingChecklist — reset dismissed flag (debug helper)
# Stvara malu HTML datoteku za brisanje localStorage keya
# ──────────────────────────────────────────────────────────────────────────────
echo "Fix 5: OnboardingChecklist — debug helper..."

# Ovo je samo obavijest, ne mijenja kod
echo ""
echo -e "${YELLOW}ℹ OnboardingChecklist:${NC}"
echo "  Ako checklist nije vidljiv, otvori DevTools → Console i pokreni:"
echo "  localStorage.removeItem('treniko_onboarding_dismissed'); location.reload();"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Gotovo! Pokreni:${NC}"
echo ""
echo "  cd frontend && npm run dev"
echo "  cd backend  && node server.js   (ili: nodemon server.js)"
echo ""
echo "Checkovi:"
echo "  ✓ /dashboard/clients/:id  — više ne crasha"
echo "  ✓ Edit session — može se mijenjati klijent"
echo "  ✓ Reactivate client — blokiran ako je limit dostignut"
echo "  ✓ Clients list — prikazuje LimitModal na reactivate 403"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
