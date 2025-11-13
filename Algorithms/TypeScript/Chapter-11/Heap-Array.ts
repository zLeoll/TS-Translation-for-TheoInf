import { Graphviz } from "@hpcc-js/wasm";
import * as tslab from "tslab";

export interface HeapNode {
    mIndex: number;
    [key: string]: any;
}

export type HeapElement = [number, HeapNode];

export class DijkstraNode implements HeapNode {
    mValue: any;
    mIndex: number = 0;
    constructor(value: any) {
        this.mValue = value;
    }
    toString(): string {
        return this.mValue.toString();
    }
    static compare(a: DijkstraNode, b: DijkstraNode): number {
        if (a.mValue < b.mValue) return -1;
        if (a.mValue > b.mValue) return 1;
        return 0;
    }
}

export async function heapToDot(A: HeapElement[]): Promise<void> {
    const n = A.length;
    let dot = 'digraph {\n';
    dot += 'node [shape=record];\n';
    for (let k = 0; k < n; k++) {
        const [p, o] = A[k];
        if (String(p) !== String(o)) {
            dot += `${k} [label="{${p}|${o}|${o.mIndex}}", style=rounded];\n`;
        } else {
            dot += `${k} [label="{${p}|${k}}", style=rounded];\n`;
        }
    }
    dot += '\n';
    for (let k = 0; k < Math.floor(n / 2); k++) {
        if (2 * k + 1 < n) {
            dot += `${k} -> ${2 * k + 1};\n`;
        }
        if (2 * k + 2 < n) {
            dot += `${k} -> ${2 * k + 2};\n`;
        }
    }
    dot += '}\n';
    const gv = await Graphviz.load();
    const svg = gv.layout(dot, "svg", "dot");
    tslab.display.html(svg);
}

function less(a: HeapElement, b: HeapElement): boolean {
    const [pa, oa] = a;
    const [pb, ob] = b;
    if (pa < pb) return true;
    if (pa > pb) return false;
    return DijkstraNode.compare(oa as DijkstraNode, ob as DijkstraNode) < 0;
}

function swap(A: HeapElement[], i: number, j: number): void {
    const [pi, oi] = A[i];
    const [pj, oj] = A[j];
    oi.mIndex = j;
    oj.mIndex = i;
    A[i] = [pj, oj];
    A[j] = [pi, oi];
}

function ascend(A: HeapElement[], k: number): number {
    while (k > 0) {
        const p = Math.floor((k - 1) / 2);
        if (less(A[k], A[p])) {
            swap(A, p, k);
            k = p;
        } else {
            return k;
        }
    }
    return 0;
}

function descend(A: HeapElement[]): void {
    const n = A.length - 1;
    let k = 0;
    while (2 * k + 1 <= n) {
        let j = 2 * k + 1;
        if (j + 1 <= n && less(A[j + 1], A[j])) {
            j += 1;
        }
        if (less(A[k], A[j])) {
            return;
        }
        swap(A, k, j);
        k = j;
    }
}

export function insert(H: HeapElement[], x: HeapElement): void {
    const n = H.length;
    H.push(x);
    const [_, o] = x;
    o.mIndex = n;
    const k = ascend(H, n);
    o.mIndex = k;
}

export function elevate(H: HeapElement[], o: HeapNode, p: number): void {
    const k = o.mIndex;
    H[k] = [p, o];
    ascend(H, k);
}

export function remove(H: HeapElement[]): HeapElement {
    const [pFirst, oFirst] = H[0];
    const [pLast, oLast] = H[H.length - 1];
    oLast.mIndex = 0;
    H[0] = [pLast, oLast];
    H.pop();
    descend(H);
    return [pFirst, oFirst];
}