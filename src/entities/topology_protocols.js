// One selection per topology. Node-level flags are read only during migration.
export const chainmakerCarriers = [
    {value: "IP", label: "普通 IPv4（保持原有通信）"},
    {value: "LIR", label: "LiR"}, {value: "ICING", label: "ICING"},
    {value: "OPT", label: "OPT"}, {value: "SELIR", label: "SELiR"}, {value: "EPIC", label: "EPIC"},
    {value: "SEC_PATH_MAB", label: "SEC_PATH_MAB（全节点自动学习）"},
];

export const defaultChainmakerMab = () => ({batch_size: 30,
    learning_rate: .01, minimum_delivery_ratio: .9});

// 旧节点对/时长字段不再进入保存结果，公共学习参数仍然保留。
function readChainmakerMab(value) {
    const {batch_size, learning_rate, minimum_delivery_ratio} = {...defaultChainmakerMab(), ...value};
    return {batch_size, learning_rate, minimum_delivery_ratio};
}

export const defaultTopologyProtocols = () => ({
    ospfv2: true, ospfv3: false, srv6: false, lir: true,
    path_validation: false, routing_table_type: 1, sec_path_mab: 0, chainmaker_p2p: "IP",
    chainmaker_mab: defaultChainmakerMab(),
});

export function readTopologyProtocols(topology = {}, execution = {}) {
    const explicit = execution.network_config?.protocols || topology.protocols;
    if (explicit) return {...defaultTopologyProtocols(), ...explicit,
        chainmaker_mab: readChainmakerMab(explicit.chainmaker_mab)};
    const legacyRouters = (topology.nodes || []).filter(n => n.type === "Router" || n.type === "LirNode");
    const validationNodes = legacyRouters.filter(n => n.enable_path_validation ?? n.type === "LirNode");
    const network = execution.network_config;
    const validation = execution.path_validation_params;
    const table = validation?.basic_config?.routing_table_type || 1;
    const mab = validation?.sec_path_mab_config;
    return {...defaultTopologyProtocols(),
        ...(network ? {ospfv2: network.enable_frr && ["ospfv2", "dual"].includes(network.ospf_version),
            ospfv3: network.enable_frr && ["ospfv3", "dual"].includes(network.ospf_version), srv6: network.enable_srv6} : {}),
        lir: table !== 3, routing_table_type: table, path_validation: validationNodes.length > 0,
        sec_path_mab: validationNodes.some(n => n.enable_sec_path_mab ?? mab?.enabled) ? (mab?.sec_path_mab_type || 1) : 0,
    };
}

export function topologyProtocolError(value) {
    const carrier = value.chainmaker_p2p || "IP";
    if (!chainmakerCarriers.some(option => option.value === carrier)) return "请选择有效的 ChainMaker P2P 承载协议";
    if (carrier !== "IP") {
        if (value.routing_table_type === 3 || (carrier !== "SEC_PATH_MAB" && value.sec_path_mab)) return "ChainMaker 固定协议承载需要单播路由表；只有选择 SEC_PATH_MAB 承载时才允许开启学习";
        if (carrier === "LIR" && !value.lir) return "ChainMaker LiR 承载需要开启 LiR";
        if (carrier !== "LIR" && !value.path_validation) return `ChainMaker ${carrier} 承载需要开启路径验证`;
        if (carrier === "SEC_PATH_MAB") {
            const m = value.chainmaker_mab || {};
            if (value.sec_path_mab !== 1) return "ChainMaker 当前只支持固定批次学习";
            if (!Number.isInteger(m.batch_size) || m.batch_size < 1 || m.batch_size > 60000 ||
                !Number.isFinite(m.learning_rate) || m.learning_rate <= 0 || m.learning_rate > 1 ||
                !Number.isFinite(m.minimum_delivery_ratio) || m.minimum_delivery_ratio <= 0 || m.minimum_delivery_ratio >= 1) return "请填写有效的 ChainMaker MAB 学习参数";
        }
    }
    if (["ospfv2", "ospfv3", "srv6", "lir", "path_validation"].some(key => typeof value[key] !== "boolean")) return "协议开关必须是布尔值，请重新选择启动配置";
    if (![1, 2, 3].includes(value.routing_table_type)) return "请选择有效的路由表类型";
    if (![0, 1, 2, 3].includes(value.sec_path_mab)) return "请选择有效的 SEC_PATH_MAB 策略";
    if (value.lir && value.routing_table_type === 3) return "LiR 需要单播路由表，不能与类型 3 多路径实验共用";
    if (value.routing_table_type === 3 && !value.path_validation) return "多路径实验表需要启用路径验证";
    if (value.sec_path_mab && (!value.path_validation || value.routing_table_type === 3)) return "SEC_PATH_MAB 需要路径验证及类型 1 或 2 路由表";
    return "";
}

export function topologyProtocolNames(value) {
    return [[value.ospfv2, "OSPFv2 / IPv4"], [value.ospfv3, "OSPFv3 / IPv6"], [value.srv6, "SRv6"],
        [value.lir, "LiR"], [value.path_validation, "路径验证"], [value.sec_path_mab, "SEC_PATH_MAB"],
        [value.chainmaker_p2p && value.chainmaker_p2p !== "IP",
            `ChainMaker P2P → ${chainmakerCarriers.find(option => option.value === value.chainmaker_p2p)?.label || value.chainmaker_p2p}`]]
        .filter(([enabled]) => enabled).map(([, label]) => label);
}
