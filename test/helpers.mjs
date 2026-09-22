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
    case 'modifier_expression':
      events.push({ kind: 'modifier', name, arguments: node.childrenForFieldName('argument').length });
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
