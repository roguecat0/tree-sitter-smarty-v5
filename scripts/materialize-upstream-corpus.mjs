import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PINNED_REPOSITORY = 'https://github.com/smarty-php/smarty';
export const PINNED_TAG = 'v5.8.4';
export const PINNED_COMMIT = '94a27cbbc7820198d7adc17a2be8d457fb267753';
export const CORE_DESTINATION = 'upstream-smarty-v5.8.4-core';
export const EXAMPLE_DESTINATION = 'upstream-smarty-v5.8.4-example';
export const MANIFEST_PATH = 'test/upstream-smarty-v5.8.4/manifest.json';

const root = fileURLToPath(new URL('..', import.meta.url));
const requiredFamilies = ['comments', 'strings_values', 'assignment_output', 'conditionals', 'loops', 'literal_whitespace'];
const groupedCoreFamilies = ['include', 'inheritance', 'capture', 'section'];
const knownFamilies = new Set([...requiredFamilies, ...groupedCoreFamilies, 'template_functions']);
const demoSource = 'demo/templates/index.tpl';
const demoScript = 'demo/index.php';
const licensePath = 'LICENSE';
const task016Composition = '{foreach $items as $item}{$item|default:$item@index}{/foreach}';

function fail(message) {
  throw new Error(`Upstream corpus materialization failed: ${message}`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function membershipDigest(entries) {
  return sha256(entries.map(entry => JSON.stringify([entry.kind, entry.source_path, entry.destination, entry.git_blob, entry.sha256]))
    .sort((a, b) => a.localeCompare(b, 'en')).join('\n') + '\n');
}

function validHex(value, length) {
  return typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
}

function safeRelativePath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\') || value.includes('\0') || path.posix.isAbsolute(value)) {
    fail(`${label} must be a non-empty relative POSIX path`);
  }
  const parts = value.split('/');
  if (parts.some(part => part === '' || part === '.' || part === '..') || path.posix.normalize(value) !== value) {
    fail(`${label} contains traversal or non-canonical path components: ${value}`);
  }
  return value;
}

function sourceBytes(checkout, relativePath) {
  const safePath = safeRelativePath(relativePath, 'source path');
  const absolute = path.resolve(checkout, ...safePath.split('/'));
  const relative = path.relative(checkout, absolute);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) fail(`source path escapes checkout: ${safePath}`);
  let cursor = checkout;
  for (const part of safePath.split('/')) {
    cursor = path.join(cursor, part);
    let stat;
    try { stat = lstatSync(cursor); } catch { fail(`missing source file: ${safePath}`); }
    if (stat.isSymbolicLink()) fail(`source path contains a symlink: ${safePath}`);
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile()) fail(`source path is not a regular file: ${safePath}`);
  return readFileSync(absolute);
}

function gitHead(checkout) {
  try { return execFileSync('git', ['-C', checkout, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { fail(`source checkout is not a readable Git checkout: ${checkout}`); }
}

function gitBlob(checkout, commit, relativePath) {
  try { return execFileSync('git', ['-C', checkout, 'rev-parse', '--verify', `${commit}:${relativePath}`], { encoding: 'utf8' }).trim(); }
  catch { fail(`source path is not present at the pinned commit: ${relativePath}`); }
}

function validateBlobAndHash(entry, checkout, getBlob, label) {
  const relativePath = safeRelativePath(entry.source_path, `${label} source path`);
  if (!validHex(entry.git_blob, 40) || !validHex(entry.sha256, 64)) fail(`${label} is missing a valid Git blob id or SHA-256`);
  const actualBlob = getBlob(checkout, PINNED_COMMIT, relativePath);
  if (actualBlob !== entry.git_blob) fail(`${label} Git blob mismatch: ${relativePath}`);
  const bytes = sourceBytes(checkout, relativePath);
  if (sha256(bytes) !== entry.sha256) fail(`${label} SHA-256 mismatch: ${relativePath}`);
  return { bytes, relativePath };
}

function validateManifest(manifest, checkout, getCommit, getBlob) {
  if (!manifest || manifest.schema_version !== 1 || !Array.isArray(manifest.entries)) fail('manifest is missing or has an unsupported schema');
  if (!validHex(manifest.membership_sha256, 64) || membershipDigest(manifest.entries) !== manifest.membership_sha256) fail('manifest membership digest mismatch; the entry set is incomplete or altered');
  const upstream = manifest.upstream;
  if (!upstream || upstream.repository !== PINNED_REPOSITORY || upstream.tag !== PINNED_TAG || upstream.commit !== PINNED_COMMIT || upstream.license !== 'LGPL-3.0-or-later') {
    fail('manifest upstream identity or license does not match the pinned source');
  }
  if (getCommit(checkout) !== PINNED_COMMIT) fail(`source checkout commit must be ${PINNED_COMMIT}`);
  if (!validHex(upstream.license_git_blob, 40) || !validHex(upstream.license_sha256, 64) || upstream.license_source_path !== licensePath) fail('manifest license provenance is incomplete');
  const licenseBytes = sourceBytes(checkout, licensePath);
  if (getBlob(checkout, PINNED_COMMIT, licensePath) !== upstream.license_git_blob || sha256(licenseBytes) !== upstream.license_sha256) fail('pinned Smarty license source hash mismatch');

  const positives = manifest.entries.filter(entry => entry?.kind === 'positive_fixture');
  const examples = manifest.entries.filter(entry => entry?.kind === 'example');
  if (manifest.entries.length !== positives.length + examples.length || positives.length < 30 || positives.length > 50 || examples.length !== 1) {
    fail('manifest must contain 30–50 positive fixtures and exactly one separate example');
  }
  if (new Set(positives.map(entry => entry.source_path)).size < 24) fail('manifest must reference at least 24 distinct positive source files');
  const familySet = new Set(positives.map(entry => entry.family));
  if (familySet.size < 8 || requiredFamilies.some(family => !familySet.has(family)) || !groupedCoreFamilies.some(family => familySet.has(family))) {
    fail('manifest lacks the required core-family coverage');
  }

  const destinations = new Set();
  const sourcePaths = new Set();
  const validated = [];
  for (const entry of manifest.entries) {
    if (entry.repository !== PINNED_REPOSITORY || entry.tag !== PINNED_TAG || entry.commit !== PINNED_COMMIT) fail('entry has a mismatched upstream identity');
    const destination = safeRelativePath(entry.destination, 'destination');
    const fullDestination = `${entry.kind === 'example' ? EXAMPLE_DESTINATION : CORE_DESTINATION}/${destination}`;
    if (destinations.has(fullDestination)) fail(`duplicate destination name: ${fullDestination}`);
    destinations.add(fullDestination);
    if (sourcePaths.has(entry.source_path)) fail(`duplicate source path: ${entry.source_path}`);
    sourcePaths.add(entry.source_path);
    if (!knownFamilies.has(entry.family) && entry.kind !== 'example') fail(`unknown core syntax family: ${entry.family}`);
    if (typeof entry.rationale !== 'string' || !entry.rationale.trim() || !Array.isArray(entry.exclusion_flags)) fail(`entry metadata is incomplete: ${entry.source_path}`);
    if (entry.kind === 'positive_fixture') {
      if (!entry.source_path.startsWith('tests/UnitTests/TemplateSource/') || !entry.source_path.endsWith('.tpl') || entry.source_path.includes('/X_Scopes/')) fail(`positive entry is not an allowed core template: ${entry.source_path}`);
      const provenance = entry.provenance;
      if (!provenance || !provenance.test_source_path?.startsWith('tests/UnitTests/TemplateSource/') || !provenance.test_source_path.endsWith('.php') || !/^test[A-Za-z0-9_]+$/.test(provenance.test_method ?? '')) fail(`positive test provenance is incomplete: ${entry.source_path}`);
      const testSource = { source_path: provenance.test_source_path, git_blob: provenance.test_source_git_blob, sha256: provenance.test_source_sha256 };
      validateBlobAndHash(testSource, checkout, getBlob, `test provenance for ${entry.source_path}`);
      if ((provenance.data_provider === undefined) !== (provenance.provider_case_ids === undefined) || (provenance.provider_case_ids !== undefined && (!Array.isArray(provenance.provider_case_ids) || provenance.provider_case_ids.length === 0))) fail(`data-provider provenance is incomplete: ${entry.source_path}`);
      if (entry.source_path.includes('/Plugin') || entry.source_path.includes('/CompilerPlugin/')) fail(`plugin behavior is excluded from core fixtures: ${entry.source_path}`);
    } else {
      if (entry.source_path !== demoSource || entry.destination !== demoSource || entry.family !== 'demo') fail('the example must be the separate pinned demo template');
      const provenance = entry.provenance;
      if (!provenance || provenance.demo_script_source_path !== demoScript || !validHex(provenance.demo_script_git_blob, 40) || !validHex(provenance.demo_script_sha256, 64)) fail('demo script provenance is incomplete');
      validateBlobAndHash({ source_path: provenance.demo_script_source_path, git_blob: provenance.demo_script_git_blob, sha256: provenance.demo_script_sha256 }, checkout, getBlob, 'demo script provenance');
      if (!Array.isArray(entry.exclusion_flags) || !entry.exclusion_flags.includes('no_positive_phpunit_claim')) fail('demo example must be explicitly marked as syntax-only');
    }
    const source = validateBlobAndHash(entry, checkout, getBlob, entry.kind);
    if (source.bytes.includes(Buffer.from(task016Composition))) fail('Task 016 composition must not appear as upstream evidence');
    validated.push({ entry, bytes: source.bytes, destination: fullDestination, sha256: sha256(source.bytes) });
  }
  return validated.sort((a, b) => a.destination.localeCompare(b.destination, 'en'));
}

function copyStaged(outputBase, validated) {
  mkdirSync(outputBase, { recursive: true });
  const stage = mkdtempSync(path.join(outputBase, '.smarty-upstream-stage-'));
  const roots = [CORE_DESTINATION, EXAMPLE_DESTINATION];
  const backups = new Map();
  const installed = [];
  try {
    for (const name of roots) mkdirSync(path.join(stage, name), { recursive: true });
    for (const { bytes, destination } of validated) {
      const absolute = path.join(stage, ...destination.split('/'));
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, bytes, { flag: 'wx' });
    }
    for (const name of roots) {
      const target = path.join(outputBase, name);
      try {
        const stat = lstatSync(target);
        if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`output root is not a regular directory: ${target}`);
        const backup = path.join(stage, `.backup-${name}-${randomBytes(5).toString('hex')}`);
        renameSync(target, backup);
        backups.set(name, backup);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    for (const name of roots) {
      renameSync(path.join(stage, name), path.join(outputBase, name));
      installed.push(name);
    }
  } catch (error) {
    for (const name of installed.reverse()) rmSync(path.join(outputBase, name), { recursive: true, force: true });
    for (const [name, backup] of backups) {
      try { renameSync(backup, path.join(outputBase, name)); } catch { /* preserve the original failure; rollback is best effort */ }
    }
    throw error;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

export function materializeManifest({ manifest, sourceCheckout, outputBase = path.join(root, 'corpus'), getCommit = gitHead, getBlob = gitBlob }) {
  const checkout = path.resolve(sourceCheckout ?? '');
  if (!sourceCheckout) fail('a caller-supplied local source checkout path is required');
  if (getCommit(checkout) !== PINNED_COMMIT) fail(`source checkout commit must be ${PINNED_COMMIT}`);
  const validated = validateManifest(manifest, checkout, getCommit, getBlob);
  copyStaged(path.resolve(outputBase), validated);
  const files = validated.map(({ entry, destination, sha256: hash }) => ({ kind: entry.kind, destination, sha256: hash }));
  return {
    positiveCount: files.filter(file => file.kind === 'positive_fixture').length,
    exampleCount: files.filter(file => file.kind === 'example').length,
    files,
  };
}

function main() {
  const checkout = process.argv[2];
  if (!checkout) fail(`usage: node scripts/materialize-upstream-corpus.mjs <pinned-smarty-checkout> [output-base] [manifest-path]`);
  const manifestPath = path.resolve(process.argv[4] ?? path.join(root, MANIFEST_PATH));
  const outputBase = path.resolve(process.argv[3] ?? path.join(root, 'corpus'));
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch { fail(`cannot read JSON manifest: ${manifestPath}`); }
  const result = materializeManifest({ manifest, sourceCheckout: checkout, outputBase });
  console.log(`Materialized ${result.positiveCount} positive fixtures under ${path.join(outputBase, CORE_DESTINATION)}`);
  console.log(`Materialized ${result.exampleCount} separate example under ${path.join(outputBase, EXAMPLE_DESTINATION)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
