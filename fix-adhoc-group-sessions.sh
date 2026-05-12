#!/bin/bash
# Ad-hoc grupne sesije — bez predefiniranih Grupa
# Pokreni iz korijena projekta: bash fix-adhoc-group-sessions.sh

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

[ ! -f "backend/routes/sessions.js" ] && echo "Pokreni iz korijena projekta" && exit 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Ad-hoc grupne sesije"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. Backend — dodaj attendee routes u sessions.js
# ─────────────────────────────────────────────────────────────────────────────
echo "Backend: Dodajem attendee endpoints..."
python3 - <<'PYEOF'
with open('backend/routes/sessions.js', 'r') as f:
    c = f.read()

if 'ADHOC_ATTENDEES' in c:
    print("ALREADY_DONE")
    exit()

ATTENDEE_ROUTES = """
// ── ADHOC_ATTENDEES ───────────────────────────────────────────────────────────

// GET /api/sessions/:id/attendees
router.get('/:id/attendees', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      `SELECT sa.id, sa.client_id, sa.status,
              c.first_name, c.last_name
       FROM session_attendees sa
       JOIN clients c ON c.id = sa.client_id
       WHERE sa.session_id = $1 AND sa.tenant_id = $2
       ORDER BY c.first_name, c.last_name`,
      [req.params.id, tenantId]
    );
    res.json({ success: true, attendees: rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/sessions/:id/attendees — add client to ad-hoc group session
router.post('/:id/attendees', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.body;
    await pool.query(
      `INSERT INTO session_attendees (session_id, client_id, tenant_id)
       VALUES ($1, $2, $3) ON CONFLICT (session_id, client_id) DO NOTHING`,
      [req.params.id, clientId, tenantId]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/sessions/:id/attendees/:clientId — update attendance status
router.put('/:id/attendees/:clientId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { status } = req.body;
    const { rows } = await pool.query(
      `UPDATE session_attendees SET status = $1
       WHERE session_id = $2 AND client_id = $3 AND tenant_id = $4
       RETURNING *`,
      [status, req.params.id, req.params.clientId, tenantId]
    );
    res.json({ success: true, attendee: rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/sessions/:id/attendees/:clientId
router.delete('/:id/attendees/:clientId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.user;
    await pool.query(
      'DELETE FROM session_attendees WHERE session_id=$1 AND client_id=$2 AND tenant_id=$3',
      [req.params.id, req.params.clientId, tenantId]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});
"""

# Dodaj pool import ako ga nema
if "const { pool" not in c and "require('../config/database')" in c:
    c = c.replace(
        "const { queryWithTenant",
        "const { pool, queryWithTenant"
    )
elif "const pool" not in c and "{ pool }" not in c:
    # Dodaj pool iz database
    c = c.replace(
        "const { authenticateToken }",
        "const { pool } = require('../config/database');\nconst { authenticateToken }"
    )

# Ubaci prije module.exports ili na kraj
if 'module.exports' in c:
    c = c.replace('module.exports', ATTENDEE_ROUTES + '\nmodule.exports')
else:
    c += ATTENDEE_ROUTES

with open('backend/routes/sessions.js', 'w') as f:
    f.write(c)
print("OK")
PYEOF
ok "Attendee endpoints dodani"

# ─────────────────────────────────────────────────────────────────────────────
# 2. Backend — ažuriraj createSession da prihvaća isGroup + attendees
# ─────────────────────────────────────────────────────────────────────────────
echo "Backend: Ažuriram createSession za ad-hoc grupe..."
python3 - <<'PYEOF'
with open('backend/controllers/sessionsController.js', 'r') as f:
    c = f.read()

if 'ADHOC_GROUP_CREATE' in c:
    print("ALREADY_DONE"); exit()

# Dodaj isGroup i groupTitle u destructuring createSession
old = "const { clientId, sessionDate, startTime, endTime, sessionType, notes, force } = req.body;"
new = "const { clientId, sessionDate, startTime, endTime, sessionType, notes, force, isGroup, groupTitle, attendees } = req.body; // ADHOC_GROUP_CREATE"
if old in c:
    c = c.replace(old, new, 1)

# Ažuriraj INSERT da uključi is_group i group_title
old2 = """    const result = await queryWithTenant(
      `INSERT INTO training_sessions 
         (tenant_id, client_id, session_date, start_time, end_time, session_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, clientId, sessionDate, startTime, endTime, sessionType || null, notes || null],"""
new2 = """    const result = await queryWithTenant(
      `INSERT INTO training_sessions 
         (tenant_id, client_id, session_date, start_time, end_time, session_type, notes, is_group, group_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, isGroup ? null : clientId, sessionDate, startTime, endTime, sessionType || null, notes || null, !!isGroup, groupTitle || null],"""
if old2 in c:
    c = c.replace(old2, new2, 1)
else:
    print("INSERT not found — trying alternative")

# Dodaj attendees insert nakon kreiranja sesije
old3 = "    res.status(201).json({ success: true, session: result.rows[0] });"
new3 = """    // Insert ad-hoc attendees
    if (isGroup && attendees && attendees.length > 0) {
      const { pool } = require('../config/database');
      for (const aClientId of attendees) {
        await pool.query(
          'INSERT INTO session_attendees (session_id, client_id, tenant_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [result.rows[0].id, aClientId, tenantId]
        );
      }
    }
    res.status(201).json({ success: true, session: result.rows[0] });"""
if old3 in c:
    c = c.replace(old3, new3, 1)

with open('backend/controllers/sessionsController.js', 'w') as f:
    f.write(c)
print("OK")
PYEOF
ok "createSession ažuriran"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Frontend — SessionModal dobiva "Ad-hoc grupno" mode
# ─────────────────────────────────────────────────────────────────────────────
echo "Frontend: SessionModal — ad-hoc grupni mode..."
python3 - <<'PYEOF'
with open('frontend/src/components/SessionModal.jsx', 'r') as f:
    c = f.read()

if 'adhoc-group' in c:
    print("ALREADY_DONE"); exit()

# Dodaj state za adhoc attendees
old_state = "  const [confirmDelete, setConfirmDelete] = useState(false);"
new_state = """  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adhocAttendees, setAdhocAttendees] = useState([]); // ad-hoc group attendees
  const [groupTitle, setGroupTitle]         = useState('');"""
c = c.replace(old_state, new_state, 1)

# Dodaj "Ad-hoc grupno" u toggle — zamijeni postojeći toggle
old_toggle = """            {/* Individual / Group toggle — only for new sessions */}
            {!session && (
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={() => { setSessionMode('individual'); setSelectedGroupId(''); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${sessionMode === 'individual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {`👤 ${t('sessions.individual')}`}
                </button>
                <button type="button" onClick={() => { setSessionMode('group'); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${sessionMode === 'group' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {`👥 ${t('sessions.group')}`}
                </button>
              </div>
            )}"""

new_toggle = """            {/* Individual / Group / Ad-hoc toggle — only for new sessions */}
            {!session && (
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button type="button" onClick={() => { setSessionMode('individual'); setSelectedGroupId(''); setAdhocAttendees([]); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${sessionMode === 'individual' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  👤 {t('sessions.individual')}
                </button>
                <button type="button" onClick={() => { setSessionMode('adhoc-group'); setSelectedGroupId(''); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${sessionMode === 'adhoc-group' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  👥 Grupno
                </button>
                <button type="button" onClick={() => { setSessionMode('group'); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${sessionMode === 'group' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  🏟 {t('nav.groups')}
                </button>
              </div>
            )}"""

c = c.replace(old_toggle, new_toggle, 1)

# Dodaj ad-hoc group UI — iza client selectora
old_client = """            {/* Group: group selector — top 2 + expand */}
            {!session && sessionMode === 'group' && ("""
new_adhoc = """            {/* Ad-hoc group: title + multi-select clients */}
            {!session && sessionMode === 'adhoc-group' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Naziv grupe <span className="text-gray-400 text-xs">(neobavezno)</span></label>
                  <input type="text" className="input" placeholder="npr. Jutarnja grupa, HIIT ponedjeljak..."
                    value={groupTitle} onChange={e => setGroupTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sudionici</label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl max-h-40 overflow-y-auto">
                    {clients.length === 0 ? (
                      <p className="text-sm text-gray-400 p-3">Nema klijenata</p>
                    ) : clients.map(cl => {
                      const checked = adhocAttendees.includes(cl.id);
                      return (
                        <label key={cl.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <input type="checkbox" checked={checked}
                            onChange={() => setAdhocAttendees(prev => checked ? prev.filter(id => id !== cl.id) : [...prev, cl.id])}
                            className="rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{cl.first_name} {cl.last_name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {adhocAttendees.length > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">{adhocAttendees.length} sudionik{adhocAttendees.length !== 1 ? 'a' : ''} odabrano</p>
                  )}
                </div>
              </div>
            )}

            {/* Group: group selector — top 2 + expand */}
            {!session && sessionMode === 'group' && ("""

c = c.replace(old_client, new_adhoc, 1)

# Ažuriraj saveSession da obradi adhoc-group
old_save = """      // Group session — call group endpoint
      if (!session && sessionMode === 'group') {"""
new_save = """      // Ad-hoc group session
      if (!session && sessionMode === 'adhoc-group') {
        if (adhocAttendees.length === 0) { setError('Odaberi barem jednog sudionika'); setLoading(false); return; }
        const payload = { ...formData, isGroup: true, groupTitle: groupTitle || null, attendees: adhocAttendees };
        await sessionsAPI.create(payload);
        setShowConflictWarning(false);
        onSave();
        return;
      }
      // Group session — call group endpoint
      if (!session && sessionMode === 'group') {"""
c = c.replace(old_save, new_save, 1)

with open('frontend/src/components/SessionModal.jsx', 'w') as f:
    f.write(c)
print("OK")
PYEOF
ok "SessionModal ažuriran"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Frontend — Calendar prikazuje ad-hoc grupne sesije s attendance paneom
# ─────────────────────────────────────────────────────────────────────────────
echo "Frontend: Kreiram AdhocGroupPanel komponentu..."
cat > frontend/src/components/AdhocGroupPanel.jsx << 'EOF'
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const token   = () => localStorage.getItem('token');
const hdr     = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

const STATUS_CONFIG = {
  scheduled: { label: 'Zakazano',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  completed: { label: 'Prisutan',  color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  no_show:   { label: 'Nije došao', color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
  cancelled: { label: 'Otkazano',  color: 'bg-gray-100 text-gray-500' },
};

export default function AdhocGroupPanel({ sessionId, tenantId }) {
  const { t } = useTranslation();
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/sessions/${sessionId}/attendees`, { headers: hdr() });
      const d = await r.json();
      setAttendees(d.attendees || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [sessionId]);

  const toggle = async (clientId, current) => {
    const next = current === 'completed' ? 'scheduled' : 'completed';
    setAttendees(prev => prev.map(a => a.client_id === clientId ? { ...a, status: next } : a));
    await fetch(`${API_URL}/sessions/${sessionId}/attendees/${clientId}`, {
      method: 'PUT', headers: hdr(), body: JSON.stringify({ status: next })
    }).catch(() => load());
  };

  if (loading) return <p className="text-xs text-gray-400 py-2">{t('common.loading')}</p>;
  if (attendees.length === 0) return <p className="text-xs text-gray-400 py-2">Nema sudionika</p>;

  const present = attendees.filter(a => a.status === 'completed').length;

  return (
    <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sudionici</p>
        <span className="text-xs text-gray-400">{present}/{attendees.length} prisutnih</span>
      </div>
      <div className="space-y-1.5">
        {attendees.map(a => {
          const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.scheduled;
          return (
            <div key={a.client_id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => toggle(a.client_id, a.status)}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${a.status === 'completed' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">{a.first_name} {a.last_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
EOF
ok "AdhocGroupPanel.jsx kreiran"

# Dodaj AdhocGroupPanel u SessionModal za prikaz pri editiranju
python3 - <<'PYEOF'
with open('frontend/src/components/SessionModal.jsx', 'r') as f:
    c = f.read()

if 'AdhocGroupPanel' in c:
    print("ALREADY_DONE"); exit()

# Dodaj import
c = c.replace(
    "import TimeInput from './TimeInput';",
    "import TimeInput from './TimeInput';\nimport AdhocGroupPanel from './AdhocGroupPanel';"
)

# Dodaj panel u edit mode — iza linked training sekcije
old_panel = "          <form onSubmit={handleSubmit} className=\"space-y-4\">"
new_panel = """          {/* Ad-hoc group attendance panel */}
          {session?.isGroup && (
            <AdhocGroupPanel sessionId={session.id} />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">"""
c = c.replace(old_panel, new_panel, 1)

with open('frontend/src/components/SessionModal.jsx', 'w') as f:
    f.write(c)
print("OK")
PYEOF
ok "AdhocGroupPanel dodan u SessionModal"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sada pokreni migraciju na bazi:"
echo ""
echo "  psql -U roks -d treniko_db -f ~/Desktop/treniko/023_adhoc_group_sessions.sql"
echo ""
echo "Zatim restartaj backend i testiraj:"
echo "  Nova sesija → 👥 Grupno → odaberi klijente → Spremi"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
