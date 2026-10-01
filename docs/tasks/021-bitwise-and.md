# 021 — Bitwise AND expressions

Status: complete (2026-10-01). Task creation owner: independent audit of the
fixed local corpus at parser hash
`c8da5c7adf026718e115c87a735e339d4df7ae22cef4c9633b3b5eb4627ca4f1` (HEAD
`f67941619b4dd62cbe6bec8acd07e2753bacee3c`). Dependencies: 005 symbolic
operators and 013 shared expression operators.

Implementation reviewer: accepted (`/root/task_impl_reviewer_021`).

## Motivation and corpus evidence

The supplied report `/tmp/smarty-020-dollar-opener-after.json` matches
`src/parser.c` exactly and covers the fixed 467 local templates: 416 parse
without errors and 51 have errors. Inspection of every failing file's earliest
error span identifies bitwise `&` conditions as the earliest root in 12 files:

`action_types/action_value_replace_part_request_dialog.tpl`,
`action_types/action_value_textbox.tpl`, `menu_button.tpl`,
`message_inline.tpl`, `messages_dialog.tpl`, `messages.tpl`, `overview_menu.tpl`,
`view_action/action_value_table.tpl`, `view_action/edit_action_value_dialog.tpl`,
`view_charts/team_tos_table.tpl`, `view_sap/request_dialog.tpl`, and
`view_to/to_overview.tpl`.

Representative local source is
`action_types/action_value_replace_part_request_dialog.tpl:65`:
`{if $part_request->get_flags() & $smarty.const.REQUEST_FLAG_CREATE_TO}`.
These are 12 confirmed first-error contexts, not an estimate that implementing
`&` alone will clean all 12 files; later failures can remain. Other repeated
roots in this report include 10 `html_options` openings, four recursive include
attribute groups, two `{for}` loops, and two literal blocks. The separate
unquoted digit-prefixed variable form `{$5a}` is valid Smarty 5.8.4 syntax but
does not occur in the fixed corpus, so this task prioritizes the 12 directly
observed bitwise conditions.

## Pinned Smarty behavior

The pinned Smarty 5.8.4 lexer defines `MATH` to include `&`
(`vendor/smarty/smarty/src/Lexer/TemplateLexer.plex`, `math` rule near line
295), and the parser uses the general production
`expr ::= expr MATH value` (`vendor/smarty/smarty/src/Parser/TemplateParser.y`,
near line 645). This is an expression operator, not an `if`-only construct.
The recording adapter accepts each of these forms without syntax errors:

```smarty
{$a & $b}
{if $flags & $smarty.const.FLAG_OK}Y{/if}
{widget value=($a & $b)}
{$x|default:($a & $b)}
```

The recorder only projects output/tag/modifier events; it does not report the
operator tree or operand values. Full Smarty 5.8.4 compiles the controlled
output examples and renders `{5 & 3}` as `1`, `{5 + 2 & 3}` as `3`, and
`{5 & 3 + 1}` as `4`. In the discriminating condition
`{if 5 & 3 == 1}T{else}F{/if}`, Smarty renders `F`; if `&` bound before
equality, `(5 & 3) == 1` would render `T`. Its tree must therefore put the
equality expression on the right side of the `&` expression. These observations
establish that addition and equality bind more tightly than `&`, and the result
is a PHP-style bitwise operation. `&` binds more tightly than logical `&&`:
with `x=2` and `mask=2`, `{$x & $mask && 2}` renders `1`, consistent with
`(2 & 2) && 2`; if `&&` bound more tightly, the result would be
`2 & (2 && 2)`, or `0`. These values distinguish the two groupings because
the bitwise result is nonzero and the logical result is `true`. The trees
below define structure; these compiler results establish syntax and runtime
observations only.

## Scope and proposed tree

Add binary bitwise AND `&` to the existing expression ladder wherever the
current grammar accepts a full `_expression`. Do not add new expression
contexts. Give it a `binary_expression` node with `left`, `operator`, and
`right` fields, matching the existing operator contract. The operator field is
the exact anonymous `&` token. It binds less tightly than arithmetic,
relational, and equality operators, and more tightly than `&&` and `||`; chains
of `&` associate left. Parentheses can express explicit grouping. Both adjacent
and whitespace-separated spellings are valid per the pinned lexer.

Add this hand-specified output example to `test/corpus/bitwise-and.txt` before
grammar changes:

```smarty
{$a & $b}
```

```text
(source_file
  (output value: (binary_expression
    left: (variable name: (identifier))
    right: (variable name: (identifier)))))
```

Add these composition examples to the same tracked fixture, with manually
specified trees:

```smarty
{if $flags & $smarty.const.FLAG_OK}Y{/if}
```

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (variable name: (identifier))
      right: (index_expression
        object: (index_expression
          object: (variable name: (identifier))
          index: (identifier))
        index: (identifier))))
    (text)
    (if_close_tag)))
```

Use a second condition tree to make the equality boundary explicit:

```smarty
{if 5 & 3 == 1}T{else}F{/if}
```

```text
(source_file
  (if_block
    (if_tag condition: (binary_expression
      left: (number)
      right: (binary_expression
        left: (number)
        right: (number))))
    (text)
    (else_clause (else_tag) (text))
    (if_close_tag)))
```

In the Node test, assert the outer condition's `operator` field is `&`, its
`right` child is a `binary_expression`, and that child's `operator` field is
`==`. The full engine must render `F`; this distinguishes Smarty's actual
grouping from `(5 & 3) == 1`.

```smarty
{widget value=($a & $b)}
```

```text
(source_file
  (custom_tag
    name: (identifier)
    (attribute
      name: (identifier)
      value: (parenthesized_expression
        (binary_expression
          left: (variable name: (identifier))
          right: (variable name: (identifier)))))))
```

```smarty
{$x|default:($a & $b)}
```

```text
(source_file
  (output value: (modifier_expression
    value: (variable name: (identifier))
    name: (identifier)
    argument: (parenthesized_expression
      (binary_expression
        left: (variable name: (identifier))
        right: (variable name: (identifier)))))))
```

The renderer/compiler checks must include the precedence examples above and a
condition evaluation using real values. The Node test must assert exact
operator field text and range, left associativity, the equality/logical
boundaries, and reference acceptance for the fixtures. Also assert that in
`{if 5 & 3 < 2}T{else}F{/if}` the relational comparison is the bitwise
expression's right child; the pinned full compiler renders `F`, unlike the
grouping `(5 & 3) < 2`. The anonymous operator token does not appear in
Tree-sitter's S-expression trees. Do not rely on the recorder to validate
operand values or precedence.

## Negative, recovery, and edit checks

Keep `&` a required binary operator: malformed sources must remain errors, and
the neighboring comment, text and later output must be recovered as separate
nodes. Add these exact manual recovery trees before grammar changes.

```smarty
before {$a &} {* keep *} after {$later}
```

```text
(source_file
  (text)
  (output
    value: (binary_expression
      left: (variable name: (identifier))
      right: (boolean (MISSING "true"))))
  (text)
  (comment)
  (text)
  (output value: (variable name: (identifier))))
```

The pinned Smarty 5.8.4 recording parser and full compiler reject the incomplete
output at `}` with `Unexpected "}"`. Tree-sitter's generic expression recovery
inserts a missing `true` boolean as the required right operand; the binary
expression remains under the first output and keeps `$a` as its left operand.
The missing node marks the tree erroneous. The comment, intervening text, and
final output `$later` remain separate siblings outside that missing node. Assert
this exact tree and the surrounding node types and source text. This is the same
local missing-boolean recovery used for an incomplete `&&` expression. A custom
output-only `ERROR` production would replace shared-expression recovery with a
context-specific rule without preserving a more useful operand structure, so
the generic local recovery is the contract.

```smarty
before {if $a &}bad{/if} after {$later}
```

```text
(source_file
  (text)
  (if_block
    (if_tag
      condition: (binary_expression
        left: (variable name: (identifier))
        right: (boolean (MISSING "true"))))
    (text)
    (if_close_tag))
  (text)
  (output value: (variable name: (identifier))))
```

The pinned Smarty 5.8.4 recording parser and full compiler also reject the
incomplete condition at `}` with `Unexpected "}"`. Tree-sitter inserts a
missing `true` boolean as the required bitwise right operand, local to the
condition. Assert this exact recovery tree, that the independent `{/if}` still
closes the block, and that the later output remains outside it. Include an
incremental edit that removes and restores the right operand in a nested
condition, comparing the repaired incremental tree with a fresh parse. Verify
ordinary text and HTML ampersands remain text; this task must not capture `&`
outside an active Smarty expression.

## Explicit exclusions and inventory effects

This task adds only binary `&`. Smarty's `MATH` lexer also recognizes `**`,
`^`, and shifts `<<`/`>>`; those remain separate practical expression gaps and
must stay visible in the inventory. Logical `&&`/`||` retain their existing
meaning, and `xor` or other word aliases are not added. A single `&` remains
unsupported as a unary operator. This scope does not enable bare identifiers
as general operands; use currently supported values such as variables, calls,
class constants, or parenthesized expressions.

The shared-expression contexts proposed for review are output, `if` condition,
generic-tag attribute value, and parenthesized modifier argument. Unparenthesized
modifier arguments keep their existing narrow boundary. The corpus only proves
the 12 condition roots; the other contexts are included to prevent a condition-
only implementation of a general expression operator.

## Failure-first check and handoff

Before implementation, add the manual trees above and a Node check that parses
`{$a & $b}`, checks `reference(...).error === null`, and asserts a clean parse.
The parser assertion was expected to fail against the baseline. The controlled
full-engine precedence/evaluation checks are in the same Node test. Expected
trees were authored from this brief, not generated from parser output. The
expression-composition checklist, feature inventory, and contract are
synchronized with the accepted implementation evidence.

## Reviewed implementation evidence

The implementation adds a left-associative shared-expression layer between
logical `&&` and equality. It produces the existing `binary_expression` node
with exact anonymous `&` operator token and `left`/`right` fields. It changes no
expression contexts and adds no operand forms. The six hand-authored fixture
trees cover output, a condition, relational/equality precedence, generic-tag
attribute value, and parenthesized modifier argument. Node checks additionally
assert operator ranges for adjacent and separated spellings, left associativity,
the equality and logical boundaries, Smarty reference acceptance, controlled
full-engine evaluation, malformed recovery locality, non-expression ampersand
text, and an incremental nested-condition edit.

The original proposed malformed `(ERROR)` trees did not match Tree-sitter's
generic recovery. With `$a &}` Tree-sitter retains a `binary_expression` with
left `$a` and a missing `true` boolean as its right child; the missing token
marks the containing tree erroneous. This is also the existing behavior for
incomplete `$a &&}`. The tracked Node checks assert both exact recovery trees,
including comment/text, independent `{/if}`, and later `{$later}` siblings.
Pinned Smarty 5.8.4's recorder and compiler reject both controlled malformed
sources at `}` with `Unexpected "}"`. A context-specific output/condition
`ERROR` production was not added because the generic recovery already stays
local and retains the operator/left operand structure shared by all expression
contexts.

`npm test` passed after regeneration and native rebuild: 91 Tree-sitter corpus
cases, 289 Node checks, and all 14 isolated mutation checks. The existing
logical-operator mutation anchor was adjusted from the old `_equality` right
rule to the new `_bitwise_and` right rule; the same swapped-operator bug is
still generated and caught.

The hash-matched corpus reports are `/tmp/smarty-021-before.json` and
`/tmp/smarty-021-after.json`. Both cover the same 467 source hashes. Clean files
rose from 416 to 428; failing files fell from 51 to 39, with no regressions.
The generated parser SHA-256 changed from
`c8da5c7adf026718e115c87a735e339d4df7ae22cef4c9633b3b5eb4627ca4f1` to
`95573b2032d5c0621d34d59f35e061ee6137333c07e96031e4936ffe0468e6d4`.
Every one of the 12 newly clean files listed in the motivation was structurally
inspected. The 31 relevant binary-expression nodes all retain method/property
calls on the left and either config-index or class-constant expressions on the
right; they are not absorbed into text. The 39 remaining failing files remain
visible completeness gaps and were not examined as part of this bounded task.

The pinned compiler does not verify Tree-sitter fields; the recording adapter
cannot report operand trees, precedence, or runtime values. The manual trees
and controlled full-engine examples cover those separate claims. Other Smarty
math operators `**`, `^`, `<<`, and `>>`, as well as unverified bitwise
contexts, remain follow-up gaps.
