#!/bin/bash
# Fix: Grupne sesije vidljive u Trainings stranici i Client detail Treninzi tabu
# 1. Dodaje backend route: GET /api/groups/sessions/for-client/:clientId
# 2. Ažurira ClientDetail.jsx da merge-a grupne sesije
# 3. Ažurira TrainingsPage.jsx da prikazuje grupne sesije

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

[ ! -f "backend/routes/groups.js" ] && echo "Pokreni iz korijena projekta" && exit 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Fix: Grupne sesije u Treninzima"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# BACKEND: Dodaj GET /api/groups/sessions/for-client/:clientId
# Mora biti PRIJE /:id routeova da ne bi bio shadovan
# ─────────────────────────────────────────────────────────────────────────────
echo "Backend: Dodajem /groups/sessions/for-client/:clientId..."
python3 - <<'PYEOF'
with open('backend/routes/groups.js', 'r') as f:
    content = f.read()

MARKER = 'FOR_CLIENT_ENDPOINT'

if MARKER in content:
    print("ALREADY_APPLIED")
else:
    NEW_ROUTE = """
// ── GET /api/groups/sessions/for-client/:clientId — FOR_CLIENT_ENDPOINT ──────
// Sve grupne sesije za određenog klijenta (across all groups)
router.get('/sessions/for-client/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;

    const { rows } = await pool.query(
      `SELECT
         gs.id,
         gs.session_date::text AS session_date,
         gs.start_time,
         gs.end_time,
         gs.session_type,
         gs.notes,
         gsa.status,
         (gsa.status = 'completed') AS is_completed,
         g.id   AS group_id,
         g.name AS group_name,
         g.color AS group_color,
         'group' AS session_kind
       FROM group_session_attendance gsa
       JOIN group_sessions gs ON gs.id = gsa.group_session_id
       JOIN groups g          ON g.id  = gs.group_id
       WHERE gsa.client_id = $1
         AND gs.tenant_id  = $2
       ORDER BY gs.session_date DESC, gs.start_time DESC`,
      [clientId, tenantId]
    );

    res.json({ success: true, sessions: rows });
  } catch (e) {
    console.error('for-client group sessions error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

"""
    # Ubaci PRIJE prvog /:id route-a da ne bude shadovan
    TARGET = "// ── GET /api/groups/sessions/calendar"
    if TARGET in content:
        content = content.replace(TARGET, NEW_ROUTE + TARGET, 1)
        with open('backend/routes/groups.js', 'w') as f:
            f.write(content)
        print("OK")
    else:
        # Fallback — ubaci na kraj prije module.exports ili pred /:id routes
        TARGET2 = "// ── GET /api/groups/:id/sessions/:sessionId"
        if TARGET2 in content:
            content = content.replace(TARGET2, NEW_ROUTE + TARGET2, 1)
            with open('backend/routes/groups.js', 'w') as f:
                f.write(content)
            print("OK_FALLBACK")
        else:
            print("TARGET_NOT_FOUND")
PYEOF

result=$(python3 -c "
with open('backend/routes/groups.js') as f: c = f.read()
print('YES' if 'FOR_CLIENT_ENDPOINT' in c else 'NO')
")
[ "$result" = "YES" ] && ok "Backend route dodan" || warn "Backend route NIJE dodan — provjeri ručno"

# ─────────────────────────────────────────────────────────────────────────────
# FRONTEND: ClientDetail.jsx — merge grupnih sesija u trainings
# ─────────────────────────────────────────────────────────────────────────────
echo "Frontend: ClientDetail.jsx — merge grupnih sesija..."
python3 - <<'PYEOF'
with open('frontend/src/pages/ClientDetail.jsx', 'r') as f:
    content = f.read()

if 'GROUP_SESSIONS_MERGED' in content:
    print("ALREADY_APPLIED")
else:
    OLD = """  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [clientRes, trainingsRes] = await Promise.all([
        fetch(`/api/clients/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
          .then(r => { if (!r.ok) throw new Error('Client not found'); return r.json(); }),
        trainingService.getAll({ clientId: id }),
      ]);
      setClient(clientRes.client || clientRes);
      setTrainings(trainingsRes.data);"""

    NEW = """  const load = useCallback(async () => {
    try {
      setLoading(true);
      const API_URL_LOCAL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const authHdr = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      // GROUP_SESSIONS_MERGED
      const [clientRes, trainingsRes, groupSessionsRes] = await Promise.all([
        fetch(`/api/clients/${id}`, { headers: authHdr })
          .then(r => { if (!r.ok) throw new Error('Client not found'); return r.json(); }),
        trainingService.getAll({ clientId: id }),
        fetch(`${API_URL_LOCAL}/groups/sessions/for-client/${id}`, { headers: authHdr })
          .then(r => r.json()).catch(() => ({ sessions: [] })),
      ]);
      setClient(clientRes.client || clientRes);

      // Normaliziraj individualne treninge
      const raw = trainingsRes.data;
      const individual = (
        Array.isArray(raw) ? raw :
        Array.isArray(raw?.trainings) ? raw.trainings :
        Array.isArray(raw?.sessions)  ? raw.sessions  :
        Array.isArray(raw?.data)      ? raw.data       : []
      ).map(t => ({ ...t, session_kind: 'individual' }));

      // Normaliziraj grupne sesije u isti format
      const groupSessions = (groupSessionsRes.sessions || []).map(gs => ({
        id:           gs.id,
        title:        `👥 ${gs.group_name}`,
        start_time:   gs.start_time,
        session_date: gs.session_date?.slice(0, 10),
        session_type: gs.session_type,
        workout_type: gs.session_type || 'Group',
        is_completed: gs.is_completed,
        status:       gs.status,
        group_id:     gs.group_id,
        group_name:   gs.group_name,
        group_color:  gs.group_color,
        session_kind: 'group',
        // Sintetiziramo start_time ISO za sort
        _sortKey:     `${gs.session_date?.slice(0, 10)}T${gs.start_time}`,
      }));

      // Merge i sortiraj po datumu DESC
      const merged = [...individual, ...groupSessions].sort((a, b) => {
        const aKey = a._sortKey || `${a.session_date || ''}T${a.start_time || ''}`;
        const bKey = b._sortKey || `${b.session_date || ''}T${b.start_time || ''}`;
        return bKey.localeCompare(aKey);
      });

      setTrainings(merged);"""

    if OLD.strip().replace(' ', '') in content.replace(' ', ''):
        # Exact match nije pronađen — pokušaj parcijalni match
        import re
        # Zamijeni samo setTrainings(trainingsRes.data); s robusnim blokom
        pass

    if OLD in content:
        content = content.replace(OLD, NEW, 1)
        with open('frontend/src/pages/ClientDetail.jsx', 'w') as f:
            f.write(content)
        print("OK")
    else:
        # Parcijalni fix — samo zamijeni setTrainings liniju ako je array fix već tu
        old_simple = """      setTrainings((() => {
        const raw = trainingsRes.data;
        if (Array.isArray(raw))                return raw;
        if (Array.isArray(raw?.trainings))     return raw.trainings;
        if (Array.isArray(raw?.sessions))      return raw.sessions;
        if (Array.isArray(raw?.data))          return raw.data;
        return [];
      })());"""
        if old_simple in content:
            print("PARTIAL_FIX_NEEDED")
        else:
            print("NOT_FOUND")
PYEOF

result=$(python3 -c "
with open('frontend/src/pages/ClientDetail.jsx') as f: c = f.read()
print('YES' if 'GROUP_SESSIONS_MERGED' in c else 'NO')
")
[ "$result" = "YES" ] && ok "ClientDetail.jsx — grupne sesije mergane" || warn "ClientDetail.jsx parcijalni fix — vidi ispod"

# ─────────────────────────────────────────────────────────────────────────────
# FRONTEND: TrainingsPage.jsx — dohvati i grupne sesije
# ─────────────────────────────────────────────────────────────────────────────
echo "Frontend: TrainingsPage.jsx — dodajem grupne sesije..."
python3 - <<'PYEOF'
with open('frontend/src/pages/TrainingsPage.jsx', 'r') as f:
    content = f.read()

if 'GROUP_SESSIONS_TRAININGS' in content:
    print("ALREADY_APPLIED")
    exit()

# Dodaj state za grupne sesije i fetch u load funkciji
# Pronađi: const [loading, setLoading]
STATE_OLD = "  const [loading,      setLoading]      = useState(true);"
STATE_NEW = """  const [loading,      setLoading]      = useState(true);
  const [groupSessions, setGroupSessions] = useState([]); // GROUP_SESSIONS_TRAININGS"""

if STATE_OLD in content:
    content = content.replace(STATE_OLD, STATE_NEW, 1)
else:
    print("STATE_NOT_FOUND")
    exit()

# Pronađi kraj load funkcije i dodaj grupni fetch
LOAD_OLD = """      const res = await trainingService.getAll(params);
      const raw = res.data;
      let rows = Array.isArray(raw) ? raw : (raw.data || []);
      const totalCount = Array.isArray(raw) ?"""

# Dodaj groupSessionsFetch nakon setLoading(true) u load
LOAD_TARGET = "    setLoading(true);\n    try {"
LOAD_NEW = """    setLoading(true);
    try {
      // Dohvati grupne sesije paralelno
      const API_URL_LOCAL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const token = localStorage.getItem('token');
      const now = new Date();
      const from = new Date(now.getFullYear() - 2, 0, 1).toISOString().split('T')[0];
      const to   = new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0];
      fetch(`${API_URL_LOCAL}/groups/sessions/calendar?startDate=${from}&endDate=${to}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).then(d => {
        const gs = (d.sessions || []).map(s => ({
          id:           `group-${s.id}`,
          title:        `👥 ${s.group_name}`,
          start_time:   s.start_time,
          session_date: (s.session_date || '').slice(0, 10),
          workout_type: s.session_type || 'Group',
          is_completed: s.status === 'completed',
          status:       s.status,
          group_name:   s.group_name,
          group_id:     s.group_id,
          session_kind: 'group',
          first_name:   s.group_name,
          last_name:    '',
        }));
        setGroupSessions(gs);
      }).catch(() => {});"""

if LOAD_TARGET in content:
    content = content.replace(LOAD_TARGET, LOAD_NEW, 1)
else:
    print("LOAD_TARGET_NOT_FOUND")
    exit()

# Dodaj close bracket za try block (zatvori naš novi try blok)
# Pronađi kraj originalnog try bloka i zatvori naš wrapper
# Zapravo — ovo je fire-and-forget pa ne treba zatvarati

with open('frontend/src/pages/TrainingsPage.jsx', 'w') as f:
    f.write(content)
print("OK")
PYEOF

# Provjeri i prikaz grupnih sesija u TrainingsPage render dijelu
python3 - <<'PYEOF'
with open('frontend/src/pages/TrainingsPage.jsx', 'r') as f:
    content = f.read()

if 'GROUP_SESSIONS_RENDER' in content:
    print("RENDER_ALREADY_OK")
    exit()

# Dodaj grupne sesije ispod liste individualnih treninga
# Traži kraj liste (nakon paginacije ili trainings.map)
RENDER_MARKER = "      {loading ? ("
if RENDER_MARKER not in content:
    print("RENDER_MARKER_NOT_FOUND")
    exit()

# Dodaj computed allItems koji merge-a oboje, koristi se u renderu
# Pronađi const types = [...] liniju — tu dodajemo merged listu
TYPES_LINE = "  const types = [...new Set(trainings.map(row => row.workout_type).filter(Boolean))];"
TYPES_NEW = """  // Merge individualnih i grupnih sesija za prikaz
  const allItems = [
    ...trainings,
    ...groupSessions.filter(gs => {
      if (filter === 'Completed') return gs.is_completed;
      if (filter === 'Upcoming')  return !gs.is_completed && gs.session_date >= new Date().toISOString().split('T')[0];
      if (filter === 'Past')      return gs.session_date <  new Date().toISOString().split('T')[0];
      return true;
    }).filter(gs => !search || gs.group_name?.toLowerCase().includes(search.toLowerCase())),
  ].sort((a, b) => {
    const aK = `${a.session_date}T${a.start_time}`;
    const bK = `${b.session_date}T${b.start_time}`;
    return bK.localeCompare(aK);
  });
  const types = [...new Set(trainings.map(row => row.workout_type).filter(Boolean))]; // GROUP_SESSIONS_RENDER"""

if TYPES_LINE in content:
    content = content.replace(TYPES_LINE, TYPES_NEW, 1)
    with open('frontend/src/pages/TrainingsPage.jsx', 'w') as f:
        f.write(content)
    print("RENDER_OK")
else:
    print("TYPES_LINE_NOT_FOUND")
PYEOF

# Sad zamijeni trainings.map s allItems.map u renderu
python3 - <<'PYEOF'
with open('frontend/src/pages/TrainingsPage.jsx', 'r') as f:
    content = f.read()

if 'ITEMS_MAP_DONE' in content:
    print("ALREADY")
    exit()

# Zamijeni trainings.map u JSX s allItems.map
# Pronađi: {trainings.map(training => (
old = "            {trainings.map(training => ("
new = "            {/* ITEMS_MAP_DONE */}{allItems.map(training => ("

if old in content:
    content = content.replace(old, new, 1)
    # Zamijeni i trainings.length === 0 uvjet
    content = content.replace(
        "      ) : trainings.length === 0 ? (",
        "      ) : allItems.length === 0 ? ("
    )
    with open('frontend/src/pages/TrainingsPage.jsx', 'w') as f:
        f.write(content)
    print("OK")
else:
    print("MAP_NOT_FOUND")
PYEOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Gotovo!${NC} Restartaj backend i frontend:"
echo ""
echo "  Terminal 1: cd backend && node server.js"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Provjeri:"
echo "  ✓ /dashboard/trainings    — grupne sesije (👥) prikazuju se u listi"
echo "  ✓ /dashboard/clients/:id  — Treninzi tab prikazuje i grupne sesije"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
