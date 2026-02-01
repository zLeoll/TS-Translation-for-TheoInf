import { Tuple } from 'recursive-set';

// =========================================================
// 1. AST DEFINITIONEN (Strenge Tuple-Typen & Value Semantics)
// =========================================================

/* 
   Wir definieren hier exakte Tuple-Typen.
   Da Tuple<T> in der Library generisch über ein Array ist, definieren wir die Array-Inhalte.
   Das ermöglicht Deep Equality Checks: formulaA.equals(formulaB).
*/

// --- TERM TYPES ---
// Var: ('Var', name)
export type VarTerm = Tuple<['Var', string]>;

// Fun: ('Fun', symbol, args) -> args ist ein Tuple von Terms
export type FunTerm = Tuple<['Fun', string, Tuple<Term[]>]>;

export type Term = VarTerm | FunTerm;

// --- FORMULA TYPES ---
// Const: ('Const', 'true'|'false')
export type ConstFormula = Tuple<['Const', 'true' | 'false']>;

// Not: ('Not', operand)
export type NotFormula = Tuple<['Not', Formula]>;

// Binary: ('Binary', op, left, right)
export type BinaryOp = '∧' | '∨' | '→' | '↔' | '⊕';
export type BinaryFormula = Tuple<['Binary', BinaryOp, Formula, Formula]>;

// Quantifier: ('Quantifier', op, variable, body)
export type QuantifierOp = '∀' | '∃';
export type QuantifierFormula = Tuple<['Quantifier', QuantifierOp, string, Formula]>;

// Pred: ('Pred', symbol, args)
export type PredFormula = Tuple<['Pred', string, Tuple<Term[]>]>;

export type Formula = 
    | ConstFormula 
    | NotFormula 
    | BinaryFormula 
    | QuantifierFormula 
    | PredFormula;

export interface Signature {
    functions: Set<string>;
    predicates: Set<string>;
}

// =========================================================
// 2. TOKENIZER
// =========================================================

function tokenize(s: string): string[] {
    // Regex passend zur Python-Logik, aber auf Unicode-Symbole fokussiert
    const regex = /\s*(?::)*\s*(?:([()¬∧∨→↔⊕⊤⊥∀∃,])|([a-zA-Z0-9_]+))/g;
    const tokens: string[] = [];
    let match;
    
    while ((match = regex.exec(s)) !== null) {
        if (match[1]) tokens.push(match[1]);
        else if (match[2]) tokens.push(match[2]);
    }
    return tokens;
}

// =========================================================
// 3. PARSER CLASS
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

    // --- Entry Points ---
    public parseAll(): Formula {
        const f = this.parseImplication();
        if (this.current() !== 'EOF') {
            throw new Error(`Unerwartetes Token am Ende: ${this.current()}`);
        }
        return f;
    }

    public parseTermEntry(): Term {
        const t = this.parseTerm(); 
        if (this.current() !== 'EOF') {
            throw new Error(`Unerwartetes Token am Ende: ${this.current()}`);
        }
        return t;
    }

    // --- Recursive Descent (Hierarchie gemäß Python Precedence) ---
    
    // LEVEL 1: Implikation & Äquivalenz (Precedence 1 & 2)
    // Python '→' (2), '↔' (1) -> Niedrigste Priorität.
    // Assoziativität: RECHTS (Daher Rekursion auf der rechten Seite)
    private parseImplication(): Formula {
        const left = this.parseXor(); // Ruft nächst höhere Priorität auf
        const op = this.current();

        if (op === '→') {
            this.consume();
            // RECHTS-ASSOZIATIV: Wir rufen parseImplication rekursiv für rechts auf
            const right = this.parseImplication(); 
            return new Tuple('Binary', '→', left, right);
        } else if (op === '↔') {
            this.consume();
            // RECHTS-ASSOZIATIV
            const right = this.parseImplication(); 
            return new Tuple('Binary', '↔', left, right);
        }
        
        return left;
    }

    // LEVEL 2: XOR (Precedence 3)
    // Python '⊕' (3) < '∨' (4). Daher hier separate Ebene.
    // Assoziativität: LINKS (Iterativ)
    private parseXor(): Formula {
        let left = this.parseOr();
        while (this.current() === '⊕') {
            this.consume();
            const right = this.parseOr();
            left = new Tuple('Binary', '⊕', left, right);
        }
        return left;
    }

    // LEVEL 3: Disjunktion (Precedence 4)
    // Assoziativität: LINKS (Iterativ)
    private parseOr(): Formula {
        let left = this.parseAnd();
        while (this.current() === '∨') {
            this.consume();
            const right = this.parseAnd();
            left = new Tuple('Binary', '∨', left, right);
        }
        return left;
    }

    // LEVEL 4: Konjunktion (Precedence 5)
    // Assoziativität: LINKS (Iterativ)
    private parseAnd(): Formula {
        let left = this.parseNot();
        while (this.current() === '∧') {
            this.consume();
            const right = this.parseNot();
            left = new Tuple('Binary', '∧', left, right);
        }
        return left;
    }

    // LEVEL 5: Negation & Quantoren (Precedence 6 & 7)
    // Python: Not(6), Quant(7). Binden stärker als binäre Operatoren.
    // Rekursiv definiert, um "¬∀x..." oder "∀x¬..." zu erlauben.
    private parseNot(): Formula {
        const token = this.current();
        
        // Negation
        if (token === '¬') {
            this.consume();
            return new Tuple('Not', this.parseNot());
        }

        // Quantoren
        if (token === '∀' || token === '∃') {
            const op = token; // Type guard durch if implizit
            this.consume();
            
            const varName = this.current();
            if (!/^[a-zA-Z0-9_]+$/.test(varName) || varName === 'EOF') {
                throw new Error("Nach Quantor muss eine Variable folgen.");
            }
            this.consume();
            
            // Quantor bindet an den direkten nächsten Ausdruck (Not oder Atom)
            const body = this.parseNot();
            
            // Type-Casting vermeiden durch expliziten Check, hier sicher durch Regex oben
            return new Tuple('Quantifier', op as QuantifierOp, varName, body);
        }

        return this.parseAtom();
    }

    // LEVEL 6: Atome (Klammern, Konstanten, Prädikate) (Precedence 8)
    private parseAtom(): Formula {
        const token = this.current();

        // Klammern
        if (token === '(') {
            this.consume();
            const f = this.parseImplication(); // Reset auf niedrigste Prio
            this.consume(')');
            return f;
        }

        // Konstanten
        if (token === '⊤') {
            this.consume();
            return new Tuple('Const', 'true');
        }
        if (token === '⊥') {
            this.consume();
            return new Tuple('Const', 'false');
        }

        // Prädikat
        const name = token;
        
        if (this.signature.predicates.has(name)) {
            this.consume();
            let args: Term[] = [];
            if (this.current() === '(') {
                this.consume();
                if (this.current() !== ')') {
                    args = this.parseTermList();
                }
                this.consume(')');
            }
            const argsTuple = new Tuple(...args);
            return new Tuple('Pred', name, argsTuple);
        }
        
        if (this.signature.functions.has(name)) {
            throw new Error(`Symbol '${name}' ist eine Funktion, wird aber als Formel genutzt (Prädikat erwartet).`);
        }

        throw new Error(`Unerwartetes Token oder unbekanntes Prädikat: '${name}'`);
    }

    // --- Term Parsing (für Argumente) ---

    private parseTerm(): Term {
        const name = this.current();
        
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
             throw new Error(`Ungültiger Term-Start: '${name}'`);
        }
        this.consume();

        // Funktion
        if (this.signature.functions.has(name)) {
            let args: Term[] = [];
            if (this.current() === '(') {
                this.consume();
                if (this.current() !== ')') {
                    args = this.parseTermList();
                }
                this.consume(')');
            }
            const argsTuple = new Tuple(...args);
            return new Tuple('Fun', name, argsTuple);
        }

        // Prädikat im Term nicht erlaubt
        if (this.signature.predicates.has(name)) {
            throw new Error(`Symbol '${name}' ist ein Prädikat, darf nicht im Term stehen.`);
        }

        // Variable
        return new Tuple('Var', name);
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
// 4. MAIN EXPORTS
// =========================================================

export function parse(input: string, signature: Signature): Formula {
    const parser = new LogicParser(input, signature);
    return parser.parseAll();
}

export function parseTerm(input: string, signature: Signature): Term {
    const parser = new LogicParser(input, signature);
    return parser.parseTermEntry(); 
}
