import { LogicParser } from './FOL-Parser';

// --- Types ---
// Wir verwenden dieselben Typ-Definitionen wie in FOL-CNF.ts, um Kompatibilität zu sichern.
export type Formula = string | [string, ...Formula[]];
export type Substitution = Record<string, Formula>;
export type Equation = ['≐', Formula, Formula];

// --- Helper Functions ---

export function parseTerm(s: string): Formula {
    const parser = new LogicParser(s);
    return parser.parse();
}

/**
 * Applies the substitution σ to the term t.
 * t can be a Formula (term) or a Set of Equations.
 */
export function apply(t: Formula | Set<Equation>, σ: Substitution): Formula | Set<Equation> {
    // Fall 1: Set von Gleichungen (wird im Algorithmus verwendet)
    if (t instanceof Set) {
        const newSet = new Set<Equation>();
        for (const eq of t) {
            // eq ist ['≐', s, t]
            newSet.add(apply(eq, σ) as Equation);
        }
        return newSet;
    }
    
    // Fall 2: Variable (String)
    if (typeof t === 'string') {
        if (Object.prototype.hasOwnProperty.call(σ, t)) {
            return σ[t];
        } else {
            return t;
        }
    }
    
    // Fall 3: Term / Formel / Gleichung (Array)
    if (Array.isArray(t)) {
        const [op, ...args] = t;
        // Rekursiv auf Argumente anwenden
        const newArgs = args.map(arg => apply(arg as Formula, σ));
        return [op, ...newArgs] as Formula;
    }
    
    return t as Formula;
}

/**
 * Composes two substitutions σ and τ.
 * Returns σ composed with τ (σ ∘ τ).
 * Assumes domains are largely non-overlapping or handles overlap by overwriting.
 */
export function compose(σ: Substitution, τ: Substitution): Substitution {
    const result: Substitution = { ...τ };
    for (const [x, s] of Object.entries(σ)) {
        result[x] = apply(s, τ) as Formula;
    }
    return result;
}

/**
 * Checks if variable x occurs in term t.
 */
export function occurs(x: string, t: Formula): boolean {
    if (x === t) {
        return true;
    }
    if (typeof t === 'string') { 
        return false;
    }
    if (Array.isArray(t)) {
        const [_, ...args] = t;
        return args.some(arg => occurs(x, arg as Formula));
    }
    return false;
}

// --- Martelli & Montanari Algorithm ---

function solve(E: Set<Equation>, σ: Substitution): Substitution | null {
    while (E.size > 0) {
        const equation = E.values().next().value;
        E.delete(equation);
        
        const [op, s, t] = equation; // op is '≐'
        
        // 1. Remove trivial equations: s ≐ s
        if (JSON.stringify(s) === JSON.stringify(t)) {
            continue;
        }
        
        // 2. Variable Elimination: x ≐ t
        if (typeof s === 'string') { 
            if (occurs(s, t)) {
                return null; // Failure: Occurs Check
            } else {
                const sub = { [s]: t };
                // Wende {x -> t} auf die restlichen Gleichungen in E an
                // Da apply ein neues Set zurückgibt, aktualisieren wir E
                const newE = apply(E, sub) as Set<Equation>;
                E = newE;
                
                // Komposition der Substitution
                σ = compose(σ, sub);
            }
        } 
        // 3. Orientation: t ≐ x  ->  x ≐ t
        else if (typeof t === 'string') {
            E.add(['≐', t, s]);
        } 
        // 4. Decomposition: f(...) ≐ g(...)
        else {
            const [f, ...sArgs] = s as [string, ...Formula[]];
            const [g, ...tArgs] = t as [string, ...Formula[]];
            
            const m = sArgs.length;
            const n = tArgs.length;
            
            if (f !== g || m !== n) {
                return null; // Failure: Clash (different functors or arity)
            } else {
                for (let i = 0; i < m; i++) {
                    E.add(['≐', sArgs[i] as Formula, tArgs[i] as Formula]);
                }
            }
        }
    }
    return σ;
}

/**
 * Computes the most general unifier (mgu) of two terms s and t.
 * Returns a Substitution object or null if not unifiable.
 */
export function unify(s: Formula, t: Formula): Substitution | null {
    const initialEquation: Equation = ['≐', s, t];
    return solve(new Set([initialEquation]), {});
}
