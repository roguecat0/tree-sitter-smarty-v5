# 036 — Optional `@` modifier prefix

**Status:** complete; independent implementation review accepted.
**Type:** standard Smarty 5 modifier syntax.
**Depends on:** [017 static modifier arguments](017-static-modifier-arguments.md).

## Corpus motivation and pinned Smarty evidence

The hash-matched Task 034 application report uses parser SHA-256
`1eb5a5ddf5dc7750fc8bf7a250f27fc695c34432baecd49bec08c3bcb119677d` and has
461/467 clean files. `view_stats/charts.tpl` has four parse errors at modifier
uses such as `{$xlabel_string|@ucfirst}` and `{$ylabel_string|@ucfirst}`.
The same error pattern repeats at lines 178, 196, 318, and 335; the current
parser errors over the output rather than preserving its modifier structure.

Pinned Smarty 5.8.4 confirms that this is syntax acceptance, not an application
runtime claim. `vendor/smarty/smarty/src/Lexer/TemplateLexer.plex:317` defines
`vert` as `|` with an optional adjacent `@`, and
`vendor/smarty/smarty/src/Parser/TemplateParser.y:1214-1216` has a `VERT AT ID`
modifier production. These source rules permit the adjacent spellings `|@name`
and `|@@name`: in the latter, the optional `@` belongs to `VERT` and the second
`@` is `AT`. The recording compiler accepts both `{$x|@ucfirst}` and
`{$x|@@ucfirst}` without error and records modifier name `ucfirst`. It does not
resolve or execute the modifier. It rejects `{$x| @ucfirst}` because whitespace
separates `|` and the first `@`; that observation does not define the boundary
for adjacent `@@`.

## Bounded scope and tree contract

Within existing modifier expressions, accept the pinned adjacent forms
`|@name` and `|@@name`. Preserve the existing tree shape and modifier-name
field; the pipe and one or two `@` punctuation characters are anonymous and do
not create nodes. In both spellings, the modifier name excludes the `@` signs:

```smarty
{$x|@ucfirst}
```

```text
(source_file
  (output value: (modifier_expression
    value: (variable name: (identifier))
    name: (identifier))))
```

The same hand-authored tree is required for `{$x|@@ucfirst}`: it contains one
modifier named `ucfirst` and no named node for either `@`. Assert exact
zero-based, end-exclusive source ranges in the Node checks. For `{$x|@ucfirst}`,
the `@` range is `[4, 5)` and modifier-name `identifier` range is `[5, 12)`;
the complete `modifier_expression` range is `[1, 12)`. For
`{$x|@@ucfirst}`, the `@@` range is `[4, 6)`, the name range is `[6, 13)`, and
the complete `modifier_expression` range is `[1, 13)`.
Preserve argument fields and chained-modifier structure when either spelling is
present. Do not infer whether a modifier is registered, executable, or supplied
by an application plugin. This task does not add tag-name modifier lists or
change other modifier grammar.

The required accepted contexts for this bounded task are output values and
generic-tag named attribute values. The existing `modifier_expression` is also
reachable through shared expressions in assignment RHS values, `if`/`elseif`
conditions, `foreach` sources, generic-tag positional arguments,
function/method arguments, `for` bounds/conditions/initializers/updates,
section loop values, modifier inputs, bracket-index expressions, and array
values. Parenthesized expressions also make it reachable in modifier arguments
and array keys. Prefix support in all of those contexts remains unverified
project work; this brief does not claim or require it. Modifier-input chaining
in fixture 2 is a mandatory tree-composition check, not a claim about all
contexts.

## Failing-first fixtures and checks

Before grammar changes, add the expected tree and a failing Node check. Cover:

1. `{$x|@ucfirst}` and `{$x|@@ucfirst}` each have the explicit tree above and
   exact range assertions. Load both with `fixtures(filename)`; the recording
   compiler must observe one `ucfirst` modifier event followed by output for
   each spelling.
2. `{$x|@default:label|escape:'html'}` retains existing argument and chain
   fields. Its hand-authored expected tree is:

   ```text
   (source_file
     (output value: (modifier_expression
       value: (modifier_expression
         value: (variable name: (identifier))
         name: (identifier)
         argument: (identifier))
       name: (identifier)
       argument: (string))))
   ```

   Also include the parenthesized compound form
   `{($x + $y)|@default:label|escape:'html'}`. Its full tree must retain the
   parentheses and both operands beneath the inner modifier, while keeping the
   same inner `default` identifier argument and outer `escape` string argument:

   ```text
   (source_file
     (output value: (modifier_expression
       value: (modifier_expression
         value: (parenthesized_expression
           (binary_expression
             left: (variable name: (identifier))
             right: (variable name: (identifier))))
         name: (identifier)
         argument: (identifier))
       name: (identifier)
       argument: (string))))
   ```

   Assert exact field ownership, nesting, and source ranges in both trees; the
   `@` belongs to the inner `default` modifier, not the outer chain node.
3. **Mandatory composition case:**
   `{widget value=$x|@escape:'html'}` retains a generic tag with a `value`
   attribute whose value is a complete `modifier_expression`. The recorder
   checks generic-tag and modifier event order/count. This establishes the
   required generic-tag attribute context without changing custom-tag
   recognition or claiming plugin execution. Its hand-authored expected tree is:

   ```text
   (source_file
     (custom_tag
       name: (identifier)
       (attribute name: (identifier)
         value: (modifier_expression
           value: (variable name: (identifier))
           name: (identifier)
           argument: (string)))))
   ```
4. Ordinary `{$x|ucfirst}` remains the same tree. `{$x| @ucfirst}{$after}` is
   rejected by the reference compiler, has a real parser error, and retains
   `{$after}` as an independent sibling. Do not infer the adjacent `@@`
   boundary from this whitespace-separated rejection.
5. Compare full incremental snapshots with fresh parses after each edit from
   `|ucfirst` to `|@ucfirst`, to `|@@ucfirst`, back to `|@ucfirst`, and back to
   `|ucfirst`; also insert and remove whitespace between `|` and `@`. Include a
   malformed prefixed modifier plus a later output if the recovery shape could
   otherwise hide loss of that sibling.

The creation review should confirm the pinned compiler observation for both
adjacent spellings and the exact ranges above before implementation begins.

## Task-creation review disposition

Independent task-creation review accepted on 2026-10-04 after two revision
rounds. The reviewer verified the application witness and minimized reference
observations for `|@name`, `|@@name`, generic-tag named-attribute composition,
and the whitespace rejection boundary. The revised brief supplies literal
trees for both output prefixes, modifier chains, a parenthesized compound
input, and named-attribute composition; exact ranges and the division between
required and still-unverified contexts are explicit. `docs/composition.md`,
`docs/features.md`, and `test/CONTRACT.md` agree with the accepted scope.

Use `fixtures(filename)` for reference comparisons. The recording compiler
establishes modifier name/event order only; it does not establish runtime
availability or behavior. Preserve parse structure with hand-authored trees.
Run `npm test`, then preserve separate hash-matched corpus reports for the
application, upstream Smarty core, and upstream demo. Inspect any newly clean
application tree and regressions before independent implementation review.

## Implementation evidence — 2026-10-04

Implementation adds an anonymous adjacent modifier-prefix token for `|@` and
`|@@`, while keeping ordinary `|` separate so the token cannot take precedence
over logical `||`. No scanner change was needed. The named modifier remains an
`identifier`, and the prefix characters remain anonymous punctuation.

Fail-first evidence: before the grammar edit,
`node --test test/modifier-at-prefix.test.mjs` failed on the required prefixed
outputs, chain, parenthesized compound input, named attribute, ranges and
incremental valid-prefix states. The ordinary modifier, whitespace rejection,
and malformed-prefix recovery checks passed against the old grammar. After the
change, the focused test passed **12/12**.

Acceptance gate: `npm test` exited 0. It regenerated and rebuilt the parser,
passed TypeScript grammar checking, **313/313 expected trees**, **450/450 Node
checks**, and **18/18 mutation checks**. Full log:
`/tmp/smarty-task036-final-npmtest.log` (SHA-256
`740974491274d887188410f1cd7e9b4113161c4152c5ab62c9609e767c3c1fd0`).

The before reports were preserved from the fresh Task 035 candidate at parser
SHA-256 `f079098a039888e1603f7bd58edc7d3768c957ca2510d64ff0fea74123746262`.
Separate after reports use parser SHA-256
`a19d801912567f8119eaae4e98ea5ecddad0fe279bc311f52b5b2ace0855ff15`:

| Corpus | Before | After | Transitions |
| --- | ---: | ---: | --- |
| Application | 461/467 clean | 462/467 clean | `view_stats/charts.tpl` newly clean; no regressions |
| Upstream Smarty core | 31/33 clean | 31/33 clean | No newly clean files or regressions |
| Upstream Smarty demo | 0/1 clean | 0/1 clean | No newly clean files or regressions |

After report paths and SHA-256 values:

- Application: `/tmp/smarty-task036-application.json`,
  `0234bb439ae30273c20cc828be552f3bb97d2abf7dda94ead2f9f62c880fd407`.
- Upstream core: `/tmp/smarty-task036-upstream-core.json`,
  `5de06a29b9efcd7640102f932d290245ca86edbf8bce8247237bacd832b18a7f`.
- Upstream demo: `/tmp/smarty-task036-upstream-demo.json`,
  `5fc794fb8485460b08cd6465ed063c15b30ae05e30587f6ab8f75445f0551a2b`.

The newly clean `view_stats/charts.tpl` tree was inspected. It has 18 text
nodes, 11 output nodes, and three `foreach` blocks, and the four former error
sites are explicit `modifier_expression` nodes
(lines 178, 196, 318, and 335). Each has `value` equal to `$xlabel_string` or
`$ylabel_string`, `name` equal to `ucfirst`, and the original source range; none
of the four expressions was swallowed as text. The four parser ranges are
columns 33–56 on their respective lines. This confirms the corpus gain is
structural. Five application files still have parse errors; the two upstream
core failures and the one upstream demo failure remain separate gaps.

Hashes for the candidate sources are `grammar.js`
`d8514ed0cc574f80ac659597b99e9d7527ce5fe98e51c0d8189ea37c8119ae29`,
`src/parser.c`
`a19d801912567f8119eaae4e98ea5ecddad0fe279bc311f52b5b2ace0855ff15`, and
unchanged `src/scanner.c`
`e51fc878261d88ed866b8df41d32595b16618a790889e8d58e2992b5cbfc6431`.
Generated parser changes were produced only by `tree-sitter generate` through
the project scripts. The independent completion reviewer reran the gate,
verified the evidence and all scoped requirements, and accepted the candidate
with no actionable findings. This evidence does not claim modifier
runtime/plugin support or prefix coverage in the remaining unverified contexts.

## Implementation-review disposition

Independent implementation review accepted on 2026-10-04 with no actionable
findings. The reviewer reproduced `npm test`, verified the two adjacent prefix
forms and their ranges, composition and reference checks, whitespace and
malformed recovery, sibling retention, incremental edits, generated-source
hashes, separate same-source corpus reports, and the structure of the newly
clean `view_stats/charts.tpl` file.

## Remaining gaps

The four application occurrences establish practical impact. This task adds
the confirmed adjacent `@` and `@@` spellings only to the named output and
generic-tag attribute contexts. Modifier execution, application plugin
availability, tag-name modifier lists, and the other unverified
modifier-expression contexts remain separate project gaps.
