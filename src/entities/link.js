import {Node} from "./node"

export class Link {
    // 构造函数
    constructor(source_node:Node, target_node:Node) {
        this.source_node = source_node;
        this.target_node = target_node;
    }
}