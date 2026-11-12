import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseConfig } from '../src/config.ts';
import * as api from '../src/index.ts';

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(path.join(fixtureDir, name), 'utf8');

function rejects(text: string, pattern: RegExp) {
  assert.throws(() => parseConfig(text), (error: unknown) => {
    assert.ok(error instanceof RangeError, `expected RangeError, got ${String(error)}`);
    assert.match(error.message, pattern);
    return true;
  });
}

// tickets/T-008-config-ignore-patterns.md
describe('parseConfig', () => {
  test('criterion 1: a valid file gives the patterns as written; exported from index', () => {
    assert.deepEqual(parseConfig('{ "ignore": ["^chore\\\\(deps\\\\)", "^docs: typo"] }'), {
      ignore: ['^chore\\(deps\\)', '^docs: typo'],
    });
    assert.equal(api.parseConfig, parseConfig);
    assert.deepEqual(parseConfig(fixture('config-ignore-docs.json')), { ignore: ['^docs'] });
  });

  test('criterion 1: {} and an empty ignore list mean no patterns', () => {
    assert.deepEqual(parseConfig('{}'), { ignore: [] });
    assert.deepEqual(parseConfig('{"ignore": []}'), { ignore: [] });
  });

  test('criterion 1: text that is not JSON is rejected', () => {
    rejects('', /^invalid config: not valid JSON/);
    rejects('{ignore: []}', /^invalid config: not valid JSON/);
    rejects('{"ignore": ["a"],}', /^invalid config: not valid JSON/);
  });

  test('criterion 1: a top level that is not an object is rejected', () => {
    for (const text of ['[]', '["^docs"]', 'null', '"^docs"', '3', 'true']) {
      rejects(text, /^invalid config: the top level must be a JSON object$/);
    }
  });

  test('criterion 1: an unknown key is rejected and named', () => {
    rejects('{"ignore": [], "sections": {}}', /unknown key "sections"/);
    rejects('{"Ignore": []}', /unknown key "Ignore"/);
    rejects('{" ignore": []}', /unknown key " ignore"/);
    rejects('{"__proto__": []}', /unknown key "__proto__"/);
  });

  test('criterion 1: ignore that is not an array is rejected', () => {
    for (const text of ['{"ignore": "^docs"}', '{"ignore": null}', '{"ignore": {"0": "a"}}', '{"ignore": 1}']) {
      rejects(text, /^invalid config: "ignore" must be an array of strings$/);
    }
  });

  test('criterion 1: an element that is not a string is rejected with its index', () => {
    rejects('{"ignore": ["^a", 7]}', /ignore\[1\] must be a string/);
    rejects('{"ignore": [null]}', /ignore\[0\] must be a string/);
    rejects('{"ignore": ["^a", "^b", ["^c"]]}', /ignore\[2\] must be a string/);
  });

  test('criterion 1: an empty pattern is rejected with its index', () => {
    rejects('{"ignore": ["^a", ""]}', /ignore\[1\] is an empty pattern/);
  });

  test('criterion 1: an invalid regular expression is rejected with index and pattern', () => {
    rejects('{"ignore": ["^ok", "(unclosed"]}', /ignore\[1\] is not a valid regular expression: "\(unclosed"/);
    // Valid without the u flag, invalid with it: the flag is part of the contract.
    rejects('{"ignore": ["\\\\-"]}', /ignore\[0\] is not a valid regular expression/);
  });

  test('criterion 2: patterns are not trimmed, lower-cased or repaired', () => {
    assert.deepEqual(parseConfig('{"ignore": [" ^chore ", "^DOCS", "\\t"]}'), {
      ignore: [' ^chore ', '^DOCS', '\t'],
    });
    // A pattern of spaces is a real pattern, not an empty one.
    assert.deepEqual(parseConfig('{"ignore": ["  "]}'), { ignore: ['  '] });
  });

  test('criterion 2: one leading byte order mark is allowed framing', () => {
    const text = fixture('config-bom.json');
    assert.equal(text.charCodeAt(0), 0xfeff, 'the fixture must start with a BOM');
    assert.deepEqual(parseConfig(text), { ignore: [' ^docs'] });
    rejects('\uFEFF\uFEFF{}', /^invalid config: not valid JSON/);
  });
});
