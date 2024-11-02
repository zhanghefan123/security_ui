import {Card, Row, Tabs, Typography, message} from "antd";
import {useEffect, useState} from "react";
import {startWebShell, stopWebShell} from "../requests/instance"
import {useParams} from "react-router-dom";

export function Instance(props) {

    // 1. 从 url 之中获取到的一些参数
    const containerName= useParams().containerName

    // 2. 一些状态属性
    const [tabs, setTabs] = useState([])
    const [activeTab, setActiveTab] = useState()

    // 3. 上来就加载一个默认的界面
    useEffect(() => {
        AddWebShellLogic()
    }, [])

    // 4. 添加的逻辑
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

    // 5. 删除的逻辑
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


    return (
        <div>
            <Row justify="center">
                <Typography.Title level={4}>WebShell</Typography.Title>
                <Card style={{width:"90vw",marginLeft:"5vw",marginRight:"5vw", height:"30vw"}}>
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
            </Row>
        </div>
    )
}