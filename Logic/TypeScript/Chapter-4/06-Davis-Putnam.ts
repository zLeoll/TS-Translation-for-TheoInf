import { RecursiveSet, Value } from './recursive-set';
import { Variable, LogicParser } from './Propositional-Logic-Parser';
import { NNFNegation, Literal, Clause, CNF, normalize } from './04-CNF'; 

// ============================================================================
// 1. Helper Functions (Strict Typing)
// ============================================================================

/**
 * Computes the complement of a literal.
 * Uses strict type narrowing instead of casting.
 */
function complement(l: Literal): Literal {
  if (l instanceof NNFNegation) {
    // Type Narrowing: TS knows 'l' is NNFNegation here.
    // 'l.phi' returns Variable (string) safely.
    return l.phi; 
  } else {
    // TS knows 'l' is Variable (string) here.
    return new NNFNegation(l);
  }
}

/**
 * Extracts the variable from a literal.
 */
function extractVariable(l: Literal): Variable {
  return (l instanceof NNFNegation) ? l.phi : l;
}

/**
 * Returns an arbitrary element from the set S.
 * Uses O(1) random access from the Hash Map implementation.
 */
function arb<T extends Value>(S: RecursiveSet<T>): T | null {
  // pickRandom() returns T | undefined, we normalize to T | null
  return S.pickRandom() ?? null;
}

/**
 * Creates a CNF containing a single unit clause {{l}}.
 */
function unit(l: Literal): CNF {
    // 1. Create Clause {l} (Explicit Generic for clarity)
    const c = new RecursiveSet<Literal>(l);
    
    // 2. Create CNF {{l}}
    // RecursiveSet expects 'Clause' elements. 'c' matches 'Clause'.
    return new RecursiveSet<Clause>(c);
}

/**
 * Selects a variable to branch on using a heuristic.
 */
function selectVariable(
  Variables: RecursiveSet<Variable>,
  UsedVars: RecursiveSet<Variable>
): Variable | null {
  // 1. Heuristic: Fast Random Guessing (O(1))
  for (let i = 0; i < 10; i++) {
      const candidate = Variables.pickRandom();
      if (candidate && !UsedVars.has(candidate)) {
          return candidate;
      }
  }

  // 2. Fallback: Linear Scan (O(N))
  for (const candidate of Variables) {
      if (!UsedVars.has(candidate)) {
          return candidate;
      }
  }    
  return null;
}

// ============================================================================
// 2. DPLL Logic (Reduction & Saturation)
// ============================================================================

/**
 * Reduces the set of clauses by applying the Unit Rule for literal `l`.
 * 1. Remove clauses containing `l` (Subsumption).
 * 2. Remove `¬l` from clauses (Unit Cut).
 * 3. Add `{l}` back to preserve the unit decision.
 */
function reduce(Clauses: CNF, l: Literal): CNF {
  const lBar = complement(l);
  const result = new RecursiveSet<Clause>();
  
  for (const clause of Clauses) {
    if (clause.has(l)) {
      // Rule 1: Subsumption (Clause is satisfied) -> Skip it.
      continue; 
    }
    
    if (clause.has(lBar)) {
      // Rule 2: Unit Cut (Remove ¬l from clause)
      // clone() returns RecursiveSet<Literal> which IS 'Clause'. No Cast needed.
      const newClause = clause.clone();
      newClause.remove(lBar);
      result.add(newClause);
    } else {
      // Keep untouched clause
      result.add(clause);
    }
  }
  
  // Rule 3: Add the unit clause {l} back
  // (We create a new set to ensure structural integrity)
  const unitClause = new RecursiveSet<Literal>(l);
  result.add(unitClause);
  
  return result; // return type matches CNF
}

/**
 * Iteratively applies unit propagation until no new units are found.
 */
function saturate(Clauses: CNF): CNF {
  let S = Clauses;
  const Used = new RecursiveSet<Clause>();
  
  while (true) {
    // Identify Unit Clauses
    const Units = new RecursiveSet<Clause>();
    for (const C of S) {
      if (C.size === 1 && !Used.has(C)) {
        Units.add(C);
      }
    }
    
    if (Units.isEmpty()) break;
    
    // Pick one unit clause and one literal from it
    const unitClause = arb(Units)!;
    Used.add(unitClause);
    
    const l = arb(unitClause)!;
    S = reduce(S, l);
  }
  return S;
}

// ============================================================================
// 3. Solver Core (Recursive Backtracking)
// ============================================================================

function solveRecursive(
  Clauses: CNF,
  Variables: RecursiveSet<Variable>,
  UsedVars: RecursiveSet<Variable>
): CNF {
  const S = saturate(Clauses);
  
  // Check for Contradiction (Empty Clause {{}})
  const EmptyClause = new RecursiveSet<Literal>(); // Logic: {}
  if (S.has(EmptyClause)) {
    // Return Falsum: {{}}
    const Falsum = new RecursiveSet<Clause>(EmptyClause);
    return Falsum;
  }

  // Check for Solution (All clauses are units)
  let allUnits = true;
  for (const C of S) {
      if (C.size !== 1) { allUnits = false; break; }
  }
  if (allUnits) return S;

  // Branching Step
  const p = selectVariable(Variables, UsedVars);
  if (!p) return S; // Should not be reached if !allUnits, but safety first

  // Prepare next recursion state (Immutable updates)
  const nextUsedVars = UsedVars.clone();
  nextUsedVars.add(p);

  // --- Branch 1: Assume p is True ---
  // S ∪ {{p}}
  const branch1 = S.union(unit(p));
  const result1 = solveRecursive(branch1, Variables, nextUsedVars);
  
  // If result1 has NO empty clause, we found a model!
  if (!result1.has(EmptyClause)) {
    return result1;
  }

  // --- Branch 2: Assume p is False ---
  // S ∪ {{¬p}}
  const notP = new NNFNegation(p);
  const branch2 = S.union(unit(notP));
  return solveRecursive(branch2, Variables, nextUsedVars);
}

function solve(Clauses: CNF): CNF {
  // Collect all variables once
  const Variables = new RecursiveSet<Variable>();
  for (const clause of Clauses) {
    for (const lit of clause) {
      Variables.add(extractVariable(lit));
    }
  }
  
  const UsedVars = new RecursiveSet<Variable>();
  return solveRecursive(Clauses, Variables, UsedVars);
}

// ============================================================================
// 4. Output Formatting
// ============================================================================

function literal_to_str(C: Clause): string {
  const val = arb(C);
  if (val === null) return "{}";
  
  // Strict typing: val is Literal
  if (val instanceof NNFNegation) {
    return `${val.phi} ↦ False`;
  } else {
    return `${val} ↦ True`;
  }
}

function formatSolution(S: CNF, Simplified: CNF): string {
  const EmptyClause = new RecursiveSet<Literal>();
  
  if (Simplified.has(EmptyClause)) {
    return `Formula is unsolvable`;
  }

  const parts: string[] = [];
  // Sort for deterministic output
  const sortedClauses = Array.from(Simplified).sort((a,b) => RecursiveSet.compare(a, b));
  
  for (const C of sortedClauses) {
    parts.push(literal_to_str(C));
  }
  return '{ ' + parts.join(', ') + ' }';
}

export { solve, formatSolution };