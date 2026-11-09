import {readTopologyStateParams} from "./topology_state";

const executionSpec = () => ({
    block_chain_params: {basic_block_chain_params: {
        blockchain_type: "长安链", consensus_type: "TBFT", consensus_thread_count: 25, start_defence: false,
    }},
    resources_config: {cpu_limit: 0, memory_limit: 1024},
    topology_params: {
        nodes: [{index: 1, type: "ChainMakerNode", x: 100, y: 200}],
        links: [],
    },
});

test("restores the nested execution spec, preserving false, zero and MB units", () => {
    const spec = executionSpec();
    const restored = readTopologyStateParams(spec);
    expect(restored).toMatchObject({blockchainType: "长安链", consensusType: "TBFT", consensusThreadCount: 25, startDefence: false, cpuLimit: 0, memoryLimit: 1024});
    expect(restored.topology.nodes).toEqual(spec.topology_params.nodes);
    expect(restored.topology.links).toEqual([]);
    expect(restored).not.toHaveProperty("network_env");
    expect(restored).not.toHaveProperty("access_link_bandwidth");
});

test("accepts a Go nil link slice without mutating the response", () => {
    const spec = executionSpec();
    spec.topology_params.links = null;
    expect(readTopologyStateParams(spec).topology.links).toEqual([]);
    expect(spec.topology_params.links).toBeNull();
});

test("rejects missing or old flat state with a useful error", () => {
    expect(() => readTopologyStateParams(undefined)).toThrow("拓扑状态格式不完整");
    expect(() => readTopologyStateParams({nodes: [], links: []})).toThrow("拓扑状态格式不完整");
});
