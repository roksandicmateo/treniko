const fs = require('fs');

// Dodaj ključeve u lokalizacije
const langs = {
  'frontend/src/locales/en.json': {
    groupName: 'Group name',
    optional: 'optional',
    participants: 'Participants',
    noClients: 'No clients',
    participantsSelected: 'participant(s) selected',
  },
  'frontend/src/locales/hr.json': {
    groupName: 'Naziv grupe',
    optional: 'neobavezno',
    participants: 'Sudionici',
    noClients: 'Nema klijenata',
    participantsSelected: 'sudionik(a) odabrano',
  },
  'frontend/src/locales/de.json': {
    groupName: 'Gruppenname',
    optional: 'optional',
    participants: 'Teilnehmer',
    noClients: 'Keine Klienten',
    participantsSelected: 'Teilnehmer ausgewählt',
  }
};

Object.entries(langs).forEach(([path, keys]) => {
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  Object.assign(json.sessions, keys);
  fs.writeFileSync(path, JSON.stringify(json, null, 2));
  console.log('Done: ' + path);
});

// Popravi SessionModal.jsx
let content = fs.readFileSync('frontend/src/components/SessionModal.jsx', 'utf8');

content = content.replace(
  `<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Naziv grupe <span className="text-gray-400 text-xs">(neobavezno)</span></label>`,
  `<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.groupName')} <span className="text-gray-400 text-xs">({t('sessions.optional')})</span></label>`
);

content = content.replace(
  `<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sudionici</label>`,
  `<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('sessions.participants')}</label>`
);

content = content.replace(
  `<p className="text-sm text-gray-400 p-3">Nema klijenata</p>`,
  `<p className="text-sm text-gray-400 p-3">{t('sessions.noClients')}</p>`
);

content = content.replace(
  `<p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">{adhocAttendees.length} sudionik{adhocAttendees.length !== 1 ? 'a' : ''} odabrano</p>`,
  `<p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">{adhocAttendees.length} {t('sessions.participantsSelected')}</p>`
);

fs.writeFileSync('frontend/src/components/SessionModal.jsx', content);
console.log('SessionModal done');