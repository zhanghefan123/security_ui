// getTopologyState.topology_params contains the full execution spec; its own
// topology_params field is the graph. Keep this mapping shared by both pages.
export function readTopologyStateParams(spec) {
    const topology = spec?.topology_params;
    const basic = spec?.block_chain_params?.basic_block_chain_params;
    const resources = spec?.resources_config;
    if (!Array.isArray(topology?.nodes) || !basic || !resources) {
        throw new Error("后端返回的拓扑状态格式不完整，无法恢复运行中的拓扑");
    }
    if (topology.links != null && !Array.isArray(topology.links)) {
        throw new Error("后端返回的拓扑链路格式不正确");
    }
    return {
        topology: {...topology, links: topology.links ?? []},
        blockchainType: basic.blockchain_type || "无区块链",
        consensusType: basic.consensus_type || "无共识协议",
        consensusThreadCount: basic.consensus_thread_count,
        startDefence: basic.start_defence ?? false,
        cpuLimit: resources.cpu_limit,
        memoryLimit: resources.memory_limit,
    };
}
