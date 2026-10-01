# 025 — Contextual reserved words as generic-tag attribute names

Status: complete (independent implementation review accepted 2026-10-02).
Dependency:
[018 generic-tag identifier values](018-generic-tag-identifier-values.md) and
[023 generic-tag attribute names](023-smarty-tag-attribute-names.md).

## Motivation and fixed-corpus evidence

The current hash-matched application report `/tmp/smarty-current-baseline.json`
uses parser SHA-256
`c1cb194d78c7fb8bfe535e33e89c248ee84377a15d59fe0772c958fca0a9fb4a`, matching
`src/parser.c` at the baseline, and covers 467 files: 449 parse without errors
and 18 contain errors. Its `grammar.js` source SHA-256 is
`983d56e23047f03210c666b6dc523d3a00aaa67a2e9ba578e9a9220267888b03`.
Four failures first stop on standard recursive `include` tags that use the
attribute `parent`:

| Application path | Earliest error | Source SHA-256 |
| --- | --- | --- |
| `view_module/full_instructions_action_blocks.tpl` | line 28, column 9; error span begins at the recursive include | `a83f5b69dea61e01c74c46c03ca89ac1fb99b5cd63b0c7d7ac03d88774b50825` |
| `view_module/instruction_summary_action_block.tpl` | line 10, column 9; error span begins at the recursive include | `b05cae8e78e1399ba8e0d3d63518150798e502b63d43257db40e21bd18764acc` |
| `view_repair/action_blocks.tpl` | line 22, column 9; error span begins at the recursive include | `44b43e2a2f2362fe4e837e4ba2365a0c2e1d8fd24f67e5bd63bff2749ead8f53` |
| `view_repair/edit_repair.tpl` | line 333, column 9; error span begins at the recursive include | `f3664703ea324ae16206f873252ca32a727e41c76d5e6044c81938557a9c61c1` |

The source spellings include
`{include file="..." block=$subblock parent=$block}` and
`{include file="..." block=$root_block parent=$root_block}`. A diagnostic
in-memory substitution of only `parent=` to `parentx=` makes all four templates
parse without errors under the current parser. This indicates no other current
parse error is exposed in these four files by that substitution. It does not
promise that a grammar change will produce the same result or that clean parses
alone prove structural support; implementations must inspect the four resulting
trees and report their actual hash-matched before/after corpus evidence.

## Pinned Smarty 5.8.4 observations

The recording compiler accepts the following standard generic-tag attributes
and preserves their names and order:

```smarty
{widget parent=$parent self=$receiver if=$condition else=MODE elseif=$fallback foreach=$items foreachelse=$empty}{$later}
{include file="x.tpl" block=$block parent=$block self=$root_block}{$later}
{widget Parent=$parent SELF=$receiver}{$later}
```

All have `error: null`. The first reports `widget` attributes in source order
(`parent`, `self`, `if`, `else`, `elseif`, `foreach`, `foreachelse`) followed by
an independent output event. The include example reports `file`, `block`,
`parent`, and `self`, followed by output. The mixed-case example preserves
`Parent` and `SELF`. Case variants of `self` and `parent` are also accepted.
The adapter verifies syntax, event order, and argument names only; it does not
inspect attribute values or include inheritance/runtime semantics.

Tree-sitter currently rejects the exact lowercase `parent` and `self` attribute
names, and the exact lowercase control words `if`, `else`, `elseif`, `foreach`,
and `foreachelse`. Case variants of `parent` and `self` are rejected as well.
Uppercase/mixed-case control-word attribute spellings currently parse; retain
them as regression coverage while repairing the reserved lowercase spellings.
The primitive words `true`, `false`, and `null` already parse as attribute
names; keep their existing `identifier` tree shape.

This distinction follows the current grammar's reserved-word declarations: the
control words are reserved in the global/tag contexts, while `self` and
`parent` are reserved case-insensitively for class receivers. The task concerns
their valid use in the generic-tag attribute-name slot. It must preserve their
existing behavior as control tags and in the class-receiver context, where the
pinned compiler rejects `self::...` and `parent::...`.

## Scope and proposed tree

Allow the standard Smarty contextual words `parent`, `self`, `if`, `else`,
`elseif`, `foreach`, and `foreachelse` as static generic-tag attribute names.
Represent each as the existing `identifier` leaf in the `name` field of the
existing `attribute` node; preserve exact spelling and source range. This
applies to generic tags including the grammar's generic representation of
`include`; it does not add include-specific AST nodes or semantics. Existing
ordinary, primitive, hyphenated, digit-prefixed, and colon-containing
attribute-name contracts remain unchanged.

Before grammar changes, add this hand-authored expected tree to
`test/corpus/contextual-attribute-names.txt`:

```smarty
{widget parent=$parent self=$receiver if=$condition else=MODE elseif=$fallback foreach=$items foreachelse=$empty}{$later}
```

```text
(source_file
  (custom_tag name: (identifier)
    (attribute name: (identifier) value: (variable name: (identifier)))
    (attribute name: (identifier) value: (variable name: (identifier)))
    (attribute name: (identifier) value: (variable name: (identifier)))
    (attribute name: (identifier) value: (identifier))
    (attribute name: (identifier) value: (variable name: (identifier)))
    (attribute name: (identifier) value: (variable name: (identifier)))
    (attribute name: (identifier) value: (variable name: (identifier))))
  (output value: (variable name: (identifier))))
```

The corresponding Node reference check must assert all seven exact ordered
names and the following output event. Add a separate hand-authored composition
tree for the core `include` form:

```smarty
{include file="x.tpl" block=$block parent=$block self=$root_block}{$later}
```

```text
(source_file
  (custom_tag name: (identifier)
    (attribute name: (identifier) value: (string))
    (attribute name: (identifier) value: (variable name: (identifier)))
    (attribute name: (identifier) value: (variable name: (identifier)))
    (attribute name: (identifier) value: (variable name: (identifier))))
  (output value: (variable name: (identifier))))
```

Its reference projection must preserve the `include` tag, ordered names
`file`, `block`, `parent`, `self`, and independent output. Existing string and
variable value subtrees must remain visible. The recorder makes no claim about
the include's runtime behavior.

The initial Node check must fail against the current parser because the new
positive expected trees are not accepted as `custom_tag` plus `attribute`
nodes. Add explicit assertions that the new name leaves have type `identifier`,
belong to the corresponding `attribute.name` fields, preserve exact text/ranges,
and do not absorb the following output.

## Recovery, composition, and boundary checks

1. Keep normal attribute names as controls in the same/composed fixtures. Keep
   `true`, `false`, and `null` as existing primitive-name controls. Test a
   mixed-case `Parent`/`SELF` case through the parser and reference adapter;
   its `identifier` names must preserve case.
2. Preserve contextual use outside the attribute slot: valid `{if $condition}`
   remains an `if_tag`, `{/if}` remains its closer, and `{self::READY}` and
   `{parent::READY}` remain errors in both the Tree-sitter parser and pinned
   compiler. The allowed attribute spellings must not make control-word roots
   fall back to generic tags or weaken the class-receiver restriction.
3. Add this malformed attribute recovery case with a hand-authored expected
   tree:

   ```smarty
   {widget parent=} {*after*} {$later}
   ```

   ```text
   (source_file
     (custom_tag name: (identifier)
       (attribute name: (identifier) value: (MISSING identifier)))
     (text)
     (comment)
     (text)
     (output value: (variable name: (identifier))))
   ```

   Require the pinned compiler to reject the missing value, the parser to
   retain the missing value under `attribute.value`, and the following comment
   and output to stay separate and navigable.
4. Add incremental edit coverage that changes an ordinary attribute name
   `other` to `parent`, then to `self`, and restores it. Compare the complete
   incremental snapshot at each stage with a fresh parse. This crosses both
   reserved-word boundaries without weakening ordinary name handling.
5. Preserve exact attribute spelling. Do not normalize names to lowercase or
   split an attribute into a positional argument. Do not add broad text/error
   fallbacks that make the enclosing tag appear successful without its
   `attribute` and value structure.
6. Run the fixed application corpus with identical source hashes before and
   after the implementation. Inspect the full tree of every newly clean file,
   including all four listed paths if they become clean. Report actual gains,
   regressions, and the remaining failures; do not claim corpus gains from the
   in-memory name-substitution diagnostic.

## Boundaries and reference limitations

All standard Smarty syntax remains in the project target regardless of task
difficulty. No standard generic-tag attribute-name form is excluded by this
brief. Project-specific plugin behavior and arbitrary tag semantics remain
outside scope. In particular, the task does not execute plugins, resolve
attribute values, implement `include` runtime inheritance, or change class
constant/static-method support for `self` and `parent`.

The vendored Smarty 5.8.4 recorder is the reference for syntax acceptance and
ordered tag/attribute names. It cannot validate expression values, application
plugin behavior, include runtime behavior, or the Tree-sitter node shape. The
manually specified trees are the structural contract; the reference checks
corroborate only what the recorder exposes.

## Baseline evidence

- Report: `/tmp/smarty-current-baseline.json`; 467 application files, 449
  without errors and 18 with errors.
- `grammar.js` SHA-256:
  `983d56e23047f03210c666b6dc523d3a00aaa67a2e9ba578e9a9220267888b03`.
- Generated parser SHA-256:
  `c1cb194d78c7fb8bfe535e33e89c248ee84377a15d59fe0772c958fca0a9fb4a`.
- Smarty 5.8.4 reference source is vendored under
  `vendor/smarty/smarty/src/Parser/TemplateParser.y` and
  `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex`; the generic attribute
  productions accept `ATTR` plus `expr` or `value`.
- Reduced successful recordings and the four error locations are described
  above. Actual task implementation reports must retain new before/after
  reports outside `build/` and structural inspection evidence.

## Implementation evidence

The implementation reviewer independently reproduced the focused/full tests
and corpus hash/count comparison, inspected all four newly clean trees, and
accepted the task with no findings. `_attribute_name` now accepts the control words and every ASCII case
variant of `self` and `parent` as aliases of `identifier`; no global reserved
word sets or class-receiver rules changed. The three manually written trees
cover both positive compositions and malformed-value recovery. The Node check
compares recorder events and ordered names, asserts exact name-leaf types/text/
ranges, tests all case variants of `self` and `parent`, keeps `if` blocks
structured, rejects static `self`/`parent` receivers in both implementations,
and compares each incremental `other -> parent -> self -> other` edit with a
fresh parse.

- `node --test test/contextual-attribute-names.test.mjs`: passed; 2 positive
  fixtures and 80 ASCII case variants checked against the parser and recorder.
  The extra structural controls retain ordinary `class` and primitive `true`,
  `false`, and `null` names and their existing value-node types.
- `npx tree-sitter test`: passed all 224 hand-authored corpus trees.
- `npm test`: passed; TypeScript grammar check, 307 Node checks, and all 14
  deliberate mutation checks caught.
- `git diff --check`: passed.
- Before report: `/tmp/smarty-current-baseline.json`; after report:
  `/tmp/smarty-task025-after.json`. All 467 application template hashes match.
  Parse-clean templates increased from 449 to 453; failures decreased from 18
  to 14. No templates regressed. The generated parser hash changed from
  `c1cb194d78c7fb8bfe535e33e89c248ee84377a15d59fe0772c958fca0a9fb4a` to
  `524b26153e0e8fca972a053c61237d028c8a7b8d861b85ecf7aff3c836244aa1`.
- The four gains are `view_module/full_instructions_action_blocks.tpl`,
  `view_module/instruction_summary_action_block.tpl`,
  `view_repair/action_blocks.tpl`, and `view_repair/edit_repair.tpl`; their
  source hashes match the values in the baseline table above. Each complete
  tree was traversed and checked for errors and structure. All retain their
  nested if/foreach/output nodes; the recursive include remains a generic tag
  with separate ordered `file` string, `block` variable, and `parent` variable
  attributes. `edit_repair.tpl` also retains its 5,436-node full-file tree,
  including 61 if blocks, 4 foreach blocks, 316 outputs, and 21 generic tags.
  No further syntax gap was exposed by these newly clean trees.
- Remaining application-corpus failures: 14. They remain reported in
  `/tmp/smarty-task025-after.json` and are not attributed to this task.

Implementation owner did not mark the task complete or commit it; both remain
the orchestrator's post-review responsibilities.
