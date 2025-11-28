/**
 * cnf.ts
 * 
 * A module to convert propositional logic formulas into Conjunctive Normal Form (CNF).
 * Compatible with the Davis-Putnam solver using RecursiveSet.
 */

import { LogicParser } from './PropositionalLogicParser';
import { RecursiveSet } from './Recursive-Set';

// --- Type Definitions ---

export type Variable = string;

// The structure returned by the LogicParser (syntax tree)
// Defined explicitly to allow tuple recursion
export type Formula = string | [string, ...Formula[]];

// The structure used by the Davis-Putnam solver
export type Literal = string; 
export type Clause = RecursiveSet<Literal>;
export type CNF = RecursiveSet<Clause>;

// --- Parsing ---

export function parse(s: string): Formula {
    // LogicParser is assumed to return a compatible structure
    const parser = new LogicParser(s);
    return parser.parse() as Formula;
}

// --- Helper for Literals (String Manipulation) ---

function getComplement(l: Literal): Literal {
    if (l.startsWith('¬')) {
        return l.substring(1);
    } else {
        return '¬' + l;
    }
}

// --- Transformation Steps ---

/**
 * Eliminate '↔' (biconditional) from the formula.
 * (g ↔ h) => (g → h) ∧ (h → g)
 */
export function eliminateBiconditional(f: Formula): Formula | null {
    if (typeof f === 'string') {
        return f;
    }
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        switch (op) {
            case '↔': {
                const [g, h] = args as [Formula, Formula];
                // Recursively eliminate in the transformed structure
                return eliminateBiconditional(['∧', ['→', g, h], ['→', h, g]]);
            }
            case '⊤':
            case '⊥':
                return f;
            case '¬': {
                const [g] = args as [Formula];
                return ['¬', eliminateBiconditional(g)!];
            }
            case '→':
            case '∧':
            case '∨': {
                const [g, h] = args as [Formula, Formula];
                return [op, eliminateBiconditional(g)!, eliminateBiconditional(h)!];
            }
        }
    }
    return null;
}

/**
 * Eliminate '→' (conditional) from the formula.
 * (g → h) => (¬g ∨ h)
 */
export function eliminateConditional(f: Formula): Formula | null {
    if (typeof f === 'string') { 
        return f; 
    }
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        switch (op) {
            case '⊤':
            case '⊥':
                return f;
            case '→': {
                const [g, h] = args as [Formula, Formula];
                // Transform and recurse
                return eliminateConditional(['∨', ['¬', g], h]);
            }
            case '¬': {
                const [g] = args as [Formula];
                return ['¬', eliminateConditional(g)!];
            }
            case '∧':
            case '∨': {
                const [g, h] = args as [Formula, Formula];
                return [op, eliminateConditional(g)!, eliminateConditional(h)!];
            }
        }
    }
    return null;
}

/**
 * Compute Negation Normal Form (NNF).
 * Pushes negations inwards using De Morgan's laws.
 */
export function nnf(f: Formula): Formula | null {
    if (typeof f === 'string') {
        return f;
    }
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        switch (op) {
            case '⊤':
            case '⊥':
                return f;
            case '¬': {
                const [g] = args as [Formula];
                return neg(g);
            }
            case '∧':
            case '∨': {
                const [g, h] = args as [Formula, Formula];
                return [op, nnf(g)!, nnf(h)!];
            }
        }
    }
    return null;
}

/**
 * Helper for NNF: Compute NNF of ¬f.
 */
function neg(f: Formula): Formula | null {
    if (typeof f === 'string') {
        // ¬Variable
        return ['¬', f];
    }
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        switch (op) {
            case '⊤':
                return ['⊥'];
            case '⊥':
                return ['⊤'];
            case '¬': {
                const [g] = args as [Formula];
                // Double negation: ¬(¬g) => g
                return nnf(g);
            }
            case '∧': {
                const [g, h] = args as [Formula, Formula];
                // De Morgan: ¬(g ∧ h) => ¬g ∨ ¬h
                return ['∨', neg(g)!, neg(h)!];
            }
            case '∨': {
                const [g, h] = args as [Formula, Formula];
                // De Morgan: ¬(g ∨ h) => ¬g ∧ ¬h
                return ['∧', neg(g)!, neg(h)!];
            }
        }
    }
    return null;
}

/**
 * Compute Conjunctive Normal Form (CNF).
 * Converts Formula tree to RecursiveSet<Clause> (set of sets of string literals).
 */
export function cnf(f: Formula): CNF | null {
    // Case: Variable "p" -> {{ "p" }}
    if (typeof f === 'string') { 
        const lit = f as Literal;
        const clause = new RecursiveSet<Literal>(lit);
        return new RecursiveSet<Clause>(clause);
    }

    if (Array.isArray(f)) {
        const [op, ...args] = f;
        
        switch (op) {
            case '⊤':
                // True -> Empty set of clauses {}
                return new RecursiveSet<Clause>();
                
            case '⊥':
                // False -> Set containing empty clause {{}}
                const emptyClause = new RecursiveSet<Literal>();
                return new RecursiveSet<Clause>(emptyClause);

            case '¬': {
                // Negative Literal: ['¬', 'p'] -> {{ "¬p" }}
                const [p] = args as [string];
                const lit = '¬' + p; 
                const clause = new RecursiveSet<Literal>(lit);
                return new RecursiveSet<Clause>(clause);
            }

            case '∧': {
                const [g, h] = args as [Formula, Formula];
                // Intersection (Union of clause sets): CNF(g) ∪ CNF(h)
                const left = cnf(g)!;
                const right = cnf(h)!;
                return left.union(right);
            }

            case '∨': {
                const [g, h] = args as [Formula, Formula];
                // Distributive: { C1 ∪ C2 | C1 ∈ CNF(g), C2 ∈ CNF(h) }
                const left = cnf(g)!;
                const right = cnf(h)!;
                
                const result = new RecursiveSet<Clause>();
                
                for (const c1 of left) {
                    for (const c2 of right) {
                        const unionClause = (c1 as Clause).union(c2 as Clause);
                        result.add(unionClause);
                    }
                }
                return result;
            }
        }
    }
    return null;
}

// --- Simplification ---

/**
 * Check if a clause is trivial (contains both p and ¬p).
 */
export function isTrivial(clause: Clause): boolean {
    for (const lit of clause) {
        const comp = getComplement(lit as Literal);
        // RecursiveSet checks value equality (works for strings)
        if (clause.has(comp)) {
            return true;
        }
    }
    return false;
}

/**
 * Remove trivial clauses from CNF.
 * Duplicates are automatically handled by RecursiveSet.
 */
export function simplify(clauses: CNF): CNF {
    const result = new RecursiveSet<Clause>();
    for (const C of clauses) {
        const clause = C as Clause; 
        if (!isTrivial(clause)) {
            result.add(clause);
        }
    }
    return result;
}

// --- Main Pipeline ---

/**
 * Normalize a formula string or tree into optimized CNF.
 */
export function normalize(f: Formula | string): CNF {
    let formula: Formula;
    if (typeof f === 'string' && !f.startsWith('(') && !f.includes(' ')) {
         // Assume simple variable
         formula = f;
    } else if (typeof f === 'string') {
         // Use parser if input is a raw string
         formula = parse(f);
    } else {
         formula = f;
    }

    const n1 = eliminateBiconditional(formula);
    const n2 = eliminateConditional(n1!);
    const n3 = nnf(n2!);
    const n4 = cnf(n3!);
    return simplify(n4!);
}

// --- Formatting ---

export function prettify(M: CNF): string {
    return M.toString();
}

/**
 * Test helper to parse, normalize, and print a formula.
 */
export function test(s: string): string {
    console.log(`The knf of ${s} is:`);
    const result = normalize(s);
    return prettify(result);
}
