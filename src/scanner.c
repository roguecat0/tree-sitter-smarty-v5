#include "tree_sitter/parser.h"

enum TokenType {
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
  (void)lexer;
  (void)valid_symbols;
  return false;
}
