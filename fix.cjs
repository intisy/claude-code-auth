const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/finn/.config/github/repos/intisy/plugin-claude-auth/src/ui';

fs.readdirSync(dir).filter(f => f.endsWith('.ts')).forEach(f => {
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
  fs.writeFileSync(p, c);
});
