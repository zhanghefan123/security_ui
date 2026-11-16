import {Node} from "./node";
import {defaultTopologyProtocols, readTopologyProtocols, topologyProtocolError} from "./topology_protocols";

test("LiR is enabled independently of validation and node payloads carry no switches", () => {
    expect(defaultTopologyProtocols()).toMatchObject({lir: true, path_validation: false, ospfv2: true});
    expect(new Node(1, "Router", 0, 0, {enable_path_validation: true})).not.toHaveProperty("enable_path_validation");
});

test("explicit topology selection overrides legacy node flags, including false", () => {
    const protocols = {...defaultTopologyProtocols(), lir: false, ospfv3: true};
    expect(readTopologyProtocols({protocols, nodes: [{type: "LirNode", enable_path_validation: true}]})).toEqual(protocols);
    expect(readTopologyProtocols({nodes: [{type: "LirNode"}]}).path_validation).toBe(true);
    expect(readTopologyProtocols({nodes: [{type: "LirNode", enable_path_validation: false}]}).path_validation).toBe(false);
});

test("running dual-stack configuration is restored and incompatible table is rejected", () => {
    const restored = readTopologyProtocols({}, {network_config: {enable_frr: true, ospf_version: "dual", enable_srv6: true}});
    expect(restored).toMatchObject({ospfv2: true, ospfv3: true, srv6: true});
    expect(topologyProtocolError({...defaultTopologyProtocols(), routing_table_type: 3})).toBeTruthy();
    expect(topologyProtocolError({...defaultTopologyProtocols(), ospfv3: true})).toBe("");
});
