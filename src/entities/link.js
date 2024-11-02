import {Node} from "./node"

export class Link {
    // 构造函数
    constructor(source_node:Node, target_node:Node, link_type: string) {
        this.source_node = source_node;
        this.target_node = target_node;
        this.link_type = link_type;
    }
}