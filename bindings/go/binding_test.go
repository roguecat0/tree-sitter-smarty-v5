package tree_sitter_smarty_v5_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_smarty_v5 "github.com/tree-sitter/tree-sitter-smarty-v5/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_smarty_v5.Language())
	if language == nil {
		t.Errorf("Error loading SmartyV5 grammar")
	}
}
