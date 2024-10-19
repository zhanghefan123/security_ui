import * as G6 from "@antv/g6";
import {useEffect, useRef, useState} from "react";
import {Button, Col, Divider, List, message, Modal, Row, Select, Typography} from "antd";

export function Topology(props) {

    // 节点类型
    const nodeTypes= [
        {"value":"satellite", "label":"satellite"},
        {"value":"consensus", "label":"consensus"},
        {"value":"router", "label": "router"},
        {"value":"malicious", "label": "malicious"},
    ]
    // 选中的节点类型
    const [nodeType, setNodeType] = useState("satellite")  // 当前选中的节点的类型 -> 状态
    // 当前的图
    const [graph, setGraph] = useState();
    // 提示框的内容
    const [promptBoxTitle, setPromptBoxTitle] = useState("Warning");
    const [promptBoxOpen, setPromptBoxOpen] = useState(false)
    const [promptBoxText, setPromptBoxText] = useState("cannot create multiple edges between two nodes")
    const [promptBoxOkText, setPromptBoxOkText] = useState("ok")
    const [promptBoxCancelText, setPromptBoxCancelText] = useState("cancel")
    const [promptBoxLoading, setPromptBoxLoading] = useState(false)
    // 各种节点的数量
    const [satelliteCount, setSatelliteCount] = useState(0)
    const [consensusNodeCount, setConsensusNodeCount] = useState(0)
    const [routerCount, setrouterCount] = useState(0)
    const [maliciousNodeCount, setMaliciousNodeCount] = useState(0)
    // 引用 dom 节点
    const graphDivRef = useRef(null); // 创建一个
    // 第一个 split 的内容
    const firstSplitContent = "操作面板"
    // 第二个 split 的内容
    const secondSplitContent = "拓扑配置界面"

    // 1. 创建图
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
        const graph = new G6.Graph({
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
        graph.data(data);
        // Render the graph
        graph.render();

        // 添加边之后的处理
        graph.on('aftercreateedge', (e) => {
            const edgeCreate = e.edge
            let source = edgeCreate.getSource()
            let target = edgeCreate.getTarget()
            let sourceId = source.getID()
            let targetId = target.getID()
            // 逻辑1: 防止进行重复的边的创建
            let edges = graph.findAll("edge", (edge)=>{
                let oneDirection = (edge.getSource().getID() === sourceId) && (edge.getTarget().getID() === targetId)
                let anotherDirection = (edge.getSource().getID() === targetId) && (edge.getTarget().getID() === sourceId)
                return oneDirection || anotherDirection
            })
            if (edges.length === 2) {
                // 删除的时候, 如果删自己的就会发生错误, 状态不一致, 这个时候需要使用 setTimeout
                setTimeout(()=>{
                    graph.removeItem(edges[0])
                    setPromptBoxOpen(true)
                    setPromptBoxText("cannot create multiple edges between two nodes")
                },0)
            }
            // 逻辑2: 防止创建指向自己的边
            edges = graph.findAll("edge", (edge)=>{
                return edge.getSource().getID() === edge.getTarget().getID()
            })
            if (edges.length === 1){
                setTimeout(()=>{
                    graph.removeItem(edges[0])
                    setPromptBoxOpen(true)
                    setPromptBoxText("cannot create an edge point to itself")
                },0)
            }
        });

        setGraph(graph)
    }, []);

    // 2. 提示框的处理函数
    function handlePromptOkCicked() {
        setPromptBoxOpen(false)
    }

    function handlePromptCancelCicked() {
        setPromptBoxOpen(false)
    }

    // 3. 复选框的处理函数
    function handleNodeTypeSelect(value){
        setNodeType(value)
    }


    // 4. 拓扑操作
    // 4.1 进行节点的添加
    function AddNode(){
        if (nodeType === "satellite") {  // 进行卫星节点的添加
            let satelliteId = nodeType + "" + (satelliteCount + 1)
            let satellite = {
                id: satelliteId,
                label: satelliteId,
                x: graphDivRef.current.clientWidth / 2,
                y: graphDivRef.current.clientHeight / 2,
                size: 40,
                img: './pictures/satellite.png',
            };
            graph.addItem('node', satellite);
            setSatelliteCount(satelliteCount + 1);
        } else if (nodeType === "consensus") { // 进行共识节点的添加
            let consensusNodeId = nodeType + "" + (consensusNodeCount + 1)
            let consensusNode = {
                id: consensusNodeId,
                label: consensusNodeId,
                x: graphDivRef.current.clientWidth / 2,
                y: graphDivRef.current.clientHeight / 2,
                size: 40,
                img: "./pictures/consensus.png",
            };
            graph.addItem('node', consensusNode);
            setConsensusNodeCount(consensusNodeCount + 1);
        } else if (nodeType === "router") { // 进行普通节点的添加
            let routerId = nodeType + "" + (routerCount + 1)
            let router = {
                id: routerId,
                label: routerId,
                x: graphDivRef.current.clientWidth / 2,
                y: graphDivRef.current.clientHeight / 2,
                size: 40,
                img: "./pictures/router.png",
            }
            graph.addItem('node', router);
            setrouterCount(routerCount + 1);
        } else if (nodeType === "malicious") { // 进行恶意节点的添加
            let maliciousNodeId = nodeType + "" + maliciousNodeCount + 1
            let maliciousNode = {
                id: maliciousNodeId,
                label: maliciousNodeId,
                x: graphDivRef.current.clientWidth / 2,
                y: graphDivRef.current.clientHeight / 2,
                size: 40,
                img: "./pictures/hacker.png"
            }
            graph.addItem('node', maliciousNode);
            setMaliciousNodeCount(maliciousNodeCount + 1);
        }
        else {
            console.log("unsupported node type")
        }
    }

    // 4.2 进行拓扑的启动
    function StartTopology(){

    }

    return (
        <div>
            {/*第1行*/}
            <Row style={{height: "30px"}}></Row>
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
                <Col span={9}></Col>
                <Col span={2} style={{textAlign: "center"}}>
                    <Select
                        defaultValue="satellite"
                        style={{width: "80%"}}
                        onChange={handleNodeTypeSelect}
                        options={nodeTypes}
                    />
                </Col>
                <Col span={2} style={{textAlign: "center"}}>
                    <Button
                        type={"primary"}
                        style={{width: "80%"}}
                        onClick={AddNode}>
                        add node
                    </Button>
                </Col>
                <Col span={2}  style={{textAlign: "center"}}>
                    <Button
                        type={"primary"}
                        style={{width: "80%", backgroundColor:'#28c016'}}
                        onClick={StartTopology}>
                        start topology
                    </Button>
                </Col>
                <Col span={9}></Col>
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