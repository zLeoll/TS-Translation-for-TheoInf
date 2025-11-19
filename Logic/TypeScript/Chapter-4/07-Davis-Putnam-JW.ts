// Typedefs für Variablen, Literale und Klauseln
export type Variable = string;
export type Literal = Variable | ['¬', Variable];
export type Clause = Set<Literal>;

// Komplement eines Literals berechnen
export function complement(l: Literal): Literal | null {
    if (Array.isArray(l) && l[0] === '¬') return l[1];
    if (typeof l === 'string') return ['¬', l];
    return null;
}

// Variable aus Literal extrahieren
export function extractVariable(l: Literal): Variable | null {
    if (Array.isArray(l) && l[0] === '¬') return l[1];
    if (typeof l === 'string') return l;
    return null;
}

// Ein beliebiges Element aus einer Menge holen
export function arb<T>(S: Set<T> | ReadonlySet<T>): T | null {
    for (const x of S) {
        return x;
    }
    return null;
}

// Literal-Key für Vergleich generieren
export function literalKey(lit: Literal): string {
    if (typeof lit === 'string') return lit;
    return `¬${lit[1]}`;
}

// Klausel normalisieren (Duplikate entfernen)
export function normalizeClause(clause: Clause): Clause {
    const map = new Map<string, Literal>();
    for (const lit of clause) {
        map.set(literalKey(lit), lit);
    }
    return new Set(map.values());
}

// Zwei Klauseln inhaltlich vergleichen
export function equalClauses(c1: Clause, c2: Clause): boolean {
    if (c1.size !== c2.size) return false;
    for (const lit of c1) {
        if (![...c2].some(l => literalKey(l) === literalKey(lit))) return false;
    }
    return true;
}

// Prüfen, ob Klausel Literal enthält
export function clauseHasLiteral(clause: Clause, literal: Literal): boolean {
    const key = literalKey(literal);
    for (const lit of clause) {
        if (literalKey(lit) === key) return true;
    }
    return false;
}

// JW-Heuristik für Literalwahl
export function selectLiteral(
    Clauses: Set<Clause>,
    Variables: Set<Variable>,
    UsedVars: Set<Variable>
): Literal | null {
    const Scores: Map<Literal, number> = new Map();
    for (const varr of Variables) {
        if (!UsedVars.has(varr)) {
            const cmp: Literal = ['¬', varr];
            Scores.set(varr, 0.0);
            Scores.set(cmp, 0.0);
            for (const C of Clauses) {
                if (clauseHasLiteral(C, cmp)) {
                    Scores.set(cmp, (Scores.get(cmp) ?? 0) + Math.pow(2, -C.size));
                }
                if (clauseHasLiteral(C, varr)) {
                    Scores.set(varr, (Scores.get(varr) ?? 0) + Math.pow(2, -C.size));
                }
            }
        }
    }
    let maxLiteral: Literal | null = null;
    let maxScore = -Infinity;
    for (const [lit, score] of Scores.entries()) {
        if (score > maxScore) {
            maxScore = score;
            maxLiteral = lit;
        }
    }
    return maxLiteral;
}

// Klausel reduzieren mit Unit Propagation
export function reduce(Clauses: Set<Clause>, l: Literal): Set<Clause> {
    const lBar = complement(l);
    const part1 = new Set<Clause>(
        [...Clauses]
            .filter(C => clauseHasLiteral(C, lBar!))
            .map(C =>
                normalizeClause(
                    new Set([...C].filter(lit => literalKey(lit) !== literalKey(lBar!)))
                )
            )
    );
    const part2 = new Set<Clause>(
        [...Clauses].filter(C => !clauseHasLiteral(C, lBar!) && !clauseHasLiteral(C, l))
    );
    const part3 = new Set<Clause>([new Set([l])]);
    return new Set([...part1, ...part2, ...part3]);
}

// Wiederholte Unit Propagation bis fixpunkt
export function saturate(Clauses: Set<Clause>): Set<Clause> {
    let S = new Set([...Clauses].map(normalizeClause));
    let Units = new Set([...S].filter(c => c.size === 1));
    let Used = new Set<Clause>();
    while (Units.size > 0) {
        const unit = Units.values().next().value;
        Units.delete(unit);
        Used.add(unit);
        const l = arb(unit);
        if (l === null) break;
        S = reduce(S, l as Literal);
        S = new Set([...S].map(normalizeClause));
        Units = new Set(
            [...S].filter(
                c => c.size === 1 && ![...Used].some(u => equalClauses(u, c))
            )
        );
    }
    return S;
}

// Gleichheit von Klauselmengen vergleichen
export function equalClauseSets(a: Set<Clause>, b: Set<Clause>): boolean {
    if (a.size !== b.size) return false;
    for (const c of a) {
        if (![...b].some(x => equalClauses(x, c))) {
            return false;
        }
    }
    return true;
}

// Rekursive Davis-Putnam-Lösung
export function solveRecursive(
    Clauses: Set<Clause>,
    Variables: Set<Variable>,
    UsedVars: Set<Variable>
): Set<Clause> {
    const S = saturate(Clauses);
    const Empty = new Set<Literal>();
    const Falsum = new Set<Clause>([Empty]);
    if ([...S].some(c => c.size === 0)) {
        return Falsum;
    }
    if ([...S].every(c => c.size === 1)) {
        return S;
    }
    const l = selectLiteral(S, Variables, UsedVars);
    const lBar = complement(l!);
    const p = extractVariable(l!) as Variable;
    const newUsed = new Set([...UsedVars, p]);
    const Result = solveRecursive(new Set([...S, new Set([l!])]), Variables, newUsed);
    if (!equalClauseSets(Result, Falsum)) {
        return Result;
    }
    return solveRecursive(new Set([...S, new Set([lBar!])]), Variables, newUsed);
}

// Top-Level Interface
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

// Pretty-printing Utility (optional)
export function literalToString(lit: Literal): string {
    if (typeof lit === 'string') {
        return `'${lit}'`;
    } else {
        return `('¬', '${lit[1]}')`;
    }
}

export function clauseToString(clause: Clause): string {
    const literals = [...clause].map(literalToString);
    return `{${literals.join(', ')}}`;
}

export function prettify(Clauses: Set<Clause>): string {
    return [...Clauses].map(clauseToString).join(', ');
}
