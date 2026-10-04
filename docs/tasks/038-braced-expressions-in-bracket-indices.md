# 038 — Braced expressions in bracket indices

**Status:** complete; implementation independently reviewed and accepted.
**Type:** standard Smarty 5 expression/index syntax.
**Depends on:** [007 dot and bracket access](007-index-access.md), [010 array literals](010-array-literals.md), [011 standalone function calls](011-standalone-function-calls.md), [019 static class method calls](019-static-class-method-calls.md), and [030 section indices](030-section-blocks-and-indices.md).

## Corpus motivation and pinned Smarty evidence

The committed Task 037 application report is
`/tmp/smarty-task037-application.json`, with parser SHA-256
`c52801d865597617f7e9502a44408383c6b0559e9ed5be638b53be2f5f728ffd`. It
matches `src/parser.c` and reports 463/467 clean files. Two failing files have
four errors caused by nested curly expressions inside ordinary square-bracket
indices:

- `view_admin/module_types/search_module_type.tpl:45-46`, including
  `{$fb_follow_up_groups[$module_type->get_id()][{$smarty.const.FB_FOLLOW_UP_REPAIR}]|escape}`;
- `view_admin/name_list/search_name_list.tpl:54-55`, including
  `{$fb_follow_up_groups[{$name_list->get_artikel_nr()}][{$smarty.const.FB_FOLLOW_UP_REPAIR}]|escape}`.

The two corpus source hashes are respectively
`aa3fe69fe754afd798fe4b1360f0c7c8178c7c6e8d2178025e19619ceaf31296` and
`0425f6255685c36153fe1062b2ec4d6504094157434013331e3c47eae02ac576`; they
match the files inspected for this draft.

The current parser independently reproduces the failure for the minimized
`{$a[{$x}]}` and loses the enclosing output/index shape. The neighboring
non-braced control `{$a[$x]}` has the existing structured `index_expression`
tree.

Pinned Smarty 5.8.4 confirms acceptance. `TemplateParser.y:1014-1015` accepts
`OPENB expr CLOSEB`, while `varvarele ::= LDEL expr RDEL` at lines 1054-1060
confirms curly-delimited expressions are a parser construct. The recording
adapter accepts braced variable, method-call, config-constant, arithmetic,
modifier, and function-call forms inside brackets, and accepts repeated
braced indices and the generic-tag attribute composition. Probes include
`{$a[{$x}]}`, `{$a[{$o->get_id()}]}`,
`{$a[{$smarty.const.FOO}]}`, `{$a[{$x + 1}]}`, `{$a[{$x|escape}]}`,
`{$a[{strlen($x)}]}`, `{$a[{$x}][{$y}]}`, and
`{widget value=$a[{$x}]}`. Smarty accepts outer bracket spacing in
`{$a[ {$x} ]}` but rejects inner-leading whitespace in `{$a[{ $x}]}` with
`Unexpected " "`. The full engine in compile-only mode accepts the
output probes without compiler errors. Its unknown-tag behavior cannot verify
the `{widget}` attribute; that form is recorder evidence only. The adapter
emits an `output` event for each inner braced construct, but it does not expose
index value ownership or runtime semantics. Hand-authored trees below define
the intended ownership; no runtime value equivalence is claimed.

The related application condition
`{if {$sub_repair->get_attachments()->count()}>0}` in
`view_certificate/actions_list.tpl:41` is accepted by both the pinned recorder
and full engine in compile-only mode.
It is not included here: the braced expression occurs in an `if` header, where
condition ownership, condition-following operators, block recovery, and the
known block closer form a separate grammar boundary. Track it as queued Task
039; do not describe it as Smarty-invalid or as intentionally out of project
scope. The array addition in `view_orders/new_article.tpl:5` is an unrelated
expression-composition gap, queued as Task 040, and is also excluded.

## Bounded scope and tree contract

Within a variable or config-variable bracket index, accept a complete Smarty
expression delimited by `{` and `}`. Preserve the existing `index_expression`
with receiver in `object` and bracket content in `index`; represent the inner
braces with a nested `output` whose `value` is the complete expression. The
braces are anonymous punctuation, and do not become a second template-level
output sibling.

For `{$a[{$x}]}`, the hand-authored target is:

```text
(source_file
  (output value: (index_expression
    object: (variable name: (identifier))
    index: (output value: (variable name: (identifier))))))
```

The bracket access remains left-nested. For
`{$rows[$row->get_id()][{$smarty.const.FB_FOLLOW_UP_REPAIR}]}`, the second
index owns the wrapped config constant and the first remains the receiver:

```text
(source_file
  (output value: (index_expression
    object: (index_expression
      object: (variable name: (identifier))
      index: (method_call_expression
        object: (variable name: (identifier))
        method: (identifier)))
    index: (output value: (index_expression
      object: (index_expression
        object: (variable name: (identifier))
        index: (identifier))
      index: (identifier))))))
```

The nested `index_expression` for `$smarty.const.FB_FOLLOW_UP_REPAIR` follows
the existing config-variable representation; its `object` is the `$smarty`
variable indexed by `const`, then by the constant name. The wrapper's full
source range includes its braces; `output.value` excludes them. Assert exact
zero-based, end-exclusive ranges for wrapper, value, receiver and index, and
that each node's source slice is correct. `object`/`index` fields and left
nested receiver ownership must be explicit.

For the first fixture `{$a[{$x}]}`, the exact ranges are: outer `output`
`[0,10)`, its `index_expression`/`output.value` `[1,9)`, receiver `$a`
`[1,3)`, nested `output` in `index` `[4,8)`, and its variable value `$x`
`[5,7)`. The direct control `{$a[$x]}` keeps output `[0,8)`, index
expression/value `[1,7)`, receiver `[1,3)`, and direct index variable `[4,6)`.

This wrapper is supported for the full currently supported expression grammar,
not just variables/config constants. At minimum preserve method calls,
arithmetic precedence, and a modifier expression in dedicated trees. Exercise
it as an output value and as a generic-tag attribute value so unknown tag names
and `attribute.value` retain the full structure. Do not add an application-tag
allowlist or use a broad text fallback. Ordinary `$a[$x]` remains an
`index_expression` with a direct variable in `index`, without an output
wrapper. Preserve static, numeric, section, config and dynamic-dot indexing,
index receiver restrictions, and all existing left nesting.

## Failing-first fixtures and checks

Before grammar edits, add manually authored expected trees and a failing Node
check. Keep rejected/recovery cases in a dedicated Node check or a separate
Tree-sitter fixture so the ordinary `fixtures(filename)` format remains valid.

1. Add `{$a[{$x}]}`, outer-spacing variant `{$a[ {$x} ]}`, and direct control
`{$a[$x]}` with hand-authored trees and field/range assertions. The braced
forms have one template-level `output` node; the inner wrapper is only the
`index` field value. In the outer-spacing variant the target shape is unchanged
and ranges must account for the exact spaces: outer `output` `[0,12)`, its
`index_expression`/`output.value` `[1,11)`, receiver `$a` `[1,3)`, nested
`output` in `index` `[5,9)`, and its variable value `$x` `[6,8)`. Use
`fixtures(filename)` to check positive cases against the pinned recording
adapter. The recorder's inner `output` event is not evidence of `index` field
structure.
2. Preserve composition and left nesting with
`{$rows[$row->get_id()][{$smarty.const.FB_FOLLOW_UP_REPAIR}]|escape}`. Require
the outer modifier's `value` to be the final `index_expression`; its receiver
must remain the preceding method-index expression, and the second index must
be `output(value: index_expression(...))` with the config constant's current
tree. Also cover an arithmetic wrapped index (for example
`{$rows[{$i + 1 * 2}]}`) and a wrapped modifier or function call. Assert
operator precedence and complete fields/ranges, not only named-child counts.
Also cover nested bracket composition such as `{$matrix[{$rows[{$i}]}]}`:
each bracket access must own its own `index`, each braced index must own one
`output` wrapper, and the receiver chain must remain left-nested.
3. Cover unknown-tag attribute composition:
`{widget value=$rows[{$row->get_id()}]}{$after}`. Require the generic tag,
attribute name/value, receiver, method call, and separate trailing output.
Use recorder assertions only for accepted tag/argument event order and counts.
No custom-tag name list is allowed.
4. Promote minimized application-shaped examples without application names:
`{$groups[$row->get_id()][{$smarty.const.REPAIR}]|escape}` and
`{$groups[{$row->get_article_number()}][{$smarty.const.REPAIR}]|escape}`.
The explicit trees must retain method calls / config-constant structure,
modifier nesting, both bracket accesses, and exact left-to-right source order.
5. Pin Smarty's rejection of malformed bracket/brace boundaries, including
`{$a[{$x]}` (the recorder and full compiler report an unexpected `]`, expecting
the inner `}`) and inner-leading whitespace `{$a[{ $x}]}` (both report
`Unexpected " "`). Keep malformed cases out of the positive `fixtures()`
format. For parser recovery, require a real error and following output or
block closer as separate navigable nodes. The whitespace error case should
include `{$after}` and preserve it as a separate output.

   Smarty rejects `{$a[{$x}}{$after}` with `Unexpected "}"`: the `]` is
   missing, while the inner and outer curly braces are present. This is a
   standalone missing-bracket case, distinct from the combined missing-`]` and
   missing-outer-`}` case below. **Recovery-contract correction:** the
   implementation owner reports this observed tree, which replaces the prior
   proposed retained-`index_expression` shape. The localized `ERROR` contains
   the receiver variable followed by the inner braced `output`; the later
   `{$after}` remains a separate error-free output:

   ```text
   (source_file
     (ERROR
       (variable name: (identifier))
       (output value: (variable name: (identifier))))
     (output value: (variable name: (identifier))))
   ```

   Require the exact local `ERROR` boundary and child order: its source text is
   `{$a[{$x}}`, followed by the separate `{$after}` output. Do not accept the
   malformed form as valid or flatten its inner expression to text.

   Separately, for the combined case
`{if true}{$a[{$x}{/if}{$after}`, require an `if_block` with children
`if_tag`, malformed output, and `if_close_tag`, plus root-level `{$after}`.
   **Recovery-contract correction:** for the combined malformed construct the
   implementation owner reports a localized `ERROR` containing the receiver
   variable followed by the inner braced `output`. The surrounding `if_block`,
   its `if_close_tag`, and root-level trailing output remain separate. Replace
   the earlier proposed retained-`index_expression` and missing-token shape
   with this exact observed tree:

   ```text
   (source_file
     (if_block
       (if_tag condition: (boolean))
       (ERROR
         (variable name: (identifier))
         (output value: (variable name: (identifier))))
       (if_close_tag))
     (output value: (variable name: (identifier))))
   ```

   Require this exact local `ERROR` boundary and child order: its source text
   is `{$a[{$x}`, followed by `if_close_tag` text `{/if}` and root-level
   `{$after}` output. This is a correction to the malformed-input recovery
   contract only; it does not weaken the valid syntax tree requirements above.

   Also cover the valid `{$a[{$x}]}{$after}` sibling boundary. A missing
   inner `}` and a missing `]` each need a focused parser case; assert that
   neither consumes the following independent output. The current baseline
   loses the enclosing output/index shape for these malformed forms, so these
   target trees intentionally require useful recovery improvement.
6. Test edits crossing both boundaries: start with `{$a[$x]}{$after}`, insert
the inner braces, edit the inner expression (variable to method or config
constant), remove `]` or the inner `}`, and repair. Compare full incremental
snapshots with fresh parses at each state, including following output.

Do not add/update generated sources by hand. Run `npm test` after implementation
and preserve hash-matched application and separate upstream reports outside
`build/`. Inspect all newly clean application trees, report remaining failures,
and do not claim corpus completion unless all errors are gone and newly clean
structures are reviewed.

## Implementation and evidence

The grammar accepts a complete braced expression as a bracket `index`, wrapped
in `output(value: expression)`. Direct indices retain their existing tree. The
wrapper is shared with braced generic-tag attribute values. Method/config
left-nesting, arithmetic precedence, modifier expressions, nested indices,
generic-tag attributes, source ranges, and incremental boundary edits are
covered by [manual trees](../../test/corpus/braced-bracket-indices.txt),
[pinned reference fixtures](../../test/corpus/smarty-reference-braced-bracket-indices.txt),
and [Node checks](../../test/braced-bracket-indices.test.mjs).

The scanner adds a scoped external opener token for `[`, lookahead whitespace,
and `{`. It ends the token at `[`, so outer bracket spacing remains skipped
whitespace and the nested output range starts at `{`. It only selects the
braced-index production when the next non-whitespace character is `{` and the
character after that is not Smarty whitespace or a comment opener. This keeps
direct `$a[$x]` on the existing production and rejects inner-leading whitespace
without widening ordinary bracket scanning. The scanner token is needed to
distinguish these forms while retaining the current extras and exact wrapper
ranges.

Pinned Smarty 5.8.4 rejects malformed boundary cases. Following the reviewed
recovery-contract correction, `{$a[{$x}}{$after}` has a localized root `ERROR`
whose children are the receiver variable and inner `output`, followed by a
separate clean `{$after}`. In `{if true}{$a[{$x}{/if}{$after}`, the same
localized error is a child of `if_block`; `if_close_tag` and the root-level
`{$after}` remain separate. A missing inner `}` retains a missing marker under
the nested output and preserves the following sibling. Inner-leading whitespace
is rejected, and the following output remains navigable. These exact checks are
in the Node test; the outer syntax probes are pinned to the recorder adapter.

`npm test` passes: grammar typecheck, 485/485 tests, and all 18/18 deliberate
grammar mutations caught. The test run regenerates and rebuilds generated
sources; they were not hand-edited.

The application report before this task is `/tmp/smarty-task037-application.json`
(parser SHA-256 `c52801d865597617f7e9502a44408383c6b0559e9ed5be638b53be2f5f728ffd`,
463/467 clean). After implementation,
`/tmp/smarty-task038-application.json` uses parser SHA-256
`f372ef95587e65541a71436966b1ca21fe3c381999dd2e2a41fc3bb4855db107` and reports
465/467 clean. The only two newly clean files are
`view_admin/module_types/search_module_type.tpl`
(`aa3fe69fe754afd798fe4b1360f0c7c8178c7c6e8d2178025e19619ceaf31296`) and
`view_admin/name_list/search_name_list.tpl`
(`0425f6255685c36153fe1062b2ec4d6504094157434013331e3c47eae02ac576`). Both
were structurally inspected: each retains the method/config index chain,
modifier and independent repair-constant output; neither tree has a parse
error. No previously clean application file regressed. The two remaining error
files are unchanged: `view_certificate/actions_list.tpl` has the separately
tracked braced-condition gap (Task 039), and `view_orders/new_article.tpl` has
the array-addition composition gap (Task 040). The application corpus is not
yet error-free.

Separate reports, each generated with the same parser hash, are
`/tmp/smarty-task038-upstream-core.json` (Smarty 5.8.4 core: 31/33 clean; the
same two existing failures) and
`/tmp/smarty-task038-upstream-demo.json` (Smarty demo: 0/1 clean; its existing
failure remains). These roots are reported independently and are not combined
with the application result.

## Task boundary and remaining gaps

This task is limited to a braced Smarty expression used as the contents of a
bracket index on already-supported variable/config receivers. It does not
change which receiver types may be indexed, add unsupported expression kinds,
or alter section-name/property indices, static/dynamic dot forms, assignment
targets, empty append indices, or bare identifier section keys. The standard
braced expression in an `{if}`/`{elseif}` condition remains a separate
confirmed gap requiring its own condition tree and block recovery contract
(queued Task 039). The array-addition expression in a generic-tag attribute
remains a separate standard expression-composition gap (queued Task 040). Both
remain project work.

## Task-creation review checklist

Verify that the parser/compiler probes use pinned Smarty 5.8.4, distinguish
syntax acceptance from generated-expression/runtime behavior, and confirm the
exact minimized application failures against the hash-matched corpus report.
Challenge whether nested `output` is the best tree wrapper and whether errors
preserve later output and a containing block closer. Confirm supported
expression varieties and reject any attempt to solve the failure with app
specific tags or swallowed text.
