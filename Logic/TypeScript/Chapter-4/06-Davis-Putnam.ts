/**
 * davis-putnam.ts
 * 
 * Implements the Davis-Putnam algorithm for solving propositional logic formulas in CNF.
 * Based on the provided notebook content.
 */

import { RecursiveSet, Value } from 'recursive-set';

// --- Type Definitions ---

export type Variable = string;
export type Literal = Variable | ['¬', Variable];
export type Clause = RecursiveSet<Literal>;

// --- Helper Functions ---

/**
 * Computes the complement of a literal l.
 * complement(p) = ['¬', p]
 * complement(['¬', p]) = p
 */
export function complement(l: Literal): Literal {
  if (Array.isArray(l)) {
    return l[1];
  } else {
    return ['¬', l];
  }
}

/**
 * Extracts the variable from the literal l.
 * extractVariable(p) = p
 * extractVariable(['¬', p]) = p
 */
export function extractVariable(l: Literal): Variable {
  if (Array.isArray(l)) {
    return l[1];
  } else {
    return l;
  }
}

/**
 * Returns an arbitrary element from the set S.
 */
function arb<T extends Value>(S: RecursiveSet<T>): T | null {
    if (S.isEmpty()) {
        return null;
    }
    return S.raw[0];
}
/**
 * Selects an arbitrary variable from the set Variables that does not occur in the set UsedVars.
 */
export function selectVariable(
  Variables: RecursiveSet<Variable>,
  UsedVars: RecursiveSet<Variable>
): Variable | null {
  for (const x of Variables) {
    if (!UsedVars.has(x)) {
      return x;
    }
  }
  return null;
}

// --- Core Logic ---

/**
 * Performs unit cuts and unit subsumptions using unit clause {l}.
 */
export function reduce(Clauses: RecursiveSet<Clause>, l: Literal): RecursiveSet<Clause> {
  const lBar = complement(l);
  const result = new RecursiveSet<Clause>();
  for (const clause of Clauses) {
    if (clause.has(lBar)) {
      const newClause = clause.clone().remove(lBar);
      result.add(newClause);
    } else if (!clause.has(l)) {
      result.add(clause);
    }
  }
  const unitClause = new RecursiveSet<Literal>();
  unitClause.add(l);
  result.add(unitClause);
  return result;
}

/**
 * Computes the set of clauses derived from Clauses via repeated unit cuts/subsumptions.
 */
export function saturate(Clauses: RecursiveSet<Clause>): RecursiveSet<Clause> {
  let S = Clauses;
  const Used = new RecursiveSet<Clause>();
  while (true) {
    const Units = new RecursiveSet<Clause>();
    for (const C of S) {
      const clause = C as Clause;
      if (clause.size === 1 && !Used.has(clause)) {
        Units.add(clause);
      }
    }
    if (Units.isEmpty()) {
      break;
    }
    const unit = arb(Units) as Clause;
    Used.add(unit);
    const l = arb(unit) as Literal;
    S = reduce(S, l);
  }
  return S;
}

/**
 * Recursive helper for the Davis-Putnam algorithm.
 */
export function solveRecursive(
  Clauses: RecursiveSet<Clause>,
  Variables: RecursiveSet<Variable>,
  UsedVars: RecursiveSet<Variable>
): RecursiveSet<Clause> {
  const S = saturate(Clauses);
  const EmptyClause = new RecursiveSet<Literal>();

  // S is inconsistent
  if (S.has(EmptyClause)) {
    const Falsum = new RecursiveSet<Clause>();
    Falsum.add(EmptyClause);
    return Falsum;
  }

  // S is trivial
  let allUnits = true;
  for (const C of S) {
    if ((C as Clause).size !== 1) {
      allUnits = false;
      break;
    }
  }
  if (allUnits) {
    return S;
  }

  // select a variable p that has not been used yet
  const p = selectVariable(Variables, UsedVars) as Variable;
  const nextUsedVars = UsedVars.union(new RecursiveSet<Variable>(p));

  // Branch 1: {p}
  const unitP = new RecursiveSet<Clause>();
  const cP = new RecursiveSet<Literal>();
  cP.add(p);
  unitP.add(cP);
  const Result1 = solveRecursive(S.union(unitP), Variables, nextUsedVars);
  if (!Result1.has(EmptyClause)) {
    return Result1;
  }

  // Branch 2: {¬p}
  const unitNotP = new RecursiveSet<Clause>();
  const cNotP = new RecursiveSet<Literal>();
  cNotP.add(['¬', p]);
  unitNotP.add(cNotP);
  return solveRecursive(S.union(unitNotP), Variables, nextUsedVars);
}

/**
 * Main entry point for the Davis-Putnam solver.
 */
export function solve(Clauses: RecursiveSet<Clause>): RecursiveSet<Clause> {
  const Variables = new RecursiveSet<Variable>();
  for (const clause of Clauses) {
    for (const lit of clause) {
      Variables.add(extractVariable(lit));
    }
  }
  const UsedVars = new RecursiveSet<Variable>();
  return solveRecursive(Clauses, Variables, UsedVars);
}

// --- Formatting / Output ---

export function literal_to_str(C: Clause): string {
  const val = arb(C);
  if (val === null) return "{}";
  const l = val as Literal;

  if (Array.isArray(l)) {
    return `${l[1]} ↦ False`;
  } else {
    return `${l} ↦ True`;
  }
}

export function prettify(Clauses: RecursiveSet<Clause>): string {
  const res: string[] = [];
  for (const C of Clauses) res.push(C.toString());
  return `{${res.join(', ')}}`;
}

export function toString(S: RecursiveSet<Clause>, Simplified: RecursiveSet<Clause>): string {
  const EmptyClause = new RecursiveSet<Literal>();
  if (Simplified.has(EmptyClause)) {
    return `${prettify(S)} is unsolvable`;
  }

  const parts: string[] = [];
  for (const C of Simplified) {
    parts.push(literal_to_str(C as Clause));
  }
  return '{ ' + parts.join(', ') + ' }';
}
