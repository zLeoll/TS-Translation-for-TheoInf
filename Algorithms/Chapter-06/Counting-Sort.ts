export function countingSort<T>(A: [T, number][], maxKey = 255): [T, number][] {
    const Counts = new Array<number>(maxKey + 1).fill(0);
    const Index = new Array<number>(maxKey + 1).fill(0);
    const Sorted = new Array<[T, number]>(A.length);

    for (const [, key] of A) {
        if (key < 0 || key > maxKey) throw new Error(`key out of range: ${key}`);
        Counts[key]++;
    }

    Index[0] = 0;
    for (let k = 0; k < maxKey; k++) {
        Index[k + 1] = Index[k] + Counts[k];
    }

    for (const [val, key] of A) {
        const i = Index[key];
        Sorted[i] = [val, key];
        Index[key]++;
    }

    return Sorted;
}
