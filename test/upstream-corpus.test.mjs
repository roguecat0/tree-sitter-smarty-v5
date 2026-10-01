import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { materializeManifest, membershipDigest, PINNED_COMMIT } from '../scripts/materialize-upstream-corpus.mjs';
import { listTemplates } from '../scripts/corpus-report.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const families = ['comments', 'strings_values', 'assignment_output', 'conditionals', 'loops', 'literal_whitespace', 'section', 'capture', 'include', 'inheritance'];

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function blobId(name) {
  return createHash('sha1').update(name).digest('hex');
}

function fixtureManifest(sourceRoot) {
  const entries = Array.from({ length: 32 }, (_, index) => {
    const family = families[index % families.length];
    const sourcePath = `tests/UnitTests/TemplateSource/${family}/templates/case-${index}.tpl`;
    const testPath = `tests/UnitTests/TemplateSource/${family}/Test.php`;
    const bytes = Buffer.from(`family ${family} fixture ${index}\n`);
    mkdirSync(path.dirname(path.join(sourceRoot, sourcePath)), { recursive: true });
    writeFileSync(path.join(sourceRoot, sourcePath), bytes);
    const testBytes = Buffer.from(`<?php // positive test for ${family}\n`);
    mkdirSync(path.dirname(path.join(sourceRoot, testPath)), { recursive: true });
    writeFileSync(path.join(sourceRoot, testPath), testBytes);
    return {
      kind: 'positive_fixture',
      repository: 'https://github.com/smarty-php/smarty',
      tag: 'v5.8.4',
      commit: PINNED_COMMIT,
      family,
      source_path: sourcePath,
      destination: `TemplateSource/${family}/case-${index}.tpl`,
      git_blob: blobId(sourcePath),
      sha256: digest(bytes),
      rationale: `synthetic fixture ${index}`,
      provenance: {
        test_source_path: testPath,
        test_source_git_blob: blobId(testPath),
        test_source_sha256: digest(testBytes),
        test_method: `testCase${index}`,
      },
      exclusion_flags: ['test_values_not_parser_evidence'],
    };
  });
  const demo = Buffer.from('demo example\n');
  const demoPath = 'demo/templates/index.tpl';
  mkdirSync(path.dirname(path.join(sourceRoot, demoPath)), { recursive: true });
  writeFileSync(path.join(sourceRoot, demoPath), demo);
  const demoScript = Buffer.from('<?php // demo setup\n');
  mkdirSync(path.dirname(path.join(sourceRoot, 'demo/index.php')), { recursive: true });
  writeFileSync(path.join(sourceRoot, 'demo/index.php'), demoScript);
  const license = Buffer.from('LGPL-3.0-or-later\n');
  writeFileSync(path.join(sourceRoot, 'LICENSE'), license);
  entries.push({
    kind: 'example',
    repository: 'https://github.com/smarty-php/smarty',
    tag: 'v5.8.4',
    commit: PINNED_COMMIT,
    family: 'demo',
    source_path: demoPath,
    destination: demoPath,
    git_blob: blobId(demoPath),
    sha256: digest(demo),
    rationale: 'separately reported syntax example',
    provenance: {
      demo_script_source_path: 'demo/index.php',
      demo_script_git_blob: blobId('demo/index.php'),
      demo_script_sha256: digest(demoScript),
    },
    exclusion_flags: ['no_positive_phpunit_claim'],
  });
  const manifest = {
    schema_version: 1,
    upstream: {
      repository: 'https://github.com/smarty-php/smarty',
      tag: 'v5.8.4',
      commit: PINNED_COMMIT,
      license: 'LGPL-3.0-or-later',
      license_source_path: 'LICENSE',
      license_git_blob: blobId('LICENSE'),
      license_sha256: digest(license),
    },
    entries,
  };
  manifest.membership_sha256 = membershipDigest(entries);
  return manifest;
}

function testGitBlob(manifest) {
  const ids = new Map([[manifest.upstream.license_source_path, manifest.upstream.license_git_blob]]);
  for (const entry of manifest.entries) {
    ids.set(entry.source_path, entry.git_blob);
    if (entry.kind === 'positive_fixture') ids.set(entry.provenance.test_source_path, entry.provenance.test_source_git_blob);
    else ids.set(entry.provenance.demo_script_source_path, entry.provenance.demo_script_git_blob);
  }
  return (_checkout, _commit, relativePath) => ids.get(relativePath);
}

function withTemp(t, callback) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'smarty-upstream-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return callback(dir);
}

test('materializes exactly the validated pinned manifest entries into separate roots', t => withTemp(t, temp => {
  const checkout = path.join(temp, 'checkout');
  const output = path.join(temp, 'corpus');
  mkdirSync(checkout);
  const manifest = fixtureManifest(checkout);
  const result = materializeManifest({ manifest, sourceCheckout: checkout, outputBase: output,
    getCommit: () => PINNED_COMMIT, getBlob: testGitBlob(manifest) });

  assert.equal(result.positiveCount, 32);
  assert.equal(result.exampleCount, 1);
  assert.equal(readdirSync(path.join(output, 'upstream-smarty-v5.8.4-core'), { recursive: true }).filter(name => name.endsWith('.tpl')).length, 32);
  assert.equal(readdirSync(path.join(output, 'upstream-smarty-v5.8.4-example'), { recursive: true }).filter(name => name.endsWith('.tpl')).length, 1);
  for (const entry of manifest.entries) {
    const base = entry.kind === 'example' ? 'upstream-smarty-v5.8.4-example' : 'upstream-smarty-v5.8.4-core';
    const materialized = readFileSync(path.join(output, base, entry.destination));
    assert.equal(digest(materialized), entry.sha256, entry.destination);
    assert.deepEqual(materialized, readFileSync(path.join(checkout, entry.source_path)));
  }
}));

test('rejects bad commits, changed or missing sources, duplicate and escaping destinations without partial output', t => withTemp(t, temp => {
  const checkout = path.join(temp, 'checkout');
  const output = path.join(temp, 'corpus');
  mkdirSync(checkout);
  const manifest = fixtureManifest(checkout);
  const run = (candidate, getCommit = () => PINNED_COMMIT) => materializeManifest({ manifest: candidate,
    sourceCheckout: checkout, outputBase: output, getCommit, getBlob: testGitBlob(candidate) });
  const assertNoPartial = () => assert.equal(existsSync(output), false);

  assert.throws(() => run(manifest, () => 'wrong-commit'), /commit/i);
  assertNoPartial();
  const editedPath = path.join(checkout, manifest.entries[0].source_path);
  const original = readFileSync(editedPath);
  writeFileSync(editedPath, 'changed source');
  assert.throws(() => run(manifest), /hash|checksum|sha/i);
  assertNoPartial();
  writeFileSync(editedPath, original);
  const missing = structuredClone(manifest);
  rmSync(path.join(checkout, missing.entries[1].source_path));
  assert.throws(() => run(missing), /missing|read/i);
  assertNoPartial();
  const duplicate = structuredClone(manifest);
  duplicate.entries[1].destination = duplicate.entries[0].destination;
  duplicate.membership_sha256 = membershipDigest(duplicate.entries);
  assert.throws(() => run(duplicate), /duplicate/i);
  assertNoPartial();
  const escaping = structuredClone(manifest);
  escaping.entries[0].destination = '../outside.tpl';
  escaping.membership_sha256 = membershipDigest(escaping.entries);
  assert.throws(() => run(escaping), /path|travers|destination/i);
  assertNoPartial();
}));

test('rejects incomplete manifests and repeats with stable destination paths and hashes', t => withTemp(t, temp => {
  const checkout = path.join(temp, 'checkout');
  mkdirSync(checkout);
  const manifest = fixtureManifest(checkout);
  const incomplete = structuredClone(manifest);
  incomplete.entries = incomplete.entries.filter(entry => entry.kind !== 'example');
  assert.throws(() => materializeManifest({ manifest: incomplete, sourceCheckout: checkout,
    outputBase: path.join(temp, 'bad'), getCommit: () => PINNED_COMMIT, getBlob: testGitBlob(incomplete) }), /membership|example|incomplete|manifest/i);

  const output = path.join(temp, 'repeat');
  const snapshots = [];
  for (let run = 0; run < 2; run++) {
    const result = materializeManifest({ manifest, sourceCheckout: checkout, outputBase: output,
      getCommit: () => PINNED_COMMIT, getBlob: testGitBlob(manifest) });
    snapshots.push(result.files);
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
}));

test('corpus reporter accepts an explicit auxiliary path without rewriting source corpora', t => withTemp(t, temp => {
  const application = path.join(temp, 'corpus');
  const appFiles = path.join(application, 'application');
  const auxiliary = path.join(application, 'upstream-smarty-v5.8.4-core');
  mkdirSync(appFiles, { recursive: true });
  mkdirSync(auxiliary);
  writeFileSync(path.join(appFiles, 'app.tpl'), 'app');
  writeFileSync(path.join(auxiliary, 'source.tpl'), 'source');
  const appPathsBefore = listTemplates(application).map(file => path.relative(application, file));
  assert.deepEqual(appPathsBefore, ['application/app.tpl']);
  const before = [readFileSync(path.join(appFiles, 'app.tpl')), readFileSync(path.join(auxiliary, 'source.tpl'))].map(digest);
  const report = path.join(temp, 'upstream-report.json');
  execFileSync(process.execPath, ['scripts/corpus-report.mjs', auxiliary, report], { cwd: root, stdio: 'pipe' });
  const parsed = JSON.parse(readFileSync(report, 'utf8'));
  assert.equal(parsed.total, 1);
  assert.deepEqual(parsed.files.map(file => file.path), ['source.tpl']);
  const after = [readFileSync(path.join(appFiles, 'app.tpl')), readFileSync(path.join(auxiliary, 'source.tpl'))].map(digest);
  assert.deepEqual(after, before);
  assert.deepEqual(listTemplates(application).map(file => path.relative(application, file)), appPathsBefore);
}));
