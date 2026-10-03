# 032 — Word binary boolean operators

**Status:** complete; independent implementation review accepted on
2026-10-03. The scope, Smarty precedence probes, tree contract, and recovery
cases also received independent task-creation review.
**Type:** standard Smarty 5 binary expression syntax.
**Depends on:** [005 symbolic condition operators](005-condition-operators.md),
[011 standalone function calls](011-standalone-function-calls.md),
[013 shared expression operators](013-divisibility-predicate.md), and
[031 prefix `not`](031-word-boolean-operators.md).

## Motivation and bounded scope

Smarty 5.8.4's lexer groups `and`, `or`, and `xor` as `SLOGOP`; the parser
accepts them through `lop` in a shared binary-expression production. They are
standard aliases for boolean composition, required in the same expression
contexts already supporting symbolic `&&` and `||`. The failed combined Task
031 candidate did not complete the gate, so it establishes no accepted support
or completion evidence for these aliases.

Implement only binary `and`, `or`, and `xor`. Prefix `not` is supplied by
Task 031. Do not implement word comparison/arithmetic aliases (`eq`, `ne`,
`neq`, `gt`, `ge`, `gte`, `lt`, `le`, `lte`, `mod`), `is ...` predicates,
bitwise operators beyond existing support, or other math operators. Those
remain project gaps in the feature inventory; no standard syntax is being
excluded from the project goal.

## Tree and precedence contract

Each binary spelling produces `binary_expression` with explicit `left`,
`operator: (word_operator)`, and `right` fields. `word_operator` must preserve
the exact case and source range. All three spellings are case-insensitive and
must not be swallowed as text or bare identifiers in an expression. Binary
operators require Smarty's whitespace boundary on both sides; `$and`, `$or`,
and `$xor` remain variable names. Preserve existing symbolic operator trees.

The pinned lexer maps the spellings into PHP operators, whose observed binding
order for these aliases is `and` (same logical level as existing `&&`), then
`or` (same level as existing `||`), then `xor` at a lower precedence than
`or`. Same-level operators associate left; parentheses can override grouping.
Verify these claims against the pinned parser/lexer and controlled full-engine
observations before implementation. If those sources disagree, stop and
correct the proposed tree before coding; do not guess from recorder acceptance.

The hand-authored tree for:

```smarty
{if $a and $b or $c}Y{/if}
```

must make the outer operator `or`, with an inner `and` binary node on the left:

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (binary_expression
        left: (variable name: (identifier))
        operator: (word_operator)
        right: (variable name: (identifier)))
      operator: (word_operator)
      right: (variable name: (identifier))))
    (text)
    (if_close_tag)))
```

For `{$a xor $b or $c}`, the outer operator is `xor` and its right child is
`$b or $c`. Assert exact text/ranges for all operators in both trees.

## Failing-first fixtures and acceptance evidence

Before grammar changes, add expected trees and Node tests for:

1. Each alias independently, same-level left association, mixed
   `and`/`or`, mixed symbolic/word `&&`/`and` and `||`/`or`, and parentheses
   that change grouping.
2. The precedence boundaries `and` > `or` and `or` > `xor`, with exact
   operator-field and child structure. Include an XOR-vs-AND mixed fixture to
   confirm the lower `xor` placement against the shared expression ladder.
3. Outputs, `if` and `elseif` conditions, generic-tag positional and attribute
   values, call arguments, array values, and parenthesized modifier arguments.
   The goal is composition in existing full-expression contexts, not new
   contexts or tag-specific semantics.
4. Uppercase/mixed-case tokens, LF/CRLF spacing, variable boundaries, and
   strings/comments containing operator words. Invalid adjacency such as
   `{$a and$b}` must remain an error if confirmed by the pinned lexer/compiler.
5. Missing right operands and malformed combinations; following independent
   comments, block closers, and outputs remain navigable.
6. A full incremental-vs-fresh snapshot sequence that changes one valid
   operator boundary (for example `and` to `or`, then restores it) in a nested
   expression. Also cover a malformed missing-operand state and repair if it
   reveals a distinct recovery risk.

Use `fixtures(filename)` for recorder comparisons, and preserve its known limit:
events do not validate operator node structure, precedence, or runtime values.
Add controlled full-engine probes that distinguish the adjacent precedence
levels and parentheses. At minimum verify:

```smarty
{if true or false and false}T{else}F{/if}   {* T: and binds more tightly *}
{if 1 xor 0 or 1}T{else}F{/if}             {* F: or binds more tightly *}
{if (1 xor 0) or 1}T{else}F{/if}            {* T: parentheses override *}
{if 0 and 0 xor 1}T{else}F{/if}            {* T: and binds more tightly *}
```

Never run arbitrary application templates through the full engine. A PHP
adapter failure such as `spawnSync php EPERM` is an environment failure, not an
acceptance exception. Completion requires a supported execution route for the
recorder checks, controlled full-engine probes, and `npm test`; do not skip or
claim the independent checks.

Run `npm test`, save hash-matched reports for application, upstream Smarty
core, and upstream demo roots separately outside `build/`, inspect newly clean
application trees, and report remaining errors/regressions. The full acceptance
gate and independent implementation review are required before marking complete.

## Implementation evidence (2026-10-03)

The implementation adds case-insensitive binary `and`, `or`, and `xor` to the
shared expression ladder. Each produces `binary_expression` with `left`, an
exact-range `operator: (word_operator)`, and `right`. `and` shares the `&&`
level, `or` shares `||`, and `xor` binds below `or`. Parentheses and left
association are retained. A stateless external scanner recognizes the three
whitespace-delimited words; it skips the required leading gap for token-range
purposes and marks the token end after the letters, then checks trailing
whitespace. Existing scanner serialization state is unchanged.

Hand-authored fixtures cover each alias, left association at each level,
`and`/`or` and `or`/`xor` precedence, `and`/`xor` composition, mixed symbolic
and word operators, parentheses, output and condition trees, generic-tag
positional/attribute values, calls, array values, and parenthesized modifier
arguments. Node assertions check the exact operator spelling/ranges alongside
the `and`/`or` and `xor`/`or` outer and inner tree fields, and exercise word
operator composition in an `elseif` condition. They preserve bare
variables, calls, tag identifiers, strings, comments, CRLF spacing, and invalid
right adjacency. A controlled Smarty 5.8.4 full-engine set returns `TFTT` for
the four precedence probes above. Missing operands retain independent comments,
outputs and the block closer; changing `and` to `&&` and back, and deleting and
repairing the operand, match fresh full snapshots.

`npm test` passes: 288/288 Tree-sitter cases, 408/408 Node/reference/edit checks,
and all 18 deliberate mutations were caught. `check:grammar` passes. The
operator scanner adds no serialized state. During implementation, direct
internal word-token alternatives changed three legacy recovery trees; the
external scanner route preserves them. The final parser hash is
`0f6fca2dfda6739cbfc6fbb417b6fdc961b23d9e395240c3c0d085df6b432ec0`, matching
the `grammarSha256` in all three after reports below.

The Task 031 before reports use parser hash
`cfd11f02eca81aaafb63046f812091a98fa77e10b98e1a0840b24171a0824454`. Before
and after reports have identical file hashes within every corpus root:

| Corpus root | Clean before → after | Remaining errors | Report |
| --- | ---: | ---: | --- |
| Application (467 files) | 456 → 457 | 10 | `/tmp/smarty-task032-after-application.json` |
| Smarty upstream core (33 files) | 29 → 29 | 4 | `/tmp/smarty-task032-after-upstream-core.json` |
| Smarty upstream demo (1 file) | 0 → 0 | 1 | `/tmp/smarty-task032-after-upstream-example.json` |

There were no clean-to-error regressions. The newly clean application template
`view_ajax/group_browse_dialog.tpl` was structurally inspected: it contains
seven `binary_expression` nodes, including an explicit `or` operator node at
the expected source range; no syntax was swallowed as text. Remaining corpus
errors are unchanged or unresolved and continue to represent project gaps.

The malformed `{$aand $b}` negative case was removed after the pinned recorder
accepted it through Smarty's expression-plus-positional-argument route; `$aand`
is retained as one variable in output. The required malformed-right-spacing
cases (`{$a and$b}`, `{$a or$b}`, `{$a xor$b}`) remain rejected by both parser
and recorder. No existing expected trees were changed. Independent
implementation review accepted the completed task on 2026-10-03 after checking
precedence trees, `elseif` composition, ranges, scanner behavior, the full
acceptance gate, corpus reports, and the newly clean template structure.

This task owns `and`, `or`, and `xor` only. Task 031 owns unary `not` only;
the tasks are sequential because both extend the same expression ladder and
the binary precedence evidence composes with the established prefix node. The
failed combined task's proposed optional trailing `not` positional argument on
`if`/`elseif` is not part of either operator task. If that compiler-accepted
tag-argument form is promoted, a separate tag-argument task must establish its
tree and recovery contract before grammar work.
