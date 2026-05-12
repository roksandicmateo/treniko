#!/bin/bash
# Kreira TimeInput komponentu + ažurira sve forme

[ ! -f "frontend/src/components/SessionModal.jsx" ] && echo "Pokreni iz korijena projekta" && exit 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " TimeInput + Uniformne forme"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. Kreiraj TimeInput.jsx komponentu
# ─────────────────────────────────────────────────────────────────────────────
echo "Kreiranje TimeInput komponente..."
cat > frontend/src/components/TimeInput.jsx << 'TIMEINPUT'
// frontend/src/components/TimeInput.jsx
// Hybrid time input: native tip + datalist sa slotovima od 30 min
// - Desktop: prikazuje dropdown s prijedlozima, slobodan upis
// - Mobile:  native time picker

const LIST_ID_PREFIX = 'ti-slots-';

function generateSlots(from = 5, to = 23, step = 30) {
  const slots = [];
  for (let h = from; h <= to; h++) {
    for (let m = 0; m < 60; m += step) {
      if (h === to && m > 0) break;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

const SLOTS = generateSlots(5, 23, 30);

let _uid = 0;

export default function TimeInput({ value, onChange, required, id, className, placeholder }) {
  // Stable unique ID za datalist po instanci
  const listId = `${LIST_ID_PREFIX}${id || ++_uid}`;

  return (
    <>
      <input
        id={id}
        type="time"
        list={listId}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder || 'HH:MM'}
        className={className || 'input'}
        step="300"
      />
      <datalist id={listId}>
        {SLOTS.map(s => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}
TIMEINPUT
echo "✓ TimeInput.jsx kreiran"

# ─────────────────────────────────────────────────────────────────────────────
# 2. SessionModal.jsx — zamijeni <input type="time"> s TimeInput
# ─────────────────────────────────────────────────────────────────────────────
echo "Ažuriranje SessionModal.jsx..."
python3 - <<'PYEOF'
with open('frontend/src/components/SessionModal.jsx', 'r') as f:
    c = f.read()

if 'TimeInput' in c:
    print("ALREADY_DONE")
else:
    # Dodaj import
    c = c.replace(
        "import { format } from 'date-fns';",
        "import { format } from 'date-fns';\nimport TimeInput from './TimeInput';"
    )
    # Zamijeni startTime input
    c = c.replace(
        '<input type="time" id="startTime" name="startTime" value={formData.startTime} onChange={handleChange} required className="input" />',
        '<TimeInput id="startTime" value={formData.startTime} onChange={v => handleChange({ target: { name: "startTime", value: v } })} required />'
    )
    # Zamijeni endTime input
    c = c.replace(
        '<input type="time" id="endTime" name="endTime" value={formData.endTime} onChange={handleChange} required className="input" />',
        '<TimeInput id="endTime" value={formData.endTime} onChange={v => handleChange({ target: { name: "endTime", value: v } })} required />'
    )
    with open('frontend/src/components/SessionModal.jsx', 'w') as f:
        f.write(c)
    print("OK")
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# 3. GroupDetail.jsx — zamijeni time inpute u ScheduleGroupSessionModal
# ─────────────────────────────────────────────────────────────────────────────
echo "Ažuriranje GroupDetail.jsx..."
python3 - <<'PYEOF'
with open('frontend/src/pages/GroupDetail.jsx', 'r') as f:
    c = f.read()

if 'TimeInput' in c:
    print("ALREADY_DONE")
else:
    # Dodaj import na vrh
    c = c.replace(
        "import SessionModal from '../components/SessionModal';",
        "import SessionModal from '../components/SessionModal';\nimport TimeInput from '../components/TimeInput';"
    )
    # Zamijeni startTime
    c = c.replace(
        "<input type=\"time\" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className=\"input\" />",
        "<TimeInput value={form.startTime} onChange={v => setForm(f => ({ ...f, startTime: v }))} />"
    )
    # Zamijeni endTime
    c = c.replace(
        "<input type=\"time\" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className=\"input\" />",
        "<TimeInput value={form.endTime} onChange={v => setForm(f => ({ ...f, endTime: v }))} />"
    )
    with open('frontend/src/pages/GroupDetail.jsx', 'w') as f:
        f.write(c)
    print("OK")
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
# 4. AddTrainingModal.jsx — split datetime-local na date + TimeInput
#    i uskladi layout s SessionModal stilom
# ─────────────────────────────────────────────────────────────────────────────
echo "Ažuriranje AddTrainingModal.jsx..."
python3 - <<'PYEOF'
with open('frontend/src/components/training/AddTrainingModal.jsx', 'r') as f:
    c = f.read()

if 'TimeInput' in c:
    print("ALREADY_DONE")
    exit()

# Dodaj import
c = c.replace(
    "import ExerciseBuilder from './ExerciseBuilder';",
    "import ExerciseBuilder from './ExerciseBuilder';\nimport TimeInput from '../TimeInput';"
)

# Promijeni helper funkcije da rade sa separate date/time
OLD_HELPERS = """function toLocalInput(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toISOString().slice(0, 16);
}
function addHour(isoString) {
  const d = new Date(isoString || Date.now());
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 16);
}"""

NEW_HELPERS = """function toDatePart(isoString) {
  if (!isoString) return new Date().toISOString().slice(0, 10);
  return new Date(isoString).toISOString().slice(0, 10);
}
function toTimePart(isoString) {
  if (!isoString) return '09:00';
  return new Date(isoString).toISOString().slice(11, 16);
}
function addHourTime(timeStr) {
  if (!timeStr) return '10:00';
  const [h, m] = timeStr.split(':').map(Number);
  const newH = Math.min(h + 1, 23);
  return `${String(newH).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
// Legacy compat
function toLocalInput(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toISOString().slice(0, 16);
}"""

if OLD_HELPERS in c:
    c = c.replace(OLD_HELPERS, NEW_HELPERS)

# Promijeni defaultStart i form state
c = c.replace(
    "  const defaultStart = initialStartTime ? toLocalInput(initialStartTime) : new Date().toISOString().slice(0, 16);",
    "  const defaultDate = initialStartTime ? toDatePart(initialStartTime) : new Date().toISOString().slice(0,10);\n  const defaultTime = initialStartTime ? toTimePart(initialStartTime) : '09:00';"
)

# Promijeni inicijalni form state
c = c.replace(
    """  const [form, setForm] = useState({
    clientId: initialClientId || '', title: '', workoutType: 'Gym',
    startTime: defaultStart,
    endTime: overrideEndTime ? toLocalInput(overrideEndTime) : addHour(defaultStart),
    notes: '', location: '', exercises: [],
  });""",
    """  const [form, setForm] = useState({
    clientId: initialClientId || '', title: '', workoutType: 'Gym',
    sessionDate: defaultDate,
    startTime: defaultTime,
    endTime: overrideEndTime ? toTimePart(overrideEndTime) : addHourTime(defaultTime),
    notes: '', location: '', exercises: [],
  });"""
)

# Reset u useEffect za novi trening
c = c.replace(
    "      setForm({ clientId: initialClientId || '', title: '', workoutType: 'Gym', startTime: start, endTime: addHour(start), notes: '', location: '', exercises: [] });",
    "      const sDate = initialStartTime ? toDatePart(initialStartTime) : new Date().toISOString().slice(0,10);\n      const sTime = initialStartTime ? toTimePart(initialStartTime) : '09:00';\n      setForm({ clientId: initialClientId || '', title: '', workoutType: 'Gym', sessionDate: sDate, startTime: sTime, endTime: addHourTime(sTime), notes: '', location: '', exercises: [] });"
)

# editTraining reset
c = c.replace(
    "        startTime: toLocalInput(editTraining.start_time), endTime: toLocalInput(editTraining.end_time),",
    "        sessionDate: toDatePart(editTraining.start_time),\n        startTime: toTimePart(editTraining.start_time), endTime: toTimePart(editTraining.end_time),"
)

# Payload — kombiniraj date + time u ISO za backend
c = c.replace(
    "      const payload = {\n        ...form, sessionId: sessionId || undefined,",
    "      const startISO = `${form.sessionDate}T${form.startTime}:00`;\n      const endISO   = `${form.sessionDate}T${form.endTime}:00`;\n      const payload = {\n        ...form, startTime: startISO, endTime: endISO, sessionId: sessionId || undefined,"
)

# Validacija — prilagodi za string usporedbu
c = c.replace(
    "    if (form.endTime <= form.startTime) return setError('End time must be after start time');",
    "    if (form.endTime <= form.startTime && form.endTime !== '00:00') return setError('End time must be after start time');"
)

# Zamijeni datetime-local inpute s date + TimeInput
OLD_DATETIME = """          {/* Date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('sessions.startTime')} <span className="text-red-400">*</span></label>
              <input type="datetime-local" className={inputCls} value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>{t('sessions.endTime')} <span className="text-red-400">*</span></label>
              <input type="datetime-local" className={inputCls} value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>"""

NEW_DATETIME = """          {/* Date/time */}
          <div>
            <label className={labelCls}>{t('sessions.date')} <span className="text-red-400">*</span></label>
            <input type="date" className={inputCls} value={form.sessionDate}
              onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('sessions.startTime')} <span className="text-red-400">*</span></label>
              <TimeInput value={form.startTime} onChange={v => setForm(f => ({ ...f, startTime: v }))} required />
            </div>
            <div>
              <label className={labelCls}>{t('sessions.endTime')} <span className="text-red-400">*</span></label>
              <TimeInput value={form.endTime} onChange={v => setForm(f => ({ ...f, endTime: v }))} required />
            </div>
          </div>"""

if OLD_DATETIME in c:
    c = c.replace(OLD_DATETIME, NEW_DATETIME)
    print("datetime fix OK")
else:
    print("datetime NOT FOUND — možda već patchano ili drugačiji format")

with open('frontend/src/components/training/AddTrainingModal.jsx', 'w') as f:
    f.write(c)
print("OK")
PYEOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Gotovo! Provjeri:"
echo "  - Nova sesija (kalendar) — time picker s dropdownom"
echo "  - Dodaj trening — odvojeni date + time inputi"
echo "  - Grupna sesija — time picker s dropdownom"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
