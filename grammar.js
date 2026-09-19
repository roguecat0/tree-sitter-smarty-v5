/**
 * @file Smarty2 grammar for tree-sitter
 * @author roguecat0 <roguecat0@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "smarty2",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
