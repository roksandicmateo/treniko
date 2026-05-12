#!/bin/bash
[ ! -f "frontend/src/components/training/AddTrainingModal.jsx" ] && echo "Pokreni iz korijena projekta" && exit 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Unificirani dizajn formi"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# AddTrainingModal — promijeni container i footer da prate SessionModal
# ─────────────────────────────────────────────────────────────────────────────
python3 - <<'PYEOF'
with open('frontend/src/components/training/AddTrainingModal.jsx', 'r') as f:
    c = f.read()

changes = 0

# 1. Outer overlay — ujednači s SessionModal
old1 = 'className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 overflow-y-auto py-8 px-4">'
new1 = 'className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">'
if old1 in c:
    c = c.replace(old1, new1, 1); changes += 1; print("✓ Overlay fix")

# 2. Inner container — ujednači s SessionModal
old2 = 'className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-gray-100 dark:border-gray-800">'
new2 = 'className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full border border-gray-100 dark:border-gray-800 max-h-[90vh] flex flex-col">'
if old2 in c:
    c = c.replace(old2, new2, 1); changes += 1; print("✓ Container fix")

# 3. Footer — zamijeni full-width btn s Cancel + Save u redu (kao SessionModal)
old3 = """        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full btn-primary py-3.5 text-base font-semibold disabled:opacity-50">
            {saving ? t('common.saving') : editTraining ? `${t('common.save')} ${t('training.title').slice(0, -1)}` : t('training.addTraining')}
          </button>
        </div>"""
new3 = """        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary" disabled={saving}>{t('common.cancel')}</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex-1 btn-primary disabled:opacity-50">
              {saving ? t('common.saving') : editTraining ? t('common.save') : t('training.addTraining')}
            </button>
          </div>
        </div>"""
if old3 in c:
    c = c.replace(old3, new3, 1); changes += 1; print("✓ Footer fix")
else:
    # Probaj alternativni format
    old3b = '          <button type="button" onClick={handleSave} disabled={saving}\n            className="w-full btn-primary py-3.5 text-base font-semibold disabled:opacity-50">'
    if old3b in c:
        print("- Footer drugačiji format, preskačem")
    else:
        print("- Footer NOT FOUND")

# 4. Labele — ujednači label className s SessionModal stilom
# SessionModal koristi: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
# AddTrainingModal koristi: labelCls varijablu — provjeri što je
if 'labelCls' in c:
    old4 = "  const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1';"
    new4 = "  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';"
    if old4 in c:
        c = c.replace(old4, new4, 1); changes += 1; print("✓ Label style fix")
    else:
        # Pronađi što je labelCls
        import re
        m = re.search(r'const labelCls = [^\n]+', c)
        if m:
            print(f"  labelCls je: {m.group()}")
            # Zamijeni bilo koji labelCls s ispravnim
            c = re.sub(r"const labelCls = '[^']*';", "const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';", c, 1)
            changes += 1; print("✓ Label style fix (regex)")

with open('frontend/src/components/training/AddTrainingModal.jsx', 'w') as f:
    f.write(c)
print(f"\nAddTrainingModal: {changes} promjena")
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# GroupDetail ScheduleGroupSessionModal — ujednači labele i button stil
# ─────────────────────────────────────────────────────────────────────────────
python3 - <<'PYEOF'
with open('frontend/src/pages/GroupDetail.jsx', 'r') as f:
    c = f.read()

changes = 0

# Labele u ScheduleGroupSessionModal
old1 = 'const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";'
new1 = 'const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";'
if old1 in c:
    c = c.replace(old1, new1, 1); changes += 1; print("✓ GroupDetail label mb fix")

# Snimi samo ako ima promjena
if changes > 0:
    with open('frontend/src/pages/GroupDetail.jsx', 'w') as f:
        f.write(c)
print(f"GroupDetail: {changes} promjena")
PYEOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Gotovo — provjeri:"
echo "  Treninzi → + Dodaj trening — treba izgledati kao Nova sesija"
echo "  Grupe → Zakaži grupnu sesiju — ujednačeni margini labela"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
