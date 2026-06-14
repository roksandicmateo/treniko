const fs = require('fs');
const langs = {
  'frontend/src/locales/en.json': { useCommon: 'Use common', unitPlaceholder: 'Unit (kg, cm...)' },
  'frontend/src/locales/hr.json': { useCommon: 'Koristi uobičajene', unitPlaceholder: 'Jedinica (kg, cm...)' },
  'frontend/src/locales/de.json': { useCommon: 'Allgemeine verwenden', unitPlaceholder: 'Einheit (kg, cm...)' }
};
Object.entries(langs).forEach(([path, keys]) => {
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!json.progress) json.progress = {};
  Object.assign(json.progress, keys);
  fs.writeFileSync(path, JSON.stringify(json, null, 2));
  console.log('Done: ' + path);
});