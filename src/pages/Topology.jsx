import * as G6 from "@antv/g6";
import React, {useEffect, useRef, useState} from "react";
import {Button, Col, Divider, Form, message, Modal, Radio, Row, Select} from "antd";
import {Node} from "../entities/node"
import {Link} from "../entities/link"
import {getTopologyState, startTopology, stopTopology} from "../requests/topology";
import {InputNumber} from "antd/lib";

// NetworkNodeType_NormalSatellite    NetworkNodeType = 0 (constellation 专用)
// NetworkNodeType_ConsensusSatellite NetworkNodeType = 1 (constellation 专用)
// NetworkNodeType_EtcdService        NetworkNodeType = 2 (constellation 专用)
// NetworkNodeType_PositionService    NetworkNodeType = 3 (constellation 专用)
// NetworkNodeType_Router             NetworkNodeType = 4 (topology 专用)
// NetworkNodeType_NormalNode         NetworkNodeType = 5 (topology 专用)
// NetworkNodeType_ConsensusNode      NetworkNodeType = 6 (topology 专用)
// NetworkNodeType_MaliciousNode      NetworkNodeType = 7 (topology 专用)

export function Topology(props) {
    // 1. 参数的定义
    // ---------------------------------------------------------------------------------------------
    // 1.1 节点类型
    const nodeTypes= [
        {"value":"Router", "label": "Router"},
        {"value":"NormalNode", "label": "NormalNode"},
        {"value":"ConsensusNode", "label": "ConsensusNode"},
        {"value":"ChainMakerNode", "label": "ChainMakerNode"},
        {"value":"MaliciousNode", "label": "MaliciousNode"},
    ]
    // 1.2 所有的表单字段
    const blockchainTypeField = "blockchain type"
    const consensusTypeField = "consensus type"
    const networkEnvironmentField = "network environment"
    const accessLinkBandwidthField = "access link bandwidth"
    const consensusNodeCpuField = "consensus node cpu"
    const attackThreadCountField = "attack thread count"
    // 1.3 区块链的类型
    const blockchainTypes = ["长安链", "以太坊", "fabric", "BIDL", "百度超级链"]
    const consensusTypes = {
        "长安链": ["TBFT", "RAFT", "MAXBFT"],
        "以太坊": ["PoW", "PoS"],
        "fabric": ["Mir-BFT", "BFT-SMaRt", "Raft"],
        "BIDL": ["PBFT-并行", "PBFT-串行"],
        "百度超级链": ["TDPoS", "PoA"]
    }
    // 1.4 各种节点的数量
    let routerCount = 0
    let normalNodeCount = 0
    let consensusNodeCount = 0
    let chainMakerNodeCount = 0
    let maliciousNodeCount = 0
    // 1.5 split 分割线的内容
    const firstSplitContent = "拓扑配置界面"
    const secondSplitContent = "区块链系统配置"
    const topologySplitContent = "拓扑"
    const attackSplitContent = "攻击配置"
    // 1.6 当前选中的区块链的类型以及共识类型
    const [selectedBlockchain, setSelectedBlockchain] = useState(blockchainTypes[0])
    const [availableConsensusTypes, setAvailableConsensusTypes] = useState(consensusTypes[blockchainTypes[0]])
    const [selectedConsensusType, setSelectedConsensusType] = useState(consensusTypes[blockchainTypes[0]][0])
    const [selectedNetworkEnvironment, setSelectedNetworkEnvironment] = useState("广域网环境")
    const [selectedAccessLinkBandwidth, setSelectedAccessLinkBandwidth] = useState(1)
    const [selectedConsensusNodeCpuLimit, setSelectedConsensusNodeCpuLimit] = useState(0.5)
    const [currentTopologyState, setCurrentTopologyState] = useState(false)
    // 1.7 引用 dom 节点
    const graphDivRef = useRef(null); // 创建一个
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


    // 2. 创建图
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
                shape: 'line',
                style: {
                    stroke: '#0b39ef',
                    lineWidth: 2,
                },
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
            let edges = graphTmp.findAll("edge", (edge)=>{
                let oneDirection = (edge.getSource().getID() === sourceId) && (edge.getTarget().getID() === targetId)
                let anotherDirection = (edge.getSource().getID() === targetId) && (edge.getTarget().getID() === sourceId)
                return oneDirection || anotherDirection
            })
            if (edges.length === 2) {
                // 删除的时候, 如果删自己的就会发生错误, 状态不一致, 这个时候需要使用 setTimeout
                setTimeout(()=>{
                    graphTmp.removeItem(edges[0])
                    setPromptBoxOpen(true)
                    setPromptBoxText("cannot create multiple edges between two nodes")
                },0)
            }
            // 逻辑2: 防止创建指向自己的边
            edges = graphTmp.findAll("edge", (edge)=>{
                return edge.getSource().getID() === edge.getTarget().getID()
            })
            if (edges.length === 1){
                setTimeout(()=>{
                    graphTmp.removeItem(edges[0])
                    setPromptBoxOpen(true)
                    setPromptBoxText("cannot create an edge point to itself")
                },0)
            }
        });

        setGraph(graphTmp)
        setCreateGraph(1)
    }, []);
    // ---------------------------------------------------------------------------------------------

    // 3. 在初始化的时候获取拓扑的状态
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        if(createGraph===1){
            getTopologyState((response)=>{
                if (response.data["state"] === "up") {
                    setCurrentTopologyState(true)
                    rebuildGraph(response.data["topology_params"])
                } else if(response.data["state"] === "down") {
                    setCurrentTopologyState(false)
                } else {
                    message.error({
                        content: "unsupported topology state"
                    })
                }
                setGetState(1)
            }, (error)=>{
                message.error({
                    content: "could not get the status from the backend server"
                })
            })
        }
    }, [createGraph]);

    // 根据后端返回的参数重新进行图的构建
    function rebuildGraph(topology_params) {
        for (let i = 0; i < topology_params["nodes"].length; i++) {
            let node = topology_params["nodes"][i]
            AddNodeLogic(node["type"], node["x"], node["y"], true)
        }
        for (let i = 0; i < topology_params["links"].length; i++){
            let link = topology_params["links"][i]
            let sourceNodeId = link["source_node"]["type"] + "_" + link["source_node"]["index"]
            let targetNodeId = link["target_node"]["type"] + "_" + link["target_node"]["index"]
            AddEdgeLogic(sourceNodeId, targetNodeId)
        }
    }
    // ---------------------------------------------------------------------------------------------

    // 4. 进行菜单的添加
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        if (getState === 1){
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
                            console.log(currentTopologyState)
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
                        } else if (target.textContent === "删除节点"){
                            setTimeout(()=>{
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
                        if(target.textContent === "删除边") {
                            setTimeout(()=>{
                                graph.removeItem(item)
                            },0)
                        }
                        message.success("成功删除边")
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




    // 5. 提示框的处理函数
    // ---------------------------------------------------------------------------------------------
    // 5.1 当提示框点击了 OK 的时候
    function handlePromptOkCicked() {
        if(promptBoxType === promptBoxTypes.startTopology) {
            setPromptBoxLoading(true)
            // 进行所有的节点的信息的收集
            let nodesMap = {}
            let nodesList = []
            const graphNodes = graph.getNodes()
            graphNodes.forEach((graphNode)=>{
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
            graphEdges.forEach((graphEdge)=>{
                let graphSourceNodeID = graphEdge.getSource().getID()
                let graphTargetNodeID = graphEdge.getTarget().getID()
                let sourceNode = nodesMap[graphSourceNodeID]
                let targetNode = nodesMap[graphTargetNodeID]
                links.push(new Link(sourceNode, targetNode))
            })
            // 构建参数
            const params= {
                nodes: nodesList,
                links: links,
            }
            // 调用函数
            startTopology(params, (response)=>{
                message.success({
                    content: `successfully start the topology`
                })
                setCurrentTopologyState(true) // 进行当前状态的更新 -> true
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false) // 不打开 promptbox
                window.location.reload() // 进行页面的强制刷新
            }, (error)=>{
                message.error({
                    content: `start topology error ${error}`
                })
                setCurrentTopologyState(false) // 进行当前状态的更新 -> false
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false) // 关闭 promptbox
            })

        } else if (promptBoxType === promptBoxTypes.stopTopology) {
            setPromptBoxLoading(true)
            stopTopology((response)=>{
                message.success({
                    content: `successfully stop the topology`
                })
                setCurrentTopologyState(false) // 进行当前状态的更新 -> false
                setPromptBoxLoading(false) // 关闭 promptbox 的 loading 状态
                setPromptBoxOpen(false)  // 关闭 promptbox
                window.location.reload() // 进行页面的强制刷新
            }, (error)=>{
                message.error({
                    content: `stop topology error ${error}`
                })
                // 不进行状态的更新
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })
        } else {
            console.log("unsupported promptBoxType")
        }
    }

    // 当提示框点击了取消的时候
    function handlePromptCancelCicked() {
        setPromptBoxOpen(false)
    }
    // ---------------------------------------------------------------------------------------------



    // 6. 下拉列表的处理函数
    // ---------------------------------------------------------------------------------------------
    function handleNodeTypeSelect(value){
        setNodeType(value)
    }
    // ---------------------------------------------------------------------------------------------


    // 7. 拓扑操作
    // ---------------------------------------------------------------------------------------------
    // 7.1 进行节点的添加
    function AddNodeButtonClicked(){
        let middleX = graphDivRef.current.clientWidth / 2
        let middleY = graphDivRef.current.clientHeight / 2
        AddNodeLogic(nodeType, middleX, middleY, false)
    }
    // 7.2 节点添加的逻辑
    function AddNodeLogic(nodeType, x, y, currentState){
        if (nodeType === "Router") { // 进行路由节点的添加
            let routerId = nodeType + "_" + (routerCount + 1)
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
            routerCount = routerCount + 1
        } else if (nodeType === "NormalNode") { // 进行普通节点的添加
            let normalNodeId = nodeType + "_" + (normalNodeCount + 1)
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
           normalNodeCount = normalNodeCount + 1
        } else if (nodeType === "ConsensusNode") { // 进行共识节点的添加
            let consensusNodeId = nodeType + "_" + (consensusNodeCount + 1)
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
            consensusNodeCount = consensusNodeCount + 1
        } else if (nodeType === "ChainMakerNode") { // 进行长安链节点的添加
            let chainMakerNodeId = nodeType + "_" + (chainMakerNodeCount + 1)
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
            chainMakerNodeCount = chainMakerNodeCount + 1
        } else if (nodeType === "MaliciousNode") { // 进行恶意节点的添加
            let maliciousNodeId = nodeType + "_" + (maliciousNodeCount + 1)
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
            console.log("maliciousnodeCount: ", maliciousNodeCount)
            maliciousNodeCount = maliciousNodeCount + 1
        }
        else {
            console.log("unsupported node type")
        }
    }
    // 7.3 边添加的逻辑
    function AddEdgeLogic(sourceNodeId, targetNodeId) {
        graph.addItem("edge", {
            source: sourceNodeId,
            target: targetNodeId
        })
    }
    // ---------------------------------------------------------------------------------------------

    // 8. 按钮
    // ---------------------------------------------------------------------------------------------
    // 8.1 进行拓扑的启动
    function StartTopology(){
        setPromptBoxType(promptBoxTypes.startTopology)
        setPromptBoxOpen(true)
        setPromptBoxTitle("start topology")
    }
    // 8.2 进行拓扑的删除
    function StopTopology(){
        setPromptBoxType(promptBoxTypes.stopTopology)
        setPromptBoxOpen(true)
        setPromptBoxTitle("stop topology")
    }
    // ---------------------------------------------------------------------------------------------

    // 9. 定义颜色
    function ReturnLableColor(currentState){
        if (currentState) {
            return '#4fde07'
        } else {
            return '#de0707'
        }
    }

    // 10. 实际的 HTML 代码
    return (
        <div>
            {/*空行*/}
            <Row style={{height: "30px", marginLeft: "5vw", marginRight: "5vw"}}>

            </Row>
            <Row>
                <Col span={12}>
                    {/*第2行*/}
                    <Row style={{marginLeft: "5vw", marginRight:"5vw"}}>
                        <Divider
                            style={{
                                borderColor: '#7cb305',
                            }}
                        >
                            {firstSplitContent}
                        </Divider>
                    </Row>
                    {/*第3行*/}
                    <Row style={{marginLeft: "5vw", marginRight:"5vw"}}>
                        <Col span={6} style={{textAlign: "center"}}>
                            <Select
                                defaultValue="Router"
                                style={{width: "80%"}}
                                onChange={handleNodeTypeSelect}
                                options={nodeTypes}
                            />
                        </Col>
                        <Col span={6} style={{textAlign: "center"}}>
                            <Button
                                type={"primary"}
                                style={{width: "80%"}}
                                disabled={currentTopologyState}
                                onClick={AddNodeButtonClicked}>
                                add node
                            </Button>
                        </Col>
                        <Col span={6}  style={{textAlign: "center"}}>
                            <Button
                                type={"primary"}
                                style={{width: "80%", backgroundColor:'#28c016'}}
                                disabled={currentTopologyState}
                                onClick={StartTopology}>
                                start topology
                            </Button>
                        </Col>
                        <Col span={6} style={{textAlign: "center"}}>
                            <Button
                                type={"primary"}
                                danger
                                disabled={!currentTopologyState}
                                onClick={StopTopology}>
                                stop topology
                            </Button>
                        </Col>
                    </Row>
                    {/*第4行*/}
                    <Row style={{marginLeft: "5vw", marginRight:"5vw"}}>
                        <Divider
                            style={{
                                borderColor: '#7cb305',
                            }}
                        >
                            {secondSplitContent}
                        </Divider>
                    </Row>
                    {/*注意 Form 是可以当成一行的*/}
                    <Form
                        labelCol={{
                            span: 8,
                        }}
                        wrapperCol={{
                            span: 14,
                        }}
                        style={{marginLeft: "5vw", marginRight:"5vw"}}
                        // layout={"inline"}
                    >
                        <Form.Item
                            label={blockchainTypeField}
                        >
                            <Select
                                defaultValue={blockchainTypes[0]}
                                value={selectedBlockchain}
                                onChange={(value)=>{
                                    setSelectedBlockchain(value)
                                    setAvailableConsensusTypes(consensusTypes[value])
                                    setSelectedConsensusType(consensusTypes[value][0])
                                }}
                                options={blockchainTypes.map((blockchainType) => ({
                                    label: blockchainType,
                                    value: blockchainType,
                                }))}
                                style={{width: "100%"}}
                            />
                        </Form.Item>
                        <Form.Item
                            label={consensusTypeField}
                        >
                            <Select
                                value={selectedConsensusType}
                                onChange={(value)=>{
                                    setSelectedConsensusType(value)
                                }}
                                options={availableConsensusTypes.map((city) => ({
                                    label: city,
                                    value: city,
                                }))}
                            />
                        </Form.Item>
                        <Form.Item
                            label={networkEnvironmentField}
                        >
                            <Radio.Group onChange={(e)=>{
                                setSelectedNetworkEnvironment(e.target.value)
                            }} value={selectedNetworkEnvironment}>
                                <Radio value={"广域网环境"}>广域网环境</Radio>
                                <Radio value={"数据中心环境"}>数据中心环境</Radio>
                                <Radio value={"自组网环境"}>自组网环境</Radio>
                            </Radio.Group>
                        </Form.Item>
                        <Form.Item
                            label={accessLinkBandwidthField}
                        >
                            <InputNumber placeholder={`${selectedAccessLinkBandwidth}`} style={{width: "100%"}} changeOnWheel></InputNumber>
                        </Form.Item>
                        <Form.Item
                            label={consensusNodeCpuField}
                        >
                            <InputNumber placeholder={`${selectedConsensusNodeCpuLimit}`} style={{width: "100%"}} changeOnWheel></InputNumber>
                        </Form.Item>
                    </Form>
                    <Row style={{marginLeft: "5vw", marginRight:"5vw"}}>
                        <Divider
                            style={{
                                borderColor: '#7cb305',
                            }}
                        >
                            {attackSplitContent}
                        </Divider>
                    </Row>
                </Col>
                <Col span={12}>
                    <Row style={{marginLeft: "5vw", marginRight:"5vw"}}>
                        <Divider
                            style={{
                                borderColor: '#7cb305',
                            }}
                        >
                            {topologySplitContent}
                        </Divider>
                    </Row>
                    {/*第5行*/}
                    <Row style={{marginLeft: "5vw", marginRight:"5vw"}}>
                        <div ref={graphDivRef} id="graph" style={{backgroundColor: "grey", width: "100%", height: "35vw"}}>
                        </div>
                    </Row>
                </Col>
            </Row>
            {/*空行*/}
            <Row style={{height: "30px", marginLeft: "5vw", marginRight: "5vw"}}>

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