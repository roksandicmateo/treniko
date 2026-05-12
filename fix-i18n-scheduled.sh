#!/bin/bash
# Fix: training.scheduled → sessions.scheduled u ClientDetail.jsx
[ ! -f "frontend/src/pages/ClientDetail.jsx" ] && echo "Pokreni iz korijena projekta" && exit 1

python3 - <<'PYEOF'
with open('frontend/src/pages/ClientDetail.jsx', 'r') as f:
    content = f.read()

fixes = [
    ("t('training.scheduled')",  "t('sessions.scheduled')"),
    ('t("training.scheduled")',  't("sessions.scheduled")'),
    ("t('trainings.scheduled')", "t('sessions.scheduled')"),
    ('t("trainings.scheduled")', 't("sessions.scheduled")'),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1

if count > 0:
    with open('frontend/src/pages/ClientDetail.jsx', 'w') as f:
        f.write(content)
    print(f"OK: {count} zamjena")
else:
    print("NOT_FOUND — provjeri ručno")
PYEOF
