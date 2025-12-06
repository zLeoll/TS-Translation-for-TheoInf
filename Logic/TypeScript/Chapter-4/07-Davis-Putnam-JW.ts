import { RecursiveSet } from './Recursive-Set';

export type Variable = string;
export type Literal = Variable | ['¬', Variable];
export type Clause = RecursiveSet<Literal>;

export function complement(l: Literal): Literal {
  if (Array.isArray(l)) {
    return l[1];
  } else {
    return ['¬', l];
  }
}

export function extractVariable(l: Literal): Variable {
  if (Array.isArray(l)) {
    return l[1];
  } else {
    return l;
  }
}

function sameLiteral(a: Literal, b: Literal): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a[0] === '¬' && b[0] === '¬' && a[1] === b[1];
  }
  return !Array.isArray(a) && !Array.isArray(b) && a === b;
}

export function arb<T>(S: RecursiveSet<T>): T | RecursiveSet<T> | null {
  for (const x of S) {
    return x;
  }
  return null;
}

export function selectLiteral(
  Clauses: RecursiveSet<Clause>,
  Variables: RecursiveSet<Variable>,
  UsedVars: RecursiveSet<Variable>
): Literal {
  let maxLiteral: Literal = Array.from(Variables)[0] ?? 'x';
  let maxScore = -Infinity;
  for (const variable of Variables) {
    if (!UsedVars.has(variable)) {
      const pos: Literal = variable;
      const neg: Literal = ['¬', variable];
      let posScore = 0;
      let negScore = 0;
      for (const C of Clauses) {
        const clause = C as Clause;
        const size = clause.size;
        for (const lit of clause) {
          if (!Array.isArray(lit) && lit === variable) {
            posScore += Math.pow(2, -size);
          } else if (Array.isArray(lit) && lit[0] === '¬' && lit[1] === variable) {
            negScore += Math.pow(2, -size);
          }
        }
      }
      if (posScore > maxScore) {
        maxScore = posScore;
        maxLiteral = pos;
      }
      if (negScore > maxScore) {
        maxScore = negScore;
        maxLiteral = neg;
      }
    }
  }
  return maxLiteral;
}

export function reduce(Clauses: RecursiveSet<Clause>, l: Literal): RecursiveSet<Clause> {
  const lBar = complement(l);
  const result = new RecursiveSet<Clause>();
  for (const clause of Clauses) {
    let hasL = false;
    let hasLBar = false;
    for (const lit of clause) {
      if (sameLiteral(lit, l)) hasL = true;
      if (sameLiteral(lit, lBar)) hasLBar = true;
    }
    if (hasLBar) {
      const newClause = new RecursiveSet<Literal>();
      for (const lit of clause) {
        if (!sameLiteral(lit, lBar)) {
          newClause.add(lit);
        }
      }
      result.add(newClause);
    } else if (!hasL) {
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
  if (S.has(EmptyClause)) {
    const Falsum = new RecursiveSet<Clause>();
    Falsum.add(EmptyClause);
    return Falsum;
  }
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
  const l = selectLiteral(S, Variables, UsedVars);
  const lBar = complement(l);
  const p = extractVariable(l);
  const nextUsedVars = UsedVars.union(new RecursiveSet<Variable>(p));
  const unitL = new RecursiveSet<Clause>();
  const cL = new RecursiveSet<Literal>();
  cL.add(l);
  unitL.add(cL);
  const Result1 = solveRecursive(S.union(unitL), Variables, nextUsedVars);
  if (!Result1.has(EmptyClause)) {
    return Result1;
  }
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
