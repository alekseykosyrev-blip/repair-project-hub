import fs from 'node:fs';
import assert from 'node:assert/strict';
const final=fs.readFileSync('app23.js','utf8');
const history=fs.readFileSync('app24.js','utf8');
assert.match(final,/act\.status!=='signed'&&act\.locked!==true/, 'Closing an estimate must not rewrite a signed act');
assert.match(history,/const beforeIds=new Set\(p\.acts\.map\(a=>a\.id\)\)/, 'Capture existing acts before saving');
assert.match(history,/p\.acts\.find\(a=>!beforeIds\.has\(a\.id\)\)/, 'Only log newly created acts');
assert.match(history,/JSON\.stringify\(before\)!==JSON\.stringify\(newest\)/, 'Only log actual changes');
console.log('Finance history safety smoke passed');
