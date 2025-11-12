export type Formula = string | [string, ...Formula[]];

export function tokenize(s: string): string[] {
    const lexSpec = /([ \t]+)|([A-Za-z][A-Za-z0-9<>,]*)|([⊤⊥∧∨¬→↔⊕()])/g;
    const tokenList = Array.from(s.matchAll(lexSpec));
    const result: string[] = [];
    for (const match of tokenList) {
        const ws = match[1];
        const identifier = match[2];
        const operator = match[3];
        if (ws) continue;
        if (identifier) result.push(identifier);
        if (operator) result.push(operator);
    }
    return result;
}

export function isPropVar(s: string): boolean {
    return /^[A-Za-z][A-Za-z0-9<>,]*$/.test(s);
}

export interface ILogicParser {
    parse(): Formula;
    toString(): string;
}

export class LogicParser implements ILogicParser {
    private _tokens: string[];
    private _operators: string[];
    private _arguments: Formula[];
    private _input: string;

    constructor(s: string) {
        this._tokens = [...tokenize(s)].reverse();
        this._operators = [];
        this._arguments = [];
        this._input = s;
    }

    parse(): Formula {
        while (this._tokens.length !== 0) {
            const next_op = this._tokens.pop()!;
            if (isPropVar(next_op)) {
                this._arguments.push(next_op);
                continue;
            }
            if (next_op === '⊤' || next_op === '⊥') {
                this._operators.push(next_op);
                continue;
            }
            if (this._operators.length === 0 || next_op === '(') {
                this._operators.push(next_op);
                continue;
            }
            const stack_op = this._operators[this._operators.length - 1];
            if (stack_op === '(' && next_op === ')') {
                this._operators.pop();
            } else if (next_op === ')' || this._eval_before(stack_op, next_op)) {
                this._pop_and_evaluate();
                this._tokens.push(next_op);
            } else {
                this._operators.push(next_op);
            }
        }
        while (this._operators.length !== 0) {
            this._pop_and_evaluate();
        }
        if (this._arguments.length !== 1) {
            throw new Error(`could not parse ${this._input}`);
        }
        return this._arguments.pop()!;
    }

    private _eval_before(stack_op: string, next_op: string): boolean {
        if (stack_op === '(') return false;
        const precedences: { [key: string]: number } = {
            '↔': 1, '→': 2, '⊕': 3, '∨': 4, '∧': 5, '¬': 6, '⊤': 7, '⊥': 7
        };
        if (precedences[stack_op] > precedences[next_op]) {
            return true;
        } else if (precedences[stack_op] === precedences[next_op]) {
            if (stack_op === next_op) {
                return stack_op === '∧' || stack_op === '∨' || stack_op === '⊕';
            }
            return true;
        }
        return false;
    }

    private _pop_and_evaluate(): void {
        const op = this._operators.pop()!;
        if (op === '⊤' || op === '⊥') {
            this._arguments.push([op]);
            return;
        }
        if (op === '¬') {
            const arg = this._arguments.pop()!;
            this._arguments.push(['¬', arg]);
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