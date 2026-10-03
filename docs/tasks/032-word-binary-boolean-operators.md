# 032 — Word binary boolean operators

**Status:** brief accepted; queued for implementation after Task 031. Its
scope, Smarty precedence probes, tree contract, and recovery cases received
independent task-creation review. Both tasks use the shared expression ladder.
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
acceptance exception. The task remains blocked until a supported execution
route runs the required recorder checks, controlled full-engine probes, and
`npm test`; do not skip or claim the independent checks.

Run `npm test`, save hash-matched reports for application, upstream Smarty
core, and upstream demo roots separately outside `build/`, inspect newly clean
application trees, and report remaining errors/regressions. The full acceptance
gate and independent implementation review are required before marking complete.

## Handoff decision

This task owns `and`, `or`, and `xor` only. Task 031 owns unary `not` only;
the tasks are sequential because both extend the same expression ladder and
the binary precedence evidence composes with the established prefix node. The
failed combined task's proposed optional trailing `not` positional argument on
`if`/`elseif` is not part of either operator task. If that compiler-accepted
tag-argument form is promoted, a separate tag-argument task must establish its
tree and recovery contract before grammar work.
