import { RecursiveSet, Value } from './recursive-set';
import { NNFNegation, Literal, Clause, CNF, getComplement } from './04-CNF';
import { Variable } from './Propositional-Logic-Parser';

// ============================================================================
// 1. Helpers
// ============================================================================

/**
 * Extracts the variable name from a literal.
 * Uses type narrowing and the semantic getter .phi
 */
function extractVariable(l: Literal): Variable {
    // Type Guard: TS checks if l is NNFNegation
    if (l instanceof NNFNegation) {
        return l.phi; // Clean access via getter (returns Variable)
    }
    return l; // l is Variable (string)
}

/**
 * Returns an arbitrary element from a set (for unit selection).
 */
function arb<T extends Value>(S: RecursiveSet<T>): T | null {
    return S.pickRandom() ?? null;
}

/**
 * Creates a CNF containing a single unit clause {{l}}.
 * Explicit typing guarantees CNF structure without casts.
 */
function unit(l: Literal): CNF {
    const c = new RecursiveSet<Literal>(l);     // Clause
    const res = new RecursiveSet<Clause>(c);    // CNF
    return res;
}

// ============================================================================
// 2. Jeroslow-Wang Heuristic
// ============================================================================

/**
 * Selects the "best" literal to branch on.
 * Strategy: Jeroslow-Wang (One-Sided).
 * Literals in short clauses get higher weights (2^-length).
 * This tends to satisfy short clauses quickly, creating unit propagations.
 */
function selectLiteral(
    Clauses: CNF,
    Variables: RecursiveSet<Variable>,
    UsedVars: RecursiveSet<Variable>
): Literal {
    let maxLiteral: Literal | null = null;
    let maxScore = -1;

    // 1. Candidate Selection: Iterate over unused variables
    for (const v of Variables) {
        if (UsedVars.has(v)) continue;

        // Check both polarities: A and ¬A
        const candidates: Literal[] = [v, new NNFNegation(v)];

        for (const lit of candidates) {
            let score = 0;

            // 2. Scoring: Sum weights of clauses containing the literal
            // Weight formula: J(l) = Sum( 2^(-|C|) ) for all C where l in C
            for (const C of Clauses) {
                if (C.has(lit)) {
                    score += Math.pow(2, -C.size);
                }
            }

            // 3. Update Maximum
            if (score > maxScore) {
                maxScore = score;
                maxLiteral = lit;
            }
        }
    }

    // Fallback/Safety: Should not happen if Variables > UsedVars
    if (maxLiteral === null) {
        throw new Error("Heuristic failed: No unused variables found, but solution not yet determined.");
    }

    return maxLiteral;
}

// ============================================================================
// 3. DPLL Core Logic
// ============================================================================

function reduce(Clauses: CNF, l: Literal): CNF {
    const lBar = getComplement(l);
    const result = new RecursiveSet<Clause>();

    for (const clause of Clauses) {
        // Rule 1: Subsumption.
        // If the clause contains l, it is true. Drop it.
        if (clause.has(l)) continue;

        // Rule 2: Unit Cut.
        // If the clause contains ¬l, remove ¬l.
        if (clause.has(lBar)) {
            const newClause = clause.clone(); // Returns RecursiveSet<Literal> (Clause)
            newClause.remove(lBar);
            result.add(newClause);
        } else {
            // Rule 3: Copy unaffected clause.
            result.add(clause);
        }
    }

    // Add decision literal as a fact (Decision History)
    // new RecursiveSet<Literal> matches type Clause
    result.add(new RecursiveSet<Literal>(l));

    return result; // Matches type CNF (RecursiveSet<Clause>)
}

function saturate(Clauses: CNF): CNF {
    let S = Clauses;
    const UsedUnits = new RecursiveSet<Clause>();

    while (true) {
        // Find all NEW unit clauses
        const Units = new RecursiveSet<Clause>();
        for (const C of S) {
            if (C.size === 1 && !UsedUnits.has(C)) {
                Units.add(C);
            }
        }

        if (Units.isEmpty()) break;

        // Pick arbitrary unit and propagate
        const unitClause = arb(Units)!;
        UsedUnits.add(unitClause);

        const l = arb(unitClause)!;
        S = reduce(S, l);
    }
    return S;
}

function solveRecursive(
    Clauses: CNF,
    Variables: RecursiveSet<Variable>,
    UsedVars: RecursiveSet<Variable>
): CNF {
    // 1. Boolean Constraint Propagation (BCP)
    const S = saturate(Clauses);

    // 2. Check for Contradiction (Empty Clause {{}})
    const EmptyClause = new RecursiveSet<Literal>();
    if (S.has(EmptyClause)) {
        // Construct Falsum explicitly typed
        const Falsum = new RecursiveSet<Clause>(EmptyClause);
        return Falsum;
    }

    // 3. Check for Solution (All clauses are units)
    let allUnits = true;
    for (const C of S) {
        if (C.size !== 1) {
            allUnits = false;
            break;
        }
    }
    if (allUnits) return S;

    // 4. Branching (Heuristic Decision)
    const l = selectLiteral(S, Variables, UsedVars);
    const lBar = getComplement(l);
    const v = extractVariable(l);

    // Prepare state for next level
    const nextUsedVars = UsedVars.clone();
    nextUsedVars.add(v);

    // Branch A: Assume Heuristic choice 'l' is True
    // (Common strategy: Try the "heavier" literal first)
    const ResA = solveRecursive(S.union(unit(l)), Variables, nextUsedVars);
    
    // If Branch A found a model (no empty clause), return it.
    if (!ResA.has(EmptyClause)) return ResA;

    // Branch B: Backtrack. Assume 'l' is False (so lBar is True).
    return solveRecursive(S.union(unit(lBar)), Variables, nextUsedVars);
}

// ============================================================================
// 4. Public API & Output
// ============================================================================

function solve(Clauses: CNF): CNF {
    const Variables = new RecursiveSet<Variable>();
    for (const C of Clauses) {
        for (const lit of C) {
            Variables.add(extractVariable(lit));
        }
    }
    const UsedVars = new RecursiveSet<Variable>();
    
    return solveRecursive(Clauses, Variables, UsedVars);
}

function literal_to_str(C: Clause): string {
    const val = arb(C);
    if (!val) return "{}";
    
    if (val instanceof NNFNegation) {
        return `${val.phi} ↦ False`;
    } else {
        return `${val} ↦ True`;
    }
}

function toString(S: CNF, Simplified: CNF): string {
    const EmptyClause = new RecursiveSet<Literal>();
    if (Simplified.has(EmptyClause)) return "UNSAT";

    const parts: string[] = [];
    const sorted = Array.from(Simplified).sort((a,b) => RecursiveSet.compare(a, b));
    
    for (const C of sorted) {
        parts.push(literal_to_str(C));
    }
    return '{ ' + parts.join(', ') + ' }';
}

export { solve, toString };