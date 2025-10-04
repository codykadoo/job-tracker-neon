package gojson

import (
    "fmt"
    "unicode/utf8"
)

type tokenType int

const (
    tokEOF tokenType = iota
    tokLBrace    // {
    tokRBrace    // }
    tokLBracket  // [
    tokRBracket  // ]
    tokColon     // :
    tokComma     // ,
    tokString
    tokNumber
    tokTrue
    tokFalse
    tokNull
)

type token struct {
    typ   tokenType
    lexeme string
}

type lexer struct {
    src   []byte
    pos   int
    width int
}

func newLexer(src []byte) *lexer { return &lexer{src: src} }

func (l *lexer) next() rune {
    if l.pos >= len(l.src) { l.width = 0; return -1 }
    r, w := utf8.DecodeRune(l.src[l.pos:])
    l.pos += w
    l.width = w
    return r
}

func (l *lexer) backup() {
    l.pos -= l.width
}

func (l *lexer) peek() rune {
    p := l.pos
    w := l.width
    r := l.next()
    l.pos = p
    l.width = w
    return r
}

func (l *lexer) skipWS() {
    for {
        r := l.peek()
        if r == ' ' || r == '\n' || r == '\r' || r == '\t' {
            l.next()
            continue
        }
        break
    }
}

func (l *lexer) nextToken() (token, error) {
    l.skipWS()
    r := l.next()
    switch r {
    case -1:
        return token{typ: tokEOF}, nil
    case '{':
        return token{typ: tokLBrace}, nil
    case '}':
        return token{typ: tokRBrace}, nil
    case '[':
        return token{typ: tokLBracket}, nil
    case ']':
        return token{typ: tokRBracket}, nil
    case ':':
        return token{typ: tokColon}, nil
    case ',':
        return token{typ: tokComma}, nil
    case '"':
        s, err := l.scanString()
        if err != nil { return token{}, err }
        return token{typ: tokString, lexeme: s}, nil
    case 't':
        if l.matchSeq("rue") { return token{typ: tokTrue}, nil }
    case 'f':
        if l.matchSeq("alse") { return token{typ: tokFalse}, nil }
    case 'n':
        if l.matchSeq("ull") { return token{typ: tokNull}, nil }
    default:
        if r == '-' || (r >= '0' && r <= '9') {
            l.backup()
            num, err := l.scanNumber()
            if err != nil { return token{}, err }
            return token{typ: tokNumber, lexeme: num}, nil
        }
    }
    return token{}, fmt.Errorf("unexpected character %q", r)
}

func (l *lexer) matchSeq(seq string) bool {
    for i := 0; i < len(seq); i++ {
        r := l.next()
        if r == -1 || r != rune(seq[i]) {
            return false
        }
    }
    return true
}

func (l *lexer) scanString() (string, error) {
    out := make([]rune, 0, 16)
    for {
        r := l.next()
        if r == -1 { return "", fmt.Errorf("unterminated string") }
        if r == '"' { break }
        if r == '\\' {
            esc := l.next()
            switch esc {
            case '"', '\\', '/':
                out = append(out, esc)
            case 'b': out = append(out, '\b')
            case 'f': out = append(out, '\f')
            case 'n': out = append(out, '\n')
            case 'r': out = append(out, '\r')
            case 't': out = append(out, '\t')
            case 'u':
                // Read 4 hex digits
                var v rune
                for i := 0; i < 4; i++ {
                    h := l.next()
                    if h == -1 { return "", fmt.Errorf("invalid unicode escape") }
                    v <<= 4
                    switch {
                    case h >= '0' && h <= '9': v += rune(h - '0')
                    case h >= 'a' && h <= 'f': v += rune(h - 'a' + 10)
                    case h >= 'A' && h <= 'F': v += rune(h - 'A' + 10)
                    default:
                        return "", fmt.Errorf("invalid unicode escape")
                    }
                }
                // Handle surrogate pairs for characters outside BMP
                if v >= 0xD800 && v <= 0xDBFF { // high surrogate
                    // Expect a following \uXXXX low surrogate
                    bs := l.next()
                    if bs != '\\' {
                        return "", fmt.Errorf("missing low surrogate after high surrogate")
                    }
                    u := l.next()
                    if u != 'u' {
                        return "", fmt.Errorf("missing low surrogate after high surrogate")
                    }
                    var low rune
                    for i := 0; i < 4; i++ {
                        h := l.next()
                        if h == -1 { return "", fmt.Errorf("invalid unicode escape") }
                        low <<= 4
                        switch {
                        case h >= '0' && h <= '9': low += rune(h - '0')
                        case h >= 'a' && h <= 'f': low += rune(h - 'a' + 10)
                        case h >= 'A' && h <= 'F': low += rune(h - 'A' + 10)
                        default:
                            return "", fmt.Errorf("invalid unicode escape")
                        }
                    }
                    if low < 0xDC00 || low > 0xDFFF {
                        return "", fmt.Errorf("invalid low surrogate")
                    }
                    combined := rune(((v - 0xD800) << 10) | (low - 0xDC00)) + 0x10000
                    out = append(out, combined)
                } else if v >= 0xDC00 && v <= 0xDFFF { // unexpected low surrogate
                    return "", fmt.Errorf("unexpected low surrogate without high surrogate")
                } else {
                    out = append(out, v)
                }
            default:
                return "", fmt.Errorf("invalid escape %q", esc)
            }
            continue
        }
        out = append(out, r)
    }
    return string(out), nil
}

func (l *lexer) scanNumber() (string, error) {
    start := l.pos
    r := l.next()
    if r == '-' {
        r = l.next()
    }
    if r == -1 { return "", fmt.Errorf("invalid number") }
    if r == '0' {
        // next may be '.' or exp or end
    } else if r >= '1' && r <= '9' {
        for {
            r = l.next()
            if r < '0' || r > '9' { break }
        }
    } else {
        return "", fmt.Errorf("invalid number")
    }
    // fraction
    if r == '.' {
        r = l.next()
        if r < '0' || r > '9' { return "", fmt.Errorf("invalid fraction") }
        for {
            r = l.next()
            if r < '0' || r > '9' { break }
        }
    }
    // exponent
    if r == 'e' || r == 'E' {
        r = l.next()
        if r == '+' || r == '-' { r = l.next() }
        if r < '0' || r > '9' { return "", fmt.Errorf("invalid exponent") }
        for {
            r = l.next()
            if r < '0' || r > '9' { break }
        }
    }
    // backup the last non-digit char
    l.backup()
    return string(l.src[start:l.pos]), nil
}