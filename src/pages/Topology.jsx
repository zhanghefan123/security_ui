import * as G6 from "@antv/g6";
import React, {useEffect, useRef, useState} from "react";
import {Button, Card, Col, Form, message, Modal, Radio, Row, Select, Table, Upload} from "antd";
import {Node} from "../entities/node"
import {Link} from "../entities/link"
import {
    getDataCenterTopology, getPathValidationTopology,
    getTopologyState,
    getWideAreaNetworkTopology, pageClose, startAttackRequest,
    startTopology, startTxRateTest,
    stopTopology, stopTxRateTest
} from "../requests/topology";
import {InputNumber} from "antd/lib";
import {ProForm} from "@ant-design/pro-components";
import {UploadOutlined} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";

const {getLabelPosition, transform} = G6.Util;

// NetworkNodeType_NormalSatellite    NetworkNodeType = 0 (constellation 专用)
// NetworkNodeType_ConsensusSatellite NetworkNodeType = 1 (constellation 专用)
// NetworkNodeType_EtcdService        NetworkNodeType = 2 (constellation 专用)
// NetworkNodeType_PositionService    NetworkNodeType = 3 (constellation 专用)
// NetworkNodeType_Router             NetworkNodeType = 4 (topology 专用)
// NetworkNodeType_NormalNode         NetworkNodeType = 5 (topology 专用)
// NetworkNodeType_ConsensusNode      NetworkNodeType = 6 (topology 专用)
// NetworkNodeType_MaliciousNode      NetworkNodeType = 7 (topology 专用)

export function Topology(props) {
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
                        repeat: true, // Whether executes the animation repeatly
                        duration: 3000 // the duration for executing once
                    }
                );
            }
        },
        "line" // extend the built-in edge 'cubic'
    );

    // 1. 参数的定义
    // ---------------------------------------------------------------------------------------------
    // 1.1 节点和链路类型
    const nodeTypes = [
        "Router",
        "NormalNode",
        "ConsensusNode",
        "ChainMakerNode",
        "MaliciousNode",
        "LirNode",
    ]
    const linkTypes = [
        "接入链路",
        "骨干链路"
    ]
    const attackTypes = [
        "udp flood attack",
        "syn flood attack",
        "connection exhausted attack",
        "共识消息重放"
    ]
    const styleForAccessLink = {
        stroke: '#0bef1e',
        lineWidth: 2,
    }
    const styleForBackboneLink = {
        stroke: '#0b39ef',
        lineWidth: 5,
    }
    // 表单
    const [startTopologyForm] = ProForm.useForm()
    // 1.2 所有的拓扑配置相关表单字段
    const networkEnvironmentField = ["网络环境", "network_env"]
    const blockchainTypeField = ["区块链类型", "blockchain_type"]
    const consensusTypeField = ["共识类型", "consensus_type"]
    const accessLinkBandwidthField = ["接入链路带宽", "接入链路带宽(mbps)"]
    const consensusNodeCpuField = ["共识节点CPU", "共识节点CPU(个)"]
    const consensusNodeMemoryField = ["共识节点内存", "共识节点内存 (MB)"]
    const consensusThreadCountField = ["共识线程数量", "consensus_thread_count"]
    const totalNodesCountField = ["总节点数量", "total_node_count"]
    // 1.3 所有攻击相关的表单字段
    const attackThreadCountField = ["攻击线程数量", "attack_thread_count"]
    const attackTypeField = ["攻击类型", "attack_type"]
    const attackNodeField = ["攻击节点", "attack_node"]
    const attackedNodeField = ["被攻击节点", "attacked_node"]
    const attackDurationField = ["攻击时间", "attack_duration"]
    // 1.4 区块链的类型
    const blockchainTypes = ["长安链", "以太坊", "fabric", "BIDL", "百度超级链"]
    const consensusTypes = {
        "长安链": ["TBFT", "RAFT", "MAXBFT"],
        "以太坊": ["PoW", "PoS"],
        "fabric": ["Mir-BFT", "BFT-SMaRt", "Raft"],
        "BIDL": ["PBFT-并行", "PBFT-串行"],
        "百度超级链": ["TDPoS", "PoA"]
    }
    // 1.6 所有的拓扑创建相关的表单字段
    const [selectedBlockchain, setSelectedBlockchain] = useState(blockchainTypes[0])
    const [availableConsensusTypes, setAvailableConsensusTypes] = useState(consensusTypes[blockchainTypes[0]])
    const [selectedConsensusType, setSelectedConsensusType] = useState(consensusTypes[blockchainTypes[0]][0])
    const [selectedNetworkEnvironment, setSelectedNetworkEnvironment] = useState("自定义环境")
    const [selectedAccessLinkBandwidth, setSelectedAccessLinkBandwidth] = useState(8)
    const [selectedConsensusNodeCpuLimit, setSelectedConsensusNodeCpuLimit] = useState(2)
    const [selectedConsensusNodeMemoryLimit, setSelectedConsensusNodeMemoryLimit] = useState(1024)
    const [selectedConsensusThreadCount, setSelectedConsensusThreadCount] = useState(25)
    // 1.7 所有的攻击相关的表单字段
    const [selectedAttackThreadCount, setSelectedAttackThreadCount] = useState(10)
    const [selectedAttackType, setSelectedAttackType] = useState(attackTypes[0])
    const [selectedAttackNode, setSelectedAttackNode] = useState("")
    const [selectedAttackedNode, setSelectedAttackedNode] = useState("")
    const [selectedAttackDuration, setSelectedAttackDuration] = useState(1)
    // 1.8 拓扑状态
    const [currentTopologyState, setCurrentTopologyState] = useState(false)
    const [currentAttackState, setCurrentAttackState] = useState(false)
    const [routers, setRouters] = useState([])
    const [normalNodes, setNormalNodes] = useState([])
    const [consensusNodes, setConsensusNodes] = useState([])
    const [chainMakerNodes, setChainMakerNodes] = useState([])
    const [maliciousNodes, setMaliciousNodes] = useState([])
    const [lirNodes, setLirNodes] = useState([])
    const [totalNodesCount, setTotalNodesCount] = useState(0)
    // 1.9 引用 dom 节点
    const graphDivRef = useRef(null); // 创建一个
    // 1.10 当前 tps
    const [timeList, setTimeList] = useState([1, 2, 3])
    const [currentTps, setCurrentTps] = useState([1, 2, 3])
    const [txRateTimer, setTxRateTimer] = useState()
    // 1.11 参数表格
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
    // 1.11 速率
    const rateOption = {
        title: {
            text: ''
        },
        grid: {
            left: "80px",
            right: "80px"
        },
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: ['共识速率/tps'],
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
                fontSize: 20
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
                fontSize: 20
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

    // 2. 组件初始化
    // ---------------------------------------------------------------------------------------------
    // 2.1 组件属性
    const [nodeType, setNodeType] = useState("Router")  // 当前选中的节点的类型 -> 状态
    const [graph, setGraph] = useState(undefined)
    // 2.2 组件的初始化步骤
    const [createGraph, setCreateGraph] = useState(0)
    const [getState, setGetState] = useState(0)
    // ---------------------------------------------------------------------------------------------

    // 3. 提示框相关
    // ---------------------------------------------------------------------------------------------
    // 3.1 提示框的类型
    const promptBoxTypes = {
        startTopology: Symbol.for("startTopology"),
        stopTopology: Symbol.for("stopTopology"),
        startAttack: Symbol.for("startAttack"),
        errorParameters: Symbol.for("errorParameters"),
    }
    // 3.2 提示框的各个属性
    const [promptBoxType, setPromptBoxType] = useState()
    const [promptBoxTitle, setPromptBoxTitle] = useState("Warning");
    const [promptBoxOpen, setPromptBoxOpen] = useState(false)
    const [promptBoxText, setPromptBoxText] = useState("cannot create multiple edges between two nodes")
    const [promptBoxOkText, setPromptBoxOkText] = useState("ok")
    const [promptBoxCancelText, setPromptBoxCancelText] = useState("cancel")
    const [promptBoxLoading, setPromptBoxLoading] = useState(false)
    // ---------------------------------------------------------------------------------------------

    // 4. 组件初始化第一步
    useEffect(() => {

        let beforeTime = 0, leaveTime = 0;

        let beforeUnloadFunction = ()=>{
            beforeTime = new Date().getTime()
        }

        let unloadFunction = ()=> {
            leaveTime = new Date().getTime() - beforeTime
            if (leaveTime <= 5) {
                pageClose();
            }
        }

        window.addEventListener("beforeunload", beforeUnloadFunction)
        window.addEventListener("unload", unloadFunction)

        return ()=>{
            window.removeEventListener("beforeunload", beforeUnloadFunction)
            window.removeEventListener("unload", unloadFunction)
        }
    }, []);

    // 4. 组件初始化的第二步 创建图
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
                style: styleForAccessLink
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

    // 5. 在创建图之后, 进行拓扑状态的获取 - 组件初始化的第二步
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        if (createGraph === 1) {
            getTopologyState((response) => {
                if (response.data["state"] === "up") {
                    startTopologyForm.setFieldsValue({
                        "网络环境": response.data["topology_params"]["network_env"],
                        "区块链类型": response.data["topology_params"]["blockchain_type"],
                        "共识类型": response.data["topology_params"]["consensus_type"],
                        "接入链路带宽": response.data["topology_params"]["access_link_bandwidth"],
                        "共识节点CPU": response.data["topology_params"]["consensus_node_cpu"],
                        "共识节点内存": response.data["topology_params"]["consensus_node_memory"],
                        "共识线程数量": response.data["topology_params"]["consensus_thread_count"],
                    })
                    setCurrentTopologyState(true)
                    rebuildGraph(response.data["topology_params"], true)
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

    useEffect(() => {
        return () => {
            if (txRateTimer) {
                clearInterval(txRateTimer)
            }
        }
    }, [])

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
                console.log(link_type)
                AddEdgeLogic(sourceNodeId, targetNodeId, link_type)
            }
        }, 1)
    }

    function clearState() {
        graph.clear()
        setRouters([])
        setNormalNodes([])
        setConsensusNodes([])
        setChainMakerNodes([])
        setMaliciousNodes([])
        setTotalNodesCount([])
    }

    // ---------------------------------------------------------------------------------------------

    // 6. 向图之中进行组件的添加, 组件初始化的第三步
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
                    <li>取消</li>
                  </ul>`
                        return outDiv
                    },

                    handleMenuClick(target, item, graph) {
                        if (target.textContent === "创建webshell") {
                            if (currentTopologyState) {
                                // 进行 webshell 的创建, 跳转到实际的创建 webshell 的界面
                                const windowProxy = window.open("_black")
                                windowProxy.location.href = `/instance/${item.getID()}`
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

    // 7. 提示框的处理函数
    // ---------------------------------------------------------------------------------------------
    // 7.1 当提示框点击了 OK 的时候
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
                network_env: selectedNetworkEnvironment,
                blockchain_type: selectedBlockchain,
                consensus_type: selectedConsensusType,
                access_link_bandwidth: selectedAccessLinkBandwidth,
                consensus_node_cpu: selectedConsensusNodeCpuLimit,
                consensus_node_memory: selectedConsensusNodeMemoryLimit,
                consensus_thread_count: selectedConsensusThreadCount,
                nodes: nodesList,
                links: links,
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
        } else {
            console.log("unsupported promptBoxType")
        }
    }

    // 7.2 当提示框点击了取消的时候
    function handlePromptCancelCicked() {
        setPromptBoxOpen(false)
    }

    // ---------------------------------------------------------------------------------------------

    // 9. 拓扑操作
    // ---------------------------------------------------------------------------------------------
    // 9.1 进行节点的添加
    const AddNodeButtonClicked = () => {
        let middleX = graphDivRef.current.clientWidth / 2
        let middleY = graphDivRef.current.clientHeight / 2
        AddNodeLogic(nodeType, middleX, middleY, false)
    }

    // 9.2 进行颜色的定义
    function ReturnLableColor(currentState) {
        if (currentState) {
            return '#4fde07'
        } else {
            return '#de0707'
        }
    }

    // 9.3 节点添加的逻辑
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

    // 9.3 边添加的逻辑
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

    // ---------------------------------------------------------------------------------------------

    // 10. 按钮
    // ---------------------------------------------------------------------------------------------
    // 10.1 进行拓扑的删除
    function StopTopology() {
        setPromptBoxType(promptBoxTypes.stopTopology)
        setPromptBoxOpen(true)
        setPromptBoxTitle("停止拓扑")
        setPromptBoxText("请确认是否停止拓扑!")
    }

    // ---------------------------------------------------------------------------------------------

    // 11. 处理拓扑启动表单
    // ---------------------------------------------------------------------------------------------
    // 11.1 当验证失败的时候
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

    // 11.2 当启动拓扑的时候
    function onStartTopologyFinish() {
        setPromptBoxType(promptBoxTypes.startTopology)
        let tableValues = [
            {
                key: "1",
                paramsDescription: networkEnvironmentField[0],
                paramsValue: selectedNetworkEnvironment
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
            }
        ]
        setPromptBoxOpen(true)
        setPromptBoxTitle("启动拓扑")
        setPromptBoxText(
            <Table dataSource={tableValues} columns={tableColumns}></Table>
        )
    }

    // 11.3 当拓扑的值改变的时候
    function onStartTopologyValuesChange(changedValues) {
        if (networkEnvironmentField[0] in changedValues) {
            setSelectedNetworkEnvironment(changedValues[networkEnvironmentField[0]]);
        }
        if (blockchainTypeField[0] in changedValues) {
            setSelectedBlockchain(changedValues[blockchainTypeField[0]]);
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

    // 12. 处理攻击表单
    // ---------------------------------------------------------------------------------------------
    // 12.1 当验证失败的时候
    function onValidateStartAttackFailed() {
        setPromptBoxOpen(true)
        setPromptBoxTitle("启动攻击失败")
        setPromptBoxText("请完成参数的选择!")
        setPromptBoxType(promptBoxTypes.errorParameters)
    }

    // 12.2 当启动攻击的时候
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

    // 12.3 当拓扑的值改变的时候
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


    // 11. 保存上传拓扑相关代码
    // ---------------------------------------------------------------------------------------------
    // 11.1 进行拓扑的保存
    function saveTopology() {
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
            console.log(lineWidth)
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
        let data = {
            "nodes": nodesList,
            "links": links,
        }
        let blob = new Blob([JSON.stringify(data)], {type: "application/json"})
        let url = window.URL.createObjectURL(blob)
        let link = document.createElement("a");
        link.style.display = "none";
        link.href = url
        link.setAttribute("download", "topology.txt");
        document.body.appendChild(link);
        link.click()
        document.body.removeChild(link);
    }

    // 11.2 加载拓扑
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

    // 12. 网络环境的变化
    function onEnvironmentChange(e) {
        const selectedEnvironment = e.target.value
        if (selectedEnvironment === "广域网环境") {
            getWideAreaNetworkTopology((response) => {
                rebuildGraph(response.data, false)
                message.success({
                    content: "成功切换到广域网环境"
                })
            }, (error) => {
                message.error({
                    content: "切换到广域网环境失败"
                })
            })
        } else if (selectedEnvironment === "数据中心环境") {
            getDataCenterTopology((response) => {
                rebuildGraph(response.data, false)
                message.success({
                    content: "成功切换到数据中心环境"
                })
            }, (error) => {
                message.error({
                    content: "切换到数据中心环境失败"
                })
            })
        } else if (selectedEnvironment === "路径验证环境") {
            getPathValidationTopology((response) => {
                rebuildGraph(response.data, false)
                message.success({
                    content: "成功切换到路径验证环境"
                })
            }, (error) => {
                message.error({
                    content: "切换到路径验证环境失败"
                })
            })
        } else {
            let emptyTopologyInfo = {
                nodes: [],
                links: []
            }
            rebuildGraph(emptyTopologyInfo, false)
            message.success({
                content: "成功切换到自定义环境"
            })
        }
    }

    // 13. 开启共识和停止共识
    function startTxRateTestClicked() {
        startTxRateTest((response) => {
            setTimeList(response.data["time_list"])
            setCurrentTps(response.data["rate_list"])
            message.success({
                content: "开启共识成功"
            })
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
        })
    }

    function stopTxRateTestClicked() {
        stopTxRateTest((response) => {
            if (txRateTimer) {
                clearInterval(txRateTimer)
            }
            message.success({
                content: "成功停止共识"
            })
        }, (error) => {
            message.error({
                content: "停止共识失败"
            })
        })
    }

    // 13. 实际的 HTML 代码
    // 13.1
    return (
        <div>
            {/*空行*/}
            <Row style={{height: "10px", marginLeft: "1vw", marginRight: "1vw"}}>

            </Row>
            <Row>
                <Col span={13}>
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
                                        setNodeType(value)
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
                                    defaultValue={"接入链路"}
                                    style={{width: "80%"}}
                                    options={linkTypes.map((linkType) => ({
                                        label: linkType,
                                        value: linkType,
                                    }))}
                                    onChange={(value) => {
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
                                        [networkEnvironmentField[0]]: selectedNetworkEnvironment,
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
                                                label={networkEnvironmentField[0]}
                                                name={networkEnvironmentField[0]}
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
                                                <Radio.Group
                                                    disabled={currentTopologyState}
                                                    onChange={onEnvironmentChange}
                                                    value={selectedNetworkEnvironment} style={{width: "100%"}}>
                                                    <Radio value={"广域网环境"}>广域网环境</Radio>
                                                    <Radio value={"数据中心环境"}>数据中心环境</Radio>
                                                    <Radio value={"路径验证环境"}>路径验证环境</Radio>
                                                    <Radio value={"自定义环境"}>自定义环境</Radio>
                                                </Radio.Group>
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
                                                        required: true,
                                                        message: "请选择区块链"
                                                    }
                                                ]}
                                            >
                                                <Select
                                                    disabled={currentTopologyState}
                                                    value={selectedBlockchain}
                                                    onChange={(value) => {
                                                        setSelectedBlockchain(value)
                                                        setAvailableConsensusTypes(consensusTypes[value])
                                                        startTopologyForm.setFieldsValue({
                                                            "共识类型": consensusTypes[value][0]
                                                        })
                                                    }}
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
                                                        required: true,
                                                        message: "请选择共识协议"
                                                    }
                                                ]}
                                            >
                                                <Select
                                                    disabled={currentTopologyState}
                                                    value={selectedConsensusType}
                                                    onChange={(value) => {
                                                        setSelectedConsensusType(value)
                                                    }}
                                                    options={availableConsensusTypes.map((city) => ({
                                                        label: city,
                                                        value: city,
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
                                    <Row>
                                        <Col span={11} style={{textAlign: "center"}}>
                                            <Button
                                                type={"primary"}
                                                style={{width: "100%", backgroundColor: '#28c016'}}
                                                disabled={currentTopologyState}
                                                htmlType={"submit"}>
                                                启动拓扑
                                            </Button>
                                        </Col>
                                        <Col span={2}></Col>
                                        <Col span={11} style={{textAlign: "center"}}>
                                            <Button
                                                type={"primary"}
                                                danger
                                                style={{width: "100%"}}
                                                disabled={!currentTopologyState}
                                                onClick={StopTopology}>
                                                停止拓扑
                                            </Button>
                                        </Col>
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
                                                    onChange={(value) => {
                                                        setSelectedAttackType(value)
                                                    }}
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
                                                        onChange={(value) => {
                                                            setSelectedAttackNode(value)
                                                        }}
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
                                                        onChange={(value) => {
                                                            setSelectedAttackedNode(value)
                                                        }}
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
                            <Card
                                size={"small"}
                                title={"共识配置"}
                            >
                                <Row>
                                    <Col span={11} style={{textAlign: "center"}}>
                                        <Button
                                            type={"primary"}
                                            style={{width: "100%"}}
                                            onClick={startTxRateTestClicked}>
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
                                            danger>
                                            停止共识
                                        </Button>
                                    </Col>
                                </Row>
                            </Card>
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
                                    style={{height: "30vh", width: "100%"}}
                                >
                                </ReactECharts>
                            </Card>
                        </Col>
                    </Row>
                </Col>


                <Col span={11}>
                    <Row style={{marginLeft: "1vw", marginRight: "1vw"}}>
                        <div ref={graphDivRef} id="graph"
                             style={{backgroundColor: "grey", width: "100%", height: "87.5vh"}}>
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
}