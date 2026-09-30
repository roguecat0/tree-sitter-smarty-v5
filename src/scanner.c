#include "tree_sitter/parser.h"

enum TokenType {
  TEXT,
  OUTPUT_ATTRIBUTE_ERROR_MARKER,
};

void *tree_sitter_smarty2_external_scanner_create(void) { return NULL; }

void tree_sitter_smarty2_external_scanner_destroy(void *payload) { (void)payload; }

unsigned tree_sitter_smarty2_external_scanner_serialize(void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_smarty2_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_smarty2_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;

  if (valid_symbols[TEXT]) {
    bool has_content = false;

    while (!lexer->eof(lexer)) {
      if (lexer->lookahead == '{') {
        // An adjacent opening brace starts a Smarty construct. Save the token
        // boundary before peeking so the brace remains for the tag lexer.
        lexer->mark_end(lexer);
        lexer->advance(lexer, false);
        if (lexer->lookahead == '{' || lexer->lookahead == '}' ||
            lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
            lexer->lookahead == '\n' || lexer->lookahead == '\v' ||
            lexer->lookahead == '\f' || lexer->lookahead == '\r') {
          has_content = true;
          if (lexer->lookahead == '}') lexer->advance(lexer, false);
          lexer->mark_end(lexer);
          continue;
        }

        if (!has_content) return false;
        lexer->result_symbol = TEXT;
        return true;
      }

      // In Smarty's default auto_literal mode, a raw right brace is text.
      lexer->advance(lexer, false);
      has_content = true;
      lexer->mark_end(lexer);
    }

    if (has_content) {
      lexer->result_symbol = TEXT;
      return true;
    }
  }

  return false;
}
