# 001 — Static configuration variables

Status: ready. Dependencies: initial baseline only.

## Scope and motivation

Add `#name#` expressions, including `{#name#}`, modifier input, and custom-tag
attribute values. Corpus evidence: `corpus/add_url_dialog.tpl` uses `{#name#}`
and `{#url#}`; `corpus/app_doc.tpl` uses `{#edit#|escape:"htmlall"}`. The initial
report finds this hint in 412 failing files. These examples need no application
plugins or loaded configuration values to recognize their syntax.

Exclude dynamic config names, indexing, configuration-file parsing, and runtime
lookup. Do not interpret a hash in ordinary text as a config variable.

## Proposed tree contract

Add `config_variable` to expressions, with a `name: (identifier)` field.
The surrounding `output` and `modifier_expression` shapes remain unchanged:

```text
{#title#}
(source_file (output value: (config_variable name: (identifier))))
```

## Acceptance work

- Add `test/corpus/config-variables.txt` with hand-authored trees for the example
  above, `{#title#|escape:'htmlall'}`, `{widget label=#title#}`, and a config
  variable in an if condition. Assert the name's exact source range and text.
- Confirm these forms with the recording reference; source productions are
  `configvariable` in `TemplateParser.y`. Do not require actual config values.
- Include ordinary `#title#` text outside tags, two adjacent outputs, and quoted
  hash text. Keep literal string contents distinct from config expressions.
- Reject a missing closing hash in output. Edit `{#title#}` to `{#title}` and back;
  incremental and fresh snapshots must match, including recovery state.
- Run `npm test` and before/after corpus reports. Inspect the now-supported
  snippet from `add_url_dialog.tpl`; do not require a fixed file-count improvement.

## Completion evidence (fill when implemented)

Expected-tree/reference/edit test paths; commands and results; report comparison;
remaining excluded forms; any contract correction supported by Smarty evidence.
