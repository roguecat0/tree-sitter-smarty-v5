# 034 — Word comparison operators

**Status:** complete; independent implementation review accepted on
2026-10-04.
The brief was accepted after independent task-creation review on 2026-10-03.
The malformed-comparison recovery amendment below was also accepted by the same
reviewer on 2026-10-03.
**Type:** standard Smarty 5 comparison-expression syntax.
**Depends on:** [005 symbolic condition operators](005-condition-operators.md),
[011 standalone function calls](011-standalone-function-calls.md),
[013 shared expression operators](013-divisibility-predicate.md),
[031 prefix `not`](031-word-boolean-operators.md), and
[032 word binary boolean operators](032-word-binary-boolean-operators.md).

## Corpus motivation and pinned Smarty evidence

The hash-matched Task 033 application report uses parser hash
`6e97d1d82dc5e54073648e255de1ed48034f528a09b40f97d28770204c4f8e20` and
reports 459/467 files clean and eight
remaining files. `view_stats/action_chart.tpl:46` and
`view_stats/stats.tpl:60` both fail at `{if $dump_txt neq ''}`; each following
closer error is recovery fallout pending a parser tree that retains the `if`
block. The report is `/tmp/smarty-task033-final-application.json`. Task 033's
triage already minimizes the expression and classifies `neq` as the first
confirmed standard-syntax blocker in those templates.

In the pinned Smarty 5.8.4 source, `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex:325`
groups `eq`, `ne`, `neq`, `gt`, `ge`, `gte`, `lt`, `le`, and `lte` into `slop`
with one-or-more whitespace characters on both sides. The parser's
`TemplateParser.y:1283-1300` lowers `SLOGOP` by lowercasing its spelling and
maps the nine aliases to PHP `==`, `!=`, `>`, `>=`, `<`, and `<=`. Therefore
they are case-insensitive comparison aliases; whitespace is part of the
operator-token boundary. With mixed case, full Smarty 5.8.4 accepts `1 EQ 1`.
Without the two-sided gap the compiler can accept a different expression
instead, so tests must assert absence of a `word_operator` rather than claim
all such forms are compiler errors. Controlled compiled output confirms
`{if 0eq1}` becomes `if ('0eq1')`, `{if 0 eq1}` becomes `if (0)`, and
`{if 0eq 1}` becomes `if ('0eq')`.

The parser emits all comparison fragments into PHP expressions. Controlled
full-engine probes (Smarty 5.8.4, fixed literal-only inputs) show the relevant
binding order: relational comparison binds more tightly than equality, and
comparisons bind more tightly than `and`, `or`, and `xor`:

| Probe | Rendered branch | Distinguishes |
| --- | --- | --- |
| `{if 1 eq 2 gt 1}T{else}F{/if}` | `T` | `gt` binds before `eq` |
| `{if 2 eq 1 and 1}T{else}F{/if}` | `F` | `eq` binds before `and` |
| `{if 2 eq 1 or 0}T{else}F{/if}` | `F` | `eq` binds before `or` |
| `{if 2 eq 1 xor 1}T{else}F{/if}` | `T` | `eq` binds before `xor` |
| `{if 8 is div by 2 eq 0}T{else}F{/if}` | `F` | equality composes after `is div by` |
| `{if 8 is div by 3 eq 0}T{else}F{/if}` | `T` | equality sees the predicate result |

The generated Smarty code for `is div by` is `!(left % right)` per
`TemplateParser.y:1302-1312`; it is a predicate production with its own
parenthesized translation, not another word comparison spelling. The two
probes above prevent the alias task from guessing at that existing composition.
The precedence conclusions also agree with existing symbolic comparison and
Task 032 boolean-operator probes. Recheck the probes before implementation;
do not rely on the recorder for precedence or runtime behavior.

## Bounded scope and tree contract

Implement only the nine standard comparison aliases `eq`, `ne`, `neq`, `gt`,
`ge`, `gte`, `lt`, `le`, and `lte`. Every occurrence in an expression becomes
the existing `binary_expression` shape with explicit `left`,
`operator: (word_operator)`, and `right` fields. `word_operator` contains only
the original letters, preserving case and exact source range; the surrounding
whitespace is not part of the node. Map each alias to the same precedence level
as its symbolic equivalent: `eq`/`ne`/`neq` share equality precedence with
`==`/`!=`/`===`/`!==`; `gt`/`ge`/`gte`/`lt`/`le`/`lte` share relational
precedence with `<`/`<=`/`>`/`>=`. Relational operators bind more tightly than
equality. Preserve the current non-associative comparison-chain boundary;
parentheses make explicit grouping.

For the minimized corpus witness, the following tree is required:

```smarty
{if $dump_txt neq ''}Y{/if}
```

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (variable name: (identifier))
      operator: (word_operator)
      right: (string)))
    (text)
    (if_close_tag)))
```

The operator token covers exactly `neq`. Also assert a mixed-boundary tree for
`{if 1 eq 2 gt 1 and $enabled}Y{/if}`: the outer node is `and`; its left is
`eq`, whose right child is `gt`; all three operators have exact text, type,
field, and byte ranges. The full Smarty result for the corresponding literal
probe is specified above; the `$enabled` fixture checks tree composition only.

## Failing-first fixtures and checks

Before grammar changes, add hand-authored trees and a failing Node check for:

1. All nine aliases independently, including every mapping category and mixed
   case. Assert exact `word_operator` spelling and start/end ranges. Check LF,
   CRLF, tab, and multiple-space gaps; the lexeme must exclude the gaps.
2. Relational-versus-equality grouping with aliases and symbolic comparisons,
   including explicit parentheses, plus comparison composition with `and`,
   `or`, `xor`, symbolic `&&`/`||`, and existing `is div by`. Keep same-level
   comparison chains invalid unless parenthesized, as established by the
   existing comparison contract and full-engine behavior.
3. Shared-expression composition in outputs; `if` and `elseif` conditions;
   generic-tag positional and attribute values; a function argument; an array
   value; and a parenthesized modifier argument. Unknown tags must retain the
   complete comparison `binary_expression`, with the alias in its `operator`
   field; do not recognize custom tag names or change their argument grammar.
4. Bare identifiers/calls named `eq`, `neq`, and `gt`, variables such as
   `$neq`, strings/comments containing alias spellings, and one-sided missing
   whitespace. These must not accidentally become comparison operator nodes.
   Where Smarty compiles a no-gap example as a different expression, assert the
   independently observed tree/boundary rather than compiler rejection.
5. Use this minimized missing-RHS recovery input, with all listed siblings
   following the malformed condition:

   ```smarty
   {if $left neq }{*keep*}{$after}{widget value=$item}{/if}
   ```

   Require `root.hasError === true` and retain the exact observed
   Tree-sitter recovery shape `(if_tag condition: (variable ...) (ERROR
   (word_operator)))`. Assert the error's child token is exactly `neq` and its
   byte range covers only those three letters. Assert that the condition has no
   represented right operand or comparison `binary_expression`; the error
   remains a sibling of the condition inside `if_tag`. The `if_block` must then
   retain, in source order, a `comment`, an `output` for `{$after}`, a
   `custom_tag` named `widget`, and the matching `if_close_tag` with exact text
   `{/if}`. An error that swallows any later sibling or the closer fails. This
   recovery contract does not claim the missing operand is represented
   structurally.
6. Start incremental-versus-fresh snapshots from this exact valid source:

   ```smarty
   {$before}{if $ready}{if $left neq $right}Y{/if}{/if}{$after}
   ```

   Change the inner `neq` to `==`, restore `neq`, then replace the condition
   text `$left neq $right` with `$left neq ` so the complete edited source is
   `{$before}{if $ready}{if $left neq }Y{/if}{/if}{$after}`. Restore `$right`
   afterward. At every step compare the entire incremental tree snapshot with a
   fresh parse. Assert the malformed state has an error and retains
   `{$before}`, both `if` closers, and `{$after}`; the restored state is
   error-free and matches the original snapshot.

Use `fixtures(filename)` for the recording adapter, which checks compiler event
acceptance only. Add fixed full-engine probes for every alias mapping (both a
true and false case), relational/equality precedence, its interaction with
word/symbolic boolean operators, and `is div by`; never run the application
corpus through the engine. Keep compiler acceptance, executable precedence,
and structural trees as separate evidence. The pinned parser/compiler is the
reference; do not modify it or hand-code its answer into the adapter.

The broad goal is all standard Smarty expression syntax. This task does not
cover word arithmetic alias `mod`, exponentiation, bitwise xor/shifts, other
math operators, or other `is ...` predicates; each remains a project-level gap
and needs its own reviewed source evidence/task. Do not use tag-specific
special cases or a text fallback.

Run `npm test`; preserve parser-hash-matched before/after reports outside
`build/` for application, upstream Smarty core, and upstream demo separately.
Inspect any newly clean application trees and all regressions. Completion
requires the full acceptance gate and an independent implementation review.

## Implementation evidence (2026-10-03)

The parser recognizes the nine aliases as case-insensitive comparison operators
with the existing symbolic equality or relational precedence. Their public
`word_operator` nodes retain original spelling and cover only the letters;
the external scanner requires Smarty's whitespace on both sides. Hand-authored
trees and checks cover all nine aliases, mixed-case spellings, LF/CRLF/tab/
multiple-space gaps, symbolic and word boolean composition, parentheses,
`is div by`, outputs, `if`/`elseif`, unknown-tag arguments/attributes, function
and array arguments, and parenthesized modifier arguments. No-gap cases retain
their observed non-operator parses. No existing expectation changed.

Malformed `{if $left neq }` has a real error, while its `if_block`, comment,
following output, unknown `widget` tag, and `{/if}` closer remain direct ordered
children. The accepted recovery shape leaves `condition` as the left variable
and keeps `neq` as a one-child `(ERROR (word_operator))` sibling inside
`if_tag`; it does not represent a missing right operand. The Node check asserts
this exact shape and byte range. Incremental edits from `neq` to `==`, back to
`neq`, deletion of the RHS, and repair match fresh parses at every step.

`npm test` passed: grammar typecheck, **299/299** Tree-sitter trees,
**427/427** Node checks, and all **18** deliberate mutation checks caught. The
saved log is `/tmp/smarty-task034-npmtest.log`.

Hash-matched corpus reports use parser SHA-256
`1eb5a5ddf5dc7750fc8bf7a250f27fc695c34432baecd49bec08c3bcb119677d` and are
separate by root:

| Corpus | Task 033 baseline | Task 034 result | Newly clean / regressions | Report |
| --- | ---: | ---: | --- | --- |
| Application (467 files) | 459 clean / 8 failing | 461 clean / 6 failing | 2 / 0 | `/tmp/smarty-task034-final-application.json` |
| Upstream core (33 files) | 31 clean / 2 failing | 31 clean / 2 failing | 0 / 0 | `/tmp/smarty-task034-final-upstream-core.json` |
| Upstream demo (1 file) | 0 clean / 1 failing | 0 clean / 1 failing | 0 / 0 | `/tmp/smarty-task034-final-upstream-example.json` |

All source-template hashes matched each corresponding Task 033 baseline.
The two newly clean application files, `view_stats/action_chart.tpl` and
`view_stats/stats.tpl`, were structurally inspected: each now has an error-free
`if_block` whose condition is a `binary_expression` with a variable left side,
`neq` in the `word_operator` field, a string right side, body text and an
explicit `{/if}` closer. The upstream roots had no clean-count changes.
The six remaining application failures and the two upstream-core failures are
still visible completeness gaps; Task 034 does not claim project completion.

The report JSON SHA-256 checksums are application
`58df46499ae1624d4b3634622f8a9514894e38216ed775e464703e7ec3d2e3e4`, core
`e49fa7d84c8772a7768c62338a59daa8f97aa598449f1c1a91b6dae196aae0c4`, and demo
`2614025aa0e890fcdbee7386438062a0dcb9a6e4b655e6bb5e800ad341703d71`. The two
newly clean application source SHA-256 values are
`view_stats/action_chart.tpl` `8b4b9cae935b0c061140f111128cd6dffc4764d3199df8a46be17f108ccfc5d3`
and `view_stats/stats.tpl`
`63ad89047e65d31e5b32b685e5e2daee78e711e58f71cb789ad88402cd1219cb`.
Independent completion review verified the alias trees and mappings, precedence,
token boundaries, malformed recovery, edits, report hashes, and both newly
clean application trees on the final parser hash.
