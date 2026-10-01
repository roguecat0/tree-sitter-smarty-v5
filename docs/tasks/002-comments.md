# 002 — Smarty comments

Status: complete (2026-09-22). Dependencies: initial baseline only.

## Scope and motivation

Recognize `{* ... *}` as a named `comment` node, including multiline and empty
comments. Corpus evidence: `corpus/application/toolbar.tpl` starts with a multiline comment;
`corpus/application/action_types/action_value_add_action.tpl` comments out HTML and Smarty.
The initial report finds comment markers in 132 failing files.

Exclude `{literal}`, HTML comments as special nodes, interpolation, and custom
delimiters. Content inside a Smarty comment must not create executable tag nodes.

## Proposed tree contract

```text
A{* {$ignored} {widget} *}B
(source_file (text) (comment) (text))
```

The comment node's range includes both delimiters and no following newline.
That newline remains template text in our source tree. Smarty's lexer may consume
it along with the comment; compare recognition rather than identical token ranges.
Check the `comment` action in `TemplateLexer.plex` before implementation: it skips
comments and reports a missing terminator. Establish termination at the first
`*}`; do not invent nested-comment semantics.

## Acceptance work

- Add `test/corpus/comments.txt`: empty comment, multiline CRLF/LF examples,
  braces/quotes/fake tags inside, adjacent comments, and comments inside an if body.
- Assert the comment's exact text and endpoints in a Node test; no tag/output
  observations should originate from its body. Use Smarty's reference to verify
  recognition and skipped-body behavior. This is not an expression-value check.
- Include a quoted `{* ... *}` inside a supported string: it remains a string.
- An unterminated comment must produce an error or missing node. Preserve a valid
  output before it. Compare delete/restore-terminator edits with fresh parses.
- Run `npm test` and corpus reports; reduce one real comment into a reviewed
  expected-tree fixture. Do not silently expand into JavaScript brace support.

## Completion evidence

- [Manual trees](../../test/corpus/comments.txt), including literal CRLF bytes,
  and [reference/range/recovery/edit checks](../../test/comments.test.mjs).
- `npm test` first failed on eight new comment trees; after implementation and
  the reference clarification below it passes 25 trees, 40 Node checks and 4
  mutation checks. The new mutation proves aliasing a comment to text is caught.
- `npm run corpus:report -- ./corpus/application /tmp/smarty-002-after.json`, compared with
  `/tmp/smarty-001-after.json`: identical hashes for all 467 files; 13 → 15 clean,
  454 → 452 failing; no clean-to-failing regressions. Both newly clean files
  (`extensions/gps/gps_print_labels.tpl` and
  `view_admin/name_list_instructions/dlg_map_nl.tpl`) have explicit comment leaves,
  with first-terminator ranges inspected. Reports are local temporary artifacts.
- `corpus/application/toolbar.tpl:1-3` supplies the minimized multiline helper comment in the
  LF/CRLF trees. Its real first comment was checked for exact delimiter range;
  the rest of that template still uses unsupported syntax.
- Reference tests verify skipped-body behavior, first terminator and unterminated
  rejection; exact trees/ranges establish node structure. Literal blocks, HTML
  comment nodes, custom delimiters and interpolation remain excluded.
- No existing expected tree changed. The supported quoted-string boundary is
  clarified below from a minimal Smarty observation.

## Reference boundary clarification

Smarty 5.8.4 accepts `{widget label='{* ignored *}'}` but rejects
`{widget label="{* ignored *}"}` with `Unexpected "* "`. Double-quoted
template interpolation is outside the existing string subset. The quoted-comment
acceptance requirement therefore uses single quotes. The initial double-quoted
fixture and its unchanged string tree are retained with an explicit reference
rejection check to document the pre-existing over-acceptance, not claim support.
No existing tree expectation is changed and the string grammar is not expanded.
