# 026 — Standard `{for}` loops

Status: complete (independent implementation review accepted 2026-10-02).
The brief was accepted by independent creation review on 2026-10-02.
Dependencies: existing expression support and block
recovery contracts in [005](005-condition-operators.md),
[006](006-foreach-blocks.md), [010](010-array-literals.md),
[011](011-standalone-function-calls.md), [013](013-divisibility-predicate.md),
[021](021-bitwise-and.md), and [022](022-static-identifier-expressions.md).
These are syntax dependencies, not scope limits: implement any additional
standard expression family as its own task when it blocks a loop operand.

## Motivation and corpus evidence

The fixed report `/tmp/smarty-task025-after.json` matches the post-Task-025
parser hash `524b26153e0e8fca972a053c61237d028c8a7b8d861b85ecf7aff3c836244aa1`
and all 467 application-template hashes. It measures 453 clean files and 14
failing files. Three reported error locations are standard `{for}` openings:

| Application path | Error location and minimized header | Source SHA-256 |
| --- | --- | --- |
| `action_types/action_value_dropdown_table.tpl` | line 13, column 17: `{for $i=0 to $value_type->get_measurement_count($name)-1}` | `d6a74ccb0fa0fb20b31d2e704c48992dcda40b6956c508d60c70f45b1a43bf5f` |
| `action_types/action_value_dropdown_table.tpl` | line 68, column 9: same range form | `d6a74ccb0fa0fb20b31d2e704c48992dcda40b6956c508d60c70f45b1a43bf5f` |
| `view_module/view_module.tpl` | line 36, column 33: `{for $i=1 to $experience->get_experience_level()}` | `1a211c510bf8c8ee2c3df7699ccd23100ea461cb0674f4666f920a1a6dcad55c` |

The two range headers reduce to `{for $i=0 to $end}{$i}{/for}`. Smarty 5.8.4
accepts both reduced forms through `test/reference.php`; the current Tree-sitter
grammar reports an error at each opening. The full local compiler accepts the
same forms. These three locations are direct evidence, not a promise that this
task will clean exactly three whole files.

## Pinned Smarty 5.8.4 behavior

`vendor/smarty/smarty/src/Parser/TemplateParser.y` defines two distinct
`{for}` header syntaxes:

1. Range form `{for $i=$start to $end}` with optional `step $step`, followed by
   supported trailing attributes. `max=...` is a documented range attribute;
   `nocache` is a documented option flag.
2. C-style form `{for $i=$start; $condition; $i++}`. The parser also accepts a
   comma-separated list of initializer assignments, a full condition
   expression, and one update action of `$i=$expr`, `$i++`, or `$i--`.

Both forms use `{forelse}...{/for}`. Smarty's official
`vendor/smarty/smarty/docs/designers/language-builtin-functions/language-function-for.md`
documents range, range+step, `max`, `nocache`, and the empty-loop `{forelse}`
branch. The pinned parser/compiler additionally accepts C-style headers; the
full compiler successfully compiles representative assignment, increment, and
decrement updates, so this confirmed syntax is included rather than deferred.
`ForElse.php` and `ForClose.php` implement the branch and closing behavior.
Range and C-style initializers use the parser's `statement` production, whose
assignment forms admit `varindexed` targets; C-style updates use `varindexed`
directly. Indexed targets such as `$a[$k]` are therefore accepted and must
keep their existing `index_expression` structure in the loop header.

Reference and compile-only observations used during brief creation:

```smarty
{for $i=1 to 3 step 2 max=4}{$i}{forelse}empty{/for}
{for $i=0,$j=1; $i<3; $i++}{$i}{$j}{/for}
{for $i=0; $i<3; $i=$i+1}{$i}{/for}
{for $i=0; $i<3; $i--}{$i}{/for}
{for $i=0; $i<3; $i++ nocache}{$i}{/for}
{for $a[$k]=1 to 3}{$a[$k]}{/for}
{for $a[$k]=0; $a[$k]<3; $a[$k]++}{$a[$k]}{/for}
```

The first five compile with the pinned full Smarty compiler and parse through
the recording compiler. Both indexed-target examples also parse through the
recorder and compile with the full engine. The recorder exposes normalized
`for` argument names:
range emits `start`, `to`, optional `step`; if `max` is present, it appears
first because parsed attributes precede synthesized header arguments. Thus the
observed sequence for the first example is `max,start,to,step`. C-style emits
`start`, `ifexp`, `var`, and `step`. It emits `forelse` and `forclose` tags and
body outputs, but does not compare argument values, expression structure,
runtime loop behavior, or block-stack validity. Hand-authored trees establish
those structural contracts; use the full compiler for the limited pairing
checks below.

Separate parser syntax from compiler validation. In range form `step` precedes
trailing attributes: `{for $i=1 to 3 step 2 max=4}` parses and compiles, while
`{for $i=1 to 3 max=4 step 2}` is rejected by the pinned parser itself (both
the recorder and full compiler report the syntax error). C-style
`{for $i=0; $i<3; $i++ max=2}` is accepted by the pinned parser and recording
compiler, but rejected by `ForTag` during full compiler attribute validation.
The Tree-sitter contract should preserve `max=2` as a syntactic header
attribute rather than require a parser error; the full-engine test documents
that the compiler will reject it. This does not claim that `max` is a valid
C-style option. `nocache` compiles on both forms. The reference projection
sees `max` by name, but represents the `nocache` option as an unnamed argument
and cannot verify its meaning.

Creation-review correction (accepted 2026-10-02): `{for $i=0 to 3 step}{$i}{/for}` is
accepted by the pinned parser and recorder, which reports the bare `step` as
an unnamed shorthand argument before synthesized `start` and `to` arguments.
The full compiler rejects this input with `too many shorthand attributes`.
Therefore it is parser-valid/compiler-invalid syntax and must not be a
Tree-sitter parser-error expectation. Preserve the bare argument structurally
in the range header and cover its separate full-compiler rejection. This
The independent task-creation reviewer accepted this correction before
implementation resumed.

Required hand-authored tree and check for that boundary:

```smarty
{for $i=0 to 3 step}{$i}{/for}
```

```text
(source_file
  (for_block
    (for_tag (range_for_header
      target: (variable name: (identifier))
      start: (number)
      end: (number)
      argument: (identifier)))
    (output value: (variable name: (identifier)))
    (for_close_tag)))
```

The `argument` field preserves the bare `step` token as an identifier while
the recorder projects it as an unnamed argument. The focused Node assertion
must confirm recorder acceptance, exact token text and source range, parser
acceptance, and the full compiler's `too many shorthand attributes` rejection.
This tree and check are part of the accepted task contract.

Malformed C-style recovery contract: for
`before {for $i=0; $i<3; }bad{/for} after {if $ok}yes{/if} {$later}`, the
malformed loop's own `{/for}` is currently recovered inside the top-level
`ERROR`. The valid neighboring `if_block` retains its `if_close_tag`, and the
following `{$later}` remains a separate final `output` sibling. The exact
Tree-sitter snapshot is asserted in `test/for-loops.test.mjs`; this preserves
the observed recovery boundary without claiming a `for_block` for this
malformed header.

Do not infer syntax from stale prose in `ForTag.php` describing
`{for $var in $array}`. The pinned parser rejects `{for $x in $items}` and the
full compiler reports the parse error. This is not an accepted Smarty 5.8.4
form. Conversely, the C-style parser production is executable compiler
behavior even though it is not listed in the current designer page, so it is
included in this task.

The recording compiler bypasses block validation. It reports no adapter error
for an orphan `{forelse}`, an unclosed `{for}`, or duplicate branches. The full
compiler rejects orphan/duplicate `{forelse}`, missing `{/for}`, and crossed
loop closers. Parser-error tests must not pretend the recorder validates these
conditions.

## Proposed tree contract

Add `for_block`, `for_tag`, `forelse_clause`, `forelse_tag`, and
`for_close_tag`. A `for_block` owns its body and optional single
`forelse_clause`, just as `foreach_block` owns `foreachelse_clause`. Nested
`for`, `foreach`, and `if` nodes own their own bodies and closers. Keep the two
header shapes distinct under `for_tag`; do not flatten either into a generic
tag or generic text:

- `range_for_header` contains `target`, `start`, and `end` fields, optional
  `step`, optional `max` value, the `nocache` option, and repeated `argument`
  fields for trailing bare shorthand values accepted by Smarty's parser. The
  target is a supported `variable` or indexed target retaining an
  `index_expression`; model the initial assignment target and value as
  distinct syntax nodes/fields.
- `c_style_for_header` contains one or more ordered `initializer` assignments,
  a `condition` expression, and one `update`. Assignment targets and values
  are separate and may be indexed targets retaining an `index_expression`;
  increment/decrement updates preserve the target and operator. Preserve
  trailing syntactically parsed attributes, including C-style `max=...` even
  though full compiler validation rejects that option.
- Existing expression trees are retained inside initializer values, end/step,
  condition, update values, and max. Assignment/update-specific structure must
  not erase expression children.
- `forelse_clause` contains `forelse_tag` followed by its direct body nodes;
  `{foreachelse}` remains a distinct foreach construct.

Illustrative hand-authored tree contracts (field names are public test
contracts for the implementation owner):

```smarty
{for $i=1 to 3 step 2 max=4}{$i}{forelse}empty{/for}
```

```text
(source_file
  (for_block
    (for_tag
      (range_for_header
        target: (variable name: (identifier))
        start: (number)
        end: (number)
        step: (number)
        max: (number)))
    (output value: (variable name: (identifier)))
    (forelse_clause (forelse_tag) (text))
    (for_close_tag)))
```

```smarty
{for $i=0,$j=1; $i<3; $i++}{if $i>0}{$i}{/if}{/for}
```

```text
(source_file
  (for_block
    (for_tag
      (c_style_for_header
        (for_initializer target: (variable name: (identifier)) value: (number))
        (for_initializer target: (variable name: (identifier)) value: (number))
        condition: (binary_expression
          left: (variable name: (identifier))
          right: (number))
        update: (for_update
          target: (variable name: (identifier))
          operator: "++")))
    (if_block
      (if_tag condition: (binary_expression
        left: (variable name: (identifier))
        right: (number)))
      (output value: (variable name: (identifier)))
      (if_close_tag))
    (for_close_tag)))
```

This parser-accepted but compiler-invalid header still has a syntactic tree.
The reference recorder has no syntax error; the full compiler rejects the
`max` attribute on this C-style form:

```smarty
{for $i=0; $i<3; $i++ max=2}{$i}{/for}
```

```text
(source_file
  (for_block
    (for_tag
      (c_style_for_header
        (for_initializer target: (variable name: (identifier)) value: (number))
        condition: (binary_expression
          left: (variable name: (identifier))
          right: (number))
        update: (for_update
          target: (variable name: (identifier))
          operator: "++")
        (attribute
          name: (identifier)
          value: (number))))
    (output value: (variable name: (identifier)))
    (for_close_tag)))
```

Indexed assignment targets are also structural expressions, not text or a
flattened variable name:

```smarty
{for $a[$k]=1 to 3}{$a[$k]}{/for}
{for $a[$k]=0; $a[$k]<3; $a[$k]++}{$a[$k]}{/for}
```

```text
(source_file
  (for_block
    (for_tag
      (range_for_header
        target: (index_expression
          object: (variable name: (identifier))
          index: (variable name: (identifier)))
        start: (number)
        end: (number)))
    (output value: (index_expression
      object: (variable name: (identifier))
      index: (variable name: (identifier))))
    (for_close_tag)))
(source_file
  (for_block
    (for_tag
      (c_style_for_header
        (for_initializer target: (index_expression
          object: (variable name: (identifier))
          index: (variable name: (identifier))) value: (number))
        condition: (binary_expression
          left: (index_expression object: (variable name: (identifier)) index: (variable name: (identifier)))
          right: (number))
        update: (for_update
          target: (index_expression object: (variable name: (identifier)) index: (variable name: (identifier)))
          operator: "++")))
    (output value: (index_expression
      object: (variable name: (identifier))
      index: (variable name: (identifier))))
    (for_close_tag)))
```

The tests should assert exact field text and source ranges for header pieces,
including `to`, `step`, semicolons, `max`, and postfix update tokens where the
chosen public tree retains them as anonymous tokens. Add a range header with a
method-call bound from the corpus; add a C-style assignment-update tree and a
decrement tree so both update alternatives remain represented.

## Acceptance work

1. Before grammar edits, hand-write `test/corpus/for-loops.txt` and add a
   failing-first Node check. Cover plain range, range+step, `max`, `nocache`,
   `forelse`, C-style header with initializer assignments, C-style expression
   update, increment and decrement, indexed range/C-style assignment targets,
   and nested `if`/`foreach`/`for` ownership.
   Include composition with method-call bounds, existing arithmetic/comparison
   expressions, output, and a generic tag inside a loop. Do not test only
   whole-file parse success; assert the distinct header nodes and fields.
2. Extend `observations()` for `for_tag`, `forelse_tag`, and `for_close_tag`,
   then opt fixtures into `fixtures('for-loops.txt')`. Normalize the compiler's
   different range/C-style parameter order exactly as observed, while explicit
   trees test source order and expression values. State in checks that the
   recorder cannot validate values, structure, runtime bounds, or block
   pairing.
3. Keep parser grammar observations distinct from full compiler validation.
   Add recorder/full-compiler cases for valid range/C-style forms, indexed
   targets, `nocache`, one `forelse` branch, nested pairing, and C-style
   `max=2`: the latter must be preserved as syntax while the full compiler
   rejects it as an invalid attribute. Assert the range `max`-before-`step`
   ordering is a parser syntax error. Full-compiler validation cases include
   orphan/duplicate `forelse`, missing close, and crossed closers; the recorder
   does not validate these. Include the hand-authored positive
   trailing-bare-`step` tree and assert recorder/parser acceptance, exact
   identifier text/range in its `argument` field, and full compiler rejection
   with `too many shorthand attributes`. Keep parser-error checks for incomplete range
   fields, missing C-style separators/condition/update, and malformed update.
   Treat the bare trailing `step` form above as syntactically accepted and
   compiler-invalid, not as an incomplete step field. Preserve a following
   independent output and valid neighboring block closer during parser
   recovery.
4. Add an incremental edit crossing a range header boundary (for example,
   remove/restore `to` or the end expression) and a C-style boundary (remove/
   restore a semicolon or update operator). Compare full incremental snapshots
   against fresh parses in both broken and repaired states, including branch,
   close, and following sibling nodes.
5. Add a focused mutation that removes or mislabels either the range/C-style
   header distinction or flattens the `for_block`; demonstrate the hand tree
   catches the structural fault. Keep existing foreach and if expectations
   intact except for any individually demonstrated correction.
6. Run `npm test`, preserve hash-matched before/after application reports
   outside `build/`, investigate regressions, and inspect every newly clean
   file's tree. Report actual clean/failing counts and whether each newly clean
   file contains the expected explicit `for_block`/header fields. Do not delete
   corpus files or count generic-tag swallowing as support.
7. Update `test/CONTRACT.md`, this brief's status/evidence, and the feature
   inventory. Leave every later error and every other standard loop/block gap
   visible. Do not modify generated parser sources or the vendored Smarty
   reference.

## Scope decisions

- Both range and C-style syntax are included. They need distinct header nodes,
  not separate project milestones chosen for implementation convenience.
- Range `max` and `nocache` are part of the contract. The parser also accepts
  C-style `max=...`, but full compiler validation rejects it; retain that
  syntactic attribute in the tree and make no claim it is a valid C-style
  option. `nocache` compiles on both forms. Preserve option syntax even where
  the recorder reports an unnamed argument.
- `{forelse}` is standard and belongs only to `{for}`; it is distinct from
  `{foreachelse}` for `{foreach}`.
- `{for $var in $array}` is excluded as a Smarty 5.8.4 parser/compiler rejection,
  despite a stale comment in the compiler class. This is not a language gap
  under the pinned reference version.
- Runtime iteration, range termination, variable values, and plugin behavior
  are not parser claims. Expression forms unsupported elsewhere remain
  separately tracked standard syntax gaps; they must not be silently consumed.
- `{while}`, legacy foreach headers, switch/capture/literal blocks, and break/
  continue are not implemented here. They remain visible project-level gaps;
  their exclusion keeps this task coherent without reclassifying them as
  nonstandard.

## Task creation evidence

- Current source/report details: `/tmp/smarty-task025-after.json`.
- Pinned parser productions: `vendor/smarty/smarty/src/Parser/TemplateParser.y`
  (the `{for}` productions and `statements`, `statement`, `foraction`).
- Pinned compiler behavior: `vendor/smarty/smarty/src/Compile/Tag/ForTag.php`,
  `ForElse.php`, `ForClose.php`, and the official designer reference
  `vendor/smarty/smarty/docs/designers/language-builtin-functions/language-function-for.md`.
- Manual reference probes used `php test/reference.php` for syntax events and
  `fullEngine(source, {mode: 'compile'})` from `test/helpers.mjs` for tag-stack
  and compiler validation. The recorder's missing errors for malformed block
  pairing are not treated as acceptance evidence.

## Implementation evidence (2026-10-02)

The independent implementation reviewer reproduced the focused test after
requiring real parsed-token source-range checks for `to`, `step`, and both
C-style semicolons. The corrected assertions check each token's type/text,
exact offsets, and matching source slice; no findings remain.

The implementation adds distinct `range_for_header` and
`c_style_for_header` nodes; assignment targets (including indexes) and values,
ordered C-style initializers, conditions, and updates remain explicit. Range
options retain `step`, `max`, `nocache`, and trailing shorthand arguments.
`for_block` participates in `_node`, so nested loops compose with existing
`foreach` and `if` ownership. The dedicated contextual `to` token avoids a
literal-keyword lexer conflict: a minimal range rule with literal `"to"` shifted
source ranges in existing foreach and index trees, while this contextual token
preserves them. The experimental external `{for ...` scanner token was removed
because it caused the same broad range drift.

Focused tests passed for loops and the prior range-sensitive families. The
full `npm test` run passed grammar typechecking, 235/235 hand-authored corpus
trees, and all 325 Node checks. All 16 deliberate mutations were caught,
including checks that removing `for_block` from `_node` fails the nested
ownership tree and removing the C-style alternative fails its hand-authored
tree.
The malformed C-style recovery assertion records the observed boundary: the
loop's own close tag is inside top-level `ERROR`, but the neighboring `if`'s
`if_close_tag` and final `{$later}` output stay distinct. The bare trailing
`step` test confirms parser/recorder acceptance and full compiler rejection.

Hash-matched local application reports `/tmp/smarty-task026-before.json` and
`/tmp/smarty-task026-after.json` cover the same 467 source files and have no
input-hash changes or clean-file regressions. The result improves from 453
clean / 14 with errors to 455 clean / 12 with errors. The two newly clean files
were structurally inspected: `action_types/action_value_dropdown_table.tpl`
contains two nested `for_block` nodes with range headers whose end fields retain
the method-call-minus-one expression; `view_module/view_module.tpl` contains
one `for_block` with a method-call end field. Both complete roots have no parse
errors. Source SHA-256 values are unchanged and recorded above in Motivation.
The after-report parser SHA-256 is
`3f46681999d891872d0389516e1a0f98db54f59d912ec064d5cc5ba0dfc9580d`.
The remaining 12 failing templates remain gaps; no files were excluded.
