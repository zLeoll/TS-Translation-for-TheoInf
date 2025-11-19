export type Variable = string;
export type Literal = Variable | [string, Variable];
export type Clause = Set<Literal>;
export type CNF = Set<Clause>;
export type Formula = Variable | Formula[];

export function eliminateBiconditional(f: Formula): Formula {
    //Eliminate the logical operator "→" from f.
    if (typeof f === 'string') { // This case covers variables.
        return f;
    }
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        switch (op) {
            case '↔': {
                const [g, h] = args as [Formula, Formula];
                const g2 = eliminateBiconditional(g);
                const h2 = eliminateBiconditional(h);
                return eliminateBiconditional(['∧', ['→', g2, h2], ['→', h2, g2]]);
            }
            case '⊤':
            case '⊥':
                return f;
            case '¬': {
                const [g] = args as [Formula];
                return ['¬', eliminateBiconditional(g)];
            }
            case '→':
            case '∧':
            case '∨': {
                const [g, h] = args as [Formula, Formula];
                return [op, eliminateBiconditional(g), eliminateBiconditional(h)];
            }
            default:
                return "";
        }
    }
    return "";
};

export function eliminateConditional(f: Formula): Formula {
    //Eliminate the logical operator "→" from f.
    if (typeof f === 'string') { // variables
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
                const g2 = eliminateConditional(g);
                const h2 = eliminateConditional(h);
                return eliminateConditional(['∨', ['¬', g2], h2]);
            }
            case '¬': {
                const [g] = args as [Formula];
                return ['¬', eliminateConditional(g)];
            }
            case '∧':
            case '∨': {
                const [g, h] = args as [Formula, Formula];
                return [op, eliminateConditional(g), eliminateConditional(h)];
            }
            default:
                return "";
        }
    }
    return "";
};

export function neg(f: Formula): Formula {
    if (typeof f === 'string') {
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
                return nnf(g);
            }
            case '∧': {
                const [g, h] = args as [Formula, Formula];
                return ['∨', neg(g), neg(h)];
            }
            case '∨': {
                const [g, h] = args as [Formula, Formula];
                return ['∧', neg(g), neg(h)];
            }
            default:
                return "";
        }
    }
    return "";
};

export function nnf(f: Formula): Formula {
    // Compute the negation normal form of f.
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
                return [op, nnf(g), nnf(h)];
            }
            default:
                return "";
        }
    }
    return "";
};

export function cnf(f: Formula): CNF {
    if (typeof f === 'string') { // f is a variable
        return new Set([new Set([f])]);
    }
    if (Array.isArray(f)) {
        const [op, ...args] = f;
        switch (op) {
            case '⊤':
                return new Set();
            case '⊥':
                return new Set([new Set()]);
            case '¬': {
                const [p] = args as [Variable];
                return new Set([new Set([['¬', p]])]); // f is a negative literal
            }
            case '∧': {
                const [g, h] = args as [Formula, Formula];
                const left = cnf(g);
                const right = cnf(h);
                return new Set([...left, ...right]);
            }
            case '∨': {
                const [g, h] = args as [Formula, Formula];
                const left = cnf(g);
                const right = cnf(h);
                const result = new Set<Clause>();
                for (const k1 of left) {
                    for (const k2 of right) {
                        const unionClause = new Set([...k1, ...k2]);
                        result.add(unionClause);
                    }
                }
                return result;
            }
            default:
                return new Set(null);
        }
    }
    return new Set(null);
};

export function isTrivial(clause: Clause): boolean {
    for (const p of clause) {
        if (typeof p === 'string') {
            if (clauseHasLiteral(clause, ['¬', p])) {
                return true;
            }
        } else if (Array.isArray(p) && p.length === 2 && p[0] === '¬') {
            if (clause.has(p[1])) {
                return true;
            }
        }
    }
    return false;
};

export function clauseHasLiteral(clause: Clause, literal: Literal): boolean {
    for (const lit of clause) {
        if (isLiteralEqual(lit, literal)) {
            return true;
        }
    }
    return false;
};

export function isLiteralEqual(a: Literal, b: Literal): boolean {
    if (typeof a === 'string' && typeof b === 'string') {
        return a === b;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return a[0] === b[0] && a[1] === b[1];
    }
    return false;
};

export function removeDuplicatesFromClause(clause: ReadonlySet<Literal>): Clause {
    const literalsSeen = new Set<string>();
    const result = new Set<Literal>();

    function literalToString(lit: Literal): string {
        if (typeof lit === 'string') {
            return lit;
        } else if (Array.isArray(lit) && lit.length === 2) {
            return `(${lit[0]},${lit[1]})`;
        }
        throw new Error('Invalid literal');
    }
    for (const lit of clause) {
        const key = literalToString(lit);
        if (!literalsSeen.has(key)) {
            literalsSeen.add(key);
            result.add(lit);
        }
    }
    return result;
};

export function simplify(clauses: Set<Clause>): Set<Clause> {
    const result = new Set<Clause>();
    for (const C of clauses) {
        const cleanClause = removeDuplicatesFromClause(C);
        if (!isTrivial(cleanClause)) {
            result.add(cleanClause);
        }
    }
    return result;
};

export function normalize(f: Formula): CNF {
    const n1 = eliminateBiconditional(f);
    const n2 = eliminateConditional(n1);
    const n3 = nnf(n2);
    const n4 = cnf(n3);
    return simplify(n4);
};