const fs = require('fs');

let content = fs.readFileSync('frontend/src/components/SessionModal.jsx', 'utf8');

content = content.replace(
  "setError('Odaberi barem jednog sudionika')",
  "setError(t('sessions.atLeastOneAttendee'))"
);

content = content.replace(
  "setError('Please select a group')",
  "setError(t('sessions.selectGroup'))"
);

content = content.replace(
  "const sessionTypes = ['Strength Training', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 'Boxing', 'Consultation', 'Other'];",
  "const sessionTypes = t('sessions.sessionTypes', { returnObjects: true });"
);

fs.writeFileSync('frontend/src/components/SessionModal.jsx', content);
console.log('Done');