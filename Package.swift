// swift-tools-version:5.3

import Foundation
import PackageDescription

var sources = ["src/parser.c"]
if FileManager.default.fileExists(atPath: "src/scanner.c") {
    sources.append("src/scanner.c")
}

let package = Package(
    name: "TreeSitterSmartyV5",
    products: [
        .library(name: "TreeSitterSmartyV5", targets: ["TreeSitterSmartyV5"]),
    ],
    dependencies: [
        .package(name: "SwiftTreeSitter", url: "https://github.com/tree-sitter/swift-tree-sitter", from: "0.9.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterSmartyV5",
            dependencies: [],
            path: ".",
            sources: sources,
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterSmartyV5Tests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterSmartyV5",
            ],
            path: "bindings/swift/TreeSitterSmartyV5Tests"
        )
    ],
    cLanguageStandard: .c11
)
