import { LogicParser, Formula, Variable, Constant, Negation, BinaryFormula, Operator } from './Propositional-Logic-Parser';
import { RecursiveSet } from './recursive-set';

// ============================================================================
// 1. Strict NNF Domain Classes
// ============================================================================

/** * Strict Negation for NNF: Can ONLY wrap a Variable.
 */
class NNFNegation extends Negation<Variable> {
    constructor(v: Variable) {
        super(v);
    }
}

/** * Strict Conjunction (AND).
 */
class NNFConjunction extends BinaryFormula<NNF, NNF> {
    constructor(left: NNF, right: NNF) {
        super('∧', left, right);
    }
}

/** Strict Disjunction (OR). */
class NNFDisjunction extends BinaryFormula<NNF, NNF> {
    constructor(left: NNF, right: NNF) {
        super('∨', left, right);
    }
}

// ============================================================================
// 2. Types
// ============================================================================

// Recursive Definition: An NNF formula is built only from these components.
type NNF = Variable | Constant | NNFNegation | NNFConjunction | NNFDisjunction;

// A Literal is an atom (A) or its negation (¬A).
type Literal = Variable | NNFNegation;

// A Clause is a Disjunction of Literals (represented as a Set).
// Example: {A, ¬B, C} means (A ∨ ¬B ∨ C)
type Clause = RecursiveSet<Literal>;

// A CNF is a Conjunction of Clauses (represented as a Set of Sets).
// Example: {{A, B}, {¬C}} means (A ∨ B) ∧ (¬C)
type CNF = RecursiveSet<Clause>;


// ============================================================================
// 3. Normalization Pipeline
// ============================================================================

function parse(s: string): Formula {
    return new LogicParser(s).parse();
}

/**
 * Step 1: Eliminate Biconditionals (↔) and XOR (⊕).
 * - A ↔ B ≡ (A → B) ∧ (B → A)
 * - A ⊕ B ≡ (A ∨ B) ∧ (¬A ∨ ¬B)
 */
function eliminateBiconditional(f: Formula): Formula {
    if (typeof f === 'string') return f;
    if (f instanceof Constant) return f;
    
    if (f instanceof Negation) {
        return new Negation(eliminateBiconditional(f.phi));
    }
    
    if (f instanceof BinaryFormula) {
        const l = eliminateBiconditional(f.left);
        const r = eliminateBiconditional(f.right);
        
        switch (f.operator) {
            case '↔':
                return new BinaryFormula('∧', 
                    new BinaryFormula('→', l, r), 
                    new BinaryFormula('→', r, l)
                );
            case '⊕':
                return new BinaryFormula('∧',
                    new BinaryFormula('∨', l, r),
                    new BinaryFormula('∨', new Negation(l), new Negation(r))
                );
            default:
                return new BinaryFormula(f.operator, l, r);
        }
    }
    throw new Error("Unknown formula type during elimination.");
}

/**
 * Step 2: Eliminate Conditionals (→).
 * - A → B ≡ ¬A ∨ B
 */
function eliminateConditional(f: Formula): Formula {
    if (typeof f === 'string') return f;
    if (f instanceof Constant) return f;
    
    if (f instanceof Negation) {
        return new Negation(eliminateConditional(f.phi));
    }
    
    if (f instanceof BinaryFormula) {
        const l = eliminateConditional(f.left);
        const r = eliminateConditional(f.right);
        
        if (f.operator === '→') {
            return new BinaryFormula('∨', new Negation(l), r);
        }
        return new BinaryFormula(f.operator, l, r);
    }
    return f;
}

/**
 * Step 3: Convert to Negation Normal Form (NNF).
 * Pushes negations inwards using De Morgan's laws until they hit variables.
 */
function nnf(f: Formula): NNF {
    if (typeof f === 'string') return f; 
    if (f instanceof Constant) return f; 
    
    if (f instanceof Negation) {
        return neg(f.phi);
    }
    
    if (f instanceof BinaryFormula) {
        if (f.operator === '∧') return new NNFConjunction(nnf(f.left), nnf(f.right));
        if (f.operator === '∨') return new NNFDisjunction(nnf(f.left), nnf(f.right));
        
        throw new Error(`Operator ${f.operator} should have been eliminated before NNF.`);
    }
    throw new Error("Unknown formula type in NNF pass.");
}

/** * Helper: Computes NNF of ¬f (Pushing Negation Inwards).
 * Applies De Morgan's Laws and Double Negation elimination.
 */
function neg(f: Formula): NNF {
    // 1. Base Case: ¬Variable -> Literal
    if (typeof f === 'string') {
        return new NNFNegation(f);
    }
    
    // 2. Constants: Flip Truth Value
    if (f instanceof Constant) {
        return new Constant(f.value === '⊤' ? '⊥' : '⊤');
    }
    
    // 3. Double Negation: ¬(¬A) -> A
    if (f instanceof Negation) {
        return nnf(f.phi);
    }
    
    // 4. De Morgan's Laws
    if (f instanceof BinaryFormula) {
        // ¬(A ∧ B) -> ¬A ∨ ¬B
        if (f.operator === '∧') return new NNFDisjunction(neg(f.left), neg(f.right));
        // ¬(A ∨ B) -> ¬A ∧ ¬B
        if (f.operator === '∨') return new NNFConjunction(neg(f.left), neg(f.right));
    }
    
    throw new Error("Unexpected formula type in neg.");
}

/**
 * Step 4: Convert NNF to CNF (Conjunctive Normal Form).
 * Applies Distributivity to move ORs inside ANDs.
 */
function cnf(f: NNF): CNF {
    // Case 1: Literal (Variable or ¬Variable)
    if (typeof f === 'string' || f instanceof NNFNegation) {
        const clause = new RecursiveSet<Literal>(f);
        return new RecursiveSet<Clause>(clause);
    }
    
    // Case 2: Constant
    if (f instanceof Constant) {
        if (f.value === '⊤') return new RecursiveSet<Clause>(); 
        
        const emptyClause = new RecursiveSet<Literal>();
        return new RecursiveSet<Clause>(emptyClause);
    }
    
    // Case 3: Conjunction (AND)
    if (f instanceof NNFConjunction) {
        const left = cnf(f.left); 
        const right = cnf(f.right);
        return left.union(right);
    }
    
    // Case 4: Disjunction (OR)
    if (f instanceof NNFDisjunction) {
        const left = cnf(f.left);
        const right = cnf(f.right);
        
        const result = new RecursiveSet<Clause>();
        
        for (const c1 of left) {
            for (const c2 of right) {
                result.add(c1.union(c2));
            }
        }
        return result;
    }
    throw new Error("Unknown NNF type in CNF pass.");
}

// ============================================================================
// 4. Simplification
// ============================================================================

function getComplement(l: Literal): Literal {
    if (typeof l === 'string') return new NNFNegation(l);
    return l.phi; // Return the variable inside the NNFNegation
}

/**
 * Checks if a clause is a Tautology (contains A and ¬A).
 */
function isTrivial(clause: Clause): boolean {
    for (const lit of clause) {
        const comp = getComplement(lit);
        if (clause.has(comp)) return true;
    }
    return false;
}

/**
 * Simplifies a CNF by removing trivial clauses (Tautologies).
 */
function simplify(clauses: CNF): CNF {
    const result = new RecursiveSet<Clause>();
    for (const clause of clauses) {
        if (!isTrivial(clause)) result.add(clause);
    }
    return result;
}

// ============================================================================
// 5. Public API
// ============================================================================

/**
 * Normalizes a propositional formula into Conjunctive Normal Form (CNF).
 * Pipeline: Eliminate ↔/→  =>  NNF  =>  CNF  =>  Simplify
 */
function normalize(f: Formula): CNF {
    const noBi   = eliminateBiconditional(f);
    const noImp  = eliminateConditional(noBi);
    const inNNF  = nnf(noImp);
    const inCNF  = cnf(inNNF);
    return simplify(inCNF);
}

export { NNFNegation, Literal, Clause, CNF, getComplement, normalize };