# 008 — Boolean and null literals

Status: ready; not implemented. Dependencies: 004–007 for composition fixtures.
Implement before 009. This is a small lexical/primary-expression task.

## Scope and motivation

Support case-insensitive whole-word `true`, `false` and `null` wherever the bounded
expression grammar allows a primary value: outputs, calls, tag arguments and
attributes, conditions, indices and modifier arguments. Do not introduce generic
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
words are reserved in tag-name position, case-insensitively; ordinary names such
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
