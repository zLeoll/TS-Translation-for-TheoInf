export function tokenize(s: string): string[] {
    const lexSpec = /([ ,:\t]+)|([a-z][A-Za-z0-9]*)|([A-Z][A-Za-z0-9]*)|([⊤⊥∧∨¬→↔⊕∀∃()])/g;
    const tokenArray = Array.from(s.matchAll(lexSpec));
    const result: string[] = [];
    for (const match of tokenArray) {
        const ws = match[1];
        const identifier = match[2];
        const funcSymbol = match[3];
        const operator = match[4];
        if (ws) {
            continue;
        }
        if (identifier) {
            result.push(identifier);
        }
        if (funcSymbol) {
            result.push(funcSymbol);
        }
        if (operator) {
            result.push(operator);
        }
    }
    return result;
};

export function isVariable(s: string, Variables: Set<string> | null): boolean {
    const varRegex = /^[a-z][A-Za-z0-9]*$/;
    if (Variables === null) {
        return varRegex.test(s);
    } else {
        if (varRegex.test(s)) {
            if (Variables.has(s)) {
                return true;
            } else {
                console.error(`Syntax error: ${s} is not declared as a variable!`);
                throw new SyntaxError(`Variable "${s}" not declared`);
            }
        }
    }
    return false;
};

export function isFunction(s: string): boolean {
    const funcRegex = /^[A-Z][A-Za-z0-9]*$/;
    return funcRegex.test(s);
};

export type Formula = string | [string, ...Formula[]];

export class LogicParser {

    private _tokens: string[];
    private _operators: string[];
    private _arguments: Formula[];
    private _variables: Set<string> | null;
    private _input: string;

    constructor(s: string, Variables?: Set<string> | null) {
        this._tokens = tokenize(s).reverse();
        this._operators = [];
        this._arguments = [];
        this._variables = Variables ?? null;
        this._input = s;
    }

    parse(): Formula {
        // Parse the token list and return a Formula that is represented as a
        // nested array.
        while (this._tokens.length !== 0) {
            const nextOp = this._tokens.pop()!;
            if (isVariable(nextOp, this._variables)) {
                this._arguments.push(nextOp);
                continue;
            }
            if (isFunction(nextOp)) {
                this._operators.push(nextOp);
                this._arguments.push("(");
                continue;
            }
            if (nextOp === "⊤" || nextOp === "⊥") {
                this._operators.push(nextOp);
                continue;
            }
            if (this._operators.length === 0 || nextOp === "(") {
                this._operators.push(nextOp);
                continue;
            }
            const stackOp = this._operators[this._operators.length - 1];
            if (stackOp === "(" && nextOp === ")") {
                this._operators.pop();
                if (this._operators.length > 0) {
                    const fct = this._operators[this._operators.length - 1];
                    if (isFunction(fct)) {
                        this._popAndEvaluate();
                    }
                }
            } else if (nextOp === ")" || this._evalBefore(stackOp, nextOp)) {
                this._popAndEvaluate();
                this._tokens.push(nextOp);
            } else {
                this._operators.push(nextOp);
            }
        }
        while (this._operators.length !== 0) {
            this._popAndEvaluate();
        }
        if (this._arguments.length !== 1) {
            throw new Error(`Could not parse: ${this._input}`);
        }
        return this._arguments.pop()!;
    }

    _evalBefore(stackOp: string, nextOp: string): boolean {
        if (stackOp === "(") return false;
        if (isFunction(stackOp)) return true;
        const precedences: { [key: string]: number } = {
            "↔": 1, "→": 2, "⊕": 3, "∨": 4, "∧": 5,
            "¬": 6, "∀": 7, "∃": 7, "⊤": 8, "⊥": 8,
        };
        if (precedences[stackOp] > precedences[nextOp]) {
            return true;
        } else if (precedences[stackOp] === precedences[nextOp]) {
            if ((stackOp === "∀" || stackOp === "∃") && (nextOp === "∀" || nextOp === "∃")) {
                return false;
            }
            if (stackOp === nextOp) {
                return ["∧", "∨", "⊕"].includes(stackOp);
            }
            return true;
        }
        return false;
    }

    _popAndEvaluate(): void {
        const op = this._operators.pop()!;
        if (op === "⊤" || op === "⊥") {
            this._arguments.push([op]);
            return;
        }
        if (op === "¬") {
            const arg = this._arguments.pop()!;
            this._arguments.push(["¬", arg]);
            return;
        }
        if (isFunction(op)) {
            let args: Formula[] = [];
            let arg = this._arguments.pop();
            while (arg !== "(") {
                args.unshift(arg!);
                arg = this._arguments.pop();
            }
            this._arguments.push([op, ...args]);
            return;
        }
        const rhs = this._arguments.pop()!;
        const lhs = this._arguments.pop()!;
        this._arguments.push([op, lhs, rhs]);
    }

    toString(): string {
        return `${this._tokens.toString()} ${this._arguments.toString()} ${this._operators.toString()}`;
    }
}