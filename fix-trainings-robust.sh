#!/bin/bash
# Robusniji fix za trainings crash — pokriva sve moguće response shape-ove
# Pokreni: bash fix-trainings-robust.sh

FILE="frontend/src/pages/ClientDetail.jsx"

[ ! -f "$FILE" ] && echo "Greška: pokreni iz korijena projekta" && exit 1

python3 - <<'PYEOF'
with open('frontend/src/pages/ClientDetail.jsx', 'r') as f:
    content = f.read()

# Ukloni prethodni (djelomični) fix i zamijeni s robusnim
old_variants = [
    "setTrainings(trainingsRes.data?.trainings || trainingsRes.data || []);",
    "setTrainings(trainingsRes.data);",
]

robust_fix = """setTrainings((() => {
        const raw = trainingsRes.data;
        if (Array.isArray(raw))                return raw;
        if (Array.isArray(raw?.trainings))     return raw.trainings;
        if (Array.isArray(raw?.sessions))      return raw.sessions;
        if (Array.isArray(raw?.data))          return raw.data;
        return [];
      })());"""

applied = False
for old in old_variants:
    if old in content:
        content = content.replace(old, robust_fix, 1)
        applied = True
        break

if applied:
    with open('frontend/src/pages/ClientDetail.jsx', 'w') as f:
        f.write(content)
    print("OK")
else:
    print("NOT_FOUND — line already fixed or different format")
PYEOF

if [ $? -eq 0 ]; then
  echo "✓ ClientDetail.jsx — robusniji trainings fix primijenjen"
else
  echo "✗ Fix nije mogao biti primijenjen"
fi
