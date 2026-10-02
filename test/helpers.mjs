import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import Parser from 'tree-sitter';
import language from '../bindings/node/index.js';

export function parser() {
  return new Parser().setLanguage(language);
}

export function fixtures(filename = 'initial.txt') {
  const corpus = readFileSync(new URL(`./corpus/${filename}`, import.meta.url), 'utf8');
  return [...corpus.matchAll(/={10,}\n([^\n]+)\n={10,}\n([\s\S]*?)\n---\n/g)]
    .map(([, name, source]) => ({ name, source }));
}

export function reference(source) {
  return JSON.parse(execFileSync('php', [new URL('./reference.php', import.meta.url).pathname, JSON.stringify({ source })], {
    encoding: 'utf8', timeout: 10_000,
  }));
}

// Compare only information both implementations actually expose. Expression
// structure is checked separately by the manually authored corpus trees.
export function observations(node) {
  const events = node.namedChildren.flatMap(observations);
  const name = node.childForFieldName('name')?.text;
  switch (node.type) {
    case 'custom_tag':
      events.push({ kind: 'tag', name, arguments: node.namedChildren.slice(1).map(child => ({
        name: child.type === 'attribute' ? child.childForFieldName('name').text : null,
      })) });
      break;
    case 'custom_close_tag':
      events.push({ kind: 'tag', name: `${name}close`, arguments: [] });
      break;
    case 'if_tag': case 'elseif_tag': case 'else_tag': case 'if_close_tag':
      events.push({ kind: 'tag', name: {
        if_tag: 'if', elseif_tag: 'elseif', else_tag: 'else', if_close_tag: 'ifclose',
      }[node.type], arguments: [] });
      break;
    case 'foreach_tag':
      // Smarty emits physical trailing attributes/options before its normalized
      // modern from/item/key arguments. Trees retain the actual source order.
      {
        const legacyHeader = node.namedChildren.find(child => child.type === 'legacy_foreach_header');
        if (legacyHeader) {
          events.push({kind: 'tag', name: 'foreach', arguments: legacyHeader.namedChildren
            .sort((left,right) => left.startIndex-right.startIndex)
            .map(child => ({name: child.type === 'attribute' ? child.childForFieldName('name').text : null}))});
        } else if (node.childForFieldName('source')) {
          const trailing = node.namedChildren
            .filter(child => child.type === 'attribute' || child.type === 'foreach_option')
            .sort((left,right) => left.startIndex-right.startIndex)
            .map(child => ({name: child.type === 'attribute' ? child.childForFieldName('name').text : null}));
          events.push({ kind: 'tag', name: 'foreach', arguments: [
            ...trailing,
            { name: 'from' }, { name: 'item' },
            ...(node.childForFieldName('key') ? [{ name: 'key' }] : []),
          ] });
        } else {
          events.push({kind: 'tag', name: 'foreach', arguments: []});
        }
      }
      break;
    case 'foreachelse_tag': case 'foreach_close_tag':
      events.push({ kind: 'tag', name: node.type === 'foreachelse_tag' ? 'foreachelse' : 'foreachclose', arguments: [] });
      break;
    case 'for_tag': {
      const header = node.namedChildren.find(child => child.type === 'range_for_header' || child.type === 'c_style_for_header');
      const attributes = [
        ...header.namedChildren.filter(child => child.type === 'attribute' || child.type === 'for_option'),
        ...header.childrenForFieldName('argument'),
        ...(header.childForFieldName('max') ? [header.childForFieldName('max')] : []),
      ].sort((left, right) => left.startIndex - right.startIndex)
        .map(child => ({name: child.type === 'attribute' ? child.childForFieldName('name').text : child.type === 'for_option' || child.type === 'identifier' ? null : 'max'}));
      const arguments_ = header.type === 'range_for_header'
        ? [...attributes, {name: 'start'}, {name: 'to'}, ...(header.childForFieldName('step') ? [{name: 'step'}] : [])]
        : [...attributes, {name: 'start'}, {name: 'ifexp'}, {name: 'var'}, {name: 'step'}];
      events.push({kind: 'tag', name: 'for', arguments: arguments_});
      break;
    }
    case 'forelse_tag': case 'for_close_tag':
      events.push({kind: 'tag', name: node.type === 'forelse_tag' ? 'forelse' : 'forclose', arguments: []});
      break;
    case 'section_tag': {
      const header = node.namedChildren.find(child => child.type === 'section_header');
      const arguments_ = header.namedChildren
        .filter(child => child.type === 'attribute' || child.type === 'section_option' || child.type === 'section_header_name' || child.type === 'section_header_loop')
        .sort((left, right) => left.startIndex - right.startIndex)
        .map(child => ({name: child.type === 'attribute' ? child.childForFieldName('name').text : child.type === 'section_header_name' && child.text.startsWith('name=') ? 'name' : child.type === 'section_header_loop' && child.text.startsWith('loop=') ? 'loop' : null}));
      events.push({kind: 'tag', name: 'section', arguments: arguments_});
      break;
    }
    case 'sectionelse_tag': case 'section_close_tag':
      events.push({kind: 'tag', name: node.type === 'sectionelse_tag' ? 'sectionelse' : 'sectionclose', arguments: []});
      break;
    case 'modifier_expression':
      events.push({ kind: 'modifier', name, arguments: node.childrenForFieldName('argument').length });
      break;
    case 'function_call_expression':
      // Smarty compiles function values through its modifier-in-expression path;
      // Smarty routes the first function argument as the value and exposes only
      // the remaining arguments as modifier parameters in this projection.
      events.push({ kind: 'modifier', name, arguments: Math.max(node.childrenForFieldName('argument').length - 1, 0) });
      break;
    case 'output':
      events.push({ kind: 'output' });
      break;
  }
  return events;
}

// Include anonymous punctuation, fields, positions, and recovery state. Tree
// identity and hasChanges intentionally differ after an incremental edit.
export function snapshot(node) {
  return {
    type: node.type, named: node.isNamed, missing: node.isMissing, error: node.hasError,
    start: node.startIndex, end: node.endIndex,
    startPosition: node.startPosition, endPosition: node.endPosition,
    children: node.children.map((child, index) => [node.fieldNameForChild(index), snapshot(child)]),
  };
}

// Full compiler/rendering is reserved for fixed controlled fixtures, never the
// application corpus. Nonzero process exits remain harness failures.
export function fullEngine(source, {mode = 'render', values = {}, objects = {}} = {}) {
  return JSON.parse(execFileSync('php', [new URL('./full-engine.php', import.meta.url).pathname,
    JSON.stringify({source, mode, values, objects})], {encoding: 'utf8', timeout: 10_000}));
}
