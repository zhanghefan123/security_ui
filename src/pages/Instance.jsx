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
    const [rateList, setRateList] = useState([])

    // 3. 上来就加载一个默认的界面
    useEffect(() => {
        // 3.1 为相应的容器开启第一个 webshell
        AddWebShellLogic()

        // 3.2 开启抓包线程
        let captureTimer = setInterval(()=>{
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
                clearInterval(captureTimer)
            })
        }
    }, [])

    // 4. 开启抓包
    function StartCapture() {
        let params = {
            container_name: containerName.replace("_", "-")
        }
        startCaptureInterfaceRate(params, (response)=>{
            // console.log("成功开启监听")
            setTimeList(response.data["time_list"])
            setRateList(response.data["rate_list"])
        }, (error)=>{
            message.error({
                content: "监听失败"
            })
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
            "container_name":realContainerName
        }
        startWebShell(params, (response)=>{
            const webShellInfo = response.data
            let largestKey = undefined
            if (tabs.length === 0){
                largestKey = 0
            } else {
                largestKey = parseInt(tabs[tabs.length-1].key.split("-")[1])
            }
            const newKey = `${realContainerName}-${largestKey + 1}`
            const url = `http://${webShellInfo.address}:${webShellInfo.port}`
            setTabs([...tabs, {
                key: newKey,
                label: newKey,
                children: <Row justify="center">
                    <iframe style={{width:"80vw",height:"25vw"}} src={url}/>
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
    const rateOption = {
        title: {
            text: '节点被攻击速率'
        },
        tooltip: {},
        legend: {
            data:['节点被攻击速率']
        },
        xAxis: {
            data: timeList
        },
        yAxis: {},
        series: [{
            name: 'CPU使用率',
            type:'line',
            data: rateList
        }]
    }


    return (
        <div>
            <Row justify={"center"}>
                <Col span={12}>
                    <Card>
                        <ReactECharts
                            option={rateOption}
                            style={{height: "30vh", width: "40vw"}}
                        >

                        </ReactECharts>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card>
                        <ReactECharts
                            option={rateOption}
                            style={{height: "30vh", width: "40vw"}}
                        >
                        </ReactECharts>
                    </Card>

                </Col>
            </Row>
            <Row justify={"center"} style={{width: "100%"}}>
                <Col span={24}>
                    <Card style={{height:"30vw"}}>
                        <Tabs
                            type="editable-card"
                            style={{width:"100%"}}
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