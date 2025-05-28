import * as G6 from "@antv/g6";
import React, {useEffect, useRef, useState} from "react";
import {Button, Card, Col, Form, Input, message, Modal, Row, Select, Switch, Table, Upload} from "antd";
import {Node} from "../entities/node"
import {Link} from "../entities/link"
import {
    changeStartDefenceRequest,
    getTopologyState, installChannelAndChaincode,
    pageClose, saveTopologyRequest,
    startAttackRequest,
    startTopology,
    startTxRateTest, stopNode,
    stopTopology,
    stopTxRateTest, topologyDescriptionRequest,
} from "../requests/topology";
import {InputNumber} from "antd/lib";
import {ProForm} from "@ant-design/pro-components";
import {UploadOutlined} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
const {getLabelPosition, transform} = G6.Util;

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
        "FabricOrderNode"
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
    const blockchainTypes = ["长安链", "fabric"]
    const consensusTypes = {
        "": [],
        "长安链": ["TBFT", "RAFT"],
        "fabric": ["BFT-SMaRt"],
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
    const [selectedAttackThreadCount, setSelectedAttackThreadCount] = useState(10)
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
    const [txRateTimer, setTxRateTimer] = useState()
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
            left: "50px",
            right: "60px",
            bottom: "40px",
            top: "40px"
        },
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: ['共识速率/TPS'],
            textStyle: {
                fontSize: 15, // 图例字体大小
            }
        },
        xAxis: {
            name: "时间/S",
            type: "category",
            data: timeList,
            axisLabel: {
                fontSize: 15
            },
            nameTextStyle: {
                fontSize: 15
            }
        },
        yAxis: {
            name: "共识速率/TPS",
            type: "value",
            axisLabel: {
                formatter: '{value}',
                fontSize: 15
            },
            nameTextStyle: {
                fontSize: 15
            }
        },
        series: [{
            name: '共识速率/TPS',
            type: 'line',
            yAxisIndex: 0,
            data: currentTps,
            lineStyle: {
                width: 4,
                color: "rgb(79,222,7)",
            },
            smooth: false,
            symbolSize: 15,
            color: "rgb(79,222,7)",
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
    // ---------------------------------------------------------------------------------------------

    // 13. 函数化组件初始化第一步 - 进行监听器的设置
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {

        let beforeTime = 0, leaveTime = 0;

        let beforeUnloadFunction = ()=>{
            beforeTime = new Date().getTime()
        }

        // 当 leaveTime <= 5 的时候, 可以判断用户是直接进行了页面的关闭
        let unloadFunction = ()=> {
            leaveTime = new Date().getTime() - beforeTime
            if (leaveTime <= 5) {
                pageClose();
            }
        }

        // 注册回调函数, 回调函数在 beforeunload 和 unload 事件发生的时候被调用
        window.addEventListener("beforeunload", beforeUnloadFunction)
        window.addEventListener("unload", unloadFunction)

        // 在结束的时候进行卸载
        return ()=>{
            // 进行监听器的删除
            window.removeEventListener("beforeunload", beforeUnloadFunction)
            window.removeEventListener("unload", unloadFunction)
            // 进行 timer 的删除
            if(txRateTimer){
                clearInterval(txRateTimer)
            }
        }
    }, []);
    // ---------------------------------------------------------------------------------------------

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
            // 图的宽度以及高毒
            width: graphDivRef.current.clientWidth,
            height: graphDivRef.current.clientHeight,
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
                label: "edge",
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
    useEffect(() => {
        if (createGraph === 1) {
            getTopologyState((response) => {

                let container_name_to_port_mapping = response.data["container_name_to_port_mapping"]
                setContainerNameToPortMapping(container_name_to_port_mapping)

                // 不管是 up 还是 down 都能够获取
                let all_topology_names = response.data["all_topology_names"]
                setTopologyOptionsWithTopologyNames(all_topology_names)

                if (response.data["state"] === "up") {
                    startTopologyForm.setFieldsValue({
                        [networkTopologyField[0]]: response.data["topology_params"]["network_env"],
                        [blockchainTypeField[0]]: response.data["topology_params"]["blockchain_type"],
                        [consensusTypeField[0]]: response.data["topology_params"]["consensus_type"],
                        [accessLinkBandwidthField[0]]: response.data["topology_params"]["access_link_bandwidth"],
                        [consensusNodeCpuField[0]]: response.data["topology_params"]["consensus_node_cpu"],
                        [consensusNodeMemoryField[0]]: response.data["topology_params"]["consensus_node_memory"],
                        [consensusThreadCountField[0]]: response.data["topology_params"]["consensus_thread_count"],
                    })
                    setCurrentTopologyState(true)
                    setStartDefence(response.data["topology_params"]["start_defence"])

                    // rebuildGraph(response.data["topology_params"], true)
                    rebuildGraphWithLinkParams(response.data["topology_params"], response.data["links"], true)
                    // rebuildGraph(response.data["topology_params"], true)
                } else if (response.data["state"] === "down") {
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
    }, [createGraph]);


    function rebuildGraphWithLinkParams(topology_params, link_params, state) {
        // 需要先进行所有的节点的删除
        clearState()
        for (let i = 0; i < topology_params["nodes"].length; i++) {
            let node = topology_params["nodes"][i]
            AddNodeLogic(node["type"], node["x"], node["y"], state)
        }
        setTimeout(() => {
            for (let i = 0; i < topology_params["links"].length; i++) {
                let link = topology_params["links"][i]
                let sourceNodeId = link["source_node"]["type"] + "_" + link["source_node"]["index"]
                let targetNodeId = link["target_node"]["type"] + "_" + link["target_node"]["index"]
                let link_type = link["link_type"]
                let sourceNodeIdBackend = link["source_node"]["type"] + "-" + link["source_node"]["index"]
                let targetNodeIdBackend = link["target_node"]["type"] + "-" + link["target_node"]["index"]

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

                AddEdgeLogicWithText(sourceNodeId, targetNodeId, link_type, finalString)
            }
        }, 50)
    }


    // 根据后端返回的参数重新进行图的构建
    function rebuildGraph(topology_params, state) {
        // 需要先进行所有的节点的删除
        clearState()
        for (let i = 0; i < topology_params["nodes"].length; i++) {
            let node = topology_params["nodes"][i]
            AddNodeLogic(node["type"], node["x"], node["y"], state)
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
                        const outDiv = document.createElement('div');
                        outDiv.style.width = '180px';
                        outDiv.innerHTML = `<ul>
                    <li>创建webshell</li>
                    <li>删除节点</li>
                    <li>暂停节点</li>
                    <li>取消</li>
                  </ul>`
                        return outDiv
                    },

                    handleMenuClick(target, item, graph) {
                        if (target.textContent === "创建webshell") {
                            if (currentTopologyState) {
                                // 进行 webshell 的创建, 跳转到实际的创建 webshell 的界面
                                // const windowProxy = window.open("_black")
                                // windowProxy.location.href = `/instance/${item.getID()}`
                                window.location.href = `/instance/${item.getID()}`
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
                            if(!currentTopologyState) {
                                message.error({
                                    content: "current topology down: cannot pause node"
                                })
                            }
                            let nodeId = item.getID()
                            let typeAndId = nodeId.split("_")
                            let containerName = `${typeAndId[0]}-${typeAndId[1]}`
                            console.log(containerNameToPortMapping)
                            console.log(containerNameToPortMapping[containerName])
                            stopNode(containerNameToPortMapping[containerName], (response)=>{
                                message.success({
                                    content: "successfully stop the node"
                                })
                            }, (error)=>{
                                message.success({
                                    content: "stop node failed"
                                })
                            })
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
            // 构建参数
            const params = {
                network_env: selectedNetworkTopology,
                blockchain_type: selectedBlockchain,
                consensus_type: selectedConsensusType,
                access_link_bandwidth: selectedAccessLinkBandwidth,
                consensus_node_cpu: selectedConsensusNodeCpuLimit,
                consensus_node_memory: selectedConsensusNodeMemoryLimit,
                consensus_thread_count: selectedConsensusThreadCount,
                nodes: nodesList,
                links: links,
                start_defence: startDefence
            }
            // 调用函数
            startTopology(params, (response) => {
                message.success({
                    content: `successfully start the topology`
                })
                setCurrentTopologyState(true) // 进行当前状态的更新 -> true
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false) // 不打开 promptbox
                window.location.reload() // 进行页面的强制刷新
            }, (error) => {
                message.error({
                    content: `start topology error ${error}`
                })
                setCurrentTopologyState(false) // 进行当前状态的更新 -> false
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false) // 关闭 promptbox
            })
        } else if (promptBoxType === promptBoxTypes.stopTopology) { // 如果是停止拓扑的话
            setPromptBoxLoading(true)
            stopTopology((response) => {
                message.success({
                    content: `成功停止拓扑`
                })
                setCurrentTopologyState(false) // 进行当前状态的更新 -> false
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false)  // 关闭 promptbox
                window.location.reload() // 进行页面的强制刷新
            }, (error) => {
                message.error({
                    content: `stop topology error ${error}`
                })
                // 不进行状态的更新
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })
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
            saveTopologyRequest(params, (response)=>{
                // response 可以顺带返回当前有什么拓扑, 然后进行更新
                let all_topology_names = response.data["all_topology_names"]
                setTopologyOptionsWithTopologyNames(all_topology_names)

                // 说明已经成功进行了拓扑的保存
                message.success({
                    content: "successfully save the topology"
                })
                setPromptBoxOpen(false)
                setPromptBoxLoading(false)
            }, (error)=>{
                message.error({
                    content: "failed to save the topology"
                })
                setPromptBoxOpen(false)
                setPromptBoxLoading(false)
            })
        } else if (promptBoxType === promptBoxTypes.installChannelandChainCode) {
            setPromptBoxLoading(true)
            installChannelAndChaincode((response)=>{
                message.success({
                    content: "成功安装通道和链码"
                })
                setCurrentChannelChaincodeState(true)
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            }, (error)=>{
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
    function setTopologyOptionsWithTopologyNames(all_topology_names){
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
    function collectTopologyInformation(){
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
    const AddNodeLogic = (nodeType, x, y, currentState) => {
        let successfullyAdd = false
        if (nodeType === "Router") { // 进行路由节点的添加
            setRouters(prevRouters => {
                let routerId = nodeType + "_" + (prevRouters.length + 1)
                let router = {
                    id: routerId,
                    label: routerId,
                    x: x,
                    y: y,
                    size: 40,
                    img: "./pictures/router.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: 14,
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
                let normalNodeId = nodeType + "_" + (prevNormalNodes.length + 1)
                let normalNode = {
                    id: normalNodeId,
                    label: normalNodeId,
                    x: x,
                    y: y,
                    size: 40,
                    img: './pictures/normalNode.png',
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: 14,
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
                let consensusNodeId = nodeType + "_" + (prevConsensusNodes.length + 1)
                let consensusNode = {
                    id: consensusNodeId,
                    label: consensusNodeId,
                    x: x,
                    y: y,
                    size: 40,
                    img: './pictures/consensusNode.png',
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: 14,
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
                let chainMakerNodeId = nodeType + "_" + (prevChainMakerNodes.length + 1)
                let chainMakerNode = {
                    id: chainMakerNodeId,
                    label: chainMakerNodeId,
                    x: x,
                    y: y,
                    size: 40,
                    img: './pictures/chainMakerNode.png',
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: 14,
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
                let maliciousNodeId = nodeType + "_" + (prevMaliciousNodes.length + 1)
                let maliciousNode = {
                    id: maliciousNodeId,
                    label: maliciousNodeId,
                    x: x,
                    y: y,
                    size: 40,
                    img: "./pictures/maliciousNode.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: 14,
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
        } else if (nodeType === "LirNode"){ // 进行 lir 节点的添加
            setLirNodes(prevLirNodes=>{
                let lirNodeId = nodeType + "_" + (prevLirNodes.length + 1)
                let lirNode = {
                    id: lirNodeId,
                    label: lirNodeId,
                    x: x,
                    y: y,
                    size: 40,
                    img: "./pictures/lirNode.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: 14,
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
        } else if (nodeType === "FabricPeerNode"){
            setFabricPeerNodes(prevFabricPeerNodes => {
                let fabricPeerNodeId = nodeType + "_" + (prevFabricPeerNodes.length + 1)
                let fabricPeerNode = {
                    id: fabricPeerNodeId,
                    label: fabricPeerNodeId,
                    x: x,
                    y: y,
                    size: 40,
                    img: "./pictures/fabricPeerNode.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: 14,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem("node", fabricPeerNode)
                return [...prevFabricPeerNodes, fabricPeerNode]
            })
            successfullyAdd = true
        } else if(nodeType === "FabricOrderNode"){
            setFabricOrderNodes(prevFabricOrderNodes => {
                let fabricOrderNodeId = nodeType + "_" + (prevFabricOrderNodes.length + 1)
                let fabricOrderNode = {
                    id: fabricOrderNodeId,
                    label: fabricOrderNodeId,
                    x: x,
                    y: y,
                    size: 40,
                    img: "./pictures/fabricOrderNode.png",
                    labelCfg: {
                        position: 'bottom',
                        style: {
                            fill: '#ffffff', // 设置字体颜色
                            fontSize: 14,
                            background: {
                                fill: ReturnLableColor(currentState),
                                padding: [4, 4, 4, 4]
                            }
                        }
                    }
                }
                graph.addItem("node", fabricOrderNode)
                return [...prevFabricOrderNodes, fabricOrderNode]
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
    function onStartTopologyFinish() {
        setPromptBoxType(promptBoxTypes.startTopology)
        let tableValues = [
            {
                key: "1",
                paramsDescription: networkTopologyField[0],
                paramsValue: selectedNetworkTopology
            },
            {
                key: "2",
                paramsDescription: blockchainTypeField[0],
                paramsValue: selectedBlockchain
            },
            {
                key: "3",
                paramsDescription: consensusTypeField[0],
                paramsValue: selectedConsensusType
            },
            {
                key: "4",
                paramsDescription: accessLinkBandwidthField[0],
                paramsValue: selectedAccessLinkBandwidth
            },
            {
                key: "5",
                paramsDescription: consensusNodeCpuField[0],
                paramsValue: selectedConsensusNodeCpuLimit
            },
            {
                key: "6",
                paramsDescription: consensusNodeMemoryField[0],
                paramsValue: selectedConsensusNodeMemoryLimit
            },
            {
                key: "7",
                paramsDescription: consensusThreadCountField[0],
                paramsValue: selectedConsensusThreadCount
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
        if (networkTopologyField[0] in changedValues) {
            setSelectedNetworkTopology(changedValues[networkTopologyField[0]]);
            // 向后端发送请求请求到拓扑名称 -> 所对应的实际拓扑描述
            const params = {
                "topology_name": changedValues[networkTopologyField[0]],
            }
            topologyDescriptionRequest(params, (response)=>{
                message.success(`成功切换到 ${changedValues[networkTopologyField[0]]} 拓扑`)
                let topologyDescriptionInString = JSON.stringify(response.data["topology_description"])
                if(topologyDescriptionInString.indexOf("FabricOrderNode") !== -1) {
                    console.log("select fabric")
                    // 设置选择的区块链
                    setSelectedBlockchain("fabric");
                    // 设置共识协议的可选项
                    setAvailableConsensusTypes(consensusTypes["fabric"])
                    startTopologyForm.setFieldsValue({
                        [blockchainTypeField[0]]: "fabric",
                        [consensusTypeField[0]]: consensusTypes["fabric"][0],
                    })
                } else if (topologyDescriptionInString.indexOf("ChainMakerNode") !== -1){
                    console.log("select chainmaker")
                    // 设置选择的区块链
                    setSelectedBlockchain("长安链");
                    // 设置共识协议的可选项
                    setAvailableConsensusTypes(consensusTypes["长安链"])
                    startTopologyForm.setFieldsValue({
                        [blockchainTypeField[0]]: "长安链",
                        [consensusTypeField[0]]: consensusTypes["长安链"],
                    })
                } else {
                    console.log("select nothing")
                    setSelectedBlockchain("")
                    setAvailableConsensusTypes([])
                    startTopologyForm.setFieldsValue({
                        [blockchainTypeField[0]]: "",
                        [consensusTypeField[0]]: [],
                    })
                }
                rebuildGraph(JSON.parse(response.data["topology_description"]))
            }, (error)=>{
                message.error("切换拓扑失败")
            })
        }
        if (blockchainTypeField[0] in changedValues) {
            // 选择的区块链的值
            let changedBlockChainType = changedValues[blockchainTypeField[0]]
            // 设置选择的区块链
            setSelectedBlockchain(changedBlockChainType);
            // 设置共识协议的可选项
            setAvailableConsensusTypes(consensusTypes[changedBlockChainType])
            // 设置为可选项的第一个
            startTopologyForm.setFieldsValue({
                "共识类型": consensusTypes[changedBlockChainType][0]
            })
            // 将 state 也同样设置为可选项的第一个
            setSelectedConsensusType(consensusTypes[changedBlockChainType][0])
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
                   onChange={(event)=>{setSelectedTopologyName(event.target.value)}}>
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
    function startTxRateTestClicked() {
        startTxRateTest((response) => {
            setTimeList(response.data["time_list"])
            setCurrentTps(response.data["rate_list"])
            message.success({
                content: "开启共识成功"
            })
            setTxRateTestStatus(true)
            let txRateTimerTmp = setInterval(() => {
                startTxRateTest((response) => {
                    setTimeList(response.data["time_list"])
                    setCurrentTps(response.data["rate_list"])
                }, (error) => {
                    message.error("获取共识速率失败")
                })
            }, 1000)
            setTxRateTimer(txRateTimerTmp)
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
            if (txRateTimer) {
                clearInterval(txRateTimer)
            }
            // 成功停止共识
            message.success({
                content: "成功停止共识"
            })
            // 将 timeList 和 rateList 重新设置成为默认值
            setTimeList([1,2,3])
            setCurrentTps([1,2,3])
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
    function onStartDefenceChange(value){
        setStartDefence(value)
        if (currentTopologyState) {
            const params = {
                "start_defence": value,
            }
            changeStartDefenceRequest(params, (response)=>{
                if(value){
                    message.success("成功开启防御措施")
                } else {
                    message.success("成功关闭防御措施")
                }
            }, (error)=>{
                if(value){
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
        <div>
            {/*空行*/}
            <Row style={{height: "10px", marginLeft: "1vw", marginRight: "1vw"}}>

            </Row>
            <Row>
                <Col span={14}>
                    <Card
                        size={"small"}
                        title={"拓扑配置"}
                        style={{marginLeft: "1vw", marginRight: "1vw"}}
                    >
                        <Row style={{marginLeft: "1vw", marginRight: "1vw"}}>
                            <Col span={5} style={{textAlign: "center"}}>
                                <Select
                                    defaultValue="Router"
                                    style={{width: "80%"}}
                                    onChange={(value) => {
                                        setSelectedNodeType(value)
                                    }}
                                    options={nodeTypes.map((nodeType) => ({
                                        label: nodeType,
                                        value: nodeType,
                                    }))}
                                />
                            </Col>
                            <Col span={5} style={{textAlign: "center"}}>
                                <Button
                                    type={"primary"}
                                    style={{width: "80%"}}
                                    disabled={currentTopologyState}
                                    onClick={AddNodeButtonClicked}>
                                    添加节点
                                </Button>
                            </Col>
                            <Col span={5} style={{textAlign: "center"}}>
                                <Select
                                    defaultValue={"骨干链路"}
                                    value={selectedLinkType}
                                    style={{width: "80%"}}
                                    options={linkTypes.map((linkType) => ({
                                        label: linkType,
                                        value: linkType,
                                    }))}
                                    onChange={(value) => {
                                        setSelectedLinkType(value)
                                        if (value === "接入链路") {
                                            console.log(graph.get("defaultEdge"))
                                            graph.get("defaultEdge").style = styleForAccessLink
                                        } else if (value === "骨干链路") {
                                            console.log(graph.get("defaultEdge"))
                                            graph.get("defaultEdge").style = styleForBackboneLink
                                        } else {
                                            console.log("unsupported link type")
                                        }
                                    }}
                                >
                                </Select>
                            </Col>
                            <Col span={5}>
                                <Button
                                    type={"primary"}
                                    style={{width: "80%"}}
                                    onClick={saveTopology}>
                                    保存拓扑
                                </Button>
                            </Col>
                            <Col span={4}>
                                <Upload {...uploadProps}>
                                    <Button style={{width: "100%"}} icon={<UploadOutlined/>}>上传拓扑</Button>
                                </Upload>
                            </Col>
                        </Row>
                    </Card>


                    <Row style={{height: "2vh"}}>

                    </Row>

                    <Row style={{marginLeft: "1vw", marginRight: "1vw"}}>
                        <Col span={12}>
                            <Card
                                size={"small"}
                                title={"区块链系统配置"}
                            >
                                {/*注意 Form 是可以当成一行的*/}
                                <Form
                                    form={startTopologyForm}
                                    name={"topology start form"}
                                    onFinishFailed={onValidateStartTopologyFailed}
                                    onFinish={onStartTopologyFinish}
                                    onValuesChange={onStartTopologyValuesChange}
                                    labelCol={{
                                        span: 16,
                                    }}
                                    wrapperCol={{
                                        span: 8,
                                    }}
                                    initialValues={{
                                        [networkTopologyField[0]]: selectedNetworkTopology,
                                        [blockchainTypeField[0]]: selectedBlockchain,
                                        [consensusTypeField[0]]: selectedConsensusType,
                                        [accessLinkBandwidthField[0]]: selectedAccessLinkBandwidth,
                                        [consensusNodeCpuField[0]]: selectedConsensusNodeCpuLimit,
                                        [consensusNodeMemoryField[0]]: selectedConsensusNodeMemoryLimit,
                                        [consensusThreadCountField[0]]: selectedConsensusThreadCount,
                                        [totalNodesCountField[0]]: totalNodesCount,
                                    }}
                                >
                                    <Row>
                                        <Col span={24}>
                                            <Form.Item
                                                label={networkTopologyField[0]}
                                                name={networkTopologyField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择网络环境"
                                                    }
                                                ]}
                                                labelCol={{
                                                    span: 8,
                                                }}
                                                wrapperCol={{
                                                    span: 16,
                                                }}
                                            >

                                                <Select
                                                    disabled={currentTopologyState}
                                                    value={selectedNetworkTopology}
                                                    style={{width: "100%"}}
                                                    options={topologyOptions}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col span={12}>
                                            <Form.Item
                                                label={blockchainTypeField[0]}
                                                name={blockchainTypeField[0]}
                                                rules={[
                                                    {
                                                        required: false,
                                                        message: "请选择区块链"
                                                    }
                                                ]}
                                            >
                                                <Select
                                                    disabled={currentTopologyState}
                                                    value={selectedBlockchain}
                                                    options={blockchainTypes.map((blockchainType) => ({
                                                        label: blockchainType,
                                                        value: blockchainType,
                                                    }))}
                                                    style={{width: "100%"}}
                                                />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                label={consensusTypeField[0]}
                                                name={consensusTypeField[0]}
                                                rules={[
                                                    {
                                                        required: false,
                                                        message: "请选择共识协议"
                                                    }
                                                ]}
                                            >
                                                <Select
                                                    disabled={currentTopologyState}
                                                    value={selectedConsensusType}
                                                    options={availableConsensusTypes.map((consensus) => ({
                                                        label: consensus,
                                                        value: consensus,
                                                    }))}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col span={12}>
                                            <Form.Item
                                                label={accessLinkBandwidthField[1]}
                                                name={accessLinkBandwidthField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择接入链路带宽"
                                                    }
                                                ]}
                                            >
                                                <InputNumber
                                                    disabled={currentTopologyState}
                                                    placeholder={`${selectedAccessLinkBandwidth}`}
                                                    min={0} style={{width: "100%"}}
                                                    changeOnWheel>
                                                </InputNumber>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                label={consensusNodeCpuField[1]}
                                                name={consensusNodeCpuField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择共识节点CPU数量限制"
                                                    }
                                                ]}
                                            >
                                                <InputNumber
                                                    disabled={currentTopologyState}
                                                    placeholder={`${selectedConsensusNodeCpuLimit}`}
                                                    min={0} style={{width: "100%"}}
                                                    changeOnWheel>
                                                </InputNumber>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col span={12}>
                                            <Form.Item
                                                label={consensusNodeMemoryField[1]}
                                                name={consensusNodeMemoryField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择共识节点内存限制"
                                                    }
                                                ]}
                                            >
                                                <InputNumber
                                                    disabled={currentTopologyState}
                                                    placeholder={`${selectedConsensusNodeMemoryLimit}`}
                                                    min={0} style={{width: "100%"}}
                                                    changeOnWheel>
                                                </InputNumber>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                label={consensusThreadCountField[0]}
                                                name={consensusThreadCountField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择共识节点内存限制"
                                                    }
                                                ]}
                                            >
                                                <InputNumber
                                                    disabled={currentTopologyState}
                                                    placeholder={`${selectedConsensusThreadCount}`}
                                                    min={0} style={{width: "100%"}}
                                                    changeOnWheel>
                                                </InputNumber>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row style={{display: "none"}}>
                                        <Form.Item
                                            label={totalNodesCountField[0]}
                                            name={totalNodesCountField[0]}
                                            rules={[
                                                {
                                                    validator: (rule, value, callback) => {
                                                        if (value === 0) {
                                                            return Promise.reject("拓扑至少存在一个节点");
                                                        } else {
                                                            return Promise.resolve()
                                                        }
                                                    },
                                                },
                                            ]}
                                        >
                                            <InputNumber></InputNumber>
                                        </Form.Item>
                                    </Row>
                                    {/*<Row style={{height: "2.3vh"}}>*/}

                                    {/*</Row>*/}
                                    <Row>
                                        <Col span={2}></Col>
                                        <Col span={6} style={{textAlign: "center"}}>
                                            <Button
                                                type={"primary"}
                                                style={{width: "100%", backgroundColor: '#28c016'}}
                                                disabled={currentTopologyState}
                                                htmlType={"submit"}>
                                                启动拓扑
                                            </Button>
                                        </Col>
                                        <Col span={1}></Col>
                                        <Col span={6} style={{textAlign: "center"}}>
                                            <Button
                                                type={"primary"}
                                                danger
                                                style={{width: "100%"}}
                                                disabled={!currentTopologyState}
                                                onClick={StopTopology}>
                                                停止拓扑
                                            </Button>
                                        </Col>
                                        <Col span={1}></Col>
                                        <Col span={6} style={{textAlign: "center"}}>
                                            <Button
                                                type={"primary"}
                                                style={{width: "100%", backgroundColor: '#6495ED'}}
                                                disabled={!currentTopologyState}
                                                onClick={installChannelAndChaincodeClicked}
                                                >
                                                安装链码
                                            </Button>
                                        </Col>
                                    </Row>
                                    <Row style={{height: "1.3vh"}}>

                                    </Row>
                                </Form>
                            </Card>
                        </Col>

                        <Col span={1}></Col>


                        <Col span={11}>
                            <Card
                                size={"small"}
                                title={"攻击配置"}
                            >
                                <Form
                                    name={"attack start form"}
                                    onFinishFailed={onValidateStartAttackFailed}
                                    onFinish={onStartAttackFinish}
                                    onValuesChange={onStartAttackValuesChange}
                                    labelCol={{
                                        span: 12,
                                    }}
                                    wrapperCol={{
                                        span: 12,
                                    }}
                                    initialValues={{
                                        [attackThreadCountField[0]]: selectedAttackThreadCount,
                                        [attackTypeField[0]]: selectedAttackType,
                                        [attackDurationField[0]]: selectedAttackDuration,
                                    }}
                                >
                                    <Row>
                                        <Col span={12}>
                                            <Form.Item
                                                label={attackThreadCountField[0]}
                                                name={attackThreadCountField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择攻击线程数量"
                                                    }
                                                ]}
                                            >
                                                <InputNumber
                                                    disabled={currentAttackState}
                                                    placeholder={`${selectedAttackThreadCount}`}
                                                    style={{width: "100%"}}
                                                    changeOnWheel>
                                                </InputNumber>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                label={attackTypeField[0]}
                                                name={attackTypeField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择攻击的类型"
                                                    }
                                                ]}
                                            >
                                                <Select
                                                    value={selectedAttackType}
                                                    disabled={currentAttackState}
                                                    options={attackTypes.map((attackType) => ({
                                                        label: attackType,
                                                        value: attackType,
                                                    }))}
                                                ></Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col span={12}>
                                            <Form.Item
                                                label={attackNodeField[0]}
                                                name={attackNodeField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择攻击节点"
                                                    }
                                                ]}
                                            >
                                                <Select value={selectedAttackNode}
                                                        disabled={currentAttackState}
                                                        options={maliciousNodes.map((maliciousNode) => ({
                                                            label: maliciousNode,
                                                            value: maliciousNode,
                                                        }))}
                                                >

                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                label={attackedNodeField[0]}
                                                name={attackedNodeField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择被攻击节点"
                                                    }
                                                ]}
                                            >
                                                <Select value={selectedAttackedNode}
                                                        disabled={currentAttackState}
                                                        options={chainMakerNodes.map((chainMakerNode) => ({
                                                            label: chainMakerNode,
                                                            value: chainMakerNode,
                                                        }))}
                                                >
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col span={12}>
                                            <Form.Item
                                                label={attackDurationField[0]}
                                                name={attackDurationField[0]}
                                                rules={[
                                                    {
                                                        required: true,
                                                        message: "请选择攻击时长"
                                                    }
                                                ]}
                                            >
                                                <InputNumber
                                                    disabled={currentAttackState}
                                                    placeholder={`${selectedAttackDuration}`}
                                                    style={{width: "100%"}}
                                                    changeOnWheel>
                                                </InputNumber>
                                            </Form.Item>
                                        </Col>
                                        <Col span={1}></Col>
                                        <Col span={11} style={{textAlign: "center"}}>
                                            <Button
                                                type={"primary"}
                                                style={{width: "100%"}}
                                                htmlType={"submit"}
                                                danger
                                                disabled={currentAttackState}>
                                                开始攻击
                                            </Button>
                                        </Col>
                                    </Row>
                                </Form>
                            </Card>
                            <Row style={{height: "0.6vh"}}></Row>
                            <Row>
                                <Col span={12}>
                                    <Card
                                        size={"small"}
                                        title={"共识配置"}
                                    >
                                        <Row>
                                            <Col span={11} style={{textAlign: "center"}}>
                                                <Button
                                                    type={"primary"}
                                                    style={{width: "100%"}}
                                                    onClick={startTxRateTestClicked}
                                                    disabled={txRateTestStatus}
                                                >
                                                    开始共识
                                                </Button>
                                            </Col>
                                            <Col span={2}></Col>
                                            <Col span={11}>
                                                <Button
                                                    type={"primary"}
                                                    style={{width: "100%"}}
                                                    htmlType={"submit"}
                                                    onClick={stopTxRateTestClicked}
                                                    disabled={!txRateTestStatus}
                                                    danger>
                                                    停止共识
                                                </Button>
                                            </Col>
                                        </Row>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card
                                        size={"small"}
                                        title={"安全配置"}
                                    >
                                        <Row>
                                            <Col span={2}></Col>
                                            <Col span={20}>
                                                <Switch value={startDefence} onChange={onStartDefenceChange} style={{width: "100%", marginTop: "10px"}}/>
                                            </Col>
                                            <Col span={2}></Col>
                                        </Row>
                                    </Card>
                                </Col>
                            </Row>

                        </Col>
                    </Row>
                    <Row style={{height: "1vh"}}></Row>
                    <Row style={{marginLeft: "1vw", marginRight: "1vw"}}>
                        <Col span={24}>
                            <Card
                                size={"small"}
                            >
                                <ReactECharts
                                    option={rateOption}
                                    style={{height: "26vh", width: "100%"}}
                                >
                                </ReactECharts>
                            </Card>
                        </Col>
                    </Row>
                </Col>

                {/*右侧的拓扑展示界面*/}
                <Col span={10}>
                    <Row style={{marginLeft: "1vw", marginRight: "1vw", height: "100%"}}>
                        <div ref={graphDivRef} id="graph"
                             style={{backgroundColor: "grey", width: "100%", height: "100%"}}>
                        </div>
                    </Row>
                </Col>
            </Row>
            {/*提示框*/}
            <Modal
                title={promptBoxTitle}
                open={promptBoxOpen} // 是否进行开启
                onOk={handlePromptOkCicked}
                onCancel={handlePromptCancelCicked}
                okText={promptBoxOkText}
                cancelText={promptBoxCancelText}
                confirmLoading={promptBoxLoading}
            >
                {promptBoxText}
            </Modal>
        </div>
    )
    // ---------------------------------------------------------------------------------------------
}