import * as G6 from "@antv/g6";
import {useEffect, useRef, useState} from "react";
import {Button, Col, Divider, message, Modal, Row, Select} from "antd";
import {Node} from "../entities/node"
import {Link} from "../entities/link"
import {startTopology, stopTopology, getTopologyState} from "../requests/topology";

// NetworkNodeType_NormalSatellite    NetworkNodeType = 0 (constellation 专用)
// NetworkNodeType_ConsensusSatellite NetworkNodeType = 1 (constellation 专用)
// NetworkNodeType_EtcdService        NetworkNodeType = 2 (constellation 专用)
// NetworkNodeType_PositionService    NetworkNodeType = 3 (constellation 专用)


// NetworkNodeType_Router             NetworkNodeType = 4 (topology 专用)
// NetworkNodeType_NormalNode         NetworkNodeType = 5 (topology 专用)
// NetworkNodeType_ConsensusNode      NetworkNodeType = 6 (topology 专用)
// NetworkNodeType_MaliciousNode      NetworkNodeType = 7 (topology 专用)

export function Topology(props) {
    // 节点类型
    const nodeTypes= [
        {"value":"Router", "label": "Router"},
        {"value":"NormalNode", "label": "NormalNode"},
        {"value":"ConsensusNode", "label": "ConsensusNode"},
        {"value":"MaliciousNode", "label": "MaliciousNode"},
    ]
    // 选中的节点类型
    const [nodeType, setNodeType] = useState("Router")  // 当前选中的节点的类型 -> 状态
    // 当前的图
    const [graph, setGraph] = useState(undefined)
    // 当前组建的初始化步骤
    const [initStep, setInitStep] = useState(0)
    // 提示框的内容
    const promptBoxTypes = {
        startTopology: Symbol.for("startTopology"),
        stopTopology: Symbol.for("stopTopology"),
    }
    const [promptBoxType, setPromptBoxType] = useState()
    const [promptBoxTitle, setPromptBoxTitle] = useState("Warning");
    const [promptBoxOpen, setPromptBoxOpen] = useState(false)
    const [promptBoxText, setPromptBoxText] = useState("cannot create multiple edges between two nodes")
    const [promptBoxOkText, setPromptBoxOkText] = useState("ok")
    const [promptBoxCancelText, setPromptBoxCancelText] = useState("cancel")
    const [promptBoxLoading, setPromptBoxLoading] = useState(false)
    // 各种节点的数量
    let routerCount = 0
    let normalNodeCount = 0
    let consensusNodeCount = 0
    let maliciousNodeCount = 0
    // const [routerCount, setrouterCount] = useState(0)
    // const [normalNodeCount, setNormalNodeCount] = useState(0)
    // const [consensusNodeCount, setConsensusNodeCount] = useState(0)
    // const [maliciousNodeCount, setMaliciousNodeCount] = useState(0)
    // 当前的拓扑的状态
    const [currentTopologyState, setCurrentTopologyState] = useState(false)

    // 引用 dom 节点
    const graphDivRef = useRef(null); // 创建一个
    // 第一个 split 的内容
    const firstSplitContent = "操作面板"
    // 第二个 split 的内容
    const secondSplitContent = "拓扑配置界面"

    // 2. 创建图
    useEffect(() => {
        // The source data
        const data = {
            // The array of nodes
            nodes: [],
            // The array of edges
            edges: [],
        };

        const nodeMenu = new G6.Menu({
            offsetX: 10,
            itemTypes: ['node'],
            getContent(e, graph) {
                const outDiv = document.createElement('div');
                outDiv.style.width = '180px';
                outDiv.innerHTML = `<ul>
                    <li>删除节点</li>
                    <li>取消</li>
                  </ul>`
                return outDiv
            },
            handleMenuClick(target, item, graph) {
                if (target.textContent === "删除节点"){
                    setTimeout(()=>{
                        graph.removeItem(item)
                    }, 0)
                    message.success("成功删除节点" + item.getID())
                }
            },
        })

        const edgeMenu = new G6.Menu({
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

        // Instantiate the Graph
        const graphTmp = new G6.Graph({
            container: 'graph', // The container id or HTML node of the graph canvas.
            // The width and the height of graph canvas
            width: graphDivRef.current.clientWidth,
            height: graphDivRef.current.clientHeight,
            // 默认的边
            defaultNode: {
                type: 'image',
                size: [260, 80],
                clipCfg: {
                    show: false,
                    // Clip type options: circle, ellipse, rect, path
                    type: 'circle',
                    // circle
                    r: 30,
                    // clip style
                    style: {
                        lineWidth: 1,
                    },
                },
            },
            defaultEdge: {
                shape: 'line',
                style: {
                    stroke: '#0b39ef',
                    lineWidth: 2,
                },
            },
            modes: {
                default: ['create-edge', 'drag-canvas', 'zoom-canvas', 'drag-node', 'brush-select'], // 允许拖拽画布、放缩画布、拖拽节点
            },
            plugins: [nodeMenu, edgeMenu],
        });
        // Load the data
        graphTmp.data(data);
        // Render the graph
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
        setInitStep(1)
    }, []);

    useEffect(() => {
        if(initStep===1){
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
            }, (error)=>{
                message.error({
                    content: "could not get the status from the backend server"
                })
            })
        }
    }, [initStep]);

    function rebuildGraph(topology_params) {
        console.log(topology_params)
        for (let i = 0; i < topology_params["nodes"].length; i++) {
            let node = topology_params["nodes"][i]
            AddNodeLogic(node["type"], node["x"], node["y"])
        }
        for (let i = 0; i < topology_params["links"].length; i++){
            let link = topology_params["links"][i]
            let sourceNodeId = link["source_node"]["type"] + "_" + link["source_node"]["index"]
            let targetNodeId = link["target_node"]["type"] + "_" + link["target_node"]["index"]
            AddEdgeLogic(sourceNodeId, targetNodeId)
        }
    }

    // 3. 提示框的处理函数
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
                let x = graphNode._cfg.bboxCache.x
                let y = graphNode._cfg.bboxCache.y
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
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            }, (error)=>{
                message.error({
                    content: `start topology error ${error}`
                })
                setCurrentTopologyState(false) // 进行当前状态的更新 -> false
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })

        } else if (promptBoxType === promptBoxTypes.stopTopology) {
            setPromptBoxLoading(true)
            stopTopology((response)=>{
                message.success({
                    content: `successfully stop the topology`
                })
                setCurrentTopologyState(false) // 进行当前状态的更新 -> false
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
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

    function handlePromptCancelCicked() {
        setPromptBoxOpen(false)
    }

    // 4. 复选框的处理函数
    function handleNodeTypeSelect(value){
        setNodeType(value)
    }


    // 5. 拓扑操作
    // 5.1 进行节点的添加
    function AddNodeButtonClicked(){
        let middleX = graphDivRef.current.clientWidth / 2
        let middleY = graphDivRef.current.clientHeight / 2
        AddNodeLogic(nodeType, middleX, middleY)
    }
    // 节点添加的逻辑
    function AddNodeLogic(nodeType, x, y){
        if (nodeType === "Router") { // 进行路由节点的添加
            let routerId = nodeType + "_" + (routerCount + 1)
            let router = {
                id: routerId,
                label: routerId,
                x: x,
                y: y,
                size: 40,
                img: "./pictures/router.png",
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
            }
            graph.addItem('node', consensusNode);
            consensusNodeCount = consensusNodeCount + 1
        } else if (nodeType === "MaliciousNode") { // 进行恶意节点的添加
            let maliciousNodeId = nodeType + "_" + (maliciousNodeCount + 1)
            let maliciousNode = {
                id: maliciousNodeId,
                label: maliciousNodeId,
                x: x,
                y: y,
                size: 40,
                img: "./pictures/maliciousNode.png"
            }
            graph.addItem('node', maliciousNode);
            console.log("maliciousnodeCount: ", maliciousNodeCount)
            maliciousNodeCount = maliciousNodeCount + 1
        }
        else {
            console.log("unsupported node type")
        }
    }
    // 边添加的逻辑
    function AddEdgeLogic(sourceNodeId, targetNodeId) {
        graph.addItem("edge", {
            source: sourceNodeId,
            target: targetNodeId
        })
    }

    // 5.2 进行拓扑的启动
    function StartTopology(){
        setPromptBoxType(promptBoxTypes.startTopology)
        setPromptBoxOpen(true)
        setPromptBoxTitle("start topology")
    }

    // 5.3 进行拓扑的删除
    function StopTopology(){
        setPromptBoxType(promptBoxTypes.stopTopology)
        setPromptBoxOpen(true)
        setPromptBoxTitle("stop topology")
    }

    return (
        <div>
            {/*第1行*/}
            <Row style={{height: "30px"}}>

            </Row>
            {/*第2行*/}
            <Row>
                <Divider
                    style={{
                        borderColor: '#7cb305',
                    }}
                >
                    {firstSplitContent}
                </Divider>
            </Row>
            {/*第3行*/}
            <Row>
                <Col span={8}></Col>
                <Col span={2} style={{textAlign: "center"}}>
                    <Select
                        defaultValue="Router"
                        style={{width: "80%"}}
                        onChange={handleNodeTypeSelect}
                        options={nodeTypes}
                    />
                </Col>
                <Col span={2} style={{textAlign: "center"}}>
                    <Button
                        type={"primary"}
                        style={{width: "80%"}}
                        disabled={currentTopologyState}
                        onClick={AddNodeButtonClicked}>
                        add node
                    </Button>
                </Col>
                <Col span={2}  style={{textAlign: "center"}}>
                    <Button
                        type={"primary"}
                        style={{width: "80%", backgroundColor:'#28c016'}}
                        disabled={currentTopologyState}
                        onClick={StartTopology}>
                        start topology
                    </Button>
                </Col>
                <Col span={2} style={{textAlign: "center"}}>
                    <Button
                        type={"primary"}
                        danger
                        disabled={!currentTopologyState}
                        onClick={StopTopology}>
                        stop topology
                    </Button>
                </Col>
                <Col span={8}></Col>
            </Row>
            {/*第4行*/}
            <Row>
                <Divider
                    style={{
                        borderColor: '#7cb305',
                    }}
                >
                    {secondSplitContent}
                </Divider>
            </Row>
            {/*第5行*/}
            <Row>
                <div ref={graphDivRef} id="graph" style={{backgroundColor: "grey", width:"100%", height: "450px"}}>
                </div>
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