const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
let checked = 0;
let failures = 0;
function check(relative) {
    const file = path.join(root, relative);
    if (fs.statSync(file).isDirectory()) {
        for (const name of fs.readdirSync(file)) check(path.join(relative, name));
        return;
    }
    if (!file.endsWith('.js')) return;
    checked++;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
        failures++;
        console.error(relative, result.error?.message || result.stderr);
    }
}
for (const entry of ['server.js', 'ecosystem.config.js', 'routes', 'utils', 'models', 'scripts', 'public', 'tests']) {
    check(entry);
}
console.log(`Checked ${checked} JavaScript files; ${failures} syntax errors.`);
process.exitCode = failures ? 1 : 0;
