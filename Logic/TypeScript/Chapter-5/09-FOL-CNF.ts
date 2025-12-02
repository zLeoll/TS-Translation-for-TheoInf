import { LogicParser } from './FOL-Parser';
import { RecursiveSet } from './Recursive-Set';

// --- Type Definitions ---
export type Variable = string;
export type Formula = string | [string, ...Formula[]];
export type Literal = string | [string, ...Formula[]];
export type Clause = RecursiveSet<Literal>;
export type CNF = RecursiveSet<Clause>;
export type Substitution = Record<string, Formula>;
export type LogicalExpression = Formula | Clause | CNF;

// --- Helper: Formula to String ---
export function formulaToString(f: LogicalExpression): string {
    if (typeof f === 'string') return f;
    if (f instanceof RecursiveSet) {
        return `{ ${[...f].map(e => formulaToString(e as LogicalExpression)).join(', ')} }`;
    }
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        if (op === '∀' || op === '∃') {
            const [variable, formula] = args as [string, Formula];
            return `${op}${variable}: ${formulaToString(formula)}`;
        }
        if (['∧', '∨', '→', '↔'].includes(op)) {
            const [left, right] = args as [Formula, Formula];
            return `(${formulaToString(left)} ${op} ${formulaToString(right)})`;
        }
        if (op === '¬') {
            return `¬${formulaToString(args[0] as Formula)}`;
        }
        if (args.length > 0) {
            return `${op}(${args.map(arg => formulaToString(arg as Formula)).join(', ')})`;
        }
        return op; // Constant
    }
    return String(f);
}

// --- Parsing ---
export function parse(s: string): Formula {
    const p = new LogicParser(s);
    return p.parse();
}

// --- Substitution & Variables ---
export function apply(t: LogicalExpression, σ: Substitution): LogicalExpression {
    if (t instanceof RecursiveSet) {
        const newElements: any[] = [];
        for (const element of t) {
            newElements.push(apply(element as LogicalExpression, σ));
        }
        return new RecursiveSet(...newElements);
    }
    if (typeof t === 'string') {
        return Object.prototype.hasOwnProperty.call(σ, t) ? σ[t] : t;
    }
    if (Array.isArray(t)) {
        const [op, ...args] = t;
        const newArgs = args.map(arg => apply(arg, σ));
        return [op, ...newArgs] as Formula;
    }
    return t as Formula;
}

export function boundVariables(f: Formula): RecursiveSet<string> {
    if (!Array.isArray(f)) return new RecursiveSet();
    const [op, ...args] = f;
    if (op === '∀' || op === '∃') {
        const [x, g] = args as [string, Formula];
        return new RecursiveSet(x).union(boundVariables(g));
    }
    if (['∧', '∨', '→', '↔'].includes(op)) {
        const [g, h] = args as [Formula, Formula];
        return boundVariables(g).union(boundVariables(h));
    }
    if (op === '¬') {
        return boundVariables(args[0] as Formula);
    }
    return new RecursiveSet();
}

export function allVariables(f: Formula): RecursiveSet<string> {
    if (typeof f === 'string') return new RecursiveSet(f);
    const [op, ...args] = f;
    if (op === '∀' || op === '∃') {
        const [x, g] = args as [string, Formula];
        return new RecursiveSet(x).union(allVariables(g));
    }
    if (['∧', '∨', '→', '↔'].includes(op)) {
        const [g, h] = args as [Formula, Formula];
        return allVariables(g).union(allVariables(h));
    }
    if (op === '¬') return allVariables(args[0] as Formula);
    
    let result = new RecursiveSet<string>();
    for (const t of args) {
        result = result.union(allVariables(t as Formula));
    }
    return result;
}

// --- Normalization Steps ---

const asciiLowercase = 'abcdefghijklmnopqrstuvwxyz';

export function renameBoundVariables(f: Formula): Formula {
    const boundVs = boundVariables(f);
    const allVs = allVariables(f);
    const availableVars = asciiLowercase.split('').filter(char => !allVs.has(char));
    const sigma: Substitution = {};
    let i = 0;
    for (const x of boundVs) {
        if (i < availableVars.length) {
            sigma[x] = availableVars[i++];
        } else {
            throw new Error("Not enough free variables available for renaming!");
        }
    }
    return apply(f, sigma) as Formula;
}

export function eliminateBiconditional(f: Formula): Formula {
    if (typeof f === 'string') return f;
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        if (op === '↔') {
            const [g, h] = args as [Formula, Formula];
            const ge = eliminateBiconditional(g);
            const he = eliminateBiconditional(h);
            return ['∧', ['→', ge, he], renameBoundVariables(['→', he, ge])] as Formula;
        }
        if (['∧', '∨', '→'].includes(op)) {
             const [g, h] = args as [Formula, Formula];
             return [op, eliminateBiconditional(g), eliminateBiconditional(h)] as Formula;
        }
        if (op === '¬') return ['¬', eliminateBiconditional(args[0] as Formula)] as Formula;
        if (op === '∀' || op === '∃') {
            const [x, g] = args as [string, Formula];
            return [op, x, eliminateBiconditional(g)] as Formula;
        }
    }
    return f;
}

export function eliminateConditional(f: Formula): Formula {
    if (typeof f === 'string') return f;
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        if (op === '→') {
            const [g, h] = args as [Formula, Formula];
            return ['∨', ['¬', eliminateConditional(g)], eliminateConditional(h)] as Formula;
        }
        if (['∧', '∨'].includes(op)) {
            const [g, h] = args as [Formula, Formula];
            return [op, eliminateConditional(g), eliminateConditional(h)] as Formula;
        }
        if (op === '¬') return ['¬', eliminateConditional(args[0] as Formula)] as Formula;
        if (op === '∀' || op === '∃') {
            const [x, g] = args as [string, Formula];
            return [op, x, eliminateConditional(g)] as Formula;
        }
    }
    return f;
}

export function nnf(f: Formula): Formula {
    if (typeof f === 'string') return f;
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        if (op === '¬') return neg(args[0] as Formula);
        if (['∧', '∨'].includes(op)) {
            const [g, h] = args as [Formula, Formula];
            return [op, nnf(g), nnf(h)] as Formula;
        }
        if (op === '∀' || op === '∃') {
            const [x, g] = args as [string, Formula];
            return [op, x, nnf(g)] as Formula;
        }
    }
    return f;
}

function neg(f: Formula): Formula {
    if (typeof f === 'string') return ['¬', f];
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        switch (op) {
            case '⊤': return ['⊥'];
            case '⊥': return ['⊤'];
            case '¬': return nnf(args[0] as Formula);
            case '∧': return ['∨', neg(args[0] as Formula), neg(args[1] as Formula)];
            case '∨': return ['∧', neg(args[0] as Formula), neg(args[1] as Formula)];
            case '∀': return ['∃', args[0] as string, neg(args[1] as Formula)];
            case '∃': return ['∀', args[0] as string, neg(args[1] as Formula)];
            default: return ['¬', f];
        }
    }
    return ['¬', f];
}

// --- Prenex Normal Form ---
function mergeQuantifiers(Q1: string[], Q2: string[]): string[] {
    if (Q1.length === 0) return Q2;
    if (Q2.length === 0) return Q1;
    if (Q1[0] === '∃') return [...Q1.slice(0, 2), ...mergeQuantifiers(Q1.slice(2), Q2)];
    if (Q2[0] === '∃') return [...Q2.slice(0, 2), ...mergeQuantifiers(Q1, Q2.slice(2))];
    return [...Q1.slice(0, 2), ...mergeQuantifiers(Q1.slice(2), Q2)];
}

function extractQuantifiers(f: Formula): [string[], Formula] {
    if (typeof f === 'string') return [[], f];
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        if (['∧', '∨'].includes(op)) {
            const [g, h] = args as [Formula, Formula];
            const [qg, gm] = extractQuantifiers(g);
            const [qh, hm] = extractQuantifiers(h);
            return [mergeQuantifiers(qg, qh), [op, gm, hm]];
        }
        if (op === '∀' || op === '∃') {
            const [x, g] = args as [string, Formula];
            const [qg, gm] = extractQuantifiers(g);
            return [[op, x, ...qg], gm];
        }
    }
    return [[], f];
}

function attachQuantifiers(Qs: string[], m: Formula): Formula {
    if (Qs.length === 0) return m;
    const Q = Qs[0];
    const x = Qs[1];
    return [Q, x, attachQuantifiers(Qs.slice(2), m)] as Formula;
}

export function prenexNormalForm(f: Formula): Formula {
    const [Qs, matrix] = extractQuantifiers(f);
    return attachQuantifiers(Qs, matrix);
}

// --- Skolemization ---
let skolemCounter = 0;
function skolemConstant(): string {
    skolemCounter++;
    return 'sk' + skolemCounter;
}

export function skolemize(f: Formula, Vs: string[] = []): Formula {
    if (typeof f === 'string') return f;
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        if (op === '∃') {
            const [x, g] = args as [string, Formula];
            const skolemFunc = skolemConstant();
            const t: Formula = [skolemFunc, ...Vs];
            const sigma: Substitution = { [x]: t };
            return skolemize(apply(g, sigma) as Formula, Vs);
        }
        if (op === '∀') {
            const [x, g] = args as [string, Formula];
            return skolemize(g, [...Vs, x]);
        }
    }
    return f;
}

// --- CNF Transformation ---
function cnf(f: Formula): CNF {
    if (typeof f === 'string') { // Literal
        return new RecursiveSet(new RecursiveSet(f));
    }
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        if (op === '¬') { // Negative Literal
             return new RecursiveSet(new RecursiveSet(f));
        }
        if (op === '∧') {
            const [g, h] = args as [Formula, Formula];
            return cnf(g).union(cnf(h));
        }
        if (op === '∨') {
             const [g, h] = args as [Formula, Formula];
             const C1 = cnf(g);
             const C2 = cnf(h);
             let result = new RecursiveSet<Clause>();
             for (const c1 of C1) {
                 for (const c2 of C2) {
                     result.add(c1.union(c2));
                 }
             }
             return result;
        }
    }
    // Atomic formula (predicate)
    return new RecursiveSet(new RecursiveSet(f as Literal));
}

export function clausify(f: Formula): CNF {
    return cnf(f);
}

export function normalize(f: Formula): CNF {
    skolemCounter = 0; // Reset for deterministic behavior if needed
    const f1 = eliminateBiconditional(f);
    const f2 = eliminateConditional(f1);
    const f3 = nnf(f2);
    const f4 = renameBoundVariables(f3);
    const f5 = prenexNormalForm(f4);
    const f6 = skolemize(f5);
    return clausify(f6);
}

export function prettify(M: CNF): string {
    if (M.size === 0) return "{}";
    let result = "{\n";
    for (const A of M) {
        const clause = A as RecursiveSet<Literal>;
        if (clause.size === 0) {
            result += "  {},\n";
        } else {
            const literals = Array.from(clause)
                .map(l => formulaToString(l as Formula))
                .sort();
            result += `  { ${literals.join(', ')} },\n`;
        }
    }
    result = result.substring(0, result.length - 2);
    result += "\n}";
    return result;
}
