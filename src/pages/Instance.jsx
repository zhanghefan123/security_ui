import {Card, Row, Tabs, Typography, message, Col, Button} from "antd";
import {useEffect, useState} from "react";
import {startWebShell, stopWebShell, startCaptureInterfaceRate, stopCaptureInterfaceRate} from "../requests/instance"
import {useParams} from "react-router-dom";
import ReactECharts from 'echarts-for-react'

export function Instance(props) {

    // 1. 从 url 之中获取到的一些参数
    const containerName= useParams().containerName

    // 2. 一些状态属性
    const [tabs, setTabs] = useState([])
    const [activeTab, setActiveTab] = useState()
    const [timeList, setTimeList] = useState([])
    const [interfaceRateList, setInterfaceRateList] = useState([])
    const [cpuRatioList, setCpuRatioList] = useState([])
    const [memoryList, setMemoryList] = useState([])
    const [blockRatioList, setBlockRatioList] = useState([])
    const [connectedList, setConnectedList] = useState([])
    const [halfConnectedList, setHalfConnectedList] = useState([])
    const [timeoutList, setTimeoutList] = useState([])
    const [messageCountList, setMessageCountList] = useState([])

    let captureTimer = undefined

    // 3. 上来就加载一个默认的界面
    useEffect(() => {
        // 3.1 为相应的容器开启第一个 webshell
        AddWebShellLogic()

        // 3.2 开启抓包线程
        captureTimer = setInterval(()=>{
            StartCapture()
        }, 1000)

        // 3.3 添加在页面被释放之前的卸载
        window.addEventListener('beforeunload', ()=>{
            StopCapture()
        })

        // 3.4 当界面析构时候的逻辑
        return ()=>{
            window.removeEventListener('beforeunload', ()=>{
                StopCapture()
            })
            clearInterval(captureTimer)
        }
    }, [])

    // 4. 开启抓包
    function StartCapture() {
        let params = {
            container_name: containerName.replace("_", "-")
        }
        startCaptureInterfaceRate(params, (response)=>{
            setTimeList(response.data["time_list"])
            setInterfaceRateList(response.data["interface_rate_list"])
            setCpuRatioList(response.data["cpu_ratio_list"])
            setMemoryList(response.data["memory_list"])
            if (response.data["block_ratio_list"]){
                setBlockRatioList(response.data["block_ratio_list"])
            }
            if (response.data["connected_count_list"]) {
                setConnectedList(response.data["connected_count_list"])
            }
            if (response.data["half_connected_count_list"]){
                setHalfConnectedList(response.data["half_connected_count_list"])
            }
            if (response.data["time_out_list"]) {
                setTimeoutList(response.data["time_out_list"])
            }
            if (response.data["message_count_list"]){
                setMessageCountList(response.data["message_count_list"])
            }
        }, (error)=>{
            clearInterval(captureTimer)
            window.close()
        })
    }

    // 5. 停止抓包
    function StopCapture(){
        let params = {
            container_name: containerName.replace("_", "-")
        }
        stopCaptureInterfaceRate(params)
    }

    // 6. 添加webshell的逻辑
    function AddWebShellLogic(){
        const containerTypeAndId = containerName.split("_")
        const realContainerName = containerTypeAndId[0] + "-" + containerTypeAndId[1]
        let params = {
            "container_name": realContainerName
        }
        startWebShell(params, (response)=>{
            const webShellInfo = response.data
            let largestKey = -1
            if (tabs.length === 0){
                largestKey = 0
            } else {
                // 遍历所有的 tabs 从而找到最大的 key
                for (let index = 0; index < tabs.length; index++) {
                    let splitContent  = tabs[index].key.split(":")
                    let tmpKey = parseInt(splitContent[1])
                    if (largestKey < tmpKey + 1) {
                        largestKey = tmpKey + 1
                    }
                }
            }
            const newKey = `${realContainerName}:${largestKey}`
            const url = `http://${webShellInfo.address}:${webShellInfo.port}`
            setTabs([...tabs, {
                key: newKey,
                label: newKey,
                children: <Row justify="center">
                    <iframe style={{width:"100%",height:"40vh"}} src={url}/>
                </Row>,
                pid: webShellInfo.pid
            }])
            message.success({
                content: "successfully create webshell"
            })
        }, (error)=>{
            message.error({
                content: "create webshell failed"
            })
        })
    }

    // 7. 删除webshell 的逻辑
    function StopWebShellLogic(targetKey){
        const deleteTabIndex = tabs.findIndex((tab)=> tab.key === targetKey)
        let params = {
            "pid": tabs[deleteTabIndex].pid
        }
        stopWebShell(params, (response)=>{
            const tabsLength = tabs.length
            if (tabsLength === 1) {
                setTabs([])
            } else {
                const tabsRemained = tabs.filter((tab)=>tab.key !== targetKey)
                const nextActiveKey = tabsRemained[deleteTabIndex-1].key
                setActiveTab(nextActiveKey)
                setTabs(tabsRemained)
            }
            message.success({
                content: "successfully delete webshell"
            })
        }, (error)=>{
            message.error({
                content: "create webshell failed"
            })
        })
    }

    // 8. option for rate
    const interfaceRateOption = {
        title: {
            text: ''
        },
        grid: {
            left: "100px",
            right: "80px"
        },
        tooltip: {
            trigger: "axis"
        },
        legend: {
            data:['节点被攻击速率'],
            textStyle: {
                fontSize: 15, // 图例字体大小
            }
        },
        xAxis: {
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
            name: "节点被攻击速率",
            type: "value",
            axisLabel: {
                formatter: '{value} Mbps',
                fontSize: 15
            },
            nameTextStyle: {
                fontSize: 20
            }
        },
        series: [{
            name: '节点被攻击速率',
            type:'line',
            yAxisIndex: 0,
            data: interfaceRateList,
            lineStyle: {
                width: 4,
                color: "rgb(222,7,7)",
            },
            smooth: false,
            symbolSize: 15,
            color: "rgb(222,7,7)",
        }]
    }

    const interfaceRateAndRatioOption = {
        title: {
            text: ''
        },
        grid: {
            left: "100px",
            right: "80px"
        },
        tooltip: {
            trigger: "axis"
        },
        legend: {
            data:['节点被攻击速率', "区块高度百分比"],
            textStyle: {
                fontSize: 15, // 图例字体大小
            }
        },
        xAxis: {
            type: "category",
            data: timeList,
            axisLabel: {
                fontSize: 15
            },
            nameTextStyle: {
                fontSize: 20
            }
        },
        yAxis: [
            {
                name: "节点被攻击速率",
                type: "value",
                axisLabel: {
                    formatter: '{value} Mbps',
                    fontSize: 15
                },
                nameTextStyle: {
                    fontSize: 20
                }
            },
            {
                name: "区块高度百分比",
                type: "value",
                axisLabel: {
                    formatter: '{value} %',
                    fontSize: 15
                },
                nameTextStyle: {
                    fontSize: 20
                }
            }
        ],
        series: [
            {
                name: '节点被攻击速率',
                type:'line',
                yAxisIndex: 0,
                data: interfaceRateList,
                lineStyle: {
                    width: 4,
                    color: "rgb(222,7,7)",
                },
                smooth: false,
                symbolSize: 15,
                color: "rgb(222,7,7)",
            },
            {
                name: "区块高度百分比",
                type: "line",
                yAxisIndex: 1,
                data: blockRatioList,
                lineStyle: {
                    width: 4,
                    color: "blue"
                },
                smooth: false,
                symbolSize: 15,
                color: "blue"
            }
        ]
    }


    const cpuAndMemoryRateOption = {
        title: {
            text: "",
        },
        grid: {
            left: "80px",
            right: "80px"
        },
        tooltip: {
            trigger: "axis"
        },
        legend: {
            data:['节点 CPU 利用率', "节点内存"],
            textStyle: {
                fontSize: 15, // 图例字体大小
            }
        },
        xAxis: {
            type: "category",
            data: timeList,
            axisLabel: {
                fontSize: 15
            },
            nameTextStyle: {
                fontSize: 20
            }
        },
        yAxis: [
            {
                name: "节点 CPU 利用率",
                type: "value",
                position: "left",
                axisLabel: {
                    formatter: '{value} %',
                    fontSize: 15
                },
                nameTextStyle: {
                    fontSize: 20
                },
            },
            {
                name: "节点内存",
                type: "value",
                position: "right",
                axisLabel: {
                    formatter: '{value} MB',
                    fontSize: 15
                },
                nameTextStyle: {
                    fontSize: 20
                },
            },
        ],
        series: [
            {
                name: '节点 CPU 利用率',
                type:'line',
                yAxisIndex: 0,
                data: cpuRatioList,
                lineStyle: {
                    width: 4,
                    color: "rgb(222,7,7)",
                },
                smooth: false,
                symbolSize: 15,
                color: "rgb(222,7,7)",
            },
            {
                name: '节点内存',
                type:'line',
                yAxisIndex: 1,
                data: memoryList,
                lineStyle: {
                    width: 4,
                    color: "blue",
                },
                smooth: false,
                symbolSize: 15,
                color: "blue",
            },
        ]
    }

    const tcpConnectedAndHalfConnectedOption = {
        title: {
            text: "",
        },
        grid: {
            left: "80px",
            right: "80px"
        },
        tooltip: {
            trigger: "axis"
        },
        legend: {
            data:['TCP 已建立连数', "TCP 半开连接数"],
            textStyle: {
                fontSize: 15, // 图例字体大小
            }
        },
        xAxis: {
            type: "category",
            data: timeList,
            axisLabel: {
                fontSize: 15
            },
            nameTextStyle: {
                fontSize: 20
            }
        },
        yAxis: [
            {
                name: "TCP 已建立连数",
                type: "value",
                position: "left",
                axisLabel: {
                    formatter: '{value}',
                    fontSize: 15
                },
                nameTextStyle: {
                    fontSize: 20
                },
            },
            {
                name: "TCP 半开连接数",
                type: "value",
                position: "right",
                axisLabel: {
                    formatter: '{value}',
                    fontSize: 15
                },
                nameTextStyle: {
                    fontSize: 20
                },
            },
        ],
        series: [
            {
                name: 'TCP 已建立连接数',
                type:'line',
                yAxisIndex: 1,
                data: connectedList,
                lineStyle: {
                    width: 4,
                    color: "purple",
                },
                smooth: false,
                symbolSize: 15,
                color: "purple",
            },
            {
                name: 'TCP 半开连接数',
                type:'line',
                yAxisIndex: 1,
                data: halfConnectedList,
                lineStyle: {
                    width: 4,
                    color: "orange",
                },
                smooth: false,
                symbolSize: 15,
                color: "orange",
            }
        ]
    }


    const timeoutAndMessageCountOption = {
        title: {
            text: "",
        },
        grid: {
            left: "80px",
            right: "80px"
        },
        tooltip: {
            trigger: "axis"
        },
        legend: {
            data:['共识超时次数', "总线消息数量"],
            textStyle: {
                fontSize: 15, // 图例字体大小
            }
        },
        xAxis: {
            type: "category",
            data: timeList,
            axisLabel: {
                fontSize: 15
            },
            nameTextStyle: {
                fontSize: 20
            }
        },
        yAxis: [
            {
                name: "共识超时次数",
                type: "value",
                position: "left",
                axisLabel: {
                    formatter: '{value}',
                    fontSize: 15
                },
                nameTextStyle: {
                    fontSize: 20
                },
            },
            {
                name: "总线消息数量",
                type: "value",
                position: "right",
                axisLabel: {
                    formatter: '{value}',
                    fontSize: 15
                },
                nameTextStyle: {
                    fontSize: 20
                },
            },
        ],
        series: [
            {
                name: '共识超时次数',
                type:'line',
                yAxisIndex: 1,
                data: timeoutList,
                lineStyle: {
                    width: 4,
                    color: "purple",
                },
                smooth: false,
                symbolSize: 15,
                color: "purple",
            },
            {
                name: '总线消息数量',
                type:'line',
                yAxisIndex: 1,
                data: messageCountList,
                lineStyle: {
                    width: 4,
                    color: "orange",
                },
                smooth: false,
                symbolSize: 15,
                color: "orange",
            }
        ]
    }

    // 判断应该进行哪种option的返回
    let echartOption = ()=>{
        let isChainMaker = containerName.indexOf("ChainMaker") !== -1
        let isFabric = containerName.indexOf("FabricOrder") !== -1
        if (isChainMaker || isFabric) {
            console.log("is blockchain")
            return interfaceRateAndRatioOption
        } else {
            console.log("is not blockchain")
            return interfaceRateOption
        }
    }


    return (
        <div>
            <Row justify={"center"}>
                <Col span={12}>
                    <Card
                        size={"small"}
                    >
                        <ReactECharts
                            option={echartOption()}
                            style={{height: "30vh", width: "100%"}}
                        >
                        </ReactECharts>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card
                        size={"small"}
                    >
                        <ReactECharts
                            option={cpuAndMemoryRateOption}
                            style={{height: "30vh", width: "100%"}}
                        >
                        </ReactECharts>
                    </Card>
                </Col>
            </Row>
            <Row justify={"center"}>
                <Col span={12}>
                    <Card
                    size={"small"}>
                        <ReactECharts
                        option={tcpConnectedAndHalfConnectedOption}
                        style={{height: "30vh", width: "100%"}}>
                        </ReactECharts>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card
                        size={"small"}>
                        <ReactECharts
                            option={timeoutAndMessageCountOption}
                            style={{height: "30vh", width: "100%"}}>
                        </ReactECharts>
                    </Card>
                </Col>
            </Row>
            <Row justify={"center"} style={{width: "100%"}}>
                <Col span={24}>
                    <Card style={{height:"50vh"}}>
                        <Tabs
                            type="editable-card"
                            style={{width:"100%", height: "50vh"}}
                            activeKey={activeTab}
                            onChange={(newActiveKey)=>{
                                setActiveTab(newActiveKey)
                            }}
                            // onEdit 是点击增加或者删除的按钮
                            onEdit={(targetKey, action) => {
                                // 开启一个新的 webshell
                                if (action === "add") {
                                    AddWebShellLogic()
                                } else if (action === "remove") {
                                    StopWebShellLogic(targetKey)
                                } else {
                                    console.log("unsupported operation")
                                }
                            }}
                            items={tabs}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    )
}