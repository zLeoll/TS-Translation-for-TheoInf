// --- Typ-Definitionen ---
export type Variable = string;
export type Value    = string | number;
export type Formula  = string;
export type Assignment = Record<Variable, Value>;
export type CSP = [Variable[], Value[], Formula[]];

// Callback Typ: Einfache Funktion, die void zurückgibt
export type VisualizationCallback = (assignment: Assignment) => void;

interface AnnotatedConstraint {
    formula: Formula;
    vars: Set<Variable>;
}

// --- Helper Funktionen ---
function collectVariables(expr: string): Set<string> {
    const identifierRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    const builtIns = new Set(['abs', 'min', 'max', 'pow', 'sum', 'len', 'Math', 'true', 'false']);
    const variables = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = identifierRegex.exec(expr)) !== null) {
        if (!builtIns.has(match[0])) variables.add(match[0]);
    }
    return variables;
}

function isSubset(subset: Set<string>, superset: Set<string>): boolean {
    for (let elem of subset) if (!superset.has(elem)) return false;
    return true;
}

function evaluateExpression(expr: string, context: Assignment): boolean {
    let jsExpr = expr.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!');
    const argNames = Object.keys(context);
    const argValues = Object.values(context);
    try {
        return new Function(...argNames, `return (${jsExpr});`)(...argValues);
    } catch (e) { return false; }
}

function isConsistent(
    variable: Variable, 
    value: Value, 
    assignment: Assignment, 
    constraints: AnnotatedConstraint[]
): boolean {
    const newAssignment = { ...assignment, [variable]: value };
    const assignedVars = new Set(Object.keys(newAssignment));

    for (const { formula, vars } of constraints) {
        if (vars.has(variable) && isSubset(vars, assignedVars)) {
            if (!evaluateExpression(formula, newAssignment)) return false;
        }
    }
    return true;
}

// --- Backtrack Search ---

function backtrackSearch(
    assignment: Assignment, 
    csp: [Variable[], Value[], AnnotatedConstraint[]], 
    state: { steps: number },
    onUpdate?: VisualizationCallback // Optionaler Callback
): [number, Assignment] | null {
    
    // Visualisierung aufrufen, wenn vorhanden
    if (onUpdate) {
        onUpdate(assignment);
    }

    const [variables, values, constraints] = csp;

    if (Object.keys(assignment).length === variables.length) {
        return [state.steps, assignment];
    }

    const unassignedVar = variables.find(v => !(v in assignment));
    if (!unassignedVar) return null;

    for (const value of values) {
        state.steps++;
        if (isConsistent(unassignedVar, value, assignment, constraints)) {
            const newAssignment = { ...assignment, [unassignedVar]: value };
            const result = backtrackSearch(newAssignment, csp, state, onUpdate);
            if (result) return result;
        }
    }
    return null;
}

// --- Exportierte Solve Funktion ---

export function solve(
    csp: CSP, 
    onUpdate?: VisualizationCallback // Hier übergeben wir showSolution
): [number, Assignment] | null {
    
    const [variables, values, constraints] = csp;
    const state = { steps: 0 };

    const annotatedConstraints = constraints.map(f => ({
        formula: f,
        vars: collectVariables(f)
    }));

    const result = backtrackSearch({}, [variables, values, annotatedConstraints], state, onUpdate);
    
    console.log(`Tested ${state.steps} partial assignments`);
    return result;
}
