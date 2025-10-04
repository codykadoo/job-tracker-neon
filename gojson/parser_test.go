package gojson

import "testing"

func TestParseSimpleObject(t *testing.T) {
    src := []byte(`{"a":1,"b":"x","c":true,"d":null}`)
    v, err := Parse(src)
    if err != nil { t.Fatalf("parse error: %v", err) }
    m, ok := v.(map[string]any)
    if !ok { t.Fatalf("expected object, got %T", v) }
    if m["a"].(float64) != 1 { t.Fatalf("a != 1") }
    if m["b"].(string) != "x" { t.Fatalf("b != x") }
    if m["c"].(bool) != true { t.Fatalf("c != true") }
    if m["d"] != nil { t.Fatalf("d != null") }
}

func TestParseArray(t *testing.T) {
    src := []byte(`[1,2,3]`)
    v, err := Parse(src)
    if err != nil { t.Fatalf("parse error: %v", err) }
    arr, ok := v.([]any)
    if !ok || len(arr) != 3 { t.Fatalf("expected array of 3, got %T len=%d", v, len(arr)) }
    if arr[0].(float64) != 1 || arr[2].(float64) != 3 { t.Fatalf("array values incorrect") }
}

func TestParseStringEscapes(t *testing.T) {
    src := []byte(`"hello\nworld"`)
    v, err := Parse(src)
    if err != nil { t.Fatalf("parse error: %v", err) }
    s, ok := v.(string)
    if !ok || s != "hello\nworld" { t.Fatalf("string escape parse failed: %q", s) }
}

func TestParseUnicode(t *testing.T) {
    src := []byte(`"\u0041\u00DF"`) // A ß
    v, err := Parse(src)
    if err != nil { t.Fatalf("parse error: %v", err) }
    s, ok := v.(string)
    if !ok || s != "Aß" { t.Fatalf("unicode parse failed: %q", s) }
}

func TestParseSurrogatePairEmoji(t *testing.T) {
    // 😀 U+1F600 represented as surrogate pair \uD83D\uDE00
    src := []byte(`"\uD83D\uDE00"`)
    v, err := Parse(src)
    if err != nil { t.Fatalf("parse error: %v", err) }
    s, ok := v.(string)
    if !ok || s != "😀" { t.Fatalf("surrogate pair parse failed: %q", s) }
}