import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const sw=fs.readFileSync('sw.js','utf8');
const app19=fs.readFileSync('app19.js','utf8');

assert.match(index,/rel="manifest" href="manifest\.webmanifest"/);
assert.match(index,/app19\.js/);
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'./');
assert.equal(manifest.scope,'./');
assert.ok(Array.isArray(manifest.icons)&&manifest.icons.length>0);
assert.match(sw,/repair-project-hub-v1/);
assert.match(sw,/app17\.js/);
assert.match(sw,/app18\.js/);
assert.match(sw,/app19\.js/);
assert.match(sw,/mode==='navigate'/);
assert.match(sw,/caches\.match\('\.\/index\.html'\)/);
assert.match(app19,/serviceWorker\.register\('\.\/sw\.js'/);
assert.match(app19,/Офлайн · данные сохраняются на устройстве/);
assert.match(app19,/Онлайн · офлайн-копия готова/);

console.log('Offline smoke test passed');
