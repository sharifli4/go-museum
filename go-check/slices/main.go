package main

import "fmt"

func main() {
	// snippet:start
	a := []int{1, 2, 3}
	b := a[:2]
	b[0] = 9
	b = append(b, 4)
	c := append(b, 5, 6, 7)
	// snippet:end

	fmt.Printf("a len=%d cap=%d vals=%v\n", len(a), cap(a), a)
	fmt.Printf("b len=%d cap=%d vals=%v\n", len(b), cap(b), b)
	fmt.Printf("c len=%d cap=%d vals=%v\n", len(c), cap(c), c)
	fmt.Printf("a0_eq_b0=%v\n", &a[0] == &b[0])
	fmt.Printf("a0_eq_c0=%v\n", &a[0] == &c[0])
}
