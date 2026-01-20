import { Tuple } from "./recursive-set";

// ============================================================================
// 1. Domain Types
// ============================================================================

type Variable = string;
type Operator = '↔' | '→' | '∧' | '∨' | '⊕';
type UnaryOp  = '¬';
type ConstOp  = '⊤' | '⊥';

// Precedence Map als Konstante (Single Source of Truth)
const PRECEDENCE: Record<string, number> = {
    '↔': 1,
    '→': 2,
    '⊕': 3,
    '∨': 4,
    '∧': 5,
    '¬': 6,
    '⊤': 7,
    '⊥': 7
};

// ============================================================================
// 2. AST Classes (Structural)
// ============================================================================

/** Represents a logical constant (⊤ or ⊥). */
class Constant extends Tuple<[ConstOp]> {
    constructor(val: ConstOp) { super(val); }
    get value() { return this.get(0); } // Return Type inferred as ConstOp
}

/** * Represents a negation (¬φ). 
 * Generic T allows us to restrict what is being negated (e.g., only Variables in NNF).
 */
class Negation<T extends Formula = Formula> extends Tuple<['¬', T]> {
    constructor(phi: T) { super('¬', phi); }
    
    get phi(): T { return this.get(1); }
}

/** * Represents a binary operation (φ ∘ ψ). 
 * Generics L and R allow restricting the operand types.
 */
class BinaryFormula<L extends Formula = Formula, R extends Formula = Formula> 
    extends Tuple<[Operator, L, R]> {
    
    constructor(op: Operator, left: L, right: R) {
        super(op, left, right);
    }

    get operator() { return this.get(0); } 
    get left(): L  { return this.get(1); } // Return Type ist jetzt L
    get right(): R { return this.get(2); } // Return Type ist jetzt R
}

type Formula = Variable | Constant | Negation | BinaryFormula;

// ============================================================================
// 3. Parser Logic
// ============================================================================

const LEX_TOKENIZER = /([ \t]+)|([A-Za-z][A-Za-z0-9<>,]*)|([⊤⊥∧∨¬→↔⊕()])/g;

/**
 * Splits the input string into a list of logic tokens.
 * Ignores whitespace.
 */
function tokenize(s: string): string[] {
    return Array.from(s.matchAll(LEX_TOKENIZER))
        .map(([_, _ws, ident, op]) => ident || op)
        .filter((t): t is string => !!t);
}

function isPropVar(s: string): boolean {
    return /^[A-Za-z][A-Za-z0-9<>,]*$/.test(s);
}

/**
 * A Shunting-Yard Parser for Propositional Logic.
 * Converts infix strings (e.g., "p ∧ q") into a Structural AST.
 */
class LogicParser {
    private tokens: string[];
    private operators: string[] = [];
    private argumentsList: Formula[] = [];
    private input: string;

    constructor(s: string) {
        this.input = s;
        // Reverse tokens to use pop() (O(1)) instead of shift() (O(N))
        this.tokens = tokenize(s).reverse();
    }

    parse(): Formula {
        while (this.tokens.length > 0) {
            const token = this.tokens.pop()!;
            
            if (isPropVar(token)) {
                this.argumentsList.push(token);
            } 
            else if (token === '⊤' || token === '⊥') {
                // Constants are treated like operands but wrapped immediately or later? 
                // In standard shunting yard, constants are operands.
                // We treat them as 0-arity operators here or push directly.
                this.argumentsList.push(new Constant(token));
            }
            else if (token === '(') {
                this.operators.push(token);
            }
            else if (token === ')') {
                let top = this.peekOperator();
                while (top !== undefined && top !== '(') {
                    this.popAndEvaluate();
                    top = this.peekOperator();
                }
                this.operators.pop(); // Pop '('
            }
            else {
                // It is an operator
                while (
                    this.operators.length > 0 && 
                    this.operators[this.operators.length - 1] !== '(' &&
                    this.shouldPop(this.operators[this.operators.length - 1], token)
                ) {
                    this.popAndEvaluate();
                }
                this.operators.push(token);
            }
        }
        
        while (this.operators.length > 0) {
            this.popAndEvaluate();
        }
        
        if (this.argumentsList.length !== 1) {
            throw new Error(`Parse Error: Invalid Formula "${this.input}". Stack: ${this.argumentsList}`);
        }
        
        return this.argumentsList.pop()!;
    }

    private peekOperator(): string | undefined {
        return this.operators[this.operators.length - 1];
    }

    /**
     * Determines operator precedence and associativity.
     * Returns true if `stackOp` should be processed before `currentOp`.
     */
    private shouldPop(stackOp: string, currentOp: string): boolean {
        const p1 = PRECEDENCE[stackOp] || 0;
        const p2 = PRECEDENCE[currentOp] || 0;

        if (p1 > p2) return true;
        if (p1 < p2) return false;

        // Same precedence: Check associativity.
        // Left-associative (∧, ∨, ↔, ⊕) -> pop.
        // Right-associative (→, ¬) -> push (don't pop).
        // Note: ¬ is unary, usually handled differently, but strict precedence works here.
        return stackOp !== '→' && stackOp !== '¬';
    }

    private popAndEvaluate(): void {
        const op = this.operators.pop();
        if (!op) return;

        // TypeScript Narrowing Magic:
        switch (op) {
            case '¬': {
                const arg = this.argumentsList.pop();
                if (!arg) throw new Error("Syntax Error: '¬' expects an operand.");
                this.argumentsList.push(new Negation(arg));
                break;
            }

            case '∧':
            case '∨':
            case '→':
            case '↔':
            case '⊕': {
                const right = this.argumentsList.pop();
                const left = this.argumentsList.pop();
                
                if (!left || !right) throw new Error(`Syntax Error: '${op}' expects 2 operands.`);
                
                // NO CAST NEEDED!
                // TS knows 'op' is one of '∧'|'∨'|'→'|'↔'|'⊕', which is assignable to Operator.
                this.argumentsList.push(new BinaryFormula(op, left, right));
                break;
            }

            default:
                throw new Error(`Unknown operator: ${op}`);
        }
    }
}

export { LogicParser, Formula, Variable, Constant, Negation, BinaryFormula, Operator };