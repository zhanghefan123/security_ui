import {Node} from "./node"
import {readLinkMetadata} from "./topology_edges";

export class Link {
    // 构造函数
    constructor(source_node:Node, target_node:Node, link_type: string, metadata = {}) {
        this.source_node = source_node;
        this.target_node = target_node;
        this.link_type = link_type;
        Object.assign(this, readLinkMetadata(metadata));
    }
}
