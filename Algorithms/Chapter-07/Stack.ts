export class Stack<T> {
    mStackElements: T[];
    constructor() {
        this.mStackElements = [];
    }

    push(e: T): void {
        this.mStackElements.push(e);
    }

    pop(): T {
        const val = this.mStackElements.pop();
        if (val === undefined) {
            throw new Error("popping empty stack");
        }
        return val;
    }

    top(): T {
        if (this.mStackElements.length === 0) {
            throw new Error("top of empty stack");
        }
        return this.mStackElements[this.mStackElements.length - 1];
    }

    isEmpty(): boolean {
        return this.mStackElements.length === 0;
    }

    copy(): Stack<T> {
        const C = new Stack<T>();
        C.mStackElements = [...this.mStackElements];
        return C;
    }

    toString(): string {
        const C = this.copy();
        const result = C.convert();
        const dashes = "-".repeat(result.length);
        return [dashes, result, dashes].join("\n");
    }

    convert(): string {
        if (this.isEmpty()) {
            return '|';
        }
        const top = this.top();
        this.pop();
        return this.convert() + ' ' + String(top) + ' |';
    }
}

export function createStack<T>(L: T[]): Stack<T> {
    const S = new Stack<T>();
    for (const x of L) {
        S.push(x);
        console.log(S.toString());
    }
    return S;
}