import { RecursiveSet } from './Recursive-Set';

// --- Typ-Definitionen ---
export type Variable = string;
export type Literal = string; 
export type Clause = RecursiveSet<Literal>;

// --- Hilfsfunktionen ---

export function complement(l: Literal): Literal {
  if (l.startsWith('¬')) {
    return l.substring(1);
  } else {
    return '¬' + l;
  }
}

export function extractVariable(l: Literal): Variable {
  if (l.startsWith('¬')) {
    return l.substring(1);
  } else {
    return l;
  }
}

export function arb<T>(S: RecursiveSet<T>): T | RecursiveSet<T> | null {
  for (const x of S) {
    return x;
  }
  return null;
}

// --- Kern-Algorithmen ---

export function selectLiteral(
    Clauses: RecursiveSet<Clause>,
    Variables: RecursiveSet<Variable>,
    UsedVars: RecursiveSet<Variable>
  ): Literal {
    const Scores = new Map<Literal, number>();
    for (const variable of Variables) {
      const varr = variable as Variable;
      if (!UsedVars.has(varr)) {
        const pos: Literal = varr;
        const neg: Literal = '¬' + varr;
        Scores.set(pos, 0);
        Scores.set(neg, 0);
        for (const C of Clauses) {
          const clause = C as Clause;
          const size = clause.size;
          if (clause.has(pos)) {
            Scores.set(pos, (Scores.get(pos) || 0) + Math.pow(2, -size));
          }
          if (clause.has(neg)) {
            Scores.set(neg, (Scores.get(neg) || 0) + Math.pow(2, -size));
          }
        }
      }
    }
    let maxLiteral: Literal = '';
    let maxScore = -Infinity;
    for (const [lit, score] of Scores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        maxLiteral = lit;
      }
    }
    return maxLiteral;
}


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
    // use the Jereslow-Wang heuristic to select the most promising literal l
    const l = selectLiteral(S, Variables, UsedVars);
    const lBar = complement(l);
    const p = extractVariable(l);
    const nextUsedVars = UsedVars.union(new RecursiveSet<Variable>(p));
    // Branch 1: {l}
    const unitL = new RecursiveSet<Clause>();
    const cL = new RecursiveSet<Literal>(); 
    cL.add(l);
    unitL.add(cL);
    const Result1 = solveRecursive(S.union(unitL), Variables, nextUsedVars);
    if (!Result1.has(EmptyClause)) {
      return Result1;
    }
    // Branch 2: {lBar}
    const unitLBar = new RecursiveSet<Clause>();
    const cLBar = new RecursiveSet<Literal>(); 
    cLBar.add(lBar);
    unitLBar.add(cLBar);
    return solveRecursive(S.union(unitLBar), Variables, nextUsedVars);
}

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

// --- Ausgabe ---

export function literal_to_str(C: Clause): string {
  const val = arb(C);
  if (val === null) return "{}";
  const l = val as Literal;
  
  if (l.startsWith('¬')) {
    return `${l.substring(1)} ↦ False`;
  } else {
    return `${l} ↦ True`;
  }
}

export function prettify(Clauses: RecursiveSet<Clause>): string {
  const res: string[] = [];
  for(const C of Clauses) res.push(C.toString());
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
