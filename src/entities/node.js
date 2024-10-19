export class Node {
    // 构造函数
    constructor(index, type: string, x:Number, y:Number) {
        this.index = index // 节点的索引
        this.type = type  // 节点的类型
        this.x = x // 横坐标
        this.y = y // 纵坐标
    }
}