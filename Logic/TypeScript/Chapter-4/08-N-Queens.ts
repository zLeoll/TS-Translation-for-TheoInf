import { RecursiveSet } from './recursive-set';
import { Literal, Clause, CNF, NNFNegation } from './04-CNF'; 
import * as DP from './07-Davis-Putnam-JW'; // Unser Solver

// ============================================================================
// 1. HELPER & CONSTRAINT GENERATION (STRICT NNF)
// ============================================================================

type Variable = string;

function varName(row: number, col: number): Variable {
    return `Q<${row},${col}>`;
}

/**
 * Erzeugt Klauseln für "Höchstens eine Dame in der Menge S".
 * Logik: Für alle Paare (p, q) füge Klausel { ¬p, ¬q } hinzu.
 */
function atMostOne(S: RecursiveSet<Variable>): CNF {
    // Expliziter Typ: Wir bauen ein CNF (Set of Clauses)
    const result = new RecursiveSet<Clause>();
    const arr = Array.from(S);

    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            const p = arr[i];
            const q = arr[j];

            // Clause: { ¬p, ¬q }
            const clause = new RecursiveSet<Literal>();
            
            // Typsicher: Wir instanziieren Literal-Objekte (NNFNegation)
            clause.add(new NNFNegation(p));
            clause.add(new NNFNegation(q));
            
            result.add(clause);
        }
    }
    return result;
}

function atMostOneInRow(row: number, n: number): CNF {
    const VarsInRow = new RecursiveSet<Variable>();
    for (let col = 1; col <= n; col++) {
        VarsInRow.add(varName(row, col));
    }
    return atMostOne(VarsInRow);
}

function oneInColumn(col: number, n: number): CNF {
    // Clause: { Q<1,c>, Q<2,c>, ... } (Mindestens eine Dame pro Spalte)
    const VarsInColumn = new RecursiveSet<Literal>();
    for (let row = 1; row <= n; row++) {
        VarsInColumn.add(varName(row, col));
    }
    
    const result = new RecursiveSet<Clause>();
    result.add(VarsInColumn);
    return result;
}

function atMostOneInFallingDiagonal(k: number, n: number): CNF {
    const Vars = new RecursiveSet<Variable>();
    for (let row = 1; row <= n; row++) {
        for (let col = 1; col <= n; col++) {
            if (row - col === k) Vars.add(varName(row, col));
        }
    }
    return atMostOne(Vars);
}

function atMostOneInRisingDiagonal(k: number, n: number): CNF {
    const Vars = new RecursiveSet<Variable>();
    for (let row = 1; row <= n; row++) {
        for (let col = 1; col <= n; col++) {
            if (row + col === k) Vars.add(varName(row, col));
        }
    }
    return atMostOne(Vars);
}

function allClauses(n: number): CNF {
    // Wir definieren result direkt als CNF (RecursiveSet<Clause>)
    const result = new RecursiveSet<Clause>();
    
    // Helper, um Sets zu mergen
    const add = (s: CNF) => { for (const c of s) result.add(c); };

    for (let row = 1; row <= n; row++) add(atMostOneInRow(row, n));
    for (let col = 1; col <= n; col++) add(oneInColumn(col, n));
    
    // Diagonalen Constraints
    for (let k = -(n - 2); k <= n - 2; k++) add(atMostOneInFallingDiagonal(k, n));
    for (let k = 3; k <= 2 * n; k++) add(atMostOneInRisingDiagonal(k, n));
    
    return result; // Kein Cast nötig, da result bereits CNF ist
}

// ============================================================================
// 2. VISUALIZATION (ASCII)
// ============================================================================

/**
 * Filtert die Lösung und gibt nur die Variablen zurück, die WAHR sind.
 * (Positive Literale in den Unit-Clauses der Lösung).
 */
function removeNegativeLiterals(Solution: CNF): RecursiveSet<Variable> {
    const Result = new RecursiveSet<Variable>();
    
    for (const C of Solution) {
        // C ist eine Unit-Clause { L }
        for (const lit of C) {
            // TYPE GUARD: 
            // Literal ist (string | NNFNegation).
            // Wenn es ein string ist, ist es eine Variable.
            if (typeof lit === 'string') {
                Result.add(lit); // TS weiß hier: lit ist string.
            }
        }
    }
    return Result;
}

function transform(Solution: CNF): Record<number, number> {
    const positiveLiterals = removeNegativeLiterals(Solution);
    const Result: Record<number, number> = {};
    
    for (const name of positiveLiterals) {
        // name ist hier garantiert string (Variable)
        const left = name.indexOf('<');
        const comma = name.indexOf(',');
        const right = name.indexOf('>');
        
        const row = name.substring(left + 1, comma);
        const col = name.substring(comma + 1, right);
        
        Result[parseInt(row, 10)] = parseInt(col, 10);
    }
    return Result;
}

function showSolutionASCII(Solution: CNF, n: number) {
    const transformed = transform(Solution);
    
    // Keine positiven Variablen gefunden? Dann ist es UNSAT (oder leere Lösung).
    if (Object.keys(transformed).length === 0) {
        console.log("No solution found (UNSAT).");
        return;
    }

    const boardArray: string[][] = Array.from({ length: n }, () => Array(n).fill('.'));
    for (let row = 1; row <= n; row++) {
        const col = transformed[row];
        if (col !== undefined) {
            // Array Index ist 0-basiert, Logik ist 1-basiert
            if (row - 1 < n && col - 1 < n) {
                boardArray[row - 1][col - 1] = 'Q';
            }
        }
    }
    
    console.log(`\nSolution for ${n}-Queens (Strict NNF):`);
    for (let r = 0; r < n; r++) {
        console.log(boardArray[r].join(' '));
    }
}

// ============================================================================
// 3. BENCHMARK RUNNER
// ============================================================================

function calculateStats(times: number[]) {
    if (times.length === 0) return { min: 0, max: 0, avg: 0, median: 0, stdDev: 0 };

    const min = Math.min(...times);
    const max = Math.max(...times);
    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / times.length;
    
    const sorted = [...times].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const squareDiffs = times.map(t => Math.pow(t - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    return { min, max, avg, median, stdDev };
}

function runBenchmark(n: number, iterations: number) {
    console.log(`\n🚀 Starting Benchmark for ${n}-Queens (STRICT NNF Objects)`);
    console.log(`Runs: ${iterations}`);
    console.log("------------------------------------------------------------");

    console.log("Generating clauses...");
    const Clauses = allClauses(n);
    console.log(`Clauses generated: ${Clauses.size}`);

    console.log("🔥 Warming up engine (5 runs)...");
    // Kurzer Warmup, damit JIT Compiler greift
    for (let i = 0; i < 5; i++) DP.solve(Clauses);
    console.log("Warmup complete.");

    console.log("⏱️  Measuring...");
    const durations: number[] = [];
    let lastSolution: CNF | null = null;

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        lastSolution = DP.solve(Clauses);
        const end = performance.now();
        
        durations.push(end - start);
        if (i % 10 === 0) process.stdout.write('.');
    }
    console.log("\n");

    const stats = calculateStats(durations);

    console.log("📊 NNF RESULTS 📊");
    console.log("============================");
    console.log(`Min:     ${stats.min.toFixed(2)} ms`);
    console.log(`Max:     ${stats.max.toFixed(2)} ms`);
    console.log(`Avg:     ${stats.avg.toFixed(2)} ms`);
    console.log(`Median:  ${stats.median.toFixed(2)} ms`);
    console.log(`StdDev:  ±${stats.stdDev.toFixed(2)} ms`);
    console.log("============================");

    if (lastSolution) {
        showSolutionASCII(lastSolution, n);
    }
}

// Starte Benchmark
runBenchmark(16, 10);