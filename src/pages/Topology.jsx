import * as G6 from "@antv/g6";
import React, {useEffect, useRef, useState} from "react";
import {Alert, Button, Card, Col, Form, Input, message, Modal, Progress, Row, Select, Switch, Table, Upload} from "antd";
import "./Topology.css";
import "./TopologyWorkbench.css";
import {Node} from "../entities/node"
import {Link} from "../entities/link"
import {readTopologyStateParams} from "../entities/topology_state"
import {
    changeStartDefenceRequest,
    getStopProgress,
    getTopologyState, GetTxRateTest, installChannelAndChaincode,
    saveTopologyRequest, startAttack,
    startAttackRequest, startInconsistentHeartbeatAttack, startMaliciousSynchronize,
    startTopology,
    startTxRateTest, stopAttack, stopInconsistentHeartbeatAttack, stopMaliciousSynchronize, stopNode,
    stopTopology,
    stopTxRateTest, topologyDescriptionRequest,
} from "../requests/topology";
import {InputNumber} from "antd/lib";
import {ProForm} from "@ant-design/pro-components";
import {UploadOutlined, PlusOutlined, SaveOutlined, DeploymentUnitOutlined, SafetyCertificateOutlined} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";

const {getLabelPosition, transform} = G6.Util;

// 拓扑销毁各步骤的中文名称，用于进度条展示
const TOPOLOGY_STOP_STEP_LABELS = {
    DeleteWebShells: "删除 WebShell",
    RemoveChainCodeContainers: "删除链码容器",
    StopNodeContainers: "停止节点容器",
    RemoveNodeContainers: "删除节点容器",
    RemoveLinks: "删除链路",
    RemoveEtcdService: "删除 Etcd 服务",
    RemoveChainMakerFiles: "删除长安链文件",
    RemoveFabricFiles: "删除 Fabric 文件",
    RemoveVolumes: "删除数据卷",
    RemoveDefaultRoutes: "删除默认路由",
    RemoveAllChainCodeImages: "删除链码镜像",
    RemoveAllFiscoBcosFiles: "删除 FISCO-BCOS 文件",
    RemoveAllSimulationDirs: "清理仿真目录",
};

// 拓扑启动各步骤的中文名称，用于进度条展示
const TOPOLOGY_START_STEP_LABELS = {
    GenerateSubnets: "生成子网",
    GenerateLinks: "生成链路",
    GenerateFrrConfigurationFiles: "生成 FRR 配置",
    GenerateChainMakerConfig: "生成长安链配置",
    GenerateFabricConfig: "生成 Fabric 配置",
    GenerateFabricNodeIDtoAddressMapping: "生成 Fabric 节点映射",
    GenerateFiscoBcosConfig: "生成 FISCO-BCOS 配置",
    GenerateAddressMapping: "生成地址映射",
    GeneratePortMapping: "生成端口映射",
    CalculateAndWriteSegmentRoutes: "计算段路由",
    GenerateIfnameToLinkIdentifierMapping: "生成接口映射",
    GenerateChainMakerIDtoNameMapping: "生成长安链名称映射",
    CalculateAndWriteLiRRoutes: "计算 LiR 路由",
    GenerateAtlasSegmentsAndOutputLinkIdentifiers: "生成 Atlas 分段",
    GenerateMultipathSelirPathsAndOutputLinkIdentifiers: "生成 Multipath-Selir 多路径",
    StartEtcdService: "启动 Etcd 服务",
    StoreToEtcd: "写入 Etcd",
    GenerateNodesVethPairs: "生成节点 veth",
    StartNodeContainers: "启动节点容器",
    SetVethNameSpaces: "设置 veth 命名空间",
    SetLinkParameters: "设置链路参数",
    UpdateHosts: "更新 hosts",
    AddDefaultRouteToFirstInterface: "添加默认路由",
};

// 所有的网路节点的可能的类型
// ---------------------------------------------------------------------------
// NetworkNodeType_NormalSatellite    NetworkNodeType = 0 (constellation 专用)
// NetworkNodeType_ConsensusSatellite NetworkNodeType = 1 (constellation 专用)
// NetworkNodeType_EtcdService        NetworkNodeType = 2 (constellation 专用)
// NetworkNodeType_PositionService    NetworkNodeType = 3 (constellation 专用)
// NetworkNodeType_Router             NetworkNodeType = 4 (topology 专用)
// NetworkNodeType_NormalNode         NetworkNodeType = 5 (topology 专用)
// NetworkNodeType_ConsensusNode      NetworkNodeType = 6 (topology 专用)
// NetworkNodeType_MaliciousNode      NetworkNodeType = 7 (topology 专用)
// ---------------------------------------------------------------------------


// 函数化组件
export function Topology(props) {


    // 1. 进行 G6 拓扑的自定义的边的注册
    // ---------------------------------------------------------------------------------------------
    G6.registerEdge(
        "arrow-running",
        {
            afterDraw(cfg, group) {
                // get the first shape in the group, it is the edge's path here=
                const shape = group.get("children")[0];

                const arrow = group.addShape("marker", {
                    attrs: {
                        x: 16,
                        y: 0,
                        r: 8,
                        lineWidth: 2,
                        stroke: "#3370ff",
                        fill: "#fff",
                        symbol: (x, y, r) => {
                            return [
                                ["M", x - 6, y - 4],
                                ["L", x - 2, y],
                                ["L", x - 6, y + 4]
                            ];
                        }
                    }
                });

                // animation for the red circle
                arrow.animate(
                    (ratio) => {
                        // the operations in each frame. Ratio ranges from 0 to 1 indicating the prograss of the animation. Returns the modified configurations
                        // get the position on the edge according to the ratio
                        const tmpPoint = shape.getPoint(ratio);
                        const pos = getLabelPosition(shape, ratio);
                        let matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
                        matrix = transform(matrix, [
                            ["t", -tmpPoint.x, -tmpPoint.y],
                            ["r", pos.angle],
                            ["t", tmpPoint.x, tmpPoint.y]
                        ]);

                        // returns the modified configurations here, x and y here
                        return {
                            x: tmpPoint.x,
                            y: tmpPoint.y,
                            matrix
                        };
                    },
                    {
                        repeat: true, // Whether executes the animation repeatly 是否边的动画
                        duration: 3000 // the duration for executing once 每次动画的执行过程
                    }
                );
            }
        },
        "line" // extend the built-in edge 'cubic'
    );
    // ---------------------------------------------------------------------------------------------

    // 2. 类型的定义
    // ---------------------------------------------------------------------------------------------
    // 2.1 节点类型
    const nodeTypes = [
        "Router",
        "NormalNode",
        "ConsensusNode",
        "ChainMakerNode",
        "MaliciousNode",
        "LirNode",
        "FabricPeerNode",
        "FabricOrderNode",
        "FiscoBcosNode",
    ]
    // 2.2 链路类型
    const linkTypes = [
        "接入链路",
        "骨干链路"
    ]
    const styleForAccessLink = {
        stroke: '#0bef1e',
        lineWidth: 2,
    }
    const styleForBackboneLink = {
        stroke: '#0b39ef',
        lineWidth: 5,
    }
    // 2.3 攻击类型
    const attackTypes = [
        "udp flood attack",
        "syn flood attack",
        "connection exhausted attack",
        "共识消息重放"
    ]
    // 2.4 区块链的类型
    // const blockchainTypes = ["长安链", "以太坊", "fabric", "BIDL", "百度超级链"]
    // const consensusTypes = {
    //     "长安链": ["TBFT", "RAFT"],
    //     "以太坊": ["PoW", "PoS"],
    //     "fabric": ["BFT-SMaRt"],
    //     "BIDL": ["PBFT-并行", "PBFT-串行"],
    //     "百度超级链": ["TDPoS", "PoA"]
    // }
    const blockchainTypes = ["无区块链", "长安链", "fabric", "fisco-bcos"]
    const consensusTypes = {
        "无区块链": ["无共识协议"],
        "长安链": ["TBFT", "RAFT"],
        "fabric": ["BFT-SMaRt"],
        "fisco-bcos": ["pbft"],
    }
    // ---------------------------------------------------------------------------------------------

    // 3.表单
    // ---------------------------------------------------------------------------------------------
    const [startTopologyForm] = ProForm.useForm()
    // ---------------------------------------------------------------------------------------------

    // 4. 字段的中英文
    // ---------------------------------------------------------------------------------------------
    // 4.1 拓扑配置相关表单字段
    const networkTopologyField = ["网络环境", "network_env"]
    const blockchainTypeField = ["区块链类型", "blockchain_type"]
    const consensusTypeField = ["共识类型", "consensus_type"]
    const accessLinkBandwidthField = ["接入链路带宽", "接入链路带宽(mbps)"]
    const consensusNodeCpuField = ["共识节点CPU", "共识节点CPU(个)"]
    const consensusNodeMemoryField = ["共识节点内存", "共识节点内存 (MB)"]
    const consensusThreadCountField = ["共识线程数量", "consensus_thread_count"]
    const totalNodesCountField = ["总节点数量", "total_node_count"]
    // 4.2 攻击相关表单字段
    const attackThreadCountField = ["攻击线程数量", "attack_thread_count"]
    const attackTypeField = ["攻击类型", "attack_type"]
    const attackNodeField = ["攻击节点", "attack_node"]
    const attackedNodeField = ["被攻击节点", "attacked_node"]
    const attackDurationField = ["攻击时间", "attack_duration"]
    // 4.3 拓扑创建相关的表单字段
    const [selectedBlockchain, setSelectedBlockchain] = useState(blockchainTypes[0])
    const [availableConsensusTypes, setAvailableConsensusTypes] = useState(consensusTypes[blockchainTypes[0]])
    const [selectedConsensusType, setSelectedConsensusType] = useState(consensusTypes[blockchainTypes[0]][0])
    const [selectedNetworkTopology, setSelectedNetworkTopology] = useState("自定义拓扑")
    const [selectedAccessLinkBandwidth, setSelectedAccessLinkBandwidth] = useState(8)
    const [selectedConsensusNodeCpuLimit, setSelectedConsensusNodeCpuLimit] = useState(2)
    const [selectedConsensusNodeMemoryLimit, setSelectedConsensusNodeMemoryLimit] = useState(1024)
    const [selectedConsensusThreadCount, setSelectedConsensusThreadCount] = useState(25)
    // 4.4 所有的攻击相关的表单字段
    const [selectedAttackThreadCount, setSelectedAttackThreadCount] = useState(40)
    const [selectedAttackType, setSelectedAttackType] = useState(attackTypes[0])
    const [selectedAttackNode, setSelectedAttackNode] = useState("")
    const [selectedAttackedNode, setSelectedAttackedNode] = useState("")
    const [selectedAttackDuration, setSelectedAttackDuration] = useState(1)
    // 4.5 保存拓扑相关的字段
    const [selectedTopologyName, setSelectedTopologyName] = useState("")
    const [topologyOptions, setTopologyOptions] = useState([])
    // 4.6 安全相关的字段
    const [startDefence, setStartDefence] = useState(false)
    // ---------------------------------------------------------------------------------------------

    // 5. 拓扑状态
    // ---------------------------------------------------------------------------------------------
    const [currentTopologyState, setCurrentTopologyState] = useState(false)
    const [topologyNeedsCleanup, setTopologyNeedsCleanup] = useState(false)
    const [currentChannelChaincodeState, setCurrentChannelChaincodeState] = useState(false)
    const [currentAttackState, setCurrentAttackState] = useState(false)
    const [routers, setRouters] = useState([])
    const [normalNodes, setNormalNodes] = useState([])
    const [consensusNodes, setConsensusNodes] = useState([])
    const [chainMakerNodes, setChainMakerNodes] = useState([])
    const [maliciousNodes, setMaliciousNodes] = useState([])
    const [lirNodes, setLirNodes] = useState([])
    const [fabricPeerNodes, setFabricPeerNodes] = useState([])
    const [fabricOrderNodes, setFabricOrderNodes] = useState([])
    const [fiscoBcosNodes, setFiscoBcosNodes] = useState([])
    const [totalNodesCount, setTotalNodesCount] = useState(0)
    const [txRateTestStatus, setTxRateTestStatus] = useState(false)
    // ---------------------------------------------------------------------------------------------

    // 6. 图的引用
    // ---------------------------------------------------------------------------------------------
    const graphDivRef = useRef(null); // 创建一个
    // ---------------------------------------------------------------------------------------------

    // 7. tps 的相关状态
    // ---------------------------------------------------------------------------------------------
    const [timeList, setTimeList] = useState([1, 2, 3])
    const [currentTps, setCurrentTps] = useState([1, 2, 3])

    // ---------------------------------------------------------------------------------------------

    // 8. 参数表格
    // ---------------------------------------------------------------------------------------------
    const tableColumns = [
        {
            title: "参数",
            dataIndex: "paramsDescription",
            key: "paramsDescription"
        },
        {
            title: "值",
            dataIndex: "paramsValue",
            key: "paramsValue"
        }
    ]
    // ---------------------------------------------------------------------------------------------

    // 9. tps 折线图的配置项
    // ---------------------------------------------------------------------------------------------
    const rateOption = {
        title: {
            text: ''
        },
        grid: {
            left: 16,
            right: 24,
            bottom: 42,
            top: 44,
            containLabel: true
        },
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: ['共识速率/TPS'],
            right: 16,
            textStyle: {
                fontSize: 13, // 图例字体大小
                color: "#55c8e8"
            }
        },
        xAxis: {
            name: "时间/S",
            nameLocation: "middle",
            nameGap: 28,
            type: "category",
            data: timeList,
            axisLabel: {
                fontSize: 13,
                color: "#8da2bb",
                hideOverlap: true
            },
            nameTextStyle: {
                fontSize: 13,
                color: "#55c8e8"
            }
        },
        yAxis: {
            name: "TPS",
            type: "value",
            axisLabel: {
                formatter: '{value}',
                fontSize: 13,
                color: "#8da2bb"
            },
            nameTextStyle: {
                fontSize: 13,
                color: "#55c8e8"
            }
        },
        series: [{
            name: '共识速率/TPS',
            type: 'line',
            yAxisIndex: 0,
            data: currentTps,
            lineStyle: {
                width: 2,
                color: "#55c8e8",
            },
            smooth: false,
            symbolSize: 5,
            color: "#55c8e8",
        }]
    }
    // ---------------------------------------------------------------------------------------------

    // 10. 拓扑配置相关状态
    // ---------------------------------------------------------------------------------------------
    // 10.1 选择的节点类型
    const [selectedNodeType, setSelectedNodeType] = useState("Router")
    // 10.2 选择的链路类型
    const [selectedLinkType, setSelectedLinkType] = useState("骨干链路")
    // ---------------------------------------------------------------------------------------------

    // 11. 组件初始化过程中使用到的状态
    // ---------------------------------------------------------------------------------------------
    // 11.1 组件属性
    const [graph, setGraph] = useState(undefined)
    // 11.2 组件的初始化步骤
    const [createGraph, setCreateGraph] = useState(0)
    const [getState, setGetState] = useState(0)
    // ---------------------------------------------------------------------------------------------


    // 12. 提示框 promptbox 相关
    // ---------------------------------------------------------------------------------------------
    // 12.1 提示框的类型
    const promptBoxTypes = {
        startTopology: Symbol.for("startTopology"),
        stopTopology: Symbol.for("stopTopology"),
        startAttack: Symbol.for("startAttack"),
        errorParameters: Symbol.for("errorParameters"),
        saveTopology: Symbol.for("saveTopology"),
        installChannelandChainCode: Symbol.for("installChannelAndChaincode")
    }
    // 12.2 提示框的各个属性
    const [promptBoxType, setPromptBoxType] = useState()
    const [promptBoxTitle, setPromptBoxTitle] = useState("Warning");
    const [promptBoxOpen, setPromptBoxOpen] = useState(false)
    const [promptBoxText, setPromptBoxText] = useState("cannot create multiple edges between two nodes")
    const [promptBoxOkText, setPromptBoxOkText] = useState("ok")
    const [promptBoxCancelText, setPromptBoxCancelText] = useState("cancel")
    const [promptBoxLoading, setPromptBoxLoading] = useState(false)
    const [containerNameToPortMapping, setContainerNameToPortMapping] = useState("")
    // 销毁进度
    const [stopProgressPercent, setStopProgressPercent] = useState(0)
    const [stopProgressStep, setStopProgressStep] = useState("")
    const [stopInProgress, setStopInProgress] = useState(false)
    const stopProgressTimerRef = useRef(null)
    // ---------------------------------------------------------------------------------------------

    // 13. 函数化组件初始化第一步 - 进行监听器的设置
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {

        // Topology lifetime belongs to the backend; reloads must not stop it.



        // 在结束的时候进行卸载
        return () => {
            // 进行监听器的删除
            // 进行 timer 的删除
            if (stopProgressTimerRef.current) clearInterval(stopProgressTimerRef.current);
        }
    }, [graph]);
    // ---------------------------------------------------------------------------------------------

    // Keep the canvas in sync with its container, including form wrapping and browser zoom.
    useEffect(() => {
        const container = graphDivRef.current;
        if (!graph || !container) {
            return;
        }

        let frameId;
        const resizeCanvas = () => {
            cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                const width = container.clientWidth;
                const height = container.clientHeight;
                if (!graph.destroyed && width > 0 && height > 0 &&
                    (graph.get("width") !== width || graph.get("height") !== height)) {
                    graph.changeSize(width, height);
                }
            });
        };

        const observer = new ResizeObserver(resizeCanvas);
        observer.observe(container);
        window.addEventListener("resize", resizeCanvas);
        resizeCanvas();
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", resizeCanvas);
            cancelAnimationFrame(frameId);
        };
    }, [graph]);

    // 14. 组件初始化的第二步 创建图
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        // 原始数据
        const data = {
            // The array of nodes
            nodes: [],
            // The array of edges
            edges: [],
        };

        // 进行图的实例化
        const graphTmp = new G6.Graph({
            container: 'graph', // html 元素的 id
            // 图的宽度以及高度
            width: graphDivRef.current.clientWidth,
            height: graphDivRef.current.clientHeight || window.innerHeight * 0.8,
            // 默认的节点
            defaultNode: {
                type: 'image',
                size: [260, 80],
                clipCfg: {
                    show: false,
                    // 节点的形状 type options: circle, ellipse, rect, path
                    type: 'circle',
                    // circle
                    r: 30,
                    // clip style
                    style: {
                        lineWidth: 1,
                    },
                },
            },
            // 默认的边
            defaultEdge: {
                type: 'arrow-running',
                style: styleForBackboneLink,
                label: "",
            },
            // 可用的模式: 允许拖拽画布、放缩画布、拖拽节点
            modes: {
                default: ['create-edge', 'drag-canvas', 'zoom-canvas', 'drag-node', 'brush-select'],
            },
        });
        // 数据的加载
        graphTmp.data(data);
        // 图的渲染
        graphTmp.render();
        // 添加边之后的处理
        graphTmp.on('aftercreateedge', (e) => {
            const edgeCreate = e.edge
            let source = edgeCreate.getSource()
            let target = edgeCreate.getTarget()
            let sourceId = source.getID()
            let targetId = target.getID()
            // 逻辑1: 防止进行重复的边的创建
            let sameNodeEdges = graphTmp.findAll("edge", (edge) => {
                let oneDirection = (edge.getSource().getID() === sourceId) && (edge.getTarget().getID() === targetId)
                let anotherDirection = (edge.getSource().getID() === targetId) && (edge.getTarget().getID() === sourceId)
                return oneDirection || anotherDirection
            })
            if (sameNodeEdges.length === 2) {
                // 删除的时候, 如果删自己的就会发生错误, 状态不一致, 这个时候需要使用 setTimeout
                setTimeout(() => {
                    graphTmp.removeItem(sameNodeEdges[0])
                    message.error({
                        content: "cannot create multiple edges between two nodes"
                    })
                }, 0)
            }
            // 逻辑2: 防止创建指向自己的边
            let edgesPointToSelf = graphTmp.findAll("edge", (edge) => {
                return edge.getSource().getID() === edge.getTarget().getID()
            })
            if (edgesPointToSelf.length === 1) {
                setTimeout(() => {
                    graphTmp.removeItem(edgesPointToSelf[0])
                    message.error({
                        content: "cannot create an edge point to itself"
                    })
                }, 0)
            }
        });
        setGraph(graphTmp)
        setCreateGraph(1)
    }, []);
    // ---------------------------------------------------------------------------------------------

    // 15. 组件初始化的的第三步 - 进行图的状态的获取
    // ---------------------------------------------------------------------------------------------
    function refreshTopologyState() {
            getTopologyState((response) => {
                if (!graph || graph.destroyed) return;

                let container_name_to_port_mapping = response.data["container_name_to_port_mapping"]
                setContainerNameToPortMapping(container_name_to_port_mapping)

                // 不管是 up 还是 down 都能够获取
                let all_topology_names = response.data["all_topology_names"]
                setTopologyOptionsWithTopologyNames(all_topology_names)

                if (response.data["state"] === "up") {
                    setCurrentTopologyState(true);
                    setTopologyNeedsCleanup(false);
                    let restored;
                    try {
                        restored = readTopologyStateParams(response.data["topology_params"]);
                    } catch (error) {
                        message.error({content: error.message});
                        return;
                    }
                    setSelectedBlockchain(restored.blockchainType);
                    setAvailableConsensusTypes(consensusTypes[restored.blockchainType] || [restored.consensusType]);
                    setSelectedConsensusType(restored.consensusType);
                    setSelectedConsensusNodeCpuLimit(restored.cpuLimit);
                    setSelectedConsensusNodeMemoryLimit(restored.memoryLimit);
                    setSelectedConsensusThreadCount(restored.consensusThreadCount);
                    startTopologyForm.setFieldsValue({
                        [blockchainTypeField[0]]: restored.blockchainType,
                        [consensusTypeField[0]]: restored.consensusType,
                        [consensusNodeCpuField[0]]: restored.cpuLimit,
                        [consensusNodeMemoryField[0]]: restored.memoryLimit,
                        [consensusThreadCountField[0]]: restored.consensusThreadCount,
                    });
                    setCurrentTopologyState(true);
                    setStartDefence(restored.startDefence);
                    rebuildGraphWithLinkParams(restored.topology, response.data["links"], true);
                } else if (response.data["state"] === "failed" || response.data.cleanup_required) {
                    setCurrentTopologyState(true);
                    setTopologyNeedsCleanup(true);
                    setTxRateTestStatus(false);
                    message.error({content: response.data.message || "拓扑清理未完成，请点击停止拓扑重试清理"});
                } else if (response.data["state"] === "down") {
                    setTopologyNeedsCleanup(false);
                    setCurrentTopologyState(false)
                } else {
                    message.error({
                        content: "unsupported topology state"
                    })
                }
                setGetState(1)
            }, (error) => {
                message.error({
                    content: "could not get the status from the backend server"
                })
            })
    }

    useEffect(() => {
        if (createGraph === 1) refreshTopologyState();
    }, [createGraph]);


    function rebuildGraphWithLinkParams(topology_params, link_params, state) {
        // 需要先进行所有的节点的删除
        clearState()
        for (let i = 0; i < topology_params["nodes"].length; i++) {
            let node = topology_params["nodes"][i]
            AddNodeLogic(node["type"], node["x"], node["y"], state, node["index"])
        }
        setTimeout(() => {
            for (let i = 0; i < topology_params["links"].length; i++) {
                let link = topology_params["links"][i]
                let sourceNodeId = link["source_node"]["type"] + "_" + link["source_node"]["index"]
                let targetNodeId = link["target_node"]["type"] + "_" + link["target_node"]["index"]
                let link_type = link["link_type"]
                let sourceNodeIdBackend = link["source_node"]["type"] + "-" + link["source_node"]["index"]
                let targetNodeIdBackend = link["target_node"]["type"] + "-" + link["target_node"]["index"]


                // ---------------------- link param add logic ----------------------
                let finalString = ""
                /*
                let link_param = link_params[sourceNodeIdBackend][targetNodeIdBackend]
                if (!link_param) {
                    link_param = link_params[targetNodeIdBackend][sourceNodeIdBackend]
                }
                let source_interface_addr = link_param["source-interface"]["source-ipv4"]
                let target_interface_addr = link_param["target-interface"]["source-ipv4"]
                let source_interface_name = link_param["source-interface"]["IfName"]
                let target_interface_name = link_param["target-interface"]["IfName"]
                let finalString = ""
                finalString += `net: ${link_param["network-segment-ipv4"]}\n`
                finalString += `${source_interface_name}: ${source_interface_addr}\n`
                finalString += `${target_interface_name}: ${target_interface_addr}`
                 */
                // ---------------------- link param add logic ----------------------

                AddEdgeLogicWithText(sourceNodeId, targetNodeId, link_type, finalString)
            }
        }, 50)
    }

    function SetBlockChainTypeAccordingToTopologyParams(topology_params) {
        let topologyDescription = JSON.stringify(topology_params)
        if (topologyDescription.indexOf("FabricOrderNode") !== -1) {
            console.log("select fabric")
            // 设置选择的区块链
            setSelectedBlockchain("fabric");
            // 设置共识协议的可选项
            setAvailableConsensusTypes(consensusTypes["fabric"])
            // 设置表单初始值
            startTopologyForm.setFieldsValue({
                [blockchainTypeField[0]]: "fabric",
                [consensusTypeField[0]]: consensusTypes["fabric"][0],
            })
        } else if (topologyDescription.indexOf("ChainMakerNode") !== -1) {
            console.log("select chainmaker")
            // 设置选择的区块链
            setSelectedBlockchain("长安链");
            // 设置共识协议的可选项
            setAvailableConsensusTypes(consensusTypes["长安链"])
            // 设置表单初始值
            startTopologyForm.setFieldsValue({
                [blockchainTypeField[0]]: "长安链",
                [consensusTypeField[0]]: consensusTypes["长安链"][0],
            })
        } else if (topologyDescription.indexOf("FiscoBcos") !== -1) {
            console.log("select fisco bcos")
            // 设置选择的区块链
            setSelectedBlockchain("fisco-bcos");
            // 设置共识协议的可选项
            setAvailableConsensusTypes(consensusTypes["fisco-bcos"])
            // 设置表单初始值
            startTopologyForm.setFieldsValue({
                [blockchainTypeField[0]]: "fisco-bcos",
                [consensusTypeField[0]]: consensusTypes["fisco-bcos"][0],
            })
        } else {
            console.log("select nothing")
            setSelectedBlockchain("无区块链")
            setAvailableConsensusTypes(consensusTypes["无区块链"])
            startTopologyForm.setFieldsValue({
                [blockchainTypeField[0]]: "无区块链",
                [consensusTypeField[0]]: consensusTypes["无区块链"][0],
            })
        }
    }


    // 根据后端返回的参数重新进行图的构建
    function rebuildGraph(topology_params, state) {
        // 根据 topology_params 确定当前的区块链的类型
        SetBlockChainTypeAccordingToTopologyParams(topology_params)
        // 需要先进行所有的节点的删除
        clearState()
        for (let i = 0; i < topology_params["nodes"].length; i++) {
            let node = topology_params["nodes"][i]
            AddNodeLogic(node["type"], node["x"], node["y"], state, node["index"])
        }
        setTimeout(() => {
            for (let i = 0; i < topology_params["links"].length; i++) {
                let link = topology_params["links"][i]
                let sourceNodeId = link["source_node"]["type"] + "_" + link["source_node"]["index"]
                let targetNodeId = link["target_node"]["type"] + "_" + link["target_node"]["index"]
                let link_type = link["link_type"]
                AddEdgeLogic(sourceNodeId, targetNodeId, link_type)
            }
        }, 50)
    }

    function clearState() {
        graph.clear()
        setRouters([])
        setNormalNodes([])
        setConsensusNodes([])
        setChainMakerNodes([])
        setMaliciousNodes([])
        setLirNodes([])
        setFabricOrderNodes([])
        setFabricPeerNodes([])
        setFiscoBcosNodes([])
        setTotalNodesCount(0)
    }

    // ---------------------------------------------------------------------------------------------

    // 16. 组件初始化的第三步 - 向图之中进行菜单, 插件的添加
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        if (getState === 1) {
            let nodeMenu = undefined
            let edgeMenu = undefined
            if (graph) {
                // 节点菜单
                nodeMenu = new G6.Menu({
                    offsetX: 10,
                    itemTypes: ['node'],
                    getContent(e, graph) {

                        const node = e.item;
                        const nodeModel = node.getModel();
                        const nodeId = nodeModel.id;
                        if (nodeId.includes("FabricOrder")) {
                            const outDiv = document.createElement('div');
                            outDiv.style.width = '180px';
                            outDiv.innerHTML = `<ul>
                                                <li>创建webshell</li>
                                                <li>删除节点</li>
                                                <li>暂停节点</li>
                                                <li>攻击主节点</li>
                                                <li>停止攻击主节点</li>
                                                <li>恶意向主节点同步</li>
                                                <li>停止向恶意向主节点同步</li>
                                                <li>取消</li>
                                            </ul>`
                            return outDiv
                        } else if(nodeId.includes("ChainMaker")){
                            const outDiv = document.createElement('div');
                            outDiv.style.width = '180px';
                            outDiv.innerHTML = `<ul>
                                                <li>创建webshell</li>
                                                <li>删除节点</li>
                                                <li>攻击主节点</li>
                                                <li>停止攻击主节点</li>
                                                <li>开启广播不一致心跳</li>
                                                <li>关闭广播不一致心跳</li>
                                                <li>取消</li>
                                            </ul>`
                            return outDiv
                        } else if(nodeId.includes("FiscoBcos")) {
                            const outDiv = document.createElement('div');
                            outDiv.style.width = '180px';
                            outDiv.innerHTML = `<ul>
                                                <li>创建webshell</li>
                                                <li>删除节点</li>
                                                <li>开启广播不一致心跳</li>
                                                <li>关闭广播不一致心跳</li>
                                                <li>取消</li>
                                            </ul>`
                            return outDiv
                        } else {
                            const outDiv = document.createElement('div');
                            outDiv.style.width = '180px';
                            outDiv.innerHTML = `<ul>
                                                <li>创建webshell</li>
                                                <li>删除节点</li>
                                                <li>取消</li>
                                            </ul>`
                            return outDiv
                        }
                    },

                    handleMenuClick(target, item, graph) {
                        if (target.textContent === "创建webshell") {
                            if (currentTopologyState) {
                                // 进行 webshell 的创建, 跳转到实际的创建 webshell 的界面
                                const windowProxy = window.open("_black")
                                windowProxy.location.href = `/instance/${item.getID()}`
                                // window.location.href = `/instance/${item.getID()}` // 这里是直接进行现场打开的结果
                            } else {
                                // 还不能创建 webshell
                                message.error({
                                    content: "still cannot create webshell"
                                })
                            }
                        } else if (target.textContent === "删除节点") {
                            setTimeout(() => {
                                graph.removeItem(item)
                            }, 0)
                            message.success("成功删除节点" + item.getID())
                        } else if (target.textContent === "暂停节点") {
                            if (!currentTopologyState) {
                                message.error({
                                    content: "current topology down: cannot pause node"
                                })
                            } else {
                                let nodeId = item.getID()
                                let typeAndId = nodeId.split("_")
                                let containerName = `${typeAndId[0]}-${typeAndId[1]}`
                                console.log(containerNameToPortMapping)
                                console.log(containerNameToPortMapping[containerName])
                                stopNode(containerNameToPortMapping[containerName], (response) => {
                                    message.success({
                                        content: "successfully stop the node"
                                    })
                                }, (error) => {
                                    message.success({
                                        content: "stop node failed"
                                    })
                                })
                            }

                        } else if (target.textContent === "攻击主节点") {
                            if (!currentTopologyState) {
                                message.error({
                                    content: "current topology down: cannot start attack"
                                })
                            } else {
                                let nodeId = item.getID()
                                let typeAndId = nodeId.split("_")
                                let containerName = `${typeAndId[0]}-${typeAndId[1]}`
                                startAttack(containerNameToPortMapping[containerName], (response) => {
                                    console.log(response)
                                    message.success({
                                        content: `successfully start attack against ${response.data["target"]}`
                                    })
                                }, (error) => {
                                    message.error({
                                        content: "start attack failed"
                                    })
                                })
                            }

                        } else if (target.textContent === "停止攻击主节点") {
                            if (!currentTopologyState) {
                                message.error({
                                    content: "current topology down: cannot stop attack"
                                })
                            } else {
                                let nodeId = item.getID()
                                let typeAndId = nodeId.split("_")
                                let containerName = `${typeAndId[0]}-${typeAndId[1]}`
                                stopAttack(containerNameToPortMapping[containerName], (response) => {
                                    message.success({
                                        content: "successfully stop attack against leader"
                                    })
                                }, (error) => {
                                    message.error({
                                        content: "stop attack failed"
                                    })
                                })
                            }

                        } else if (target.textContent === "恶意向主节点同步") {
                            if (!currentTopologyState) {
                                message.error({
                                    content: "cannot synchronize to main leader"
                                })
                            } else {
                                let nodeId = item.getID()
                                let typeAndId = nodeId.split("_")
                                let containerName = `${typeAndId[0]}-${typeAndId[1]}`
                                startMaliciousSynchronize(containerNameToPortMapping[containerName], (response) => {
                                    message.success({
                                        content: "successfully start malicious synchoronize"
                                    })
                                }, (error) => {
                                    message.error({
                                        content: "start malicious synchronize failed"
                                    })
                                })
                            }
                        } else if (target.textContent === "停止向恶意向主节点同步") {
                            if (!currentTopologyState) {
                                message.error({
                                    content: "cannot stop sychronize to main leader"
                                })
                            } else {
                                let nodeId = item.getID()
                                let typeAndId = nodeId.split("_")
                                let containerName = `${typeAndId[0]}-${typeAndId[1]}`
                                stopMaliciousSynchronize(containerNameToPortMapping[containerName], (response) => {
                                    message.success({
                                        content: "successfully stop malicious synchoronize"
                                    })
                                }, (error) => {
                                    message.error({
                                        content: "stop malicious synchronize failed"
                                    })
                                })
                            }
                        } else if(target.textContent === "开启广播不一致心跳") {
                            if(!currentTopologyState) {
                                message.error({
                                    content: "topology not started"
                                })
                            } else {
                                let nodeId = item.getID()
                                let typeAndId = nodeId.split("_")
                                let containerName = `${typeAndId[0]}-${typeAndId[1]}`
                                startInconsistentHeartbeatAttack(containerNameToPortMapping[containerName], (response)=>{
                                    message.success({
                                        content: "start inconsistent heartbeat attack successful"
                                    })
                                }, (error)=>{
                                    message.error({
                                        content: "start inconsistent heartbeat attack failed"
                                    })
                                })
                            }
                        } else if(target.textContent === "关闭广播不一致心跳") {
                            if(!currentTopologyState) {
                                message.error({
                                    content: "topology not started"
                                })
                            } else {
                                let nodeId = item.getID()
                                let typeAndId = nodeId.split("_")
                                let containerName = `${typeAndId[0]}-${typeAndId[1]}`
                                stopInconsistentHeartbeatAttack(containerNameToPortMapping[containerName], (response)=>{
                                    message.success({
                                        content: "stop inconsistent heartbeat attack successful"
                                    })
                                }, (error)=>{
                                    message.error({
                                        content: "stop inconsistent heartbeat attack failed"
                                    })
                                })
                            }
                        }
                    },
                })

                // 边的菜单
                edgeMenu = new G6.Menu({
                    offsetX: 10,
                    itemTypes: ['edge'],
                    getContent(e, graph) {
                        const outDiv = document.createElement('div');
                        outDiv.style.width = '180px';
                        outDiv.innerHTML = `<ul>
                    <li>删除边</li>
                    <li>取消</li>
                  </ul>`
                        return outDiv
                    },
                    handleMenuClick(target, item, graph) {
                        if (target.textContent === "删除边") {
                            graph.removeItem(item)
                            message.success({
                                content: "成功删除边"
                            })
                        } else {
                            message.success({
                                content: "取消操作"
                            })
                        }

                    },
                })
                graph.addPlugin(nodeMenu);
                graph.addPlugin(edgeMenu);
            }

            // 清理插件
            return () => {
                if (graph) {
                    graph.removePlugin(nodeMenu);
                    graph.removePlugin(edgeMenu)
                }
            };
        }
    }, [getState, currentTopologyState, graph]);
    // ---------------------------------------------------------------------------------------------

    // 17. 提示框的处理函数
    // ---------------------------------------------------------------------------------------------
    // 17.1 当提示框点击了 OK 的时候
    function stopProgressPolling() {
        if (stopProgressTimerRef.current) {
            clearInterval(stopProgressTimerRef.current)
            stopProgressTimerRef.current = null
        }
    }

    function handlePromptOkCicked() {
        if (promptBoxType === promptBoxTypes.startTopology) { // 如果是启动拓扑的话
            setPromptBoxLoading(true)
            // 进行所有的节点的信息的收集
            let nodesMap = {}
            let nodesList = []
            const graphNodes = graph.getNodes()
            graphNodes.forEach((graphNode) => {
                let nodeID = graphNode.getID()
                let result = nodeID.split("_")
                let x = graphNode._cfg.model.x
                let y = graphNode._cfg.model.y
                let node = new Node(Number(result[1]), result[0], x, y)
                nodesMap[nodeID] = node
                nodesList.push(node)
            })
            // 进行所有的边的信息的收集
            let links = []
            const graphEdges = graph.getEdges()
            graphEdges.forEach((graphEdge) => {
                let lineWidth = graphEdge._cfg.originStyle["edge-shape"].lineWidth
                let lineType = ""
                if (lineWidth === 2) {
                    lineType = "access"
                } else if (lineWidth === 5) {
                    lineType = "backbone"
                } else {
                    console.log("unsupported line type")
                }
                let graphSourceNodeID = graphEdge.getSource().getID()
                let graphTargetNodeID = graphEdge.getTarget().getID()
                let sourceNode = nodesMap[graphSourceNodeID]
                let targetNode = nodesMap[graphTargetNodeID]
                links.push(new Link(sourceNode, targetNode, lineType))
            })
            // 构建参数 - 从表单获取最新值
            const formValues = startTopologyForm.getFieldsValue();
            const params = {
                network_env: formValues[networkTopologyField[0]] || selectedNetworkTopology,
                blockchain_type: formValues[blockchainTypeField[0]] || selectedBlockchain,
                consensus_type: formValues[consensusTypeField[0]] || selectedConsensusType,

                consensus_node_cpu: formValues[consensusNodeCpuField[0]] || selectedConsensusNodeCpuLimit,
                consensus_node_memory: formValues[consensusNodeMemoryField[0]] || selectedConsensusNodeMemoryLimit,
                consensus_thread_count: formValues[consensusThreadCountField[0]] || selectedConsensusThreadCount,
                nodes: nodesList,
                links: links,
                start_defence: startDefence
            }
            console.log("params:", formValues)
            console.log("selectedConsensusType:", selectedConsensusType)
            // 初始化启动进度
            setStopInProgress(true)
            setStopProgressPercent(0)
            setStopProgressStep("正在启动拓扑...")
            // 调用函数
            startTopology(params, (response) => {
                stopProgressPolling()
                setStopProgressPercent(100)
                setStopInProgress(false)
                message.success({
                    content: `successfully start the topology`
                })
                setCurrentTopologyState(true) // 进行当前状态的更新 -> true
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false) // 不打开 promptbox
                window.location.reload() // 进行页面的强制刷新
            }, (error) => {
                stopProgressPolling()
                setStopInProgress(false)
                message.error({
                    content: error.response?.data?.message || `start topology error ${error}`
                })
                setCurrentTopologyState(true);
                setTopologyNeedsCleanup(true);
                refreshTopologyState() // 进行当前状态的更新 -> false
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false) // 关闭 promptbox
            })

            // 轮询启动进度
            stopProgressTimerRef.current = setInterval(() => {
                getStopProgress("topology", (res) => {
                    setStopProgressPercent(res.data?.percent ?? 0)
                    const step = res.data?.step
                    if (step) setStopProgressStep(TOPOLOGY_START_STEP_LABELS[step] || step)
                }, () => {})
            }, 300)
        } else if (promptBoxType === promptBoxTypes.stopTopology) { // 如果是停止拓扑的话
            setPromptBoxLoading(true)
            setStopInProgress(true)
            setStopProgressPercent(0)
            setStopProgressStep("正在销毁拓扑...")
            stopTopology((response) => {
                stopProgressPolling()
                setStopProgressPercent(100)
                setStopInProgress(false)
                message.success({
                    content: `成功停止拓扑`
                })
                setCurrentTopologyState(false) // 进行当前状态的更新 -> false
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false)  // 关闭 promptbox
                window.location.reload() // 进行页面的强制刷新
            }, (error) => {
                stopProgressPolling()
                setStopInProgress(false)
                message.error({
                    content: error.response?.data?.message || `stop topology error ${error}`
                })
                // 不进行状态的更新
                setTopologyNeedsCleanup(true);
                setTxRateTestStatus(false);
                refreshTopologyState();
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })

            // 轮询销毁进度
            stopProgressTimerRef.current = setInterval(() => {
                getStopProgress("topology", (res) => {
                    setStopProgressPercent(res.data?.percent ?? 0)
                    const step = res.data?.step
                    if (step) setStopProgressStep(TOPOLOGY_STOP_STEP_LABELS[step] || step)
                }, () => {})
            }, 300)
        } else if (promptBoxType === promptBoxTypes.startAttack) { // 如果是发动攻击的话
            setPromptBoxLoading(true)
            let params = {
                attack_thread_count: selectedAttackThreadCount,
                attack_type: selectedAttackType,
                attack_node: selectedAttackNode.replace("_", "-"),
                attacked_node: selectedAttackedNode.replace("_", "-"),
                attack_duration: selectedAttackDuration
            }
            let splitContent = selectedAttackNode.split("_")  // 准备拿到类型和 id
            startAttackRequest(parseInt(splitContent[1]), params, (response) => {
                message.success({
                    content: `成功发动攻击`
                })
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false)  // 关闭 promptbox
                // 如果成功的发动了攻击的话，应该需要将攻击状态设置为正在攻击
                setCurrentAttackState(true)
                setTimeout(() => {
                    setCurrentAttackState(false)
                    message.success({
                        content: "攻击完成"
                    })
                }, selectedAttackDuration * 1000)
            }, (error) => {
                message.error({
                    content: "发动攻击失败"
                })
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false)  // 关闭 promptbox
            })
        } else if (promptBoxType === promptBoxTypes.errorParameters) {
            setPromptBoxOpen(false)
        } else if (promptBoxType === promptBoxTypes.saveTopology) {
            setPromptBoxLoading(true)
            // 进行所有的节点的信息的收集, 并上传到后端进行保存
            let topologyDescription = collectTopologyInformation()
            const params = {
                "topology_name": selectedTopologyName,
                "topology_description": topologyDescription,
            }
            saveTopologyRequest(params, (response) => {
                // response 可以顺带返回当前有什么拓扑, 然后进行更新
                let all_topology_names = response.data["all_topology_names"]
                setTopologyOptionsWithTopologyNames(all_topology_names)

                // 说明已经成功进行了拓扑的保存
                message.success({
                    content: "successfully save the topology"
                })
                setPromptBoxOpen(false)
                setPromptBoxLoading(false)
            }, (error) => {
                message.error({
                    content: "failed to save the topology"
                })
                setPromptBoxOpen(false)
                setPromptBoxLoading(false)
            })
        } else if (promptBoxType === promptBoxTypes.installChannelandChainCode) {
            setPromptBoxLoading(true)
            installChannelAndChaincode((response) => {
                message.success({
                    content: "成功安装通道和链码"
                })
                setCurrentChannelChaincodeState(true)
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            }, (error) => {
                setCurrentChannelChaincodeState(false)
                message.error({
                    content: "安装channel以及链码失败"
                })
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })
        } else {
            console.log("unsupported promptBoxType")
        }
    }

    // 17.2 当提示框点击了取消的时候
    function handlePromptCancelCicked() {
        setPromptBoxOpen(false)
    }

    // 17.3 设置 options
    function setTopologyOptionsWithTopologyNames(all_topology_names) {
        let topology_options = []
        for (let index = 0; index < all_topology_names.length; index++) {
            topology_options.push({
                label: all_topology_names[index],
                value: all_topology_names[index]
            })
        }
        topology_options.push({
            label: "自定义拓扑",
            value: "自定义拓扑"
        })

        setTopologyOptions(topology_options)
    }

    // ---------------------------------------------------------------------------------------------

    // 18. 进行当前拓扑信息的收集
    function collectTopologyInformation() {
        // 节点map
        let nodesMap = {}
        // 节点列表
        let nodesList = []
        // 遍历所有的图节点
        // -------------------------------------------------------------------
        const graphNodes = graph.getNodes()
        graphNodes.forEach((graphNode) => {
            let nodeID = graphNode.getID()
            let result = nodeID.split("_")
            let x = graphNode._cfg.model.x
            let y = graphNode._cfg.model.y
            let node = new Node(Number(result[1]), result[0], x, y)
            nodesMap[nodeID] = node
            nodesList.push(node)
        })
        // -------------------------------------------------------------------

        // 遍历所有的图边
        // -------------------------------------------------------------------
        let links = []
        const graphEdges = graph.getEdges()
        graphEdges.forEach((graphEdge) => {
            let lineWidth = graphEdge._cfg.originStyle["edge-shape"].lineWidth
            let lineType = ""
            if (lineWidth === 2) {
                lineType = "access"
            } else if (lineWidth === 5) {
                lineType = "backbone"
            } else {
                console.log("unsupported line type")
            }
            let graphSourceNodeID = graphEdge.getSource().getID()
            let graphTargetNodeID = graphEdge.getTarget().getID()
            let sourceNode = nodesMap[graphSourceNodeID]
            let targetNode = nodesMap[graphTargetNodeID]
            links.push(new Link(sourceNode, targetNode, lineType))
        })
        // -------------------------------------------------------------------

        // 准备进行数据的发送
        // -------------------------------------------------------------------
        let data = {
            "nodes": nodesList,
            "links": links,
        }
        return JSON.stringify(data)
        // -------------------------------------------------------------------
    }

    // 18. 拓扑操作
    // ---------------------------------------------------------------------------------------------
    // 18.1 进行节点的添加
    const AddNodeButtonClicked = () => {
        let middleX = graphDivRef.current.clientWidth / 2
        let middleY = graphDivRef.current.clientHeight / 2
        AddNodeLogic(selectedNodeType, middleX, middleY, false)
    }

    // 18.2 进行颜色的定义
    function ReturnLableColor(currentState) {
        // 如果当前为启动状态 -> 那么为绿色
        if (currentState) {
            return '#4fde07'
        } else { // 如果当前为关闭状态 -> 那么为红色
            return '#de0707'
        }
    }

    // 18.3 节点添加的逻辑
    const AddNodeLogic = (nodeType, x, y, currentState, savedIndex) => {
        if (!graph || graph.destroyed) return;
        const usedIndexes = graph.getNodes().map(node => node.getID())
            .filter(id => id.startsWith(nodeType + "_"))
            .map(id => Number(id.slice(nodeType.length + 1)));
        const nodeIndex = savedIndex ?? (Math.max(0, ...usedIndexes) + 1);
        if (!Number.isInteger(nodeIndex) || nodeIndex < 1 || usedIndexes.includes(nodeIndex)) {
            throw new Error("拓扑节点编号必须为不重复的正整数");
        }
        let successfullyAdd = false
        let fontsize = 20
        let figuresize = 60
        if (nodeType === "Router") { // 进行路由节点的添加
            setRouters(prevRouters => {
                let routerId = nodeType + "_" + nodeIndex
                let router = {
                    id: routerId,
                    label: routerId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: "./pictures/router.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: fontsize,
                            shadowOffsetY: 10,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem('node', router);
                return [...prevRouters, routerId]
            })
            successfullyAdd = true
        } else if (nodeType === "NormalNode") { // 进行普通节点的添加
            setNormalNodes(prevNormalNodes => {
                let normalNodeId = nodeType + "_" + nodeIndex
                let normalNode = {
                    id: normalNodeId,
                    label: normalNodeId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: './pictures/normalNode.png',
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: fontsize,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem('node', normalNode);
                return [...prevNormalNodes, normalNodeId]
            })
            successfullyAdd = true
        } else if (nodeType === "ConsensusNode") { // 进行共识节点的添加
            setConsensusNodes(prevConsensusNodes => {
                let consensusNodeId = nodeType + "_" + nodeIndex
                let consensusNode = {
                    id: consensusNodeId,
                    label: consensusNodeId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: './pictures/consensusNode.png',
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: fontsize,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem('node', consensusNode);
                return [...prevConsensusNodes, consensusNodeId]
            })
            successfullyAdd = true
        } else if (nodeType === "ChainMakerNode") { // 进行长安链节点的添加
            setChainMakerNodes(prevChainMakerNodes => {
                let chainMakerNodeId = nodeType + "_" + nodeIndex
                let chainMakerNode = {
                    id: chainMakerNodeId,
                    label: chainMakerNodeId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: './pictures/chainMakerNode.png',
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: fontsize,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem('node', chainMakerNode);
                return [...prevChainMakerNodes, chainMakerNodeId]
            })
            successfullyAdd = true
        } else if (nodeType === "MaliciousNode") { // 进行恶意节点的添加
            setMaliciousNodes(prevMaliciousNodes => {
                let maliciousNodeId = nodeType + "_" + nodeIndex
                let maliciousNode = {
                    id: maliciousNodeId,
                    label: maliciousNodeId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: "./pictures/maliciousNode.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: fontsize,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem('node', maliciousNode);
                return [...prevMaliciousNodes, maliciousNodeId]
            })
            successfullyAdd = true
        } else if (nodeType === "LirNode") { // 进行 lir 节点的添加
            setLirNodes(prevLirNodes => {
                let lirNodeId = nodeType + "_" + nodeIndex
                let lirNode = {
                    id: lirNodeId,
                    label: lirNodeId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: "./pictures/lirNode.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: fontsize,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem("node", lirNode)
                return [...prevLirNodes, lirNode]
            })
            successfullyAdd = true
        } else if (nodeType === "FabricPeerNode") {
            setFabricPeerNodes(prevFabricPeerNodes => {
                let fabricPeerNodeId = nodeType + "_" + nodeIndex
                let fabricPeerNode = {
                    id: fabricPeerNodeId,
                    label: fabricPeerNodeId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: "./pictures/fabricPeerNode.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: fontsize,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem("node", fabricPeerNode)
                return [...prevFabricPeerNodes, fabricPeerNodeId]
            })
            successfullyAdd = true
        } else if (nodeType === "FabricOrderNode") {
            setFabricOrderNodes(prevFabricOrderNodes => {
                let fabricOrderNodeId = nodeType + "_" + nodeIndex
                let fabricOrderNode = {
                    id: fabricOrderNodeId,
                    label: fabricOrderNodeId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: "./pictures/fabricOrderNode.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: fontsize,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem("node", fabricOrderNode)
                return [...prevFabricOrderNodes, fabricOrderNodeId]
            })
            successfullyAdd = true
        } else if (nodeType === "FiscoBcosNode") {
            setFiscoBcosNodes(prevFiscoBcosNodes => {
                let fiscoBcosNodeId = nodeType + "_" + nodeIndex
                let fiscoBcosNode = {
                    id: fiscoBcosNodeId,
                    label: fiscoBcosNodeId,
                    x: x,
                    y: y,
                    size: figuresize,
                    img: "./pictures/fisco-bcos.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: "#ffffff",
                            fontSize: fontsize,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem("node", fiscoBcosNode)
                return [...prevFiscoBcosNodes, fiscoBcosNodeId]
            })
            successfullyAdd = true
        } else {
            console.log("unsupported node type")
        }
        if (successfullyAdd) {
            setTotalNodesCount((prev) => prev + 1)
            startTopologyForm.setFieldsValue({
                "总节点数量": totalNodesCount + 1,
            })
        }
    }

    // 18.4 边添加的逻辑
    function AddEdgeLogic(sourceNodeId, targetNodeId, link_type) {
        if (link_type === "access") {
            graph.addItem("edge", {
                source: sourceNodeId,
                target: targetNodeId,
                style: styleForAccessLink,
            })
        } else if (link_type === "backbone") {
            graph.addItem("edge", {
                source: sourceNodeId,
                target: targetNodeId,
                style: styleForBackboneLink,
            })
        }
    }

    function AddEdgeLogicWithText(sourceNodeId, targetNodeId, link_type, text) {
        if (link_type === "access") {
            graph.addItem("edge", {
                source: sourceNodeId,
                target: targetNodeId,
                style: styleForAccessLink,
                label: text,
            })
        } else if (link_type === "backbone") {
            graph.addItem("edge", {
                source: sourceNodeId,
                target: targetNodeId,
                style: styleForBackboneLink,
                label: text,
            })
        }
    }

    // ---------------------------------------------------------------------------------------------

    // 19. 按钮
    // ---------------------------------------------------------------------------------------------
    // 19.1 进行拓扑的删除
    function StopTopology() {
        setPromptBoxType(promptBoxTypes.stopTopology)
        setPromptBoxOpen(true)
        setPromptBoxTitle("停止拓扑")
        setPromptBoxText("请确认是否停止拓扑!")
    }

    // ---------------------------------------------------------------------------------------------

    // 20. 处理拓扑启动表单
    // ---------------------------------------------------------------------------------------------
    // 20.1 当验证失败的时候
    function onValidateStartTopologyFailed() {
        setPromptBoxOpen(true)
        setPromptBoxTitle("启动拓扑失败")
        if (totalNodesCount > 0) {
            setPromptBoxText("请完成参数的选择!")
        } else {
            setPromptBoxText("请至少完成一个拓扑节点的选择!")
        }
        setPromptBoxType(promptBoxTypes.errorParameters)
    }

    // 20.2 当启动拓扑的时候
    function onStartTopologyFinish(values) {
        setPromptBoxType(promptBoxTypes.startTopology)
        // 使用表单的最新值，如果没有则使用状态值作为后备
        const currentNetworkTopology = values[networkTopologyField[0]] || selectedNetworkTopology;
        const currentBlockchain = values[blockchainTypeField[0]] || selectedBlockchain;
        const currentConsensusType = values[consensusTypeField[0]] || selectedConsensusType;
        const currentAccessLinkBandwidth = "由后端配置控制（此页面不覆盖）";
        const currentConsensusNodeCpuLimit = values[consensusNodeCpuField[0]] || selectedConsensusNodeCpuLimit;
        const currentConsensusNodeMemoryLimit = values[consensusNodeMemoryField[0]] || selectedConsensusNodeMemoryLimit;
        const currentConsensusThreadCount = values[consensusThreadCountField[0]] || selectedConsensusThreadCount;

        let tableValues = [
            {
                key: "1",
                paramsDescription: networkTopologyField[0],
                paramsValue: currentNetworkTopology
            },
            {
                key: "2",
                paramsDescription: blockchainTypeField[0],
                paramsValue: currentBlockchain
            },
            {
                key: "3",
                paramsDescription: consensusTypeField[0],
                paramsValue: currentConsensusType
            },
            {
                key: "4",
                paramsDescription: accessLinkBandwidthField[0],
                paramsValue: currentAccessLinkBandwidth
            },
            {
                key: "5",
                paramsDescription: consensusNodeCpuField[0],
                paramsValue: currentConsensusNodeCpuLimit
            },
            {
                key: "6",
                paramsDescription: consensusNodeMemoryField[0],
                paramsValue: currentConsensusNodeMemoryLimit
            },
            {
                key: "7",
                paramsDescription: consensusThreadCountField[0],
                paramsValue: currentConsensusThreadCount
            },
            {
                key: "8",
                paramsDescription: "开启防御",
                paramsValue: startDefence
            }
        ]
        setPromptBoxOpen(true)
        setPromptBoxTitle("启动拓扑")
        setPromptBoxText(
            <Table dataSource={tableValues} columns={tableColumns}></Table>
        )
    }

    // 20.3 当拓扑的值改变的时候
    function onStartTopologyValuesChange(changedValues) {
        // console.log("block chain type field:", changedValues);
        // console.log(selectedBlockchain)
        // console.log(selectedConsensusType)
        if (networkTopologyField[0] in changedValues) {
            setSelectedNetworkTopology(changedValues[networkTopologyField[0]]);
            // 向后端发送请求请求到拓扑名称 -> 所对应的实际拓扑描述
            const params = {
                "topology_name": changedValues[networkTopologyField[0]],
            }
            topologyDescriptionRequest(params, (response) => {
                message.success(`成功切换到 ${changedValues[networkTopologyField[0]]} 拓扑`)
                console.log("topology_description", response.data["topology_description"])
                rebuildGraph(JSON.parse(response.data["topology_description"]))
            }, (error) => {
                message.error("切换拓扑失败")
            })
        }
        if (blockchainTypeField[0] in changedValues) {

            // 选择的区块链的值
            let changedBlockChainType = changedValues[blockchainTypeField[0]]
            // 设置选择的区块链
            setSelectedBlockchain(changedBlockChainType);
            // 将 state 也同样设置为可选项的第一个
            console.log(consensusTypes[changedBlockChainType][0])
            setSelectedConsensusType(consensusTypes[changedBlockChainType][0])
            // 设置共识协议的可选项
            setAvailableConsensusTypes(consensusTypes[changedBlockChainType])
            // 设置为可选项的第一个
            startTopologyForm.setFieldsValue({
                "共识类型": consensusTypes[changedBlockChainType][0]
            })
        }

        if (consensusTypeField[0] in changedValues) {
            setSelectedConsensusType(changedValues[consensusTypeField[0]]);
        }

        if (accessLinkBandwidthField[0] in changedValues) {
            setSelectedAccessLinkBandwidth(changedValues[accessLinkBandwidthField[0]]);
        }
        if (consensusNodeCpuField[0] in changedValues) {
            setSelectedConsensusNodeCpuLimit(changedValues[consensusNodeCpuField[0]]);
        }
        if (consensusNodeMemoryField[0] in changedValues) {
            setSelectedConsensusNodeMemoryLimit(changedValues[consensusNodeMemoryField[0]]);
        }
        if (consensusThreadCountField[0] in changedValues) {
            setSelectedConsensusThreadCount(changedValues[consensusThreadCountField[0]]);
        }
    }

    // ---------------------------------------------------------------------------------------------

    // 21. 处理攻击表单
    // ---------------------------------------------------------------------------------------------
    // 21.1 当验证失败的时候
    function onValidateStartAttackFailed() {
        setPromptBoxOpen(true)
        setPromptBoxTitle("启动攻击失败")
        setPromptBoxText("请完成参数的选择!")
        setPromptBoxType(promptBoxTypes.errorParameters)
    }

    // 21.2 当启动攻击的时候
    function onStartAttackFinish() {
        let tableValues = [
            {
                key: "1",
                paramsDescription: attackThreadCountField[0],
                paramsValue: selectedAttackThreadCount
            },
            {
                key: "2",
                paramsDescription: attackTypeField[0],
                paramsValue: selectedAttackType
            },
            {
                key: "3",
                paramsDescription: attackNodeField[0],
                paramsValue: selectedAttackNode
            },
            {
                key: "4",
                paramsDescription: attackedNodeField[0],
                paramsValue: selectedAttackedNode
            },
            {
                key: "5",
                paramsDescription: attackDurationField[0],
                paramsValue: selectedAttackDuration
            }
        ]
        setPromptBoxType(promptBoxTypes.startAttack)
        setPromptBoxOpen(true)
        setPromptBoxTitle("启动攻击")
        setPromptBoxText(
            <Table dataSource={tableValues} columns={tableColumns}></Table>
        )
    }

    // 21.3 当拓扑的值改变的时候
    function onStartAttackValuesChange(changedValues) {
        if (attackThreadCountField[0] in changedValues) {
            setSelectedAttackThreadCount(changedValues[attackThreadCountField[0]])
        }
        if (attackTypeField[0] in changedValues) {
            setSelectedAttackType(changedValues[attackTypeField[0]])
        }
        if (attackNodeField[0] in changedValues) {
            setSelectedAttackNode(changedValues[attackNodeField[0]])
        }
        if (attackedNodeField[0] in changedValues) {
            setSelectedAttackedNode(changedValues[attackedNodeField[0]])
        }
        if (attackDurationField[0] in changedValues) {
            setSelectedAttackDuration(changedValues[attackDurationField[0]])
        }
    }

    // ---------------------------------------------------------------------------------------------


    // 22. 保存上传拓扑相关代码
    // ---------------------------------------------------------------------------------------------
    // 22.1 进行拓扑的保存
    function saveTopology() {
        // 设置弹出框的属性
        setPromptBoxType(promptBoxTypes.saveTopology)
        setPromptBoxOpen(true)
        setPromptBoxTitle("保存拓扑")
        setPromptBoxText(
            <Input placeholder={"请输入保存的拓扑名称:"}
                   onChange={(event) => {
                       setSelectedTopologyName(event.target.value)
                   }}>
            </Input>
        )
    }

    // 22.2 加载拓扑
    const uploadProps = {
        beforeUpload: (file) => {
            const fileReader = new FileReader()
            fileReader.onload = (e) => {
                const fileContent = e.target.result
                let topologyParams = JSON.parse(fileContent)
                rebuildGraph(topologyParams, false)
                message.success({
                    content: "成功加载拓扑"
                })
            }
            fileReader.onerror = (e) => {
                message.error({
                    content: "加载拓扑失败"
                })
            }
            fileReader.readAsText(file)
            return false
        },
        showUploadList: false
    }
    // ---------------------------------------------------------------------------------------------

    // 24. 开启共识和停止共识按钮的回调函数
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        if (!txRateTestStatus || topologyNeedsCleanup) return;
        let cancelled = false;
        let timer;
        const poll = () => {
            GetTxRateTest(response => {
                if (cancelled) return;
                setTimeList(response.data.time_list);
                setCurrentTps(response.data.rate_list);
                timer = setTimeout(poll, 1000);
            }, error => {
                if (cancelled) return;
                message.error(error.response?.data?.message || "获取 TPS 失败");
                setTxRateTestStatus(false);
            });
        };
        timer = setTimeout(poll, 1000);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [txRateTestStatus, topologyNeedsCleanup]);

    function startTxRateTestClicked() {
        startTxRateTest((response) => {
            setTimeList(response.data["time_list"])
            setCurrentTps(response.data["rate_list"])
            message.success({
                content: "开启共识成功"
            })
            setTxRateTestStatus(true)

        }, (error) => {
            message.error({
                content: "开启共识失败"
            })
            setTxRateTestStatus(false)
        })
    }

    function stopTxRateTestClicked() {
        stopTxRateTest((response) => {
            // 进行计时器的停止
            // 成功停止共识
            message.success({
                content: "成功停止共识"
            })
            // 将 timeList 和 rateList 重新设置成为默认值
            setTimeList([1, 2, 3])
            setCurrentTps([1, 2, 3])
            setTxRateTestStatus(false)
        }, (error) => {
            message.error({
                content: "停止共识失败"
            })
        })
    }

    function installChannelAndChaincodeClicked() {
        setPromptBoxType(promptBoxTypes.installChannelandChainCode)
        setPromptBoxOpen(true)
        setPromptBoxTitle("安装链码")
        setPromptBoxText("请确认是否安装链码!")
    }

    // ---------------------------------------------------------------------------------------------


    // 进行投票
    // ---------------------------------------------------------------------------------------------
    function onStartDefenceChange(value) {
        setStartDefence(value)
        if (currentTopologyState) {
            const params = {
                "start_defence": value,
            }
            changeStartDefenceRequest(params, (response) => {
                if (value) {
                    message.success("成功开启防御措施")
                } else {
                    message.success("成功关闭防御措施")
                }
            }, (error) => {
                if (value) {
                    message.error("开启防御措施失败")
                } else {
                    message.error("关闭防御措施失败")
                }
            })
        }
    }

    // ---------------------------------------------------------------------------------------------

    // 25. 实际的 HTML 代码
    // ---------------------------------------------------------------------------------------------
    return (
        <div className="topology-container topology-workbench">
            {topologyNeedsCleanup && <Alert type="warning" showIcon message="拓扑清理未完成，请点击停止拓扑重试；清理完成前不能启动新实验。" />}
          <header className="topology-system-header">
            <div className="topology-brand">
              <div className="topology-brand-icon"><DeploymentUnitOutlined /></div>
              <div>
                <div className="topology-eyebrow">LINK-AWARE ROUTING / CONTROL CENTER</div>
                <h1>链路感知的安全可控路由原型系统</h1>
              </div>
            </div>
            <div className={"topology-status" + (currentTopologyState && !topologyNeedsCleanup ? " is-active" : "")}>
              <span className="topology-status-dot" />
              {topologyNeedsCleanup ? "待清理" : currentTopologyState ? "拓扑运行中" : "拓扑未启动"}
            </div>
          </header>
          <main className="topology-workspace">
            <section className="topology-controls" aria-label="拓扑与安全配置">
              <Card className="topology-panel topology-toolbar" title={<span><span className="topology-section-number">01</span>拓扑配置</span>} extra={<span className="topology-panel-caption">构建与管理</span>}>
                <div className="topology-toolbar-grid">
                  <div className="topology-tool-field"><label>节点类型</label><div className="topology-node-actions"><Select defaultValue="Router" onChange={value => {
                        setSelectedNodeType(value);
                      }} options={nodeTypes.map(nodeType => ({
                        label: nodeType,
                        value: nodeType
                      }))} aria-label="节点类型" /><Button type={"primary"} disabled={currentTopologyState} onClick={AddNodeButtonClicked} icon={<PlusOutlined />}>添加节点</Button></div></div>
                  <div className="topology-tool-field"><label>链路类型</label><Select defaultValue={"骨干链路"} value={selectedLinkType} options={linkTypes.map(linkType => ({
                      label: linkType,
                      value: linkType
                    }))} onChange={value => {
                      setSelectedLinkType(value);
                      if (value === "接入链路") {
                        console.log(graph.get("defaultEdge"));
                        graph.get("defaultEdge").style = styleForAccessLink;
                      } else if (value === "骨干链路") {
                        console.log(graph.get("defaultEdge"));
                        graph.get("defaultEdge").style = styleForBackboneLink;
                      } else {
                        console.log("unsupported link type");
                      }
                    }} aria-label="链路类型">
                    </Select></div>
                  <div className="topology-file-actions"><Button onClick={saveTopology} type="default" icon={<SaveOutlined />}>保存拓扑</Button><Upload {...uploadProps}>
                      <Button icon={<UploadOutlined />}>上传拓扑</Button>
                    </Upload></div>
                </div>
              </Card>
              <div className="topology-configuration-grid">
                <Card className="topology-panel topology-system-config" title={<span><span className="topology-section-number">02</span>区块链系统配置</span>}>
                  <Form form={startTopologyForm} name={"topology start form"} onFinishFailed={onValidateStartTopologyFailed} onFinish={onStartTopologyFinish} onValuesChange={onStartTopologyValuesChange} initialValues={{
                    [networkTopologyField[0]]: selectedNetworkTopology,
                    [blockchainTypeField[0]]: selectedBlockchain,
                    [consensusTypeField[0]]: selectedConsensusType,
                    [accessLinkBandwidthField[0]]: selectedAccessLinkBandwidth,
                    [consensusNodeCpuField[0]]: selectedConsensusNodeCpuLimit,
                    [consensusNodeMemoryField[0]]: selectedConsensusNodeMemoryLimit,
                    [consensusThreadCountField[0]]: selectedConsensusThreadCount,
                    [totalNodesCountField[0]]: totalNodesCount
                  }} layout="vertical" className="topology-settings-form">
                    <Row gutter={[12, 0]}>
                      <Col span={24}>
                        <Form.Item label={networkTopologyField[0]} name={networkTopologyField[0]} rules={[{
                          required: true,
                          message: "请选择网络环境"
                        }]}>
                          <Select disabled={currentTopologyState} value={selectedNetworkTopology} style={{
                            width: "100%"
                          }} options={topologyOptions} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={[12, 0]}>
                      <Col span={12}>
                        <Form.Item label={blockchainTypeField[0]} name={blockchainTypeField[0]} rules={[{
                          required: false,
                          message: "请选择区块链"
                        }]}>
                          <Select disabled={currentTopologyState} value={selectedBlockchain} options={blockchainTypes.map(blockchainType => ({
                            label: blockchainType,
                            value: blockchainType
                          }))} style={{
                            width: "100%"
                          }} />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label={consensusTypeField[0]} name={consensusTypeField[0]} rules={[{
                          required: false,
                          message: "请选择共识协议"
                        }]}>
                          <Select disabled={currentTopologyState} value={selectedConsensusType} options={availableConsensusTypes.map(consensus => ({
                            label: consensus,
                            value: consensus
                          }))} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={[12, 0]}>
                      <Col span={12}>
                        <Form.Item label={accessLinkBandwidthField[1]}><Input value="由后端配置控制" disabled /></Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label={consensusNodeCpuField[1]} name={consensusNodeCpuField[0]} rules={[{
                          required: true,
                          message: "请选择共识节点CPU数量限制"
                        }]}>
                          <InputNumber disabled={currentTopologyState} placeholder={`${selectedConsensusNodeCpuLimit}`} min={0} style={{
                            width: "100%"
                          }} changeOnWheel>
                          </InputNumber>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={[12, 0]}>
                      <Col span={12}>
                        <Form.Item label={consensusNodeMemoryField[1]} name={consensusNodeMemoryField[0]} rules={[{
                          required: true,
                          message: "请选择共识节点内存限制"
                        }]}>
                          <InputNumber disabled={currentTopologyState} placeholder={`${selectedConsensusNodeMemoryLimit}`} min={0} style={{
                            width: "100%"
                          }} changeOnWheel>
                          </InputNumber>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label={consensusThreadCountField[0]} name={consensusThreadCountField[0]} rules={[{
                          required: true,
                          message: "请选择共识节点内存限制"
                        }]}>
                          <InputNumber disabled={currentTopologyState} placeholder={`${selectedConsensusThreadCount}`} min={0} style={{
                            width: "100%"
                          }} changeOnWheel>
                          </InputNumber>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row style={{
                      display: "none"
                    }}>
                      <Form.Item label={totalNodesCountField[0]} name={totalNodesCountField[0]} rules={[{
                        validator: (rule, value, callback) => {
                          if (value === 0) {
                            return Promise.reject("拓扑至少存在一个节点");
                          } else {
                            return Promise.resolve();
                          }
                        }
                      }]}>
                        <InputNumber></InputNumber>
                      </Form.Item>
                    </Row>
                    {}
                    {}
                    <Row gutter={[12, 0]} className="topology-form-actions">
                      <Col span={8}>
                        <Button type={"primary"} disabled={currentTopologyState} htmlType={"submit"}>启动拓扑</Button>
                      </Col>
                      <Col span={8}>
                        <Button type={"primary"} danger disabled={!currentTopologyState} onClick={StopTopology}>停止拓扑</Button>
                      </Col>
                      <Col span={8}>
                        <Button type={"primary"} disabled={!currentTopologyState || topologyNeedsCleanup} onClick={installChannelAndChaincodeClicked}>安装链码</Button>
                      </Col>
                    </Row>
                  </Form>
                </Card>
                <div className="topology-security-stack">
                  <Card className="topology-panel topology-attack-config" title={<span><span className="topology-section-number">03</span>攻击配置</span>}>
                    <Form name={"attack start form"} onFinishFailed={onValidateStartAttackFailed} onFinish={onStartAttackFinish} onValuesChange={onStartAttackValuesChange} initialValues={{
                      [attackThreadCountField[0]]: selectedAttackThreadCount,
                      [attackTypeField[0]]: selectedAttackType,
                      [attackDurationField[0]]: selectedAttackDuration
                    }} layout="vertical" className="topology-settings-form">
                      <Row gutter={[12, 0]}>
                        <Col span={12}>
                          <Form.Item label={attackThreadCountField[0]} name={attackThreadCountField[0]} rules={[{
                            required: true,
                            message: "请选择攻击线程数量"
                          }]}>
                            <InputNumber disabled={currentAttackState} placeholder={`${selectedAttackThreadCount}`} style={{
                              width: "100%"
                            }} changeOnWheel>
                            </InputNumber>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label={attackTypeField[0]} name={attackTypeField[0]} rules={[{
                            required: true,
                            message: "请选择攻击的类型"
                          }]}>
                            <Select value={selectedAttackType} disabled={currentAttackState} options={attackTypes.map(attackType => ({
                              label: attackType,
                              value: attackType
                            }))}></Select>
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={[12, 0]}>
                        <Col span={12}>
                          <Form.Item label={attackNodeField[0]} name={attackNodeField[0]} rules={[{
                            required: true,
                            message: "请选择攻击节点"
                          }]}>
                            <Select value={selectedAttackNode} disabled={currentAttackState} options={maliciousNodes.map(maliciousNode => ({
                              label: maliciousNode,
                              value: maliciousNode
                            }))}>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label={attackedNodeField[0]} name={attackedNodeField[0]} rules={[{
                            required: true,
                            message: "请选择被攻击节点"
                          }]}>
                            <Select value={selectedAttackedNode} disabled={currentAttackState} options={[...chainMakerNodes, ...fabricOrderNodes, ...fiscoBcosNodes].map(node => ({
                              label: node,
                              value: node
                            }))}>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={[12, 0]}>
                        <Col span={12}>
                          <Form.Item label={attackDurationField[0]} name={attackDurationField[0]} rules={[{
                            required: true,
                            message: "请选择攻击时长"
                          }]}>
                            <InputNumber disabled={currentAttackState} placeholder={`${selectedAttackDuration}`} style={{
                              width: "100%"
                            }} changeOnWheel>
                            </InputNumber>
                          </Form.Item>
                        </Col>
                        <Col span={12} className="topology-inline-action">
                          <Button type={"primary"} htmlType={"submit"} danger disabled={currentAttackState}>开始攻击</Button>
                        </Col>
                      </Row>
                    </Form>
                  </Card>
                  <Card className="topology-panel topology-runtime-config" title="运行控制">
                    <div className="topology-runtime-row">
                      <span className="topology-runtime-label">共识配置</span>
                      <div className="topology-consensus-actions"><Button type={"primary"} onClick={startTxRateTestClicked} disabled={txRateTestStatus || !currentTopologyState || topologyNeedsCleanup}>开始共识</Button>
                        <Button type={"primary"} htmlType={"submit"} onClick={stopTxRateTestClicked} disabled={!txRateTestStatus} danger>停止共识</Button></div>
                    </div>
                    <div className="topology-runtime-row">
                      <span className="topology-runtime-label"><SafetyCertificateOutlined />安全防御</span>
                      <Switch value={startDefence} disabled={topologyNeedsCleanup} onChange={onStartDefenceChange} aria-label="安全防御" checkedChildren="开" unCheckedChildren="关" />
                    </div>
                  </Card>
                </div>
              </div>
              <Card className="topology-panel topology-metrics" title={<span><span className="topology-section-number">04</span>共识性能监测</span>} extra={<span className="topology-panel-caption">TPS / 时间</span>}>
                <div className="topology-metrics-chart">
                  <ReactECharts option={rateOption} style={{
                    position: "absolute",
                    inset: 0,
                    height: "100%",
                    width: "100%"
                  }} />
                </div>
              </Card>
            </section>
            <div className="topology-visuals">
              <section className="topology-canvas-panel" aria-label="网络拓扑画布">
                <div className="topology-canvas-header">
                  <div><h2><DeploymentUnitOutlined />网络拓扑</h2><p>节点连接与链路视图</p></div>
                  <span className="topology-node-count">{totalNodesCount}
                    <span>个节点</span></span>
                </div>
                <div className="topology-canvas-body">
                  <div ref={graphDivRef} id="graph" />
                  {totalNodesCount === 0 && <div className="topology-canvas-empty">
                    <DeploymentUnitOutlined />
                    <strong>开始构建网络拓扑</strong>
                    <span>添加节点，或通过上传拓扑载入已有配置</span>
                  </div>}
                </div>
                <div className="topology-canvas-footer">
                  <div className="topology-legend"><span><i className="access-link" />接入链路</span><span><i className="backbone-link" />骨干链路</span></div>
                  <span>滚轮缩放 · 拖拽画布</span>
                </div>
              </section>
            </div>
          </main>
          <Modal title={promptBoxTitle} open={promptBoxOpen} onOk={handlePromptOkCicked} onCancel={handlePromptCancelCicked} okText={promptBoxOkText} cancelText={promptBoxCancelText} confirmLoading={promptBoxLoading} rootClassName="topology-dialog">
            {promptBoxText}
            {stopInProgress && (
              <div style={{marginTop: 12}}>
                <Progress percent={stopProgressPercent} status="active" />
                <div style={{fontSize: 12, color: "#888", marginTop: 4}}>{stopProgressStep}</div>
              </div>
            )}
          </Modal>
        </div>
    )
    // ---------------------------------------------------------------------------------------------
}
