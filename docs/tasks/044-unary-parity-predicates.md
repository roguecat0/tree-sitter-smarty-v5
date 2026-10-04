# 044 — Smarty unary parity predicates

**Status:** complete (2026-10-05); implementation review accepted. **Type:** standard Smarty 5 expression syntax. **Depends on:** [013 `is div by`](013-divisibility-predicate.md), [031 word `not`](031-word-boolean-operators.md), and [043 parity grouping predicates](043-parity-grouping-predicates.md).

## Motivation and evidence

Task 043 deliberately covered the four grouping predicates `is [not] odd/even by`, but identified four standard unary forms as a distinct `SINGLECOND` production and a separate arity/tree contract. This is a confirmed inventory gap, not a malformed use of the grouping operator. The official Smarty operator reference lists `is [not] even` and `is [not] odd`; the `if` designer guide demonstrates `is even`, `is odd`, and `is not odd`. The project completion target includes standard Smarty 5 expressions even when the current corpora do not contain a witness.

The current grammar reports errors for all four forms. With pinned Smarty 5.8.4, the recording adapter accepts each reduced `{if ...}` example. The full engine also accepts and evaluates them: for value `3`, `is odd` and `is not even` are true, while `is even` and `is not odd` are false. An output form `{$x is odd}` is accepted by both the recorder and full engine and renders `1` for `x = 3`.

This task adds only the unary parity family. It does not claim new corpus-clean gains; report the three corpus roots separately and inspect any newly clean files if the parser changes them.

## Scope and proposed tree contract

Support these four case-insensitive postfix predicates in the shared expression grammar:

- `is odd`
- `is even`
- `is not odd`
- `is not even`

Require Smarty's whitespace-delimited spelling: whitespace before `is`, after `is`, and between `not` and `odd`/`even` when `not` is present. The pinned `scond` lexer token includes the leading whitespace before `is`; the Tree-sitter `single_condition_operator` node should begin at `is` and end after `odd`/`even`, preserving original case and internal whitespace but excluding the leading separator. The explicit expression node is `single_condition_expression(left, operator: single_condition_operator)`. Its `left` field is the arithmetic operand at this operator's precedence, not necessarily every expression to the left in the condition. This postfix node keeps the one-operand contract distinct from both `unary_expression(operator, argument)` and `binary_expression(left, operator, right)`.

The reduced condition fixture is:

```smarty
{if $n is odd}Y{/if}
```

Its manually written condition tree is:

```text
(if_tag
  condition: (single_condition_expression
    left: (variable name: (identifier))
    operator: (single_condition_operator)))
```

The matching output fixture `{$n is not even}` must have an `output.value` containing the same expression shape. The operator node text and byte/index range must preserve exact spelling, for example `is  NoT\nEvEn` in the multi-whitespace case.

The pinned parser production is `expr ::= expr scond`, with arithmetic, relational, equality and logical operators participating at distinct precedence levels. Preserve the observed nesting, not a blanket rule that the predicate absorbs all preceding expressions:

- `{if 0 < 2 is odd}` renders false and has a relational `binary_expression` at the root, with `single_condition_expression(left: 2, operator: is odd)` as its right operand.
- `{if (0 < 2) is odd}` renders true and has a `single_condition_expression` whose `left` is the complete `parenthesized_expression`.
- `{if 4 + 1 is even}` predicates the complete addition as its `left` operand.
- `{$n is even + 1}` with `n = 4` renders `2`; the addition is outside the parity predicate.

The expected condition shapes for the first three cases are:

```text
(if_tag
  condition: (binary_expression
    left: (number)
    operator: "<"
    right: (single_condition_expression
      left: (number)
      operator: (single_condition_operator))))
```

```text
(if_tag
  condition: (single_condition_expression
    left: (parenthesized_expression
      (binary_expression left: (number) operator: "<" right: (number)))
    operator: (single_condition_operator)))
```

```text
(if_tag
  condition: (single_condition_expression
    left: (binary_expression left: (number) operator: "+" right: (number))
    operator: (single_condition_operator)))
```

For `{$n is even + 1}`, `output.value` is a `binary_expression` whose `left` is `single_condition_expression(left: variable, operator: single_condition_operator)` and whose `right` is a `number`.

A following `&&`/`||` composes with the predicate result. A parenthesized parity expression remains a `parenthesized_expression` when used as another operand. Do not fold the result into `unary_expression`, flatten the input, or reuse `parity_by_operator` (which includes a right operand and ends at `by`).

## Required failing-first checks

1. Add hand-authored expected trees and Node checks before grammar edits. Cover all four spellings across condition and output contexts, including mixed case and repeated ASCII spaces. Assert the exact node type, `left` and `operator` fields, operator text/range beginning at `is`, and that no right field is introduced. The lexer token includes leading whitespace, but the named tree operator does not. Compare recorder events for accepted reduced fixtures; event projection does not establish expression tree shape or precedence.
2. Add the exact comparison/arithmetic composition cases above with expected trees, plus boolean composition, a parenthesized predicate, and at least one existing word `not` expression. The full-engine observations constrain the shape; do not infer grouping from event counts. Include a repeated unary parity predicate only if its independent Smarty observation is retained in the brief/test.
3. Verify runtime truth for all four forms using controlled numeric values through `fullEngine()`. The recorder does not validate values or truth behavior. The lexer token captures the required leading whitespace before `is` as well as whitespace inside the phrase. Its semantic mapping removes ordinary ASCII spaces but not tabs/newlines: recorder checks accept `{if 3\tis odd}` and `{if 3 is\todd}`, but the pinned full compiler emits an undefined-key warning and invalid PHP; `{if\t3 is odd}` succeeds because that tab is outside the token. Also verify repeated ASCII spaces and case variants in the full engine. Keep token/range coverage for non-space whitespace, but don't claim full-engine semantic success for it.
4. Assert that `is oddness` is rejected by the pinned recorder and full engine because the `scond` prefix leaves `ness`. Do not characterize `{if 3 isodd}` or `{if 3 is notodd}` as compiler errors: Smarty accepts them as condition `3` with extra positional arguments, not as parity predicates. Likewise, `{if 3 is }` and `{if 3 is not}` are accepted as extra arguments; `{if 3 is not }` is a confirmed error. Keep these precise distinctions in boundary checks and avoid treating the accepted extra-argument forms as parity evidence. For editor recovery, use a confirmed malformed form such as `{if $n is odd && }` or `{if $n is not }`, surrounded by text and followed by a recognizable `{/if}` and independent output. Repair the malformed construct with an incremental edit and compare the whole edited snapshot to a fresh parse; include an edit crossing the `is [not] odd/even` boundary.
5. Protect nearby forms: `{if $n is odd by 2}` and `{if $n is div by 2}` must retain their existing `binary_expression` shapes and operator ranges; prefix `not $n` remains `unary_expression`; bare identifiers and generic-tag arguments must not be captured as predicate tokens.
6. Exercise the confirmed parenthesized modifier-argument composition `{$x|default:($n is odd)}` in both recorder and full-engine checks, with an explicit tree preserving the inner predicate. Keep unsupported narrow argument contexts out of scope and list them as unverified rather than assumed.
7. Run `npm test`. Preserve before/after reports outside `build/` for application, upstream core, and upstream demo; compare file manifests; report parser hashes, clean/error counts, regressions, and structurally inspect every newly clean file. Corpus no-error totals alone do not prove support.

## Exclusions and remaining gaps

Keep the distinct grouping forms `is [not] odd/even by` and `is div by` unchanged. `is not div by` belongs to the binary `TLOGOP` family and remains a separate standard syntax gap. Other predicates (`is [not] in`, `matches`, and arbitrary predicate names), word arithmetic `mod`, and `**`, `^`, `<<`, `>>` remain separate inventory gaps. Do not alter block syntax or add runtime/predicate-name validation.

These exclusions divide independent operator/token families; they do not remove those accepted standard forms from the project completion target.

## Pinned Smarty evidence and limits

The reference is Smarty 5.8.4 at commit `94a27cbbc7820198d7adc17a2be8d457fb267753`:

- `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex` defines `scond = ~\\s+is\\s+(not\\s+)?(odd|even)~` and assigns it the `SINGLECOND` token. It consumes the leading whitespace before `is`; `tlop` is separate and includes `by` plus a following whitespace boundary.
- `vendor/smarty/smarty/src/Parser/TemplateParser.y` defines `expr ::= expr scond`; `scond` maps the four normalized phrases `iseven`, `isnoteven`, `isodd`, and `isnotodd` to their compiler expression prefixes.
- `vendor/smarty/smarty/docs/designers/language-basic-syntax/language-syntax-operators.md` documents all four unary spellings.
- `vendor/smarty/smarty/docs/designers/language-builtin-functions/language-function-if.md` demonstrates even, odd, and not-odd conditions.
- Reduced recorder/full-engine observations accept all four in conditions; the full engine also accepts the tested output and parenthesized modifier argument. `{if 0 < 2 is odd}` evaluates false, while `{if (0 < 2) is odd}` evaluates true. A recorder event verifies only syntax-level event projection. Full-engine checks verify runtime outcomes only for separators whose pinned compiler translation is valid. `{if\t3 is odd}` succeeds; a tab/newline captured before or inside `scond` is recorder-accepted but breaks the pinned generated semantic mapping.

The task must not describe a compiler semantic limitation as a lexer rejection. If the pinned lexer accepts a spelling that its generated semantic mapping mishandles, preserve that distinction in the test and handoff.

## Implementation and corpus evidence

Implemented the four unary forms as postfix
`single_condition_expression(left, operator: single_condition_operator)` nodes
in both shared expressions and the local `{if}` ladder. The external scanner
consumes Smarty's leading whitespace as part of recognizing `SINGLECOND`, but
marks the public operator range from `is` through `odd`/`even`. It distinguishes
the longer `is [not] odd/even by` grouping form and leaves an `oddness` suffix
unconsumed, matching the pinned lexer's prefix behavior. A combined gap-token
dispatch preserves the existing gap-sensitive nocache and word-operator
tokens. No scanner state or unrelated output/tag behavior changed.

The manually written trees and Node checks are in
[the corpus fixture](../../test/corpus/unary-parity-predicates.txt) and
[the test module](../../test/unary-parity-predicates.test.mjs). They cover the
four forms, exact operator text/ranges, distinct unary tree shape, precedence,
case and ASCII/syntax whitespace, supported output and parenthesized modifier
contexts, compiler boundary distinctions, parity-by and div-by preservation,
malformed recovery with the actual `{/if}` and later output retained, and
incremental edits checked against fresh parses. Full-engine probes verify
truth outcomes for the four forms, comparisons, arithmetic composition,
output, and the modifier argument. Tabs/newlines captured within Smarty's
`SINGLECOND` token are accepted lexically by the recorder but produce invalid
compiler PHP; tests preserve that distinction and limit semantic claims to
valid compiler translations. `is oddness` is a compiler error; the related
`isodd`, `is notodd`, `is`, and `is not` inputs accepted as extra tag arguments
are explicitly not classified as parity predicates.

Acceptance command: `npm test` (exit 0 in **258.30 seconds**; final replay log
`/tmp/task044-npm-test-reviewfix.log`, SHA-256
`a214bb533ecea652d803e0a9223a004de302fc3c36f95e2d94505858892f6a52`). It
regenerated and rebuilt the grammar, passed **394/394 Tree-sitter corpus
cases**, **555/555 Node/reference/edit checks**, and caught all **18/18**
deliberate mutations. The independent review replay exposed that the mutation
runner's original 30-second per-command timeout could expire during grammar
generation under load even though the test runner allowed ten minutes overall.
An isolated mutation workspace measured generation at **10.664 seconds** and
the focused fixture parse at **1.438 seconds**. `test/mutations.mjs` now gives
generation 120 seconds and each focused test 60 seconds; all prior expected
status and `1 failure:` assertions remain intact. `test/run.mjs` gives the full
serialized mutation phase a finite 900-second ceiling, about 3.7 times the
previous full mutation duration of 241 seconds. The repeat acceptance run
finished in **258.30 seconds** with every mutation caught. Generated parser
SHA-256:
`6e0b1132cce00b8905cbe44963f68af8fab7016c564850a8326ee7dbea8636b5`.

The three corpus roots remained separate. Their baseline reports are Task
043's after reports copied to `/tmp/task044-before-*`; the after reports are
`/tmp/task044-after-application.json`,
`/tmp/task044-after-upstream-core.json`, and
`/tmp/task044-after-upstream-example.json`. File hashes and manifests matched
within each root. The counts remained application **467/467**, upstream core
**33/33**, and upstream demo **1/1**; there were no regressions or newly clean
files from this task, so no new corpus tree required structural review. The
demo's previously cleaned `index.tpl` and its structural review are recorded
under [Task 043](043-parity-grouping-predicates.md#implementation-and-corpus-evidence-2026-10-04).

## Brief review (2026-10-04)

The independent creation reviewer accepted the revised brief. The review
required precise precedence trees distinguishing `0 < 2 is odd` from
`(0 < 2) is odd`, and clarified that the predicate's `left` is the arithmetic
operand at its precedence level. It also verified the `scond` leading-whitespace
capture and tab/newline compiler limitation, corrected rejected versus accepted
extra-argument boundary cases, and confirmed the parenthesized modifier-argument
composition as an additional supported context. No unresolved brief findings
remain.

## Implementation review (2026-10-05)

The independent completion reviewer accepted the implementation with no
remaining findings. It verified the tree/range and precedence contract, scanner
interactions with existing `nocache`, word operators, `is div by`, and grouped
parity, compiler/runtime boundaries, recovery and edits, and the unchanged
hash-matched corpus reports. Its independent `npm test` replay exited 0 with
394/394 trees, 555/555 Node checks, and 18/18 mutations caught. The replay log
is `/tmp/task044-reviewfix-independent.log`, SHA-256
`a8dacc29ae2d9e20ff0107f0adcee883df80f0c42acd8411d1ef8b8653c137b4`; the
reviewer confirmed the finite per-command and overall mutation timeouts resolve
the reproducibility issue without changing assertions.
