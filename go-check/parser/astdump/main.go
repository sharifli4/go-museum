// Command astdump parses go-check/parser/main.go (the exact program shown
// in the Parser/AST part's plaque) and prints the real go/ast node kinds
// it produces, in pre-order, so scripts/check-parser.mjs can assert the
// museum never names a node go/ast doesn't actually produce for this file.
package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: astdump <path-to-main.go>")
		os.Exit(2)
	}

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, os.Args[1], nil, 0)
	if err != nil {
		fmt.Fprintln(os.Stderr, "parse error:", err)
		os.Exit(1)
	}

	fmt.Println("*ast.File")
	ast.Inspect(file, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.FuncDecl:
			fmt.Printf("FuncDecl %s\n", node.Name.Name)
		case *ast.BlockStmt:
			fmt.Println("BlockStmt")
		case *ast.AssignStmt:
			fmt.Printf("AssignStmt %s\n", node.Tok)
		case *ast.BinaryExpr:
			fmt.Printf("BinaryExpr %s\n", node.Op)
		case *ast.BasicLit:
			fmt.Printf("BasicLit %s\n", node.Value)
		case *ast.ExprStmt:
			fmt.Println("ExprStmt")
		case *ast.CallExpr:
			fmt.Println("CallExpr")
		case *ast.Ident:
			fmt.Printf("Ident %s\n", node.Name)
		}
		return true
	})
}
