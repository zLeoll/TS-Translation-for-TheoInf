export class Stack {
    mStackElements: any[];
    constructor() {
        this.mStackElements = [];
    }

    push(e: any): void {
        this.mStackElements.push(e);
    }

    pop(): any {
        if (this.mStackElements.length === 0) {
            throw new Error("popping empty stack");
        }
        this.mStackElements.pop();
    }

    top(): any {
        if (this.mStackElements.length === 0) {
            throw new Error("top of empty stack");
        }
        return this.mStackElements[this.mStackElements.length - 1];
    }

    isEmpty(): boolean {
        return this.mStackElements.length === 0;
    }

    copy(): Stack {
        const C = new Stack();
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

export function createStack(L: any[]): Stack {
    const S = new Stack();
    for (const x of L) {
        S.push(x);
        console.log(S.toString());
    }
    return S;
}