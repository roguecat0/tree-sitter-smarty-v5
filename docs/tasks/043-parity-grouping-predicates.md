# 043 — Smarty parity grouping predicates

**Status:** complete (2026-10-04); implementation review accepted. **Type:** standard Smarty 5 expression
syntax. **Depends on:** [013 `is div by`](013-divisibility-predicate.md),
[030 section blocks and indices](030-section-blocks-and-indices.md), and the
shared expression/operator tasks.

## Motivation and separated corpus evidence

Task 042 left the official Smarty 5.8.4 demo as the only failing file in its
separate upstream-example root (0/1 clean). The exact pinned source is
`corpus/upstream-smarty-v5.8.4-example/demo/templates/index.tpl`, SHA-256
`c50433e4a658858ccc5a785bbaf25097512587a7afaab77cb4f2c6d4e419ebea`. Its
first syntax error is the section condition on line 27:

```smarty
{if $smarty.section.outer.index is odd by 2}
```

At brief creation, the separate baselines are application 467/467 clean,
upstream core 33/33 clean, and upstream demo 0/1 clean. Task 030 independently
records the demo as an `is odd by 2` blocker and confirms the enclosing section,
sectionelse, close, and section-index forms are already modeled. The corpus
reports are triage evidence; the reduced source below establishes the specific
grammar failure.

The pinned 5.8.4 recording adapter and full engine accept
`{if 5 is odd by 2}T{else}F{/if}` and render `F`; the corresponding even form
`{if 5 is even by 2}T{else}F{/if}` renders `T`. The existing grammar reports a
parse error for both. The official Smarty designer guide documents these
grouping forms and describes the grouping behavior: `is odd by` reverses the
alternating grouping from `is even by`. The compiler source maps these forms
through the `TLOGOP` family; this is standard parser syntax, not a project
plugin feature.

## Scope

Add the four parity grouping forms `is odd by`, `is even by`, `is not odd by`,
and `is not even by` to the shared expression grammar. Require Smarty's
whitespace-delimited word boundaries and preserve the entire source spelling
and range from `is` through `by` in a named `parity_by_operator`. Represent
each as `binary_expression(left, operator, right)`, matching the existing
`is div by` structure. Keep the existing expression precedence and associativity
observed for Task 013's `expr ::= expr tlop value`: the left operand is the
current full expression and the right is a supported value. Do not change the
precedence ladder or add expression contexts.

The reduced failing-first check is:

```smarty
{if $smarty.section.outer.index is odd by 2}Y{/if}
```

The hand-authored expected condition shape is:

```text
(if_tag
  condition: (binary_expression
    left: (section_property_expression
      section: (identifier)
      property: (identifier))
    operator: (parity_by_operator)
    right: (number)))
```

The left property node retains the `section` name `outer` and `property` name
`index`; do not flatten the established section-property structure. Add a
separate manually specified output tree for `{$n is even by 2}` to prove that
the feature follows the shared expression grammar outside conditions.

## Required checks

1. Add manually written corpus trees and failing Node checks before grammar
   changes. Cover all four exact spellings, including one mixed-case and one
   multi-whitespace example. Assert node type, operator text, exact start/end
   indices, left/right fields, and that the section property stays structured.
2. Check composition with an existing supported relational and boolean operator,
   arithmetic on each side, parentheses, and a supported unary right operand.
   Use the Task 013 precedence observations to specify the expected nesting;
   the new predicate must not flatten or consume surrounding expression nodes.
3. Verify the pinned Smarty recorder accepts the minimized condition and output
   fixtures, while documenting that its event projection does not establish
   operator tree shape or precedence. Use `fullEngine()` numeric cases to
   verify odd/even and negative-form behavior independently. Include the
   demo-shaped section condition as a minimized fixture, not only a corpus
   report.
4. Include malformed right-operand recovery with surrounding text, a real
   `{/if}` closer, and later output preserved; repair the missing value with an
   incremental edit and compare the complete incremental snapshot to a fresh
   parse. Include an edit crossing the `is ... by` token boundary.
5. Assert the exact malformed word-boundary cases `{if 5 is oddby 2}T{/if}`
   and `{if 5 is not oddby 2}T{/if}` remain compiler/reference errors, as
   observed with the pinned adapter and full engine. Do not use `is odd by2`
   as a negative case: Smarty 5.8.4 compiles it. Keep arbitrary identifiers
   and generic-tag parsing unchanged. Compiler acceptance/rejection establishes
   compiler behavior; token-boundary claims must come from pinned lexer source
   or parser traces, not acceptance alone.
6. Add a direct regression assertion for the existing `{$n is div by 2}` tree:
   it must still use `binary_expression`, `div_by_operator`, and the existing
   `left`, `operator`, and `right` fields/ranges. This guards the shared
   operator path while adding the parity-specific node.
7. Run `npm test`, separate before/after reports for application, upstream core,
   and upstream demo, compare input manifests, inspect the newly clean demo tree,
   and report any newly clean files and regressions. A no-error report alone is
   not structural evidence.

## Explicit exclusions and follow-up gaps

Keep `is div by` unchanged. The pinned lexer source has distinct `TLOGOP`,
`SINGLECOND`, and `isin`/`matches` token definitions; this task covers only the
`odd/even by` members of `TLOGOP`. The valid unary standard forms `is odd`,
`is even`, `is not odd`, and `is not even` belong to `SINGLECOND` and remain
separate coverage gaps, not malformed missing-`by` variants. `is not div by`,
`is [not] in`, `matches`, and arbitrary new predicate names also remain
separate gaps. These are scope exclusions, not claims that Smarty rejects the
syntax. The unary parity forms need a separate tree contract because they have
a different arity. Do not change section syntax, custom tags, or runtime
semantics.

## Pinned reference evidence and limits

Smarty source is pinned at commit `94a27cbbc7820198d7adc17a2be8d457fb267753`.
`vendor/smarty/smarty/src/Lexer/TemplateLexer.plex` defines
`tlop = ~\\s+is\\s+(not\\s+)?(odd|even|div)\\s+by\\s+~`; `TemplateParser.y`
defines `expr ::= expr tlop value`, and its `tlop` mapping has distinct
`isevenby`, `isnotevenby`, `isoddby`, and `isnotoddby` cases. Thus the four
spellings have the same binary production shape but different operator text
and runtime translation. The separate lexer definition for unary forms is
`scond = ~\\s+is\\s+(not\\s+)?(odd|even)~`. Pinned recorder/full-engine
observations reject `is oddby 2` and `is not oddby 2`; they accept `is odd by2`,
so that latter form is not a negative case. Existing Task 013 observations
establish that the `tlop` production composes with the shared expression
ladder; the new tests must confirm the parity variants retain that precedence
in the current generated Smarty parser and full engine. Reference event
agreement cannot establish Tree-sitter node shape, compiler block validation,
or runtime values.

Relevant sources:

- `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex`
- `vendor/smarty/smarty/src/Parser/TemplateParser.y`
- `vendor/smarty/smarty/docs/designers/language-basic-syntax/language-syntax-operators.md`
- `vendor/smarty/smarty/docs/designers/language-builtin-functions/language-function-if.md`
- `docs/tasks/013-divisibility-predicate.md`
- `docs/tasks/030-section-blocks-and-indices.md`

## Brief review (2026-10-04)

The independent creation reviewer accepted the revised brief. The review
verified the four `TLOGOP` forms and their compiler behavior, and required
clarifying that unary `is [not] odd/even` forms are valid separate syntax,
`is odd by2` is accepted rather than a negative case, and only pinned-rejected
`is oddby 2` / `is not oddby 2` are used as malformed boundaries. The brief
also adds a direct `is div by` tree/range regression check and distinguishes
compiler acceptance from lexer-boundary evidence.

## Implementation handoff

The first check should fail on the hand-authored operator tree and reduced
section condition while all current corpus and prior operator tests remain
untouched. Update the contract and feature inventory after brief review accepts
the shape. At completion, record generated-parser hash, test counts, independent
corpus results, manifest comparison, the structurally inspected demo tree, and
any remaining errors.

## Implementation and corpus evidence (2026-10-04)

The implementation adds `parity_by_operator` for the four `is [not] odd/even
by` spellings and uses it in both the shared expression and condition grammar.
It retains `binary_expression(left, operator, right)`, the Task 013 precedence
and unary RHS boundary, and exact source spelling/range. It does not add valid
unary `is [not] odd/even`, `is not div by`, or other predicates.

The manually authored section-condition and output trees plus the Node check
failed against the pre-change parser: the section form had an `ERROR`, output
was parsed as a generic tag, and the joined-word cases remained errors. After
implementation, the focused Task043 Node file passed 9/9 checks; `check:grammar`
passed. The required `npm test` exited **0** with 382/382 Tree-sitter corpus
cases, 537/537 Node/reference/edit checks, and 18/18 deliberate mutations
caught. Full output is `/tmp/task043-npm-test-final.log`, SHA-256
`9f45e99fc6537d5859f23ee90898f7b75e8b12c59d0f9c64e8256d8574d1bd84`; the
recorded exit file is `/tmp/task043-npm-test-final.exit` (content `0`, SHA-256
`9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa`). The
mutation-phase timeout in `test/run.mjs` was raised from four to ten minutes
after an initial run hit the old 240-second bound at 17 catches. The isolated
final arithmetic mutation was independently reproduced and failed its expected
tree assertion; the full run then caught all 18.

The Task013 negative assertion that previously listed `is odd by` and
`is even by` was narrowed to its still-unsupported divisibility cases. This
contract correction is grounded in pinned Smarty 5.8.4 recorder and full-engine
acceptance of `{if 5 is odd by 2}T{else}F{/if}` and the corresponding `even`
form; Task043 now independently asserts their tree, precedence, and runtime
behavior. Task013 records the updated boundary explicitly in
[its Task043 syntax-boundary update](013-divisibility-predicate.md#later-syntax-boundary-update-task-043).

All corpus roots were reported separately against parser hash
`3354a4daa152009901712e574a23aefb1db23becffb3541a42d89736f70ed149` (the
SHA-256 of generated `src/parser.c`). The before and after reports have matching
file manifests in each root:

| Corpus root | Before report (SHA-256) | Result | After report (SHA-256) |
| --- | --- | ---: | --- |
| Application | `/tmp/task043-before-application.json` (`5d6c7c0a88c5e74de53bd8ab236728e420797bc6a5f0e59358218a845852de9a`) | 467/467 → 467/467; no regressions | `/tmp/task043-after-application.json` (`ceb9cb98980defbe4b05c7debaa82162738f06e0e3ea26583cba3c9d47aeae82`) |
| Upstream Smarty core | `/tmp/task043-before-core.json` (`cc07b3b6fbff86832b4a2aaea88d6e4bddfe58a34d92493409552aeca8b0027d`) | 33/33 → 33/33; no regressions | `/tmp/task043-after-core.json` (`89ac9a76d5d2fbe525b225746c5f8eacf8479ec9cdc4dbbf29b283f0f6d217d5`) |
| Upstream Smarty demo | `/tmp/task043-before-example.json` (`2c79a90aaf67626ac5587b51284888a4c10720a9b59d34e32d5beb3781c7611d`) | 0/1 → 1/1; `demo/templates/index.tpl` newly clean | `/tmp/task043-after-example.json` (`525d296d7ce11c182039b810ba450a7204f3873ed55fbfedd56e2f0e0480686e`) |

The before demo report's three errors were at lines 27, 29, and 31; the first
was its `{if $smarty.section.outer.index is odd by 2}` condition. The full
after tree was inspected with `tree-sitter parse`. The demo now contains a
`section_block` with its existing `section_header`, nested `if_block`, and
`sectionelse_clause`. The `if_tag.condition` retains a
`section_property_expression` (`outer.index`) as the left field, a
`parity_by_operator` with source text `is odd by`, and the numeric right field.
Both branches preserve `{$smarty.section.outer.rownum}` and the separate
`$FirstName[outer]`/`$LastName[outer]` outputs with `index_expression` and
`section_index` nodes; the `if_close_tag`, `sectionelse_tag`, and
`section_close_tag` remain structurally owned. No corpus inputs changed and no
errors remain in these three roots. This task does not assert general semantic
validation of section variables or render the upstream demo.

## Implementation review (2026-10-04)

The independent completion reviewer accepted the frozen diff with no actionable
findings. It verified the four operator forms, spelling/ranges, precedence,
shared and condition expression contexts, unchanged `is div by` behavior,
negative boundaries, malformed recovery, incremental edits, and the complete
demo tree. It also verified the Task013 contract correction, generated parser,
all three hash-matched corpus reports, and the final acceptance gate. A separate
reviewer mutation run caught all 18 deliberate faults in 241.13 seconds,
confirming the former 240-second limit could expire before the final mutation;
the updated 600-second bound is finite and sufficient.
