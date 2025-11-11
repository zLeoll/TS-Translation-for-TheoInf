export class AVLSet<T> {
    static sNodeCount = 0;
    mKey: T | null;
    mLeft: AVLSet<T> | null;
    mRight: AVLSet<T> | null;
    mHeight: number;
    mID?: number;

    constructor() {
        this.mKey = null;
        this.mLeft = null;
        this.mRight = null;
        this.mHeight = 0;
    }

    isEmpty(): boolean {
        return this.mKey === null;
    }

    member(key: T): boolean {
        if (this.isEmpty()) {
            return false;
        } else if (this.mKey === key) {
            return true;
        } else if (key < (this.mKey as T)) {
            return this.mLeft !== null && this.mLeft.member(key);
        } else {
            return this.mRight !== null && this.mRight.member(key);
        }
    }

    insert(key: T): AVLSet<T> {
        if (this.isEmpty()) {
            this.mKey = key;
            this.mLeft = new AVLSet<T>();
            this.mRight = new AVLSet<T>();
            this.mHeight = 1;
        } else if (this.mKey === key) {
            // key exists, do nothing
        } else if (key < (this.mKey as T)) {
            if (this.mLeft === null) this.mLeft = new AVLSet<T>();
            this.mLeft.insert(key);
            this._restore();
        } else {
            if (this.mRight === null) this.mRight = new AVLSet<T>();
            this.mRight.insert(key);
            this._restore();
        }
        return this;
    }

    delete(key: T): AVLSet<T> {
        if (this.isEmpty()) {
            return this;
        }
        if (key === this.mKey) {
            if (this.mLeft === null || this.mLeft.isEmpty()) {
                this._update(this.mRight);
            } else if (this.mRight === null || this.mRight.isEmpty()) {
                this._update(this.mLeft);
            } else {
                const [newRight, minKey] = this.mRight!._delMin();
                this.mRight = newRight;
                this.mKey = minKey;
            }
        } else if (key < (this.mKey as T)) {
            if (this.mLeft !== null) this.mLeft.delete(key);
        } else {
            if (this.mRight !== null) this.mRight.delete(key);
        }
        return this;
    }

    pop(): T {
        if (this.mKey === null) {
            throw new Error('KeyError: pop from empty set');
        }
        if (this.mLeft === null || this.mLeft.mKey === null) {
            const key = this.mKey;
            this._update(this.mRight);
            return key as T;
        }
        return this.mLeft.pop();
    }

    _delMin(): [AVLSet<T>, T | null] {
        if (this.mLeft === null || this.mLeft.isEmpty()) {
            return [this.mRight!, this.mKey];
        } else {
            const [ls, km] = this.mLeft._delMin();
            this.mLeft = ls;
            this._restore();
            return [this, km];
        }
    }

    _update(t: AVLSet<T> | null): void {
        if (t === null) {
            this.mKey = null;
            this.mLeft = null;
            this.mRight = null;
            this.mHeight = 0;
        } else {
            this.mKey = t.mKey;
            this.mLeft = t.mLeft;
            this.mRight = t.mRight;
            this.mHeight = t.mHeight;
        }
    }

    _setValues(k: T | null, l: AVLSet<T> | null, r: AVLSet<T> | null): void {
        this.mKey = k;
        this.mLeft = l;
        this.mRight = r;
    }

    _restoreHeight(): void {
        const leftHeight = this.mLeft !== null ? this.mLeft.mHeight : 0;
        const rightHeight = this.mRight !== null ? this.mRight.mHeight : 0;
        this.mHeight = Math.max(leftHeight, rightHeight) + 1;
    }

    _restore(): void {
        const leftHeight = this.mLeft !== null ? this.mLeft.mHeight : 0;
        const rightHeight = this.mRight !== null ? this.mRight.mHeight : 0;

        if (Math.abs(leftHeight - rightHeight) <= 1) {
            this._restoreHeight();
            return;
        }

        if (leftHeight > rightHeight) {
            const k1 = this.mKey as T;
            const l1 = this.mLeft as AVLSet<T>;
            const r1 = this.mRight;
            const k2 = l1.mKey as T;
            const l2 = l1.mLeft;
            const r2 = l1.mRight;

            const r2Height = r2 !== null ? r2.mHeight : 0;
            const l2Height = l2 !== null ? l2.mHeight : 0;

            if (l2Height >= r2Height) {
                this._setValues(k2, l2, createAVLNode(k1, r2, r1));
            } else {
                const k3 = r2!.mKey as T;
                const l3 = r2!.mLeft;
                const r3 = r2!.mRight;
                this._setValues(k3, createAVLNode(k2, l2, l3), createAVLNode(k1, r3, r1));
            }
        } else {
            const k1 = this.mKey as T;
            const l1 = this.mLeft;
            const r1 = this.mRight as AVLSet<T>;
            const k2 = r1.mKey as T;
            const l2 = r1.mLeft;
            const r2 = r1.mRight;

            const r2Height = r2 !== null ? r2.mHeight : 0;
            const l2Height = l2 !== null ? l2.mHeight : 0;

            if (r2Height >= l2Height) {
                this._setValues(k2, createAVLNode(k1, l1, l2), r2);
            } else {
                const k3 = l2!.mKey as T;
                const l3 = l2!.mLeft;
                const r3 = l2!.mRight;
                this._setValues(k3, createAVLNode(k1, l1, l3), createAVLNode(k2, r3, r2));
            }
        }
        this._restoreHeight();
    }
}



function createAVLNode<T>(key: T, left: AVLSet<T> | null, right: AVLSet<T> | null): AVLSet<T> {
    const node = new AVLSet<T>();
    node.mKey = key;
    node.mLeft = left;
    node.mRight = right;
    const leftHeight = left !== null ? left.mHeight : 0;
    const rightHeight = right !== null ? right.mHeight : 0;
    node.mHeight = Math.max(leftHeight, rightHeight) + 1;
    return node;
}