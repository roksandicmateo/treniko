#!/bin/bash
# Fallback za Fix 3 — ako apply-fixes.sh nije mogao automatski patchati clientsController.js
# Pokreni: bash manual-fix3.sh

FILE="backend/controllers/clientsController.js"

python3 - <<'PYEOF'
with open('backend/controllers/clientsController.js', 'r') as f:
    content = f.read()

# Probe raznih varijanti koje mogu biti u fajlu
targets = [
    "    const checkResult = await queryWithTenant(\n      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',\n      [id, tenantId], tenantId\n    );\n\n    if (checkResult.rows.length === 0) {",
    "    const checkResult = await queryWithTenant(\n      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',\n      [\n",
]

LIMIT_CHECK = """
    // REACTIVATION_LIMIT_CHECK
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

if 'REACTIVATION_LIMIT_CHECK' in content:
    print("ALREADY_APPLIED")
else:
    # Pronađi updateClient funkciju i ubaci limit check
    # Tražimo poziciju checkResult unutar updateClient konteksta
    idx = content.find("const updateClient = async")
    if idx == -1:
        print("UPDATE_CLIENT_NOT_FOUND")
    else:
        check_idx = content.find("const checkResult = await queryWithTenant", idx)
        if check_idx == -1:
            print("CHECKRESULT_NOT_FOUND")
        else:
            content = content[:check_idx] + LIMIT_CHECK + "\n    " + content[check_idx:]
            with open('backend/controllers/clientsController.js', 'w') as f:
                f.write(content)
            print("OK")
PYEOF

echo ""
echo "Provjeri output iznad:"
echo "  OK              → Fix primijenjen uspješno"
echo "  ALREADY_APPLIED → Fix je već tu, sve je ok"
echo "  *_NOT_FOUND     → Kontaktiraj Roks — ručni edit potreban"
