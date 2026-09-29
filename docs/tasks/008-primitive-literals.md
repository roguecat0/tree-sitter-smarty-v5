# 008 — Boolean and null literals

Status: complete (2026-09-29). Dependencies: 004–007 for composition fixtures.
Implement before 009. This is a small lexical/primary-expression task.

## Scope and motivation

Support case-insensitive whole-word `true`, `false` and `null` wherever the bounded
expression grammar allows a primary value: outputs, calls, tag arguments and
attributes, conditions, parenthesized/compound indices and modifier arguments. Do not introduce generic
bare-word values, constants, numeric formats, output attributes or assignment.

On 2026-09-22 a raw lexical scan found primitive words in 254 of the 467 local
`.tpl` files. This includes JavaScript, comments and quoted text and is only a
triage hint, not a count of failing Smarty expressions.
`corpus/action_types/action_value_afmelden.tpl:16` supplies a method argument
`get_key_values(true)`; reduce it to `{$user->find(true)}`. Null and mixed-case
forms are synthetic reference-backed cases, not claimed corpus discoveries.

## Proposed tree contract

Add named leaf `boolean` (covering both true and false) and `null` nodes. Preserve
original spelling/ranges; do not convert them to strings, identifiers or numbers.

```text
{$user->find(true, FALSE, null)}
(source_file
  (output value: (method_call_expression
    object: (variable name: (identifier))
    method: (identifier)
    argument: (boolean)
    argument: (boolean)
    argument: (null))))
```

`{true}`, `{FALSE}` and `{null}` are outputs, not generic tags. Exact primitive
words are reserved in opening tag-name position, case-insensitively; ordinary names such
as `true_widget`, `TRUEish` and `nullary` remain generic tags. Contextual property,
method and static dot-key identifiers such as `$a->true()` and `$a.TRUE` must
retain their identifier nodes. Strings and comment bodies remain opaque.

## Reference observations (Smarty 5.8.4, 2026-09-22)

The recorder identifies `{true}`, `{FALSE}`, `{null}` as output events and accepts
`{widget enabled=true value=null}` and `{$user->find(false)}`. It identifies
`{TRUEish}` and `{true_widget}` as generic tags, and accepts `$a.TRUE` and
`$a->true()` in outputs. Inspect `value ::= ID` and lexer keyword handling;
PHP constant treatment participates in compilation, but this task does not
support arbitrary compile-time constants or bare words.

A separate full Smarty `fetch` observation, with only literal expressions and a
temporary compile directory, returned `T` for all three controlled templates:

```smarty
{if true === TRUE}T{else}F{/if}
{if false === FaLsE}T{else}F{/if}
{if null === NULL}T{else}F{/if}
```

The recorder also accepts `{widget value=trueish}` (bare-word value) and
`{TRUE value=1}` (output attributes). Those remain excluded. Do not add a general
identifier fallback to handle keyword prefixes or silently accept output attributes.
The event projection does not verify literal values/types; exact trees and the
controlled full-engine helper from 005 provide distinct evidence.

## Reference boundary correction (2026-09-23)

Bare bracket `ID` is a section index in Smarty, even when it spells a primitive.
With `a = {0: "zero", 1: "one", "": "empty"}`, full-engine rendering returns
`empty` for `$a[true]`, `$a[false]`, `$a[null]` and `$a[TRUE]`, but `one` for
`$a[(true)]` and `zero` for `$a[(false)]`. Therefore bare primitive indices stay
outside the existing section-index boundary; parenthesized and compound primitive
indices are expressions. This corrects the brief's original blanket index scope.
The recorder alone cannot expose that semantic difference.

Primitive reservation applies only to opening tags. Independent `{/true}`,
attribute names in `{widget true=1}`, modifiers in `$a|true` and contextual member
names remain identifiers. Existing malformed control tags remain errors.

## Acceptance work

1. Add manual `test/corpus/primitive-literals.txt` trees and failing Node checks.
   Cover each literal in lower/upper/mixed case, unary negation and strict equality,
   call arguments, index expressions and composed foreach/if bodies.
2. Opt fixtures into dedicated reference tests. Add controlled full-engine checks
   that distinguish true, false, null and their quoted spellings, using only fixed
   templates/primitive values and no application plugins or arbitrary corpus code.
3. Assert literal node spelling/ranges and whole-token boundaries. Preserve
   renamed unknown tags/modifiers and contextual keyword members; include
   `{true_widget}`, `{TRUEish}`, `$a->null`, `$a->true()` and `$a.FALSE`.
4. Check incomplete expressions and excluded primitive-prefix bare words do not
   become partial literal tokens followed by discarded text. Edit `true` to
   `true_widget` at a complete tag boundary and back; also edit a call argument
   across a keyword boundary. Compare full incremental/fresh snapshots.
5. A mutation is required if the implementation's lexical priority/boundary
   handling could accept prefixes without a tested tree difference; otherwise
   explain why focused positive/negative checks cover it. Do not manufacture a
   redundant mutation solely to increase counts.
6. Run `npm test` and before/after hash-matched corpus reports saved outside
   `build/`; investigate regressions and inspect new literal nodes. Update the
   contract, inventory and this brief. Explain any prior generic-tag expectation
   corrected by the independently observed `{true}` output classification.

## Completion evidence (fill when implemented)

Trees/reference/full-engine/edit links; exact keyword/identifier boundaries;
commands/results; corpus report paths/comparison; changed expectations and minimal
Smarty observations; remaining bare-word/constant/output-attribute exclusions.

## Completion evidence (2026-09-29)

- [Seven manual trees](../../test/corpus/primitive-literals.txt) and
  [reference/type/range/edit checks](../../test/primitive-literals.test.mjs).
  Before implementation six new trees failed; the opaque-string/comment tree
  already passed. The inherited draft's full-engine return-field typo was fixed
  (`result`, not `output`); no assertion was weakened or old tree changed.
- `npm test` passes 91 trees, 137 Node checks and all nine mutations. Exact
  keyword spelling uses Tree-sitter word boundaries; longer names and primitive
  prefixes are protected by positive trees and explicit negative/edit checks.
  No additional mutation is needed for a failure mode those checks already catch.
  Index/attribute mutation anchors were updated preserving their original faults.
- `reference.php` now records the real deferred modifier list passed into
  `compilePrintExpression`: `{null|escape:false}` previously omitted its modifier
  event. Dedicated renamed-modifier and malformed-argument checks verify the
  extension; plugin execution remains bypassed, as before.
- Full-engine tests distinguish literal types/case from quoted values and
  independently verify the section-index correction above. Bare-name values,
  section indices and output attributes remain separate project gaps to keep
  this primary-expression task bounded, not permanent project exclusions.
- Reports `/tmp/smarty-008-before.json` and `/tmp/smarty-008-after.json` match all
  467 input hashes: **57 → 71 clean**, **410 → 396 failing**, no regressions.
  Literal nodes in all fourteen newly clean files were inspected; local structure
  evidence is `/tmp/smarty-008-review.json`. The method-argument fixture minimizes
  the cited `get_key_values(true)` corpus usage. Clean parses do not prove runtime
  correctness or complete language coverage.
