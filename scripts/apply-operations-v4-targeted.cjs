/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error('No change applied to ' + path);
  fs.writeFileSync(path, after);
  console.log('updated ' + path);
}

function replaceExact(source, from, to, label) {
  if (!source.includes(from)) throw new Error('Missing target: ' + label);
  return source.replace(from, to);
}

patch('app/admin/alerts/alerts-workspace.tsx', (source) => {
  let next = replaceExact(source, '})}</div> : unresolved === 0 ? <OpsEmptyState', '})}</div> : (unresolved === 0 ? <OpsEmptyState', 'alerts ternary opening parenthesis');
  next = replaceExact(next, 'onClick={reset}>Show all alerts</OpsButton>/>} \n        </OpsSurface>', 'onClick={reset}>Show all alerts</OpsButton>/>) }\n        </OpsSurface>', 'alerts ternary closing parenthesis');
  return next;
});

patch('app/admin/command-centre/command-centre-workspace.tsx', (source) => {
  let next = source;
  for (const unused of ['  AlertTriangle,\n', '  Clock3,\n', '  ShieldAlert,\n', '  UserRound,\n']) {
    next = replaceExact(next, unused, '', 'unused command centre icon ' + unused.trim());
  }
  return next;
});
