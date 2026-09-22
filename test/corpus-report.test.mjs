import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspect } from '../scripts/corpus-report.mjs';

test('Corpus triage reports a missing closing tag and preserves original coordinates', () => {
  const source = 'é😀\r\n{if $x}hello';
  const result = inspect(source);
  assert.equal(result.clean, false);
  assert.ok(result.errors.length > 0);
  for (const error of result.errors) {
    const prefix = source.slice(0, error.startIndex).split('\n');
    assert.equal(error.line, prefix.length);
    assert.equal(error.column, prefix.at(-1).length + 1);
  }
});

test('Corpus hints do not pretend to diagnose syntax or certify coverage', () => {
  const result = inspect('{widget label="->"}');
  assert.equal(result.clean, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.hints.includes('object_members'));
});
