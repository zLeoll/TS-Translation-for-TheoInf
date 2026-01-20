/**
 * @module recursive-set
 * @version 8.0.0
 * @description
 * A specialized collection library supporting Value Semantics (Deep Equality)
 * and recursive structures (Sets of Sets, Maps as keys).
 * * Architecture:
 * - Engine: "Compact Layout" Hash Table (Open Addressing, Linear Probing).
 * - Storage: Dense arrays for data (iteration O(N)), Uint32Array for slots.
 * - Hashing: Bitwise optimized (Murmur-inspired) + XOR mixing for Sets.
 * - Contract: Accessing .hashCode freezes the object (Immutable-after-Hash).
 */

// ============================================================================
// 1. TYPE DEFINITIONS
// ============================================================================

/** Primitive types supported by the engine (string and number). */
type Primitive = string | number;

/** * A Value can be a primitive or a structural object (Object/Set/Map/Tuple).
 * Used recursively generics.
 */
type Value = Primitive | Structural;

/**
 * Interface for objects that support Value Semantics.
 * Any object implementing this can be used as a key in RecursiveMap or value in RecursiveSet.
 */
interface Structural {
    /** * Returns the hash code of the object. 
     * SIDE EFFECT: This MUST freeze the object to ensure the hash remains stable.
     */
    readonly hashCode: number;

    /** * Checks deep equality with another object.
     * @param other The object to compare with.
     */
    equals(other: unknown): boolean;
}

// ============================================================================
// 2. HASH ENGINE (Bitwise Optimized)
// ============================================================================

/**
 * Computes a 32-bit hash code for a given value.
 * - Numbers: Integer bit mixing.
 * - Strings: FNV-1a / Murmur-like iteration.
 * - Objects: Delegates to `.hashCode`.
 * * @param val The value to hash.
 * @returns A 32-bit integer.
 */
function getHashCode(val: Value): number {
    if (typeof val === 'number') {
        let h = val | 0; 
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = ((h >> 16) ^ h) * 0x45d9f3b;
        h = (h >> 16) ^ h;
        return h;
    }      
    if (typeof val === 'string') {
        let h = 0x811c9dc5;
        for (let i = 0; i < val.length; i++) {
            h ^= val.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h;
    } 
    // Recursive Structures: Accessing .hashCode triggers Freeze!
    if (val && typeof val === 'object') {
        return val.hashCode;
    }

    return 0;
}

/**
 * Determines deep equality between two values.
 * @param a First value.
 * @param b Second value.
 * @returns True if values are structurally equal.
 */
function areEqual(a: Value, b: Value): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    
    // Primitives
    if (typeof a === 'number' || typeof a === 'string') return a === b;

    // Deep Check
    if (typeof a === 'object' && a !== null && b !== null) {
        return a.equals(b);
    }
    return false;
}

/**
 * Global Comparator providing a Total Ordering.
 * Necessary for strictly ordered output (e.g. toString) or deterministic collision resolution.
 * * Logic:
 * 1. Identity check.
 * 2. Type segregation (Numbers < Strings < Objects).
 * 3. Hash code comparison (O(1) fast path).
 * 4. Deep recursive comparison (Collision resolution).
 * * @param a First value.
 * @param b Second value.
 * @returns Negative if a < b, positive if a > b, 0 if equal.
 */
/**
 * Universal Comparison Function (The "Spaceship Operator" <=>).
 * Defines a total ordering across ALL Value types.
 * * Order of Precedence:
 * 1. Identity (Ref check)
 * 2. Type Segregation (Number < String < Tuple < Set < Map)
 * 3. Hash Code (Fast Fail O(1))
 * 4. Structural Comparison (Deep Recursion)
 */
function compare(a: Value, b: Value): number {
    // 1. Identity Optimization
    if (a === b) return 0;
    
    // 2. Primitive Fast Paths
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : 1;

    // 3. Type Segregation (Sort by Type ID)
    const typeA = getTypeId(a);
    const typeB = getTypeId(b);
    if (typeA !== typeB) return typeA - typeB;

    // 4. Hash Code Shortcut (The Performance Saver O(1))
    // If hashes differ, the objects are definitely different.
    // We use the hash difference to define arbitrary stable order.
    const h1 = getHashCode(a);
    const h2 = getHashCode(b);
    if (h1 !== h2) return h1 - h2;

    // 5. Deep Structural Collision Resolution (Slow path, rare)
    if (a instanceof RecursiveSet && b instanceof RecursiveSet) return a.compare(b);
    if (a instanceof RecursiveMap && b instanceof RecursiveMap) return a.compare(b); // Falls Map compare hat
    if (a instanceof Tuple && b instanceof Tuple) return compareTuples(a, b);

    // Fallback for unexpected types (should not happen with strict typing)
    return 0;
}

/**
 * Helper: Assigns a numeric ID to types for sorting stability.
 * Number(1) < String(2) < Tuple(3) < Set(4) < Map(5)
 */
function getTypeId(v: Value): number {
    if (typeof v === 'number') return 1;
    if (typeof v === 'string') return 2;
    if (v instanceof Tuple) return 3;
    if (v instanceof RecursiveSet) return 4;
    if (v instanceof RecursiveMap) return 5;
    return 99; // Unknown
}

/**
 * Specialized comparator for Tuples.
 * Uses the public `.get()` API to respect encapsulation (no access to .raw).
 */
function compareTuples(a: Tuple<Value[]>, b: Tuple<Value[]>): number {
    const len = a.length;
    if (len !== b.length) return len - b.length;

    for (let i = 0; i < len; i++) {
        // Safe access via public API (Typsicher dank Generics im Tuple)
        const valA = a.get(i); 
        const valB = b.get(i);
        
        // Rekursiver Vergleich der Elemente
        const diff = compare(valA, valB);
        if (diff !== 0) return diff;
    }
    return 0;
}

/**
 * Specialized comparator for Arrays (used by RecursiveSet internally).
 * Arrays allow fast direct index access `[i]`.
 */
function compareSequences(a: ReadonlyArray<Value>, b: ReadonlyArray<Value>): number {
    const len = a.length;
    if (len !== b.length) return len - b.length;
    
    for (let i = 0; i < len; i++) {
        const diff = compare(a[i], b[i]);
        if (diff !== 0) return diff;
    }
    return 0;
}

// ============================================================================
// 3. TUPLE (Immutable)
// ============================================================================

/**
 * An immutable, fixed-length sequence of values supporting Value Semantics.
 * * **Type Safety Feature:**
 * The `get` method returns the exact type at the given index, removing the need 
 * for manual casting in subclasses.
 * * @template T The tuple definition (e.g. `[string, number]`).
 */
class Tuple<T extends Value[]> implements Structural, Iterable<T[number]> {
    
    readonly #elements: T;
    readonly #hashCode: number;

    /**
     * Creates a new Tuple.
     * @param elements The elements to store.
     */
    constructor(...elements: T) {
        // Defensive copy to guarantee immutability
        this.#elements = [...elements] as T;
        Object.freeze(this.#elements); 

        // Compute Hash once (Immutable = Hash never changes)
        let h = 1;
        for (const e of this.#elements) {
            h = Math.imul(h, 31) + getHashCode(e);
        }
        this.#hashCode = h;
    }

    get length() { return this.#elements.length; }
    get hashCode() { return this.#hashCode; }

    /**
     * Returns the element at the specified index with **Strict Type Inference**.
     * * @template K The literal index type (e.g. `0` or `1`).
     * @param index The index to retrieve.
     * @returns The element at that index (e.g. if T is `[string, int]`, `get(0)` returns `string`).
     */
    get<K extends keyof T>(index: K): T[K] { 
        return this.#elements[index]; 
    }

    /**
     * Value Equality Check.
     * Two tuples are equal if they have the same length and recursively equal elements.
     */
    equals(other: unknown): boolean {
        if (this === other) return true;
        if (!(other instanceof Tuple)) return false;
        
        // Quick Fail: Hash & Length
        if (this.hashCode !== other.hashCode) return false;
        if (this.length !== other.length) return false;
        
        // Structural Check
        // Note: usage of 'any' is safe here as we established it's a Tuple
        const otherTuple = other as Tuple<Value[]>;
        for (let i = 0; i < this.length; i++) {
            if (!areEqual(this.#elements[i], otherTuple.#elements[i])) return false;
        }
        return true;
    }
    
    /** Allows `for (const x of tuple)` or `[...tuple]` */
    [Symbol.iterator](): Iterator<T[number]> {
        return this.#elements[Symbol.iterator]();
    }

    toString(): string {
        return `(${this.#elements.map(e => String(e)).join(', ')})`;
    }
    
    [Symbol.for('nodejs.util.inspect.custom')]() { return this.toString(); }
}

// ============================================================================
// 4. RECURSIVE MAP
// ============================================================================

/**
 * A Hash Map implementation optimized for high-performance iteration and memory locality.
 *
 * Architecture: **Structure of Arrays (SoA)**
 * Instead of storing objects like `{ key, value }`, this map maintains parallel arrays:
 * - `_keys`: Stores the keys.
 * - `_values`: Stores the values at the same index.
 * - `_hashes`: Stores the pre-calculated hashes at the same index.
 *
 * This layout improves cache locality during iteration and reduces GC pressure.
 *
 * @template K Key type (must be a Value).
 * @template V Value type (must be a Value).
 */
class RecursiveMap<K extends Value, V extends Value> implements Structural, Iterable<[K, V]> {
    
    // Dense storage (Parallel Arrays)
    private _keys: K[] = [];
    private _values: V[] = [];
    private _hashes: number[] = []; 
    
    // Sparse index table for O(1) lookup
    private _indices: Uint32Array;
    
    private _bucketCount = 16;
    private _mask = 15;
    
    private _isFrozen = false;
    private _cachedHash: number | null = null;

    constructor() {
        this._indices = new Uint32Array(16);
    }

    get size() { return this._keys.length; }
    get isFrozen() { return this._isFrozen; }
    isEmpty(): boolean { return this._keys.length === 0; }

    /**
     * Creates a shallow mutable copy of this map.
     * The copy is NOT frozen, even if the original was.
     */
    mutableCopy(): RecursiveMap<K, V> {
        const copy = new RecursiveMap<K, V>();
        copy.ensureCapacity(this.size);
        // Fast copy: We can just copy the dense arrays directly if we wanted deeper optimization,
        // but iterating is safe and correct.
        for (let i = 0; i < this._keys.length; i++) {
            copy.set(this._keys[i], this._values[i]);
        }
        return copy;
    }

    /**
     * Computes the order-independent hash code (XOR of Entry Hashes).
     * @warning **Side Effect**: Freezes the map to guarantee hash stability.
     * It explicitly iterates all keys to trigger their `hashCode` property, 
     * ensuring nested structures are frozen as well.
     */
    get hashCode(): number {
        if (this._cachedHash !== null) return this._cachedHash;
        
        let h = 0;
        for (let i = 0; i < this._keys.length; i++) {
            const k = this._keys[i];
            const hk = this._hashes[i]; // Use cached hash for speed
            
            // Force freeze on the key if it's structural (nested freeze)
            if (k && typeof k === 'object') {
                k.hashCode; 
            }

            // Calculate value hash (freezes value if structural)
            const hv = getHashCode(this._values[i]);
            
            // Mix key hash and value hash
            h ^= Math.imul(hk, 31) ^ hv;
        }
        
        this._cachedHash = h;
        this._isFrozen = true;
        return h;
    }

    ensureCapacity(capacity: number) {
        if (capacity * 1.33 > this._bucketCount) {
            let target = this._bucketCount;
            while (target * 0.75 < capacity) target *= 2;
            
            this._bucketCount = target;
            this._mask = this._bucketCount - 1;
            
            // Rebuild index table (Re-hashing)
            // The dense arrays (_keys, _values, _hashes) remain untouched!
            const oldKeys = this._keys;
            const oldHashes = this._hashes;
            this._indices = new Uint32Array(this._bucketCount);
            
            for (let i = 0; i < oldKeys.length; i++) {
                const h = oldHashes[i];
                let idx = h & this._mask;
                while (this._indices[idx] !== 0) idx = (idx + 1) & this._mask;
                this._indices[idx] = i + 1;
            }
        }
    }

    private resize() {
        this.ensureCapacity(this._keys.length + 1);
    }

    /**
     * Associates the specified value with the specified key.
     * Uses Linear Probing to find a slot in the `_indices` array.
     * @complexity Amortized O(1).
     */
    set(key: K, value: V): void {
        if (this._isFrozen) throw new Error("Frozen Map");
        if (this._keys.length >= this._bucketCount * 0.75) this.resize();

        const h = getHashCode(key);
        let idx = h & this._mask;

        while (true) {
            const entry = this._indices[idx];
            
            // 1. Found empty slot -> Insert new entry
            if (entry === 0) {
                this._hashes.push(h);
                this._keys.push(key);
                this._values.push(value);
                this._indices[idx] = this._keys.length; // 1-based index
                this._cachedHash = null;
                return;
            }

            // 2. Found existing slot -> Check for key equality (Update)
            const ptr = entry - 1; // Convert to 0-based array index
            if (this._hashes[ptr] === h && areEqual(this._keys[ptr], key)) {
                this._values[ptr] = value;
                this._cachedHash = null;
                return;
            }
            
            // 3. Collision -> Probe next slot
            idx = (idx + 1) & this._mask;
        }
    }

    get(key: K): V | undefined {
        const h = getHashCode(key);
        let idx = h & this._mask;
        while (true) {
            const entry = this._indices[idx];
            if (entry === 0) return undefined;
            
            const ptr = entry - 1;
            if (this._hashes[ptr] === h && areEqual(this._keys[ptr], key)) return this._values[ptr];
            
            idx = (idx + 1) & this._mask;
        }
    }

    /**
     * Removes a key-value pair.
     * **Algorithm: Swap & Pop (Parallel)**
     * Since we store data in 3 parallel arrays (`_keys`, `_values`, `_hashes`),
     * removing an element requires moving the *last* element of ALL THREE arrays
     * into the gap created by the removal.
     * @complexity O(1)
     */
    delete(key: K): boolean {
        if (this._isFrozen) throw new Error("Frozen Map");
        if (this.size === 0) return false;

        const h = getHashCode(key);
        let idx = h & this._mask;

        while (true) {
            const entry = this._indices[idx];
            if (entry === 0) return false;

            const ptr = entry - 1; // The index in the dense arrays
            if (this._hashes[ptr] === h && areEqual(this._keys[ptr], key)) {
                this._cachedHash = null;
                
                // 1. Repair the hash table probe chain
                this.removeIndex(idx);

                // 2. Pop the last element from ALL parallel arrays
                const lastKey = this._keys.pop()!;
                const lastVal = this._values.pop()!;
                const lastHash = this._hashes.pop()!;

                // 3. If we didn't remove the very last element, move the popped 
                //    element into the gap to keep arrays dense.
                if (ptr < this._keys.length) {
                    this._keys[ptr] = lastKey;
                    this._values[ptr] = lastVal;
                    this._hashes[ptr] = lastHash;
                    
                    // Update the lookup table to point to the new location
                    this.updateIndexForKey(lastHash, this._keys.length + 1, ptr + 1);
                }
                return true;
            }
            idx = (idx + 1) & this._mask;
        }
    }

    /**
     * Updates the Lookup Table when an element moves in the dense storage.
     * Necessary during the "Swap" phase of deletion.
     */
    private updateIndexForKey(hash: number, oldLoc: number, newLoc: number) {
        let idx = hash & this._mask;
        while(true) {
            if (this._indices[idx] === oldLoc) {
                this._indices[idx] = newLoc;
                return;
            }
            idx = (idx + 1) & this._mask;
        }
    }

    /**
     * Repairs the Open Addressing chain after an index is removed.
     * Shifts subsequent colliding elements backward ("Robin Hood" style) 
     * to fill the hole.
     */
    private removeIndex(holeIdx: number): void {
        let i = (holeIdx + 1) & this._mask;
        while (this._indices[i] !== 0) {
            const entry = this._indices[i];
            const ptr = entry - 1;
            const h = this._hashes[ptr]; 
            
            const ideal = h & this._mask;
            const distHole = (holeIdx - ideal + this._bucketCount) & this._mask;
            const distI = (i - ideal + this._bucketCount) & this._mask;
            
            if (distHole < distI) {
                this._indices[holeIdx] = entry;
                holeIdx = i;
            }
            i = (i + 1) & this._mask;
        }
        this._indices[holeIdx] = 0;
    }

    equals(other: unknown): boolean {
        if (this === other) return true;
        if (!(other instanceof RecursiveMap)) return false;
        if (this.size !== other.size) return false;
        if (this.hashCode !== other.hashCode) return false;
        for(let i=0; i<this._keys.length; i++) {
            const val = other.get(this._keys[i]);
            if (val === undefined || !areEqual(this._values[i], val)) return false;
        }
        return true;
    }

    compare(other: RecursiveMap<Value, Value>): number { return this.hashCode - other.hashCode; }
    
    *[Symbol.iterator](): Iterator<[K, V]> {
        for(let i=0; i<this._keys.length; i++) yield [this._keys[i], this._values[i]];
    }
    
    toString() { return `Map{${this.size}}`; }
    [Symbol.for('nodejs.util.inspect.custom')]() { return this.toString(); }
}


// ============================================================================
// 5. RECURSIVE SET
// ============================================================================

/**
 * A Hash Set implementation focused on high-performance iteration and Value Semantics.
 *
 * Architecture:
 * - **Dense Storage**: Elements are stored in a contiguous array (`_values`) for O(n) iteration.
 * - **Sparse Lookup**: A separate `Uint32Array` (`_indices`) maps hashes to indices in the dense array.
 * - **Open Addressing**: Uses linear probing for collision resolution.
 *
 * @template T The type of elements in the set.
 */
class RecursiveSet<T extends Value> implements Structural, Iterable<T> {
    
    // Dense arrays for fast iteration and data locality
    private _values: T[] = [];
    private _hashes: number[] = [];
    
    // Sparse array for O(1) lookups (stores index + 1, where 0 means empty)
    private _indices: Uint32Array; 
    
    private _bucketCount: number;
    private _mask: number;
    private _xorHash: number = 0;
    
    private _isFrozen: boolean = false;
    private readonly LOAD_FACTOR = 0.75;
    private readonly MIN_BUCKETS = 16;

    constructor(...initialData: T[]) {
        this._bucketCount = this.MIN_BUCKETS;
        if (initialData.length > 0) {
            const target = Math.ceil(initialData.length / this.LOAD_FACTOR);
            while (this._bucketCount < target) this._bucketCount <<= 1;
        }
        this._mask = this._bucketCount - 1;
        this._indices = new Uint32Array(this._bucketCount);
        for (const item of initialData) this.add(item);
    }

    static compare(a: Value, b: Value) { return compare(a, b); }

    get size(): number { return this._values.length; }
    get isFrozen(): boolean { return this._isFrozen; }
    isEmpty(): boolean { return this._values.length === 0; }

    /**
     * Returns the order-independent hash code (XOR sum).
     * @warning **Side Effect**: Freezes the set to guarantee hash stability for use as a map key.
     */
    get hashCode(): number {
        this._isFrozen = true;
        return this._xorHash;
    }

    ensureCapacity(capacity: number) {
        if (capacity * 1.33 > this._bucketCount) {
            let target = this._bucketCount;
            while (target * 0.75 < capacity) target *= 2;
            
            this._bucketCount = target;
            this._mask = this._bucketCount - 1;
            
            // Rebuild the lookup table (Re-hashing)
            // Note: We don't need to touch _values or _hashes, just where to find them.
            const oldValues = this._values;
            const oldHashes = this._hashes;
            this._indices = new Uint32Array(this._bucketCount);
            
            for (let i = 0; i < oldValues.length; i++) {
                const h = oldHashes[i];
                let idx = h & this._mask;
                while (this._indices[idx] !== 0) idx = (idx + 1) & this._mask;
                this._indices[idx] = i + 1;
            }
        }
    }

    private resize(): void {
        this.ensureCapacity(this._values.length + 1); // Reuse logic, but force growth
    }

    /**
     * Updates the Lookup Table when an element moves in the Dense Array.
     * This is crucial for the "Swap & Pop" removal strategy.
     */
    private updateIndexForValue(hash: number, oldLoc: number, newLoc: number): void {
        let idx = hash & this._mask;
        while (true) {
            if (this._indices[idx] === oldLoc) {
                this._indices[idx] = newLoc;
                return;
            }
            idx = (idx + 1) & this._mask;
        }
    }

    /**
     * Repairs the Open Addressing Probe Chain.
     * * When an index is removed, we cannot simply set it to 0, because it might break
     * the search path for other elements that collided and were placed further down.
     * This algorithm shifts subsequent elements back into the "hole" if they belong 
     * closer to their ideal hash bucket.
     * * @param holeIdx The index in the `_indices` array that is being cleared.
     */
    private removeIndex(holeIdx: number): void {
        let i = (holeIdx + 1) & this._mask;
        while (this._indices[i] !== 0) {
            const entry = this._indices[i];
            const valPtr = entry - 1;
            const h = this._hashes[valPtr];
            
            const idealIdx = h & this._mask;
            const distToHole = (holeIdx - idealIdx + this._bucketCount) & this._mask;
            const distToI = (i - idealIdx + this._bucketCount) & this._mask;
            
            // If the element at 'i' is logically "farther" from its ideal spot than 
            // the hole is, we shift it into the hole to close the gap.
            if (distToHole < distToI) {
                this._indices[holeIdx] = entry;
                holeIdx = i;
            }
            i = (i + 1) & this._mask;
        }
        this._indices[holeIdx] = 0;
    }

    add(e: T): void {
        if (this._isFrozen) throw new Error("Frozen Set modified.");
        if (this._values.length >= this._bucketCount * this.LOAD_FACTOR) this.resize();

        const h = getHashCode(e);
        let idx = h & this._mask;

        while (true) {
            const entry = this._indices[idx];
            if (entry === 0) {
                // Found empty slot: Insert new value
                this._hashes.push(h);
                this._values.push(e);
                this._indices[idx] = this._values.length; // Store 1-based index
                this._xorHash ^= h; 
                return;
            }
            
            // Collision handling: Check if it's the same existing item
            const valIndex = entry - 1;
            if (this._hashes[valIndex] === h && areEqual(this._values[valIndex], e)) return; 
            
            idx = (idx + 1) & this._mask; // Linear probe
        }
    }

    has(element: T): boolean {
        const h = getHashCode(element);
        let idx = h & this._mask;
        while (true) {
            const entry = this._indices[idx];
            if (entry === 0) return false;
            
            const valIndex = entry - 1;
            if (this._hashes[valIndex] === h && areEqual(this._values[valIndex], element)) return true;
            
            idx = (idx + 1) & this._mask;
        }
    }

    /**
     * Removes an element using "Swap & Pop".
     * * Algorithm:
     * 1. Locate the element in the hash table (`_indices`).
     * 2. Repair the hash table probe chain (`removeIndex`).
     * 3. Remove the element from the dense array (`_values`):
     * - Instead of splicing (which is O(N)), we move the *last* element
     * of the array into the slot of the removed element.
     * - We then update the hash table to point to this new location.
     * * Complexity: O(1)
     */
    remove(e: T): void {
        if (this._isFrozen) throw new Error("Frozen Set modified.");
        if (this._values.length === 0) return;

        const h = getHashCode(e);
        let idx = h & this._mask;

        while (true) {
            const entry = this._indices[idx];
            if (entry === 0) return; // Element not found

            const valIndex = entry - 1;
            if (this._hashes[valIndex] === h && areEqual(this._values[valIndex], e)) {
                this._xorHash ^= h;
                
                // 1. Remove from Lookup Table (and fix probe chain)
                this.removeIndex(idx);
                
                // 2. Remove from Dense Storage (Swap & Pop)
                const lastVal = this._values.pop()!;
                const lastHash = this._hashes.pop()!;

                // If the element we removed wasn't the last one, 
                // fill the gap with the last element to keep array dense.
                if (valIndex < this._values.length) {
                    this._values[valIndex] = lastVal;
                    this._hashes[valIndex] = lastHash;
                    // Important: Update lookup table to point to the new location of lastVal
                    this.updateIndexForValue(lastHash, this._values.length + 1, valIndex + 1);
                }
                return;
            }
            idx = (idx + 1) & this._mask;
        }
    }

    clone(): RecursiveSet<T> {
        const s = new RecursiveSet<T>();
        if (s._bucketCount !== this._bucketCount) s.ensureCapacity(this.size);
        
        // Fast path: Block copy if structure matches
        if (s._bucketCount === this._bucketCount) {
            s._indices.set(this._indices);
            s._values = this._values.slice();
            s._hashes = this._hashes.slice();
            s._xorHash = this._xorHash;
        } else {
             for(const v of this._values) s.add(v);
        }
        return s;
    }

    union(other: RecursiveSet<T>): RecursiveSet<T> {
        const res = this.clone();
        for (const item of other) res.add(item);
        return res;
    }

    intersection(other: RecursiveSet<T>): RecursiveSet<T> {
        const res = new RecursiveSet<T>();
        // Optimization: Iterate over the smaller set
        const [small, large] = this.size < other.size ? [this, other] : [other, this];
        for (const item of small) { if (large.has(item)) res.add(item); }
        return res;
    }

    symmetricDifference(other: RecursiveSet<T>): RecursiveSet<T> {
        const res = new RecursiveSet<T>();
        for (const item of this) { if (!other.has(item)) res.add(item); }
        for (const item of other) { if (!this.has(item)) res.add(item); }
        return res;
    }

    cartesianProduct<U extends Value>(other: RecursiveSet<U>): RecursiveSet<Tuple<[T, U]>> {
        const result = new RecursiveSet<Tuple<[T, U]>>();
        result.ensureCapacity(this.size * other.size);
        for (const a of this) {
            for (const b of other) {
                result.add(new Tuple(a, b));
            }
        }
        return result;
    }

    /** * Computes the Power Set (Set of all subsets).
     * @warning **Complexity O(2^N)**: Grows exponentially. Use only for small sets (N < 20).
     */
    powerset(): RecursiveSet<RecursiveSet<T>> {
        const n = this._values.length;
        const max = 1 << n;
        const result = new RecursiveSet<RecursiveSet<T>>();
        result.ensureCapacity(max);
        
        for (let i = 0; i < max; i++) {
            const subset = new RecursiveSet<T>();
            for (let j = 0; j < n; j++) {
                if ((i & (1 << j)) !== 0) {
                    subset.add(this._values[j]);
                }
            }
            result.add(subset);
        }
        return result;
    }

    pickRandom(): T | undefined {
        if (this._values.length === 0) return undefined;
        return this._values[Math.floor(Math.random() * this._values.length)];
    }
    
    [Symbol.iterator](): Iterator<T> { return this._values[Symbol.iterator](); }
    
    compare(other: RecursiveSet<Value>): number {
        if (this === other) return 0;
        if (this.hashCode !== other.hashCode) return this.hashCode - other.hashCode;
        const sortFn = (a: Value, b: Value) => compare(a, b);
        const arrA = [...this._values].sort(sortFn);
        const arrB = [...other._values].sort(sortFn);
        return compareSequences(arrA, arrB);
    }
    
    equals(other: unknown): boolean {
        if (this === other) return true;
        if (!(other instanceof RecursiveSet)) return false;
        if (this.size !== other.size) return false;
        if (this.hashCode !== other.hashCode) return false;
        for(const v of this._values) { if (!other.has(v)) return false; }
        return true;
    }
    
    toString(): string {
        const sorted = [...this._values].sort((a,b) => compare(a,b));
        return `{${sorted.map(String).join(', ')}}`;
    }
    [Symbol.for('nodejs.util.inspect.custom')]() { return this.toString(); }
}

// ============================================================================
// 6. PUBLIC EXPORTS
// ============================================================================

/** Creates an empty RecursiveSet. */
function emptySet<T extends Value>() { return new RecursiveSet<T>(); }

/** Creates a RecursiveSet containing a single element. */
function singleton<T extends Value>(el: T) { return new RecursiveSet<T>(el); }

// Alias for public use
const hashValue = getHashCode; 

export {
    RecursiveSet,
    RecursiveMap,
    Tuple,
    Value,
    Primitive,
    Structural,
    emptySet,
    singleton,
    hashValue,
    compare,
    getHashCode
};