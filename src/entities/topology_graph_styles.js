// G6 会深度合并内置 selected 样式，省略 text-shape 不能移除 fontWeight。
// 使用独立状态，避免取消选中时恢复缺失的标签样式缓存。
export const TOPOLOGY_SELECTED_STATE = 'topology-selected';

export function createTopologySelectionStyles() {
    return {
        nodeStateStyles: {
            [TOPOLOGY_SELECTED_STATE]: {
                shadowColor: '#38bdf8',
                shadowBlur: 16,
            },
        },
        edgeStateStyles: {
            [TOPOLOGY_SELECTED_STATE]: {
                stroke: '#38bdf8',
                lineWidth: 4,
                shadowColor: '#38bdf8',
                shadowBlur: 8,
            },
        },
    };
}
