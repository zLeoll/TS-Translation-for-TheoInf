export class ListNode<K extends string | number, T> {
    public mKey: K;
    public mValue: T;
    public mNextPtr: ListNode<K, T> | null;

    constructor(key: K, value: T) {
        this.mKey = key;
        this.mValue = value;
        this.mNextPtr = null;
    }

    find(key: K): T | null {
        let ptr: ListNode<K, T> | null = this;
        while (ptr !== null) {
            if (ptr.mKey === key) return ptr.mValue;
            ptr = ptr.mNextPtr;
        }
        return null;
    }

    insert(key: K, value: T): boolean {
        let ptr: ListNode<K, T> = this;
        while (true) {
            if (ptr.mKey === key) {
                ptr.mValue = value;   // update
                return false;         // not a new key
            }
            if (ptr.mNextPtr !== null) {
                ptr = ptr.mNextPtr;
            } else {
                ptr.mNextPtr = new ListNode(key, value); // append
                return true;          // new key inserted
            }
        }
    }

    delete(key: K): { head: ListNode<K, T> | null; flag: boolean } {
        let previous: ListNode<K, T> | null = null;
        let ptr: ListNode<K, T> | null = this;

        while (ptr !== null) {
            if (ptr.mKey === key) {
                if (previous === null) {
                    // deleting head
                    return { head: ptr.mNextPtr, flag: true };
                } else {
                    previous.mNextPtr = ptr.mNextPtr;
                    return { head: this, flag: true };
                }
            }
            previous = ptr;
            ptr = ptr.mNextPtr;
        }
        return { head: this, flag: false };
    }

    toString(): string {
        const parts: string[] = [];
        let ptr: ListNode<K, T> | null = this;
        while (ptr !== null) {
            parts.push(`${String(ptr.mKey)}: ${String(ptr.mValue)}`);
            ptr = ptr.mNextPtr;
        }
        return parts.join(", ");
    }
}

export class MapIterator<K extends string | number, T>
    implements IterableIterator<[K, T]> {
    private mPtr: ListNode<K, T> | null;

    constructor(ptr: ListNode<K, T> | null) {
        this.mPtr = ptr;
    }

    [Symbol.iterator](): IterableIterator<[K, T]> {
        return this;
    }

    next(): IteratorResult<[K, T]> {
        if (this.mPtr === null) {
            return { done: true, value: undefined };
        }
        const key = this.mPtr.mKey;
        const value = this.mPtr.mValue;
        this.mPtr = this.mPtr.mNextPtr;
        return { done: false, value: [key, value] };
    }
}

export class ListMap<K extends string | number, T>
    implements Iterable<[K, T]> {
    private mPtr: ListNode<K, T> | null = null;

    find(key: K): T | null {
        return this.mPtr ? this.mPtr.find(key) : null;
    }

    insert(key: K, value: T): boolean {
        if (this.mPtr) {
            return this.mPtr.insert(key, value);
        } else {
            this.mPtr = new ListNode(key, value);
            return true;
        }
    }

    delete(key: K): boolean {
        if (!this.mPtr) return false;
        const { head, flag } = this.mPtr.delete(key);
        this.mPtr = head;
        return flag;
    }

    [Symbol.iterator](): IterableIterator<[K, T]> {
        return new MapIterator(this.mPtr);
    }

    toString(): string {
        return this.mPtr ? `{ ${this.mPtr.toString()} }` : "{}";
    }
}