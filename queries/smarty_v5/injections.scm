; One pattern combines both kinds of host text into the same HTML document.
; Smarty tags/comments are holes in HTML. Nested script/style nodes may span
; those holes; Smarty highlights use priority 110 to win over host captures.
([
  (text)
  (literal_content)
] @injection.content
  (#set! injection.language "html")
  (#set! injection.combined))
