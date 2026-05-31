const fs = require('fs');

const langs = {
  'frontend/src/locales/en.json': {
    selectGroup: 'Please select a group',
    atLeastOneAttendee: 'Select at least one participant',
    sessionTypes: ['Strength Training','Cardio','HIIT','Yoga','Pilates','Boxing','Consultation','Other']
  },
  'frontend/src/locales/hr.json': {
    selectGroup: 'Odaberi grupu',
    atLeastOneAttendee: 'Odaberi barem jednog sudionika',
    sessionTypes: ['Trening snage','Kardio','HIIT','Yoga','Pilates','Boks','Konzultacija','Ostalo']
  },
  'frontend/src/locales/de.json': {
    selectGroup: 'Bitte Gruppe auswaehlen',
    atLeastOneAttendee: 'Mindestens einen Teilnehmer auswaehlen',
    sessionTypes: ['Krafttraining','Kardio','HIIT','Yoga','Pilates','Boxen','Beratung','Sonstiges']
  }
};

Object.entries(langs).forEach(([path, keys]) => {
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  json.sessions.selectGroup = keys.selectGroup;
  json.sessions.atLeastOneAttendee = keys.atLeastOneAttendee;
  json.sessions.sessionTypes = keys.sessionTypes;
  fs.writeFileSync(path, JSON.stringify(json, null, 2));
  console.log('Done: ' + path);
});