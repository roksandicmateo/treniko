#!/bin/bash
# Fix: Invalid Date na grupnim sesijama + i18n ključevi u ClientDetail
set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

[ ! -f "frontend/src/pages/GroupDetail.jsx" ] && echo "Pokreni iz korijena projekta" && exit 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Fix: Invalid Date + i18n ključevi"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# FIX A: GroupDetail.jsx — Invalid Date
# session_date može doći kao "2025-01-15T00:00:00.000Z" — .slice(0,10) čisti to
# ─────────────────────────────────────────────────────────────────────────────
echo "Fix A: GroupDetail — Invalid Date..."
python3 - <<'PYEOF'
with open('frontend/src/pages/GroupDetail.jsx', 'r') as f:
    content = f.read()

old = "const fmt  = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });"
new = "const fmt  = (d) => new Date(((d || '').slice(0, 10)) + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });"

if old in content:
    content = content.replace(old, new)
    with open('frontend/src/pages/GroupDetail.jsx', 'w') as f:
        f.write(content)
    print("OK")
elif "slice(0, 10)" in content:
    print("ALREADY_APPLIED")
else:
    # Pokušaj generičniji match
    import re
    pattern = r"const fmt\s*=\s*\(d\)\s*=>\s*new Date\(d\s*\+\s*'T00:00:00'\)"
    replacement = "const fmt  = (d) => new Date(((d || '').slice(0, 10)) + 'T00:00:00')"
    new_content, count = re.subn(pattern, replacement, content)
    if count > 0:
        with open('frontend/src/pages/GroupDetail.jsx', 'w') as f:
            f.write(new_content)
        print("OK_REGEX")
    else:
        print("NOT_FOUND")
PYEOF

result=$?
if [ $result -eq 0 ]; then ok "GroupDetail.jsx — Invalid Date fix primijenjen"
else warn "Fix A nije uspio — provjeri ručno"; fi

# ─────────────────────────────────────────────────────────────────────────────
# FIX B: ClientDetail.jsx — trainings.completed/scheduled → training.completed/scheduled
# Pogrešan i18n namespace (trainings vs training)
# ─────────────────────────────────────────────────────────────────────────────
echo "Fix B: ClientDetail — i18n ključevi..."
python3 - <<'PYEOF'
with open('frontend/src/pages/ClientDetail.jsx', 'r') as f:
    content = f.read()

fixes = [
    ("t('trainings.completed')", "t('training.completed')"),
    ("t('trainings.scheduled')", "t('training.scheduled')"),
    ('t("trainings.completed")', 't("training.completed")'),
    ('t("trainings.scheduled")', 't("training.scheduled")'),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1

if count > 0:
    with open('frontend/src/pages/ClientDetail.jsx', 'w') as f:
        f.write(content)
    print(f"OK:{count}")
else:
    print("NOT_FOUND")
PYEOF

result=$?
if [ $result -eq 0 ]; then ok "ClientDetail.jsx — i18n ključevi popravljeni"; fi

# ─────────────────────────────────────────────────────────────────────────────
# FIX C: GroupDetail.jsx — GroupSessionCard prikazuje "Invalid Date" i na drugim mjestima
# Provjeri sve ostale fmt() pozive i session_date mjesta
# ─────────────────────────────────────────────────────────────────────────────
echo "Fix C: GroupDetail — dodatna mjesta s datumom..."
python3 - <<'PYEOF'
with open('frontend/src/pages/GroupDetail.jsx', 'r') as f:
    content = f.read()

# Provjeri ima li još raw new Date(session_date) bez slice
import re
raw_dates = re.findall(r'new Date\((?!.*slice).*session_date.*\)', content)
if raw_dates:
    print(f"WARN:{len(raw_dates)} raw date(s) still found — may need manual check")
else:
    print("OK: no raw session_date usage found")
PYEOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Gotovo!${NC} Restartaj frontend pa provjeri:"
echo "  ✓ Grupe → grupna sesija — datum treba biti čitljiv"
echo "  ✓ Klijent → Treninzi tab — status badge treba biti Završeno/Zakazano"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
