import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const js=fs.readFileSync('measurements.js','utf8');
const css=fs.readFileSync('measurements.css','utf8');
const bridge=fs.readFileSync('estimator-bridge.js','utf8');

assert.match(index,/measurements\.css/);
assert.match(index,/measurements\.js/);
assert.match(index,/estimator-bridge\.js/);
assert.match(sw,/estimator-bridge\.js/);
assert.match(bridge,/ESTIMATE_RESULT_JSON_START/);
assert.match(bridge,/priceStatus/);
assert.match(bridge,/measurementEstimateResult/);
assert.match(bridge,/function audit/);
assert.match(sw,/measurements\.css/);
assert.match(sw,/measurements\.js/);
assert.match(js,/id="measurementBack"/);
assert.match(js,/← Проекты/);
assert.match(js,/MEASUREMENTS_JSON_START/);
assert.match(js,/MEASUREMENTS_JSON_END/);
assert.match(js,/measurementEstimateDraft/);
assert.match(js,/Скопировать для сметчика/);
assert.match(js,/Импорт от сметчика/);
assert.match(js,/Передать в смету/);
assert.match(js,/window\.openMeasurementsWorkspace/);
assert.match(css,/\.measurement-workspace/);
assert.match(css,/\.measurement-back/);

console.log('Measurements smoke test passed');
