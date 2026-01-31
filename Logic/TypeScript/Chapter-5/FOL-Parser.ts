// =========================================================
// 1. AST DEFINITIONEN (Notebook-Kompatibel)
// =========================================================

export type Term =
    | { kind: 'Var'; name: string }
    | { kind: 'Fun'; symbol: string; args: Term[] };

export type Formula =
    | { kind: 'Const'; value: boolean }
    | { kind: 'Not'; operand: Formula }
    | { kind: 'Binary'; op: '∧' | '∨' | '→' | '↔' | '⊕'; left: Formula; right: Formula }
    | { kind: 'Quantifier'; op: '∀' | '∃'; variable: string; body: Formula }
    | { kind: 'Pred'; symbol: string; args: Term[] };

export interface Signature {
    functions: Set<string>;
    predicates: Set<string>;
}

// =========================================================
// 2. TOKENIZER (Only Unicode & Identifiers)
// =========================================================

function tokenize(s: string): string[] {
    // 1. Whitespace und Doppelpunkte ignorieren wir (\s* oder :)
    // 2. Erlaubte Unicode-Symbole und Klammern (Gruppe 1)
    // 3. Identifier (a-z, A-Z, 0-9, _) (Gruppe 2)
    
    const regex = /\s*(?::)*\s*(?:([()¬∧∨→↔⊕⊤⊥∀∃,])|([a-zA-Z0-9_]+))/g;
    
    const tokens: string[] = [];
    let match;
    
    while ((match = regex.exec(s)) !== null) {
        // match[1]: Ein Zeichen (Symbol oder Klammer)
        if (match[1]) {
            tokens.push(match[1]);
        }
        // match[2]: Ein Wort (Identifier)
        else if (match[2]) {
            tokens.push(match[2]);
        }
    }
    return tokens;
}

// =========================================================
// 3. PARSER CLASS (Internal)
// =========================================================

export class LogicParser {
    private tokens: string[];
    private pos: number = 0;
    private signature: Signature;

    constructor(input: string, signature: Signature) {
        this.tokens = tokenize(input);
        this.signature = signature;
    }

    private current(): string {
        return this.pos < this.tokens.length ? this.tokens[this.pos] : 'EOF';
    }

    private consume(expected?: string): string {
        const token = this.current();
        if (expected && token !== expected) {
            throw new Error(`Erwartet: '${expected}', Gefunden: '${token}' an Pos ${this.pos}`);
        }
        this.pos++;
        return token;
    }

    // --- Entry Point ---
    public parseAll(): Formula {
        const f = this.parseImplication();
        if (this.current() !== 'EOF') {
            throw new Error(`Unerwartetes Token am Ende: ${this.current()}`);
        }
        return f;
    }

    public parseTermEntry(): Term {
        const t = this.parseTerm(); // Ruft die private parseTerm() auf
        if (this.current() !== 'EOF') {
            throw new Error(`Unerwartetes Token am Ende: ${this.current()}`);
        }
        return t;
    }

    // --- Recursive Descent ---
    
    private parseImplication(): Formula {
        let left = this.parseOr();
        while (true) {
            const op = this.current();
            if (op === '→') {
                this.consume();
                left = { kind: 'Binary', op: '→', left, right: this.parseOr() };
            } else if (op === '↔') {
                this.consume();
                left = { kind: 'Binary', op: '↔', left, right: this.parseOr() };
            } else {
                return left;
            }
        }
    }

    private parseOr(): Formula {
        let left = this.parseAnd();
        while (true) {
            const op = this.current();
            if (op === '∨') {
                this.consume();
                left = { kind: 'Binary', op: '∨', left, right: this.parseAnd() };
            } else if (op === '⊕') {
                this.consume();
                left = { kind: 'Binary', op: '⊕', left, right: this.parseAnd() };
            } else {
                return left;
            }
        }
    }

    private parseAnd(): Formula {
        let left = this.parseNot();
        while (this.current() === '∧') {
            this.consume();
            left = { kind: 'Binary', op: '∧', left, right: this.parseNot() };
        }
        return left;
    }

    private parseNot(): Formula {
        const token = this.current();
        if (token === '¬') {
            this.consume();
            return { kind: 'Not', operand: this.parseNot() };
        }
        if (token === '∀' || token === '∃') {
            const op = token as '∀' | '∃';
            this.consume();
            const varName = this.current();
            // Variable muss ein Identifier sein
            if (!/^[a-zA-Z0-9_]+$/.test(varName) || varName === 'EOF') {
                throw new Error("Nach Quantor muss eine Variable folgen.");
            }
            this.consume();
            return { kind: 'Quantifier', op: op, variable: varName, body: this.parseNot() };
        }
        return this.parseAtom();
    }

    private parseAtom(): Formula {
        const token = this.current();
        if (token === '(') {
            this.consume();
            const f = this.parseImplication();
            this.consume(')');
            return f;
        }
        if (token === '⊤') {
            this.consume();
            return { kind: 'Const', value: true };
        }
        if (token === '⊥') {
            this.consume();
            return { kind: 'Const', value: false };
        }

        const name = token;
        
        // 1. Prädikat? (Muss in Signatur sein)
        if (this.signature.predicates.has(name)) {
            this.consume();
            let args: Term[] = [];
            if (this.current() === '(') {
                this.consume();
                args = this.parseTermList();
                this.consume(')');
            }
            return { kind: 'Pred', symbol: name, args };
        }
        
        // 2. Fehler: Funktion an Formel-Position
        if (this.signature.functions.has(name)) {
            throw new Error(`Symbol '${name}' ist eine Funktion, wird aber als Formel genutzt.`);
        }

        throw new Error(`Unbekanntes Prädikat: '${name}'`);
    }

    // --- Term Parsing ---

    private parseTerm(): Term {
        const name = this.current();
        
        // Ein Term MUSS mit einem Identifier starten (Funktion oder Variable)
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
             throw new Error(`Ungültiger Term-Start: '${name}'`);
        }
        this.consume();

        // 1. Funktion
        if (this.signature.functions.has(name)) {
            let args: Term[] = [];
            if (this.current() === '(') {
                this.consume();
                if (this.current() !== ')') {
                    args = this.parseTermList();
                }
                this.consume(')');
            }
            return { kind: 'Fun', symbol: name, args };
        }

        // 2. Prädikat (Fehler)
        if (this.signature.predicates.has(name)) {
            throw new Error(`Symbol '${name}' ist ein Prädikat, darf nicht im Term stehen.`);
        }

        // 3. Fallback: Variable
        return { kind: 'Var', name: name };
    }

    private parseTermList(): Term[] {
        const args: Term[] = [];
        args.push(this.parseTerm());
        while (this.current() === ',') {
            this.consume();
            args.push(this.parseTerm());
        }
        return args;
    }
}

// =========================================================
// 4. MAIN EXPORT
// =========================================================

export function parse(input: string, signature: Signature): Formula {
    const parser = new LogicParser(input, signature);
    return parser.parseAll();
}

export function parseTerm(input: string, signature: Signature): Term {
    const parser = new LogicParser(input, signature);
    return parser.parseTermEntry(); // Ruft parseTerm() auf -> Erwartet Term
}