package gojson

import (
    "errors"
    "fmt"
    "strconv"
)

// Parse parses JSON bytes into native Go values without using encoding/json.
func Parse(src []byte) (Value, error) {
    p := &parser{lex: newLexer(src)}
    v, err := p.parseValue()
    if err != nil { return nil, err }
    // Ensure there's no trailing content
    tok, err := p.lex.nextToken()
    if err != nil { return nil, err }
    if tok.typ != tokEOF {
        return nil, fmt.Errorf("unexpected trailing content")
    }
    return v, nil
}

type parser struct {
    lex *lexer
    buf *token
}

func (p *parser) next() (token, error) {
    if p.buf != nil {
        t := *p.buf
        p.buf = nil
        return t, nil
    }
    return p.lex.nextToken()
}

func (p *parser) peek() (token, error) {
    if p.buf != nil { return *p.buf, nil }
    t, err := p.lex.nextToken()
    if err != nil { return token{}, err }
    p.buf = &t
    return t, nil
}

func (p *parser) expect(tt tokenType) error {
    t, err := p.next()
    if err != nil { return err }
    if t.typ != tt { return fmt.Errorf("expected %v", tt) }
    return nil
}

func (p *parser) parseValue() (Value, error) {
    t, err := p.peek()
    if err != nil { return nil, err }
    switch t.typ {
    case tokLBrace:
        return p.parseObject()
    case tokLBracket:
        return p.parseArray()
    case tokString:
        _, _ = p.next()
        return t.lexeme, nil
    case tokNumber:
        _, _ = p.next()
        n, err := strconv.ParseFloat(t.lexeme, 64)
        if err != nil { return nil, fmt.Errorf("invalid number: %w", err) }
        return n, nil
    case tokTrue:
        _, _ = p.next(); return true, nil
    case tokFalse:
        _, _ = p.next(); return false, nil
    case tokNull:
        _, _ = p.next(); return nil, nil
    default:
        return nil, errors.New("invalid JSON value")
    }
}

func (p *parser) parseObject() (map[string]any, error) {
    if err := p.expect(tokLBrace); err != nil { return nil, err }
    obj := make(map[string]any)
    // Empty object?
    t, err := p.peek(); if err != nil { return nil, err }
    if t.typ == tokRBrace {
        _ , _ = p.next()
        return obj, nil
    }
    for {
        // key
        kt, err := p.next(); if err != nil { return nil, err }
        if kt.typ != tokString { return nil, fmt.Errorf("expected string key") }
        if err := p.expect(tokColon); err != nil { return nil, err }
        v, err := p.parseValue(); if err != nil { return nil, err }
        obj[kt.lexeme] = v
        // next
        nt, err := p.next(); if err != nil { return nil, err }
        if nt.typ == tokComma { continue }
        if nt.typ == tokRBrace { break }
        return nil, fmt.Errorf("expected , or } in object")
    }
    return obj, nil
}

func (p *parser) parseArray() ([]any, error) {
    if err := p.expect(tokLBracket); err != nil { return nil, err }
    arr := make([]any, 0, 4)
    // Empty array?
    t, err := p.peek(); if err != nil { return nil, err }
    if t.typ == tokRBracket {
        _ , _ = p.next()
        return arr, nil
    }
    for {
        v, err := p.parseValue(); if err != nil { return nil, err }
        arr = append(arr, v)
        nt, err := p.next(); if err != nil { return nil, err }
        if nt.typ == tokComma { continue }
        if nt.typ == tokRBracket { break }
        return nil, fmt.Errorf("expected , or ] in array")
    }
    return arr, nil
}