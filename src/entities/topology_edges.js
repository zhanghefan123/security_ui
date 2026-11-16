// Backend identity is independent of G6's item ID and of the endpoint pair.
// A single physical link also reserves `${edge_id}/reverse` in the backend.
let edgeSequence = 0;

export function readLinkMetadata(model = {}) {
    return {
        ...(model.edge_id ? {edge_id: model.edge_id} : {}),
        ...(model.forward_fault != null ? {forward_fault: {...model.forward_fault}} : {}),
        ...(model.reverse_fault != null ? {reverse_fault: {...model.reverse_fault}} : {}),
    };
}

function nextEdgeID(graph) {
    const reserved = new Set();
    graph.getEdges().forEach(edge => {
        const id = edge.getModel().edge_id;
        if (id) { reserved.add(id); reserved.add(`${id}/reverse`); }
    });
    let id;
    do {
        id = `ui-edge-${Date.now().toString(36)}-${++edgeSequence}`;
    } while (reserved.has(id) || reserved.has(`${id}/reverse`));
    return id;
}

export function getTopologyLinkType(model) {
    return model.link_type || (model.style?.lineWidth === 2 ? "access" : "backbone");
}

export function isCompletedTopologyEdge(edge) {
    const {source, target} = edge.getModel();
    // G6 uses a point or the source itself as the target while drawing a preview.
    return typeof source === "string" && typeof target === "string" && source !== target;
}

export function createTopologyEdgeModel(graph, source, target, linkType, style, metadata = {}, label = "") {
    return {
        ...readLinkMetadata(metadata),
        edge_id: metadata.edge_id || nextEdgeID(graph),
        source, target, link_type: linkType, style: {...style},
        type: "arrow-running", curveOffset: 0, curvePosition: 0.5,
        link_label: label, label: "",
    };
}

export function completeTopologyEdge(graph, edge) {
    const model = edge.getModel();
    graph.updateItem(edge, {
        edge_id: model.edge_id || nextEdgeID(graph),
        link_type: getTopologyLinkType(model),
    });
    layoutParallelTopologyEdges(graph);
}

export function layoutParallelTopologyEdges(graph) {
    if (!graph || graph.destroyed) return;
    const groups = new Map();
    graph.getEdges().filter(isCompletedTopologyEdge).forEach(edge => {
        const {source, target} = edge.getModel();
        const key = JSON.stringify([source, target].sort());
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(edge);
    });
    groups.forEach(edges => edges.forEach((edge, index) => {
        const model = edge.getModel();
        // Reverse-drawn edges must use the opposite sign to occupy distinct lanes.
        const direction = model.source < model.target ? 1 : -1;
        const curveOffset = edges.length === 1 ? 0 : (index - (edges.length - 1) / 2) * 48 * direction;
        const label = "";
        if (model.curveOffset !== curveOffset || model.label !== label) {
            graph.updateItem(edge, {curveOffset, curvePosition: 0.5, label});
        }
    }));
}
