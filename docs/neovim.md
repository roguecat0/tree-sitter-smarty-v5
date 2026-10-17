# Neovim integration

Requires Neovim 0.11 or later, a C compiler, and the repository's locked
Tree-sitter CLI (`npm ci`). This works through Neovim's built-in Tree-sitter
support; nvim-treesitter is optional. The parser name is `smarty_v5`, the language
is Smarty 5, and the Neovim filetype is `smarty`.

From the repository, compile the parser:

```sh
mkdir -p parser
node_modules/.bin/tree-sitter build --output parser/smarty_v5.so
```

Use the platform's shared library suffix on Windows/macOS when needed. Rebuild
after parser updates. Add this repository to your plugin manager's runtime path,
or configure it explicitly (replace the path):

```lua
vim.opt.runtimepath:prepend('/absolute/path/to/tree-sitter-smarty_v5')
vim.treesitter.language.register('smarty_v5', 'smarty')
-- .tpl is also used by other template languages. Add this only for Smarty files.
vim.filetype.add({ extension = { tpl = 'smarty' } })
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'smarty',
  callback = function(event)
    vim.treesitter.start(event.buf, 'smarty_v5')
    vim.bo[event.buf].commentstring = '{* %s *}'
    vim.wo.foldmethod = 'expr'
    vim.wo.foldexpr = 'v:lua.vim.treesitter.foldexpr()'
  end,
})
```

Install the `html`, `javascript`, and `css` parsers **and their Neovim queries**
using your preferred parser manager. Merely installing parser libraries does not
install highlighting/injection queries. Smarty injects one combined HTML document
from `text` and `literal_content`. Standard HTML queries then inject JavaScript
inside `<script>` and CSS inside `<style>`; script type attributes follow the
installed HTML query set's rules. Smarty tags stay recognized by the parent parser
everywhere, including scripts, styles, and quoted HTML attributes.

Neovim 0.11 nested script/style ranges can span the Smarty holes in HTML. All
Smarty captures therefore use priority 110, above the standard host priority 100.
Keep host highlight priorities below 110. This protects template coloring even
inside JS strings or comments. Embedded JS/CSS trees may still contain errors
around template syntax; injection does not render the template or guarantee a
valid generated program. `{literal}` bodies receive HTML/JS/CSS highlighting but
apparent Smarty syntax inside them remains literal, as the grammar specifies.

The runtime files `queries/smarty_v5/*.scm` mirror the canonical root query files
used by the Node binding and Tree-sitter CLI; acceptance checks prevent drift. Folds cover recognized blocks and
comments; generic opening/closing tags remain independent. Indentation,
textobjects, locals and symbol queries are deferred. For non-HTML templates,
override `queries/smarty_v5/injections.scm` in your own runtime path.

Inspect with `:InspectTree`, `:Inspect`, and `:EditQuery`; verify Smarty coloring
inside scripts as well as normal HTML. Highlighting is not an LSP or completion
provider.

## Integration check

`npm test` checks query compilation, captures, exact script tree shape, injection
content, folds and boundary edits without requiring an editor. For the actual
Neovim integration check, put compiled `smarty_v5.so`, `html.so`, `javascript.so`,
and `css.so` in an external directory, then run from this repository:

```sh
SMARTY_EDITOR_DEPS=/absolute/path/to/parser-libraries nvim --headless -u NONE -l test/neovim-editor.lua
```

The check supplies the upstream HTML grammar's basic script/style queries so it
is independent of a particular plugin manager; separately check installed HTML
queries for specialized script types. It verifies real nested language trees,
Smarty priority over overlapping JS captures, literal behavior and edits.
