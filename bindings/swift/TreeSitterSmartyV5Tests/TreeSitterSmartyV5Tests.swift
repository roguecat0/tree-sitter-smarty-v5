import XCTest
import SwiftTreeSitter
import TreeSitterSmartyV5

final class TreeSitterSmartyV5Tests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_smarty_v5())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Smarty 5 grammar")
    }
}
