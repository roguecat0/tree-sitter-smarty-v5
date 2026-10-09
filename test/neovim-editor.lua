-- Explicit integration check: see docs/neovim.md for prerequisites and command.
local root = vim.fn.getcwd()
local deps = assert(vim.env.SMARTY_EDITOR_DEPS, 'set SMARTY_EDITOR_DEPS to a directory containing html/javascript/css.so')
vim.opt.runtimepath:prepend(root)
vim.treesitter.language.add('smarty_v5', {path = deps .. '/smarty_v5.so'})
for _, lang in ipairs({'html','javascript','css'}) do
  vim.treesitter.language.add(lang, {path = deps .. '/' .. lang .. '.so'})
end
-- The upstream HTML parser's standard script/style injections, independent
-- of plugin installation. Actual plugin query discovery should also be checked.
vim.treesitter.query.set('html','injections', [[
((script_element (raw_text) @injection.content) (#set! injection.language "javascript"))
((style_element (raw_text) @injection.content) (#set! injection.language "css"))
]])
local source = '<div class="{$class}"><script>const x = "{$value}"; {if $ok}run();{/if}</script><style>.x { color: {$color}; }</style>{literal}<script>const raw = 1;</script>{/literal}</div>'
local buf = vim.api.nvim_create_buf(false,true)
vim.api.nvim_buf_set_lines(buf,0,-1,false,{source})
local p = vim.treesitter.get_parser(buf,'smarty_v5')
p:parse(true)
local seen = {}
p:for_each_tree(function(tree, lt)
  seen[lt:lang()] = true
  assert(tree:root():type() ~= 'ERROR', 'lost host tree')
end)
assert(seen.html and seen.javascript and seen.css, 'missing nested language')
local highlights = assert(vim.treesitter.query.get('smarty_v5','highlights'))
local function check_template(text)
  p:parse(true)
  local root_node = p:trees()[1]:root()
  assert(not root_node:has_error(), 'Smarty tree lost structure')
  for _, token in ipairs({'$class','$value','$ok','$color'}) do
    local found = false
    for id,node,metadata in highlights:iter_captures(root_node,buf,0,-1) do
      if highlights.captures[id] == 'variable' and vim.treesitter.get_node_text(node,buf) == token then
        assert(tonumber(metadata.priority) == 110, 'Smarty priority must win over hosts')
        found = true
      end
    end
    assert(found, 'missing Smarty variable '..token)
  end
  local js_query = vim.treesitter.query.parse('javascript','(string) @string')
  local overlap = false
  local offset = assert(text:find('{$value}',1,true)) - 1
  p:for_each_tree(function(tree,lt)
    if lt:lang() == 'javascript' then
      for _,node in js_query:iter_captures(tree:root(),buf,0,-1) do
        local _,sc,_,ec = node:range()
        if sc <= offset and ec >= offset+8 then overlap = true end
      end
    end
  end)
  assert(overlap, 'exercise overlapping host string highlight')
end
check_template(source)
-- Literal bodies must not acquire Smarty variable captures.
local literal_source = '<script>{literal}const s = "{$opaque}";{/literal}</script>'
local literal_tree = vim.treesitter.get_string_parser(literal_source,'smarty_v5'):parse()[1]
for id in highlights:iter_captures(literal_tree:root(),literal_source,0,-1) do
  assert(highlights.captures[id] ~= 'variable', 'literal body interpreted as Smarty')
end
-- Edits cross the Smarty/JS boundary and restore all injected trees.
local offset = assert(source:find('{$value}',1,true)) - 1
vim.api.nvim_buf_set_text(buf,0,offset+2,0,offset+7,{''})
p:parse(true)
local broken = vim.api.nvim_buf_get_lines(buf,0,-1,false)[1]
local fresh = vim.treesitter.get_string_parser(broken,'smarty_v5')
fresh:parse(true)
assert(p:trees()[1]:root():sexpr() == fresh:trees()[1]:root():sexpr(), 'incremental broken tree differs')
vim.api.nvim_buf_set_text(buf,0,offset+2,0,offset+2,{'value'})
check_template(source)
local restored = {}
p:for_each_tree(function(_,lt) restored[lt:lang()] = true end)
assert(restored.html and restored.javascript and restored.css, 'edit lost injections')
print('Neovim editor integration passed')
