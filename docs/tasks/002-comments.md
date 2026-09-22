# 002 — Smarty comments

Status: ready. Dependencies: initial baseline only.

## Scope and motivation

Recognize `{* ... *}` as a named `comment` node, including multiline and empty
comments. Corpus evidence: `corpus/toolbar.tpl` starts with a multiline comment;
`corpus/action_types/action_value_add_action.tpl` comments out HTML and Smarty.
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

## Completion evidence (fill when implemented)

Test paths; commands/results; corpus snippet provenance and comparison; reference
limitations; any revised tree expectation and reason.
