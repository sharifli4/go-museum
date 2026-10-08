package main

type User struct{ Name string }

//go:noinline
func newUser(name string) *User {
	u := User{Name: name}
	return &u
}

func main() {
	p := newUser("Kenan")
	println(p.Name)
}
