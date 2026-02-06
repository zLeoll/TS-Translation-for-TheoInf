export class Node {
    mValue: number;
    mParent: Node | null;
    mHeight: number;

    constructor(value: number) {
        this.mValue = value;
        this.mParent = null;
        this.mHeight = 1;
    }

    find(): Node {
        let node: Node = this;
        while (node.mParent !== null) {
            node = node.mParent;
        }
        return node;
    }
}

export function union(x: Node, y: Node): void {
    const root_x = x.find();
    const root_y = y.find();

    if (root_x !== root_y) {
        if (root_x.mHeight < root_y.mHeight) {
            root_x.mParent = root_y;
        } else if (root_x.mHeight > root_y.mHeight) {
            root_y.mParent = root_x;
        } else {
            root_y.mParent = root_x;
            root_x.mHeight += 1;
        }
    }
}