package gojson

// Value represents any JSON value.
// Concrete types used:
// - map[string]any for objects
// - []any for arrays
// - string for strings
// - float64 for numbers
// - bool for booleans
// - nil for null
type Value = any