type Variable = string;
type Literal = Variable | ['¬', Variable];
type Clause = Set<Literal>;

/**
 * Compute the complement of a literal
 */
export function complement(l: Literal): Literal | null {
    if (Array.isArray(l) && l[0] === '¬') return l[1];
    if (typeof l === 'string') return ['¬', l];
    return null;
}

/**
 * Extract the variable from a literal
 */
export function extractVariable(l: Literal): Variable | null {
    if (Array.isArray(l) && l[0] === '¬') return l[1];
    if (typeof l === 'string') return l;
    return null;
}

/**
 * Return some arbitrary element from a set
 */
export function arb<T>(S: Set<T>): T | null {
    for (const x of S) {
        return x;
    }
    return null;
}

/**
 * Select a variable from Variables not in UsedVars
 */
export function selectVariable(Variables: Set<Variable>, UsedVars: Set<Variable>): Variable | null {
    for (const x of Variables) {
        if (!UsedVars.has(x)) {
            return x;
        }
    }
    return null;
}

/**
 * Return string key for literal (for semantic equality)
 */
export function literalKey(lit: Literal): string {
    if (typeof lit === 'string') return lit;
    return `¬${lit[1]}`;
}

/**
 * Normalize a clause by removing duplicate literals (semantic deduplication)
 */
export function normalizeClause(clause: Clause): Clause {
    const map = new Map<string, Literal>();
    for (const lit of clause) {
        map.set(literalKey(lit), lit);
    }
    return new Set(map.values());
}

/**
 * Check semantic equality of two clauses
 */
export function equalClauses(c1: Clause, c2: Clause): boolean {
    if (c1.size !== c2.size) return false;
    for (const lit of c1) {
        if (![...c2].some(l => literalKey(l) === literalKey(lit))) return false;
    }
    return true;
}

/**
 * Check if a clause contains a literal (semantic check)
 */
export function clauseHasLiteral(clause: Clause, literal: Literal): boolean {
    const key = literalKey(literal);
    for (const lit of clause) {
        if (literalKey(lit) === key) return true;
    }
    return false;
}

/**
 * Reduce clauses using unit clause l
 */
export function reduce(Clauses: Set<Clause>, l: Literal): Set<Clause> {
    const lBar = complement(l);
    const part1 = new Set(
        [...Clauses]
            .filter(C => clauseHasLiteral(C, lBar!))
            .map(C => normalizeClause(new Set([...C].filter(lit => literalKey(lit) !== literalKey(lBar!)))))
    );
    const part2 = new Set(
        [...Clauses].filter(C => !clauseHasLiteral(C, lBar!) && !clauseHasLiteral(C, l))
    );
    const part3 = new Set([new Set([l])]);
    return new Set([...part1, ...part2, ...part3]);
}

/**
 * Saturate set of clauses by repeated unit propagation and subsumption
 */
export function saturate(Clauses: Set<Clause>): Set<Clause> {
    let S = new Set([...Clauses].map(normalizeClause));
    let Units = new Set([...S].filter(c => c.size === 1));
    let Used = new Set<Clause>();
    while (Units.size > 0) {
        const unit = arb(Units);
        if (unit === null) break;
        Units.delete(unit);
        Used.add(unit);
        const l = arb(unit);
        if (l === null) break;
        S = reduce(S, l);
        S = new Set([...S].map(normalizeClause));
        Units = new Set([...S].filter(c => c.size === 1 && ![...Used].some(u => equalClauses(u, c))));
    }
    return S;
}

/**
 * Check semantic equality of sets of clauses
 */
export function equalClauseSets(a: Set<Clause>, b: Set<Clause>): boolean {
    if (a.size !== b.size) return false;
    for (const c of a) {
        if (![...b].some(x => equalClauses(x, c))) return false;
    }
    return true;
}

/**
 * Recursive solver export function for SAT problem
 */
export function solveRecursive(Clauses: Set<Clause>, Variables: Set<Variable>, UsedVars: Set<Variable>): Set<Clause> {
    const S = saturate(Clauses);
    const Empty = new Set<Literal>();
    const Falsum = new Set([Empty]);
    if ([...S].some(c => c.size === 0)) {
        return Falsum;
    }
    if ([...S].every(c => c.size === 1)) {
        return S;
    }
    const p = selectVariable(Variables, UsedVars);
    if (p === null) {
        return S;
    }
    const pBar = complement(p) as Literal;
    const newUsed = new Set([...UsedVars, p]);
    let Result = solveRecursive(new Set([...S, new Set([p])]), Variables, newUsed);
    if (!equalClauseSets(Result, Falsum)) {
        return Result;
    }
    return solveRecursive(new Set([...S, new Set([pBar])]), Variables, newUsed);
}

/**
 * Solve export function exposed to user:
 * Solves SAT problem given set of clauses
 */
export function solve(Clauses: Set<Clause>): Set<Clause> {
    const Variables = new Set<Variable>();
    for (const C of Clauses) {
        for (const l of C) {
            const v = extractVariable(l);
            if (v !== null) {
                Variables.add(v);
            }
        }
    }
    return solveRecursive(Clauses, Variables, new Set());
}
