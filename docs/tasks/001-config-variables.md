# 001 — Static configuration variables

Status: complete (2026-09-22). Dependencies: initial baseline only.

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

## Completion evidence

- [Manual trees](../../test/corpus/config-variables.txt) and
  [reference/range/recovery/edit checks](../../test/config-variables.test.mjs).
- `npm test` failed on all six new trees before implementation, then passed:
  15 trees, 27 Node checks, all 3 mutation checks. PHP subprocesses required an
  approved execution outside the local sandbox; no test bypass was added.
- `npm run corpus:report -- ./corpus /tmp/smarty-001-before.json` and the
  corresponding `/tmp/smarty-001-after.json`: identical hashes for all 467 files;
  6 → 13 clean, 461 → 454 failing; no clean-to-failing regressions.
  Reports stay local and temporary. Config node names were inspected in all
  seven newly clean files. `corpus/add_url_dialog.tpl:4-5` supplies the reduced
  adjacent `{#name#}{#url#}` outputs in the tracked boundary fixture.
- Smarty 5.8.4 accepts all fixture forms and rejects `{# title#}` and `{#title #}`.
  Immediate tokens enforce this observed boundary. Reference projection checks
  acceptance/events, not config values; explicit trees/ranges check structure.
- Dynamic names, indexing, runtime lookup and config-file parsing remain excluded.
  No existing expected trees changed; no contract correction was needed.
