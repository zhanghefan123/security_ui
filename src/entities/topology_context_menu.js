import "./topology_context_menu.css";

// G6 serializes getContent() to HTML: use data attributes, not DOM listeners,
// to dispatch actions. User-provided node labels are always assigned as text.
const iconPaths = {
    node: ['M7 3h10v4H7z', 'M7 17h10v4H7z', 'M12 7v10', 'M3 10h5v4H3z', 'M16 10h5v4h-5z', 'M8 12h8'],
    terminal: ['M4 4h16v16H4z', 'm8 9 3 3-3 3', 'M13 15h4'],
    pause: ['M8 5v14', 'M16 5v14'],
    attack: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
    stop: ['M7 7h10v10H7z'],
    sync: ['M4 10a8 8 0 0 1 13-4l3 3', 'M20 4v5h-5', 'M20 14a8 8 0 0 1-13 4l-3-3', 'M4 20v-5h5'],
    pulse: ['M3 12h4l3-8 4 16 3-8h4'],
    delete: ['M3 6h18', 'M9 6V3h6v3', 'm5 6 1 15h12l1-15', 'M10 10v7', 'M14 10v7'],
    link: ['m10 14 4-4', 'm8 16-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0', 'm16 8 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0'],
    arrow: ['M5 12h14', 'm14 7 5 5-5 5'],
    satellite: ['m9 8 7 7-5 5-7-7z', 'm14 3 7 7-4 4-7-7z', 'm7 17-4 4', 'M4 3a7 7 0 0 1 7 7'],
    station: ['M5 4a10 10 0 0 0 15 15L5 4z', 'm12 12 6-6', 'M17 4h3v3', 'm10 18-2 4', 'M4 22h12'],
    locate: ['M12 2v4', 'M12 18v4', 'M2 12h4', 'M18 12h4', 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14', 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
    plus: ['M12 5v14', 'M5 12h14'],
    minus: ['M5 12h14'],
};

function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.entries({viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.65", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false"})
        .forEach(([key, value]) => svg.setAttribute(key, value));
    (iconPaths[name] || iconPaths.node).forEach((d) => {
        const path = document.createElementNS(svg.namespaceURI, "path");
        path.setAttribute("d", d);
        svg.appendChild(path);
    });
    return svg;
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

const actions = {
    transmit: {label: "发起传输", note: "IPv6 / SRv6 · UDP / TCP", icon: "arrow"},
    shell: {label: "打开节点控制台", note: "终端 · 资源 · 路由与配置", icon: "terminal", primary: true},
    pause: {label: "暂停节点", icon: "pause"},
    attack: {label: "攻击主节点", icon: "attack"},
    stopAttack: {label: "停止攻击主节点", icon: "stop"},
    sync: {label: "开启恶意同步", icon: "sync"},
    stopSync: {label: "停止恶意同步", icon: "stop"},
    heartbeat: {label: "开启不一致心跳广播", icon: "pulse"},
    stopHeartbeat: {label: "关闭不一致心跳广播", icon: "stop"},
    deleteNode: {label: "删除节点", note: "从拓扑画布中移除", icon: "delete", danger: true},
    deleteEdge: {label: "删除连线", note: "从拓扑画布中移除", icon: "delete", danger: true},
    edgeFault: {label: "链路故障配置", note: "SEC_PATH_MAB · 双向篡改概率", icon: "link"},
    locate: {label: "定位到此节点", note: "调整地球视角", icon: "locate"},
    addStation: {label: "加入星座配置", note: "选为本次实验的地面站", icon: "plus"},
    removeStation: {label: "移出星座配置", note: "从本次实验的地面站列表移除", icon: "minus"},
};

function actionButton(action, running, options = {}) {
    const data = {...actions[action], ...options};
    const disabled = data.disabled ?? (!running && !data.danger);
    const button = element("button", `topology-context-action${data.primary ? " is-primary" : ""}${data.danger ? " is-danger" : ""}`);
    button.type = "button";
    button.dataset.menuAction = action;
    button.disabled = disabled;
    button.setAttribute("aria-disabled", String(disabled));
    if (disabled) button.title = data.disabledReason || "请先启动拓扑";
    const symbol = element("span", "topology-context-action-icon");
    symbol.appendChild(icon(data.icon));
    const text = element("span", "topology-context-action-text");
    text.appendChild(element("span", "topology-context-action-label", data.label));
    if (data.note) text.appendChild(element("span", "topology-context-action-note", data.note));
    button.append(symbol, text);
    if (data.primary) {
        const arrow = element("span", "topology-context-action-arrow");
        arrow.appendChild(icon("arrow"));
        button.appendChild(arrow);
    }
    return button;
}

function menuHeader(title, type, running, options = {}) {
    const header = element("div", "topology-context-header");
    const mark = element("span", "topology-context-mark");
    mark.appendChild(icon(options.icon || (type === "连线" ? "link" : "node")));
    const text = element("div", "topology-context-heading");
    text.appendChild(element("div", "topology-context-kind", type));
    text.appendChild(element("div", "topology-context-title", title));
    header.append(mark, text);
    if (running !== undefined) {
        header.appendChild(element("span", `topology-context-status${running ? " is-running" : ""}`, options.statusText || (running ? "拓扑已启动" : "未启动")));
    }
    return header;
}

function addGroup(menu, label, items, running) {
    const group = element("div", "topology-context-group");
    if (label) group.appendChild(element("div", "topology-context-group-label", label));
    items.forEach((item) => group.appendChild(typeof item === "string"
        ? actionButton(item, running) : actionButton(item.action, running, item)));
    menu.appendChild(group);
}

export function createNodeContextMenu(model, running, canTransmit = false) {
    const id = String(model.id || "节点");
    const menu = element("div", "topology-context-content");
    menu.setAttribute("aria-label", `${id} 操作`);
    menu.appendChild(menuHeader(id.replace(/_(\d+)$/, "-$1"), "节点操作", running));
    const fabric = id.includes("FabricOrder");
    const chainmaker = id.includes("ChainMaker");
    const fisco = id.includes("FiscoBcos");
    addGroup(menu, "", fabric ? ["shell", "pause"] : ["shell"], running);
    addGroup(menu, "数据传输", [{action: "transmit", note: "IPv4 / IPv6 / SRv6 / LiR · UDP / TCP",
        disabled: !running || !canTransmit, disabledReason: "请等待拓扑就绪，并启用节点的传输服务和网络协议"}], running);
    const experiments = [];
    if (fabric || chainmaker) experiments.push("attack", "stopAttack");
    if (fabric) experiments.push("sync", "stopSync");
    if (chainmaker || fisco) experiments.push("heartbeat", "stopHeartbeat");
    if (experiments.length) addGroup(menu, "实验操作", experiments, running);
    addGroup(menu, "", ["deleteNode"], running);
    if (!running) menu.appendChild(element("div", "topology-context-hint", "启动拓扑后可使用终端与实验操作"));
    return menu;
}

export function createEdgeContextMenu(model) {
    const menu = element("div", "topology-context-content");
    menu.setAttribute("aria-label", "连线操作");
    const endpoint = (value) => String(value?.getID?.() ?? value ?? "节点").replace(/_(\d+)$/, "-$1");
    menu.appendChild(menuHeader(`${endpoint(model.source)} → ${endpoint(model.target)}`, "连线"));
    if (model.edge_id) menu.appendChild(element("div", "topology-context-hint", `链路标识：${model.edge_id}`));
    addGroup(menu, "", [{action: "edgeFault", disabled: !model.edge_id, disabledReason: "链路缺少标识，请重新加载拓扑"}], true);
    addGroup(menu, "", ["deleteEdge"], true);
    return menu;
}

export function getContextMenuAction(target) {
    const button = target?.closest?.("button[data-menu-action]");
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return null;
    return button.dataset.menuAction;
}

export function createConstellationContextMenu({name, nodeType, runtime, selected, canOpen, canEdit, statusText}) {
    const groundStation = nodeType === "GroundStation";
    const menu = element("div", "topology-context-content");
    menu.setAttribute("aria-label", `${name} 操作`);
    menu.appendChild(menuHeader(name, groundStation ? "地面站" : "卫星", runtime ? canOpen : selected, {
        icon: groundStation ? "station" : "satellite",
        statusText: runtime ? statusText : (selected ? "已选入" : "未选入"),
    }));
    addGroup(menu, "", [{action: "shell", disabled: !canOpen, disabledReason: "节点运行后可打开控制台"}], canOpen);
    if (groundStation && runtime) {
        addGroup(menu, "数据传输", [{action: "transmit", disabled: !canOpen, disabledReason: "请等待星座就绪"}], canOpen);
    }
    addGroup(menu, "视图操作", [{action: "locate", disabled: false}], true);
    if (groundStation && !runtime) {
        addGroup(menu, "星座配置", [{action: selected ? "removeStation" : "addStation", disabled: !canEdit,
            disabledReason: "请先停止星座，再修改地面站配置"}], true);
        menu.appendChild(element("div", "topology-context-hint", "启动星座后可查看终端、资源和路由"));
    }
    return menu;
}
