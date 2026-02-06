import { Tuple } from 'recursive-set';

// =========================================================
// 1. AST DEFINITIONEN (Tuple-Typen ohne Tag-Strings)
// =========================================================

// Semantische String-Typen für bessere Lesbarkeit
export type VariableName = string;
export type FunctionSymbol = string;
export type PredicateSymbol = string;

// --- TERM TYPES ---
// Var: (name)
export type VarTerm = Tuple<[VariableName]>;

// Fun: (symbol, args) -> args ist ein Tuple von Terms
export type FunTerm = Tuple<[FunctionSymbol, Tuple<Term[]>]>;

export type Term = VarTerm | FunTerm;

// --- FORMULA TYPES ---
// Const: ('true'|'false')
export type ConstFormula = Tuple<['true' | 'false']>;

// Not: (operand)
export type NotFormula = Tuple<[Formula]>;

// Binary: (op, left, right)
export type BinaryOp = '∧' | '∨' | '→' | '↔';
export type BinaryFormula = Tuple<[BinaryOp, Formula, Formula]>;

// Quantifier: (op, variable, body)
export type QuantifierOp = '∀' | '∃';
export type QuantifierFormula = Tuple<[QuantifierOp, VariableName, Formula]>;

// Pred: (symbol, args)
export type PredFormula = Tuple<[PredicateSymbol, Tuple<Term[]>]>;

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
    const regex = /\s*(?::)*\s*(?:([()¬∧∨→↔⊤⊥∀∃,])|([a-zA-Z0-9_]+))/g;
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

    // --- Recursive Descent ---
    
    // LEVEL 1: Implikation & Äquivalenz
    // Assoziativität: RECHTS
    private parseImplication(): Formula {
        const left = this.parseOr();
        const op = this.current();

        if (op === '→') {
            this.consume();
            const right = this.parseImplication(); 
            return new Tuple('→', left, right);
        } else if (op === '↔') {
            this.consume();
            const right = this.parseImplication(); 
            return new Tuple('↔', left, right);
        }
        
        return left;
    }

    // LEVEL 2: Disjunktion
    // Assoziativität: LINKS
    private parseOr(): Formula {
        let left = this.parseAnd();
        while (this.current() === '∨') {
            this.consume();
            const right = this.parseAnd();
            left = new Tuple('∨', left, right);
        }
        return left;
    }

    // LEVEL 3: Konjunktion
    // Assoziativität: LINKS
    private parseAnd(): Formula {
        let left = this.parseNot();
        while (this.current() === '∧') {
            this.consume();
            const right = this.parseNot();
            left = new Tuple('∧', left, right);
        }
        return left;
    }

    // LEVEL 4: Negation & Quantoren
    private parseNot(): Formula {
        const token = this.current();
        
        // Negation
        if (token === '¬') {
            this.consume();
            return new Tuple(this.parseNot());
        }

        // Quantoren
        if (token === '∀' || token === '∃') {
            const op = token;
            this.consume();
            
            const varName = this.current();
            if (!/^[a-zA-Z0-9_]+$/.test(varName) || varName === 'EOF') {
                throw new Error("Nach Quantor muss eine Variable folgen.");
            }
            this.consume();
            
            const body = this.parseNot();
            
            return new Tuple(op as QuantifierOp, varName, body);
        }

        return this.parseAtom();
    }

    // LEVEL 5: Atome
    private parseAtom(): Formula {
        const token = this.current();

        // Klammern
        if (token === '(') {
            this.consume();
            const f = this.parseImplication();
            this.consume(')');
            return f;
        }

        // Konstanten
        if (token === '⊤') {
            this.consume();
            return new Tuple('true');
        }
        if (token === '⊥') {
            this.consume();
            return new Tuple('false');
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
            return new Tuple(name, argsTuple);
        }
        
        if (this.signature.functions.has(name)) {
            throw new Error(`Symbol '${name}' ist eine Funktion, wird aber als Formel genutzt (Prädikat erwartet).`);
        }

        throw new Error(`Unerwartetes Token oder unbekanntes Prädikat: '${name}'`);
    }

    // --- Term Parsing ---

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
            return new Tuple(name, argsTuple);
        }

        // Prädikat im Term nicht erlaubt
        if (this.signature.predicates.has(name)) {
            throw new Error(`Symbol '${name}' ist ein Prädikat, darf nicht im Term stehen.`);
        }

        // Variable
        return new Tuple(name);
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
