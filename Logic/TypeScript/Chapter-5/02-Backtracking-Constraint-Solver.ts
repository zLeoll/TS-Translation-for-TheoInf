export type Variable = string;
export type Value = string | number;
export type Formula = string;
export type Assignment = Record<Variable, Value>;

export type CSPTuple = [Variable[], Value[], Formula[]];
export type AnnotatedCSP = [Variable[], Value[], Array<[Formula, Set<Variable>]>];

export function collectVariables(expr: string): Set<string> {
    const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    const builtIns = new Set(['true', 'false']);
    const variables = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = identifierRegex.exec(expr)) !== null) {
        if (!builtIns.has(match[0])) variables.add(match[0]);
    }
    return variables;
}

export function intersection<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    return new Set([...setA].filter(x => setB.has(x)));
}

export function isSubset<T>(subset: Set<T>, superset: Set<T>): boolean {
    for (let elem of subset) {
        if (!superset.has(elem)) return false;
    }
    return true;
}

export function evaluateExpression(expression: string, context: Record<string, any>): any {
    const argNames = Object.keys(context);
    const argValues = Object.values(context);
    const dynamicFunc = new Function(...argNames, `return (${expression});`);
    return dynamicFunc(...argValues);
}

export function isConsistent(
    variable: Variable,
    value: Value,
    assignment: Assignment,
    constraints: Array<[Formula, Set<Variable>]>
): boolean {
    const newAssignment = { ...assignment, [variable]: value };
    const assignedVars = new Set(Object.keys(newAssignment));

    for (const [formula, varsInFormula] of constraints) {
        if (varsInFormula.has(variable) && isSubset(varsInFormula, assignedVars)) {
            try {
                const argNames = Object.keys(newAssignment);
                const argValues = Object.values(newAssignment);
                const checkFunc = new Function(...argNames, `return (${formula});`);

                if (!checkFunc(...argValues)) {
                    return false;
                }
            } catch (e) {
                console.error(`Fehler beim Auswerten von "${formula}":`, e);
                return false;
            }
        }
    }
    return true;
}

export function backtrackSearch(assignment: Assignment, csp: AnnotatedCSP): Assignment | null {
    const [variables, values, constraints] = csp;

    if (Object.keys(assignment).length === variables.length) {
        return assignment;
    }

    const unassignedVar = variables.find(v => !(v in assignment));

    if (!unassignedVar) return null;

    for (const value of values) {
        if (isConsistent(unassignedVar, value, assignment, constraints)) {
            const newAssignment = { ...assignment, [unassignedVar]: value };
            const result = backtrackSearch(newAssignment, csp);
            if (result !== null) {
                return result;
            }
        }
    }
    return null;
}

export function solve(csp: CSPTuple): Assignment | null {
    const [variables, values, constraints] = csp;

    const annotatedConstraints: Array<[Formula, Set<Variable>]> = constraints.map(f => {
        const varsInFormula = collectVariables(f);
        const varsInProblem = new Set(variables);
        return [f, intersection(varsInFormula, varsInProblem)];
    });

    const annotatedCSP: AnnotatedCSP = [variables, values, annotatedConstraints];
    return backtrackSearch({}, annotatedCSP);
}
