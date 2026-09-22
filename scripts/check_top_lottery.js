const fs = require('fs');
const path = require('path');
const vm = require('vm');

const iztroCode = fs.readFileSync(path.join(__dirname, '../webapp/iztro.min.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '../webapp/app.js'), 'utf8');

const sandbox = {
  window: {},
  console,
  localStorage: { getItem: () => null, setItem: () => {}, length: 0, key: () => null },
  document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} }
};
sandbox.self = sandbox.window;
sandbox.global = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(iztroCode, sandbox);
vm.runInContext(appCode, sandbox);

const code = `
const session = {
  sessionId: 'client-001',
  clientName: '客戶-001',
  birthday: '1990-03-15',
  calendarType: 'solar',
  birthTime: 7,
  gender: '男',
  targetYear: 2026,
  includeNatal: false
};
state.currentSession = session;
calculateClientAstrolabe(session);

const future = state.rankings.letou.filter(d => d.date >= '2026-09-22');
console.log('Top future lottery day:');
console.log('Date:', future[0].date);
console.log('GanZhi:', future[0].dailyGanZhi);
console.log('Score:', future[0].score);
console.log('Details:', JSON.stringify(future[0].details, null, 2));

console.log('\\nTOP 5 Future lottery days:');
future.slice(0, 5).forEach((d, i) => {
  console.log(\`#\${i+1}: \${d.date} (\${d.dailyGanZhi}) - \${d.score} pts: \${d.details.map(x => x.rule).join('; ')}\`);
});
`;

vm.runInContext(code, sandbox);
