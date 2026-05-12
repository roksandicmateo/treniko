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
