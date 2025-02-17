import React, {useEffect, useState} from "react";
import {Button, Card, Col, Divider, Form, message, Modal, Row, Table} from "antd";
import {InputNumber} from "antd/lib";
import {Entity, PointGraphics, PolylineGraphics, Viewer} from "resium";
import {
    getConstellationStateRequest,
    getInstancePositionsRequest,
    startConstellationRequest,
    stopConstellationRequest
} from "../requests/constellation";
import {Cartesian3} from "cesium";


// Constellation 页面
export function Constellation(props) {
    // 1. 常量的定义
    // ---------------------------------------------------------------------------------------------
    const nameOfForm = "constellation_configuration"
    const orbitNumberField = ["轨道数量", "orbit_number"]
    const satellitePerOrbitField = ["每轨道卫星数量", "satellite_per_orbit"]
    const firstSplitContent = "配置面板"
    const secondSplitContent = "可视化界面"
    // ---------------------------------------------------------------------------------------------

    // 2. 表单结构
    // ---------------------------------------------------------------------------------------------
    const tableColumns = [
        {
            title: "param",
            dataIndex: "paramsDescription",
            key: "paramsDescription"
        },
        {
            title: "value",
            dataIndex: "paramsValue",
            key: "paramsValue"
        }
    ]
    // ---------------------------------------------------------------------------------------------

    // 3. 星座参数
    // ---------------------------------------------------------------------------------------------
    const [orbitNumber, setOrbitNumber] = useState()
    const [satellitePerOrbit, setSatellitePerOrbit] = useState()
    // ---------------------------------------------------------------------------------------------

    // 4.提示框的内容
    // ---------------------------------------------------------------------------------------------
    const promptBoxTypes = {
        startConstellation: Symbol.for("startConstellation"),
        stopConstellation: Symbol.for("stopConstellation"),
    }
    const [promptBoxType, setPromptBoxType] = useState(promptBoxTypes.startConstellation)
    const [promptBoxTitle, setPromptBoxTitle] = useState("Warning");
    const [promptBoxOpen, setPromptBoxOpen] = useState(false)
    const [promptBoxText, setPromptBoxText] = useState("please input the required arguments")
    const [promptBoxOkText, setPromptBoxOkText] = useState("ok")
    const [promptBoxCancelText, setPromptBoxCancelText] = useState("cancel")
    const [promptBoxLoading, setPromptBoxLoading] = useState(false)
    // ---------------------------------------------------------------------------------------------

    // 5. 当前星座的状态 (启动, 未启动)
    // ---------------------------------------------------------------------------------------------
    const [currentConstellationState, setCurrentConstellationState] = useState(false)
    // ---------------------------------------------------------------------------------------------

    // 6. 所有实例的实时位置信息
    // ---------------------------------------------------------------------------------------------
    const [allInstancePositions, setAllInstancePositions] = useState([])
    const [allLinks, setAllLinks] = useState([])
    // ---------------------------------------------------------------------------------------------

    // 7. 获取实例状态的 timer
    // ---------------------------------------------------------------------------------------------
    const [instanceTimer, setInstanceTimer] = useState(null)
    // ---------------------------------------------------------------------------------------------


    // 8. 组件初始化第一步 -> 进行星座状态的获取
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        // 在刚开开始的时候进行星座状态的获取
        GetConstellationState()

        // 卸载的时候触发的回调
        return ()=>{
            if(instanceTimer) {
                clearInterval(instanceTimer)
            }
        }
    }, []);

    function GetConstellationState(){
        getConstellationStateRequest((response)=>{
            if (response.data["state"] === "up"){
                setCurrentConstellationState(true)

                // 进行 timer 的创建
                let timer = setInterval(()=>{
                    getInstancePositions()
                }, 1000)

                // 进行 instanceTimer 的设置
                setInstanceTimer(timer)
            } else if(response.data["state"] === "down") {
                setCurrentConstellationState(false)
            } else {
                message.error({
                    content: "unsupported constellation state"
                })
            }
        }, (error)=>{
            message.error({
                content: "could not get the status from the backend server"
            })
        })
    }
    // ---------------------------------------------------------------------------------------------

    // 9. 获取卫星位置的函数
    // ---------------------------------------------------------------------------------------------
    function getInstancePositions() {
        getInstancePositionsRequest((response)=>{
            let positions = []
            let links = []
            for (let containerName in response.data.positions) {
                let position = (
                    <Entity
                        key={containerName}
                        name={containerName}
                        description={containerName}
                        position={Cartesian3.fromRadians(
                            response.data.positions[containerName]["longitude"],
                            response.data.positions[containerName]["latitude"],
                            response.data.positions[containerName]["altitude"],
                        )}
                    >
                        <PointGraphics pixelSize={10}/>
                    </Entity>
                )
                positions.push(position)
            }

            if(positions.length === 0){
                return
            }

            for (let linkId in response.data.links) {
                let sourceContainerName = response.data.links[linkId][0]
                let targetContainerName = response.data.links[linkId][1]
                let lineData = [
                    response.data.positions[sourceContainerName]["longitude"],
                    response.data.positions[sourceContainerName]["latitude"],
                    response.data.positions[sourceContainerName]["altitude"],
                    response.data.positions[targetContainerName]["longitude"],
                    response.data.positions[targetContainerName]["latitude"],
                    response.data.positions[targetContainerName]["altitude"],
                ]
                let link = (
                    <Entity
                        key={linkId + sourceContainerName + targetContainerName}
                        name={linkId + sourceContainerName + targetContainerName}
                        description={`source node ${sourceContainerName} <----> target node ${targetContainerName}`}
                    >
                        <PolylineGraphics
                            positions={Cartesian3.fromRadiansArrayHeights(lineData)}
                        >
                        </PolylineGraphics>
                    </Entity>
                )
                links.push(link)
            }

            setAllInstancePositions(positions)
            setAllLinks(links)
        }, (error)=>{
            console.log(error)
        })
    }
    // ---------------------------------------------------------------------------------------------


    // 10. 当提示框的ok按钮所对应的处理函数
    // ---------------------------------------------------------------------------------------------
    function handlePromptOkCicked(){
        if (promptBoxType === promptBoxTypes.startConstellation) { // 处理 startConstellation
            setPromptBoxLoading(true)
            const params = {
                orbit_number: orbitNumber,
                satellite_per_orbit: satellitePerOrbit,
            }
            // 进行实际的请求的发送
            startConstellationRequest(params, (response)=>{
                message.success({
                    content: "successfully start the constellation"
                })
                setCurrentConstellationState(true)
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
                // 这个时候再调用周期性进行获取的函数

                // 进行 timer 的创建
                let timer = setInterval(()=>{
                    getInstancePositions()
                }, 1000)

                // 将其设置到 instanceTimer 之中
                setInstanceTimer(timer)

            }, (error)=>{
                message.error({
                    content: `start constellation error ${error}`
                })
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })
        } else if(promptBoxType === promptBoxTypes.stopConstellation) { // 处理 stopConstellation
            setPromptBoxLoading(true)
            // 进行实际的请求的发送
            stopConstellationRequest((response)=>{
                // 停止拓扑成功
                message.success({
                    content: "successfully stop the constellation"
                })
                setCurrentConstellationState(false)
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)

                // 进行周期性计时器的停止
                if(instanceTimer){
                    clearInterval(instanceTimer)
                }

                // 进行页面的强制刷新
                window.location.reload()
            }, (error) => {
                // 停止拓扑失败
                message.error({
                    content: `stop constellation error ${error}`
                })
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)

                // 进行周期性计时器的停止
                if(instanceTimer){
                    clearInterval(instanceTimer)
                }
            })
        } else {
            console.error("unsupported prompt box type")
        }
    }
    // ---------------------------------------------------------------------------------------------

    // 11. 当点击提示框 cancel 按钮所对应的处理函数
    // ---------------------------------------------------------------------------------------------
    function handlePromptCancelClicked(){
        setPromptBoxOpen(false)
    }
    // ---------------------------------------------------------------------------------------------

    // 12. 验证失败所对应的处理函数
    // ---------------------------------------------------------------------------------------------
    function onValidateStartConstellationFailed(){
        setPromptBoxOpen(true)
        setPromptBoxTitle("start constellation failed")
        setPromptBoxText("please finish the selection of required arguments")
    }
    // ---------------------------------------------------------------------------------------------

    // 13. 验证成功开始发送消息
    // ---------------------------------------------------------------------------------------------
    function onStartConstellationFinish(){
        setPromptBoxType(promptBoxTypes.startConstellation)
        let tableValues = [
            {
                key: "1",
                paramsDescription: orbitNumberField[0],
                paramsValue: orbitNumber,
            },
            {
                key: "2",
                paramsDescription: satellitePerOrbitField[0],
                paramsValue: satellitePerOrbit,
            }
        ]
        setPromptBoxOpen(true)
        setPromptBoxTitle("start constellation")
        setPromptBoxText(
            <Table dataSource={tableValues} columns={tableColumns}></Table>
        )
    }
    // ---------------------------------------------------------------------------------------------

    // 14. 当表单内的内容发生变化的时候的对应的处理函数
    // ---------------------------------------------------------------------------------------------
    function onStartConstellationValuesChange(changedValues){
        if(satellitePerOrbitField[1] in changedValues){
            setSatellitePerOrbit(changedValues[satellitePerOrbitField[1]])
        }
        if(orbitNumberField[1] in changedValues){
            setOrbitNumber(changedValues[orbitNumberField[1]])
        }
    }
    // ---------------------------------------------------------------------------------------------

    // 15. stopConstellation 停止星座的回调函数
    // ---------------------------------------------------------------------------------------------
    function stopConstellation(){
        setPromptBoxType(promptBoxTypes.stopConstellation)
        setPromptBoxOpen(true)
        setPromptBoxTitle("stop constellation")
        setPromptBoxText("please decide whether to stop the constellation")
    }
    // ---------------------------------------------------------------------------------------------

    // 16. 真实的前端界面
    // ---------------------------------------------------------------------------------------------
    return (
        <div>
            {/*第1行*/}
            <Row style={{height: "30px"}}>

            </Row>
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
            <Form
                name={nameOfForm}
                onFinishFailed={onValidateStartConstellationFailed}
                onFinish={onStartConstellationFinish}
                onValuesChange={onStartConstellationValuesChange}
                labelCol={{
                    span: 12,
                }}
                wrapperCol={{
                    span: 12,
                }}
            >
                <Row justify={"center"}>
                        <Col span={6}></Col>
                        <Col span={4} style={{textAlign: "center"}}>
                            <Form.Item
                                label={orbitNumberField[0]}
                                name={orbitNumberField[1]}
                                rules={[
                                    {
                                        required: true,
                                        message: "请选择轨道数量"
                                    }
                                ]}
                            >
                                <InputNumber placeholder={orbitNumber} style={{width: "80%"}} changeOnWheel></InputNumber>
                            </Form.Item>
                        </Col>
                        <Col span={4} style={{textAlign: "center"}}>
                            <Form.Item
                                label={satellitePerOrbitField[0]} // 在表单前面的内容
                                name={satellitePerOrbitField[1]}
                                rules={[
                                    {
                                        required: true,
                                        message: "请选择每个轨道的卫星数量"
                                    }
                                ]}
                            >
                                <InputNumber placeholder={satellitePerOrbit} style={{width: "80%"}} changeOnWheel></InputNumber>
                            </Form.Item>
                        </Col>
                        <Col span={2} style={{textAlign: "center"}}>
                            <Button type={"primary"} htmlType={"submit"} disabled={currentConstellationState} style={{width: "80%"}}>
                                启动星座
                            </Button>
                        </Col>
                        <Col span={2} style={{textAlign: "center"}}>
                            <Button type={"primary"} danger style={{width:"80%"}} disabled={!currentConstellationState} onClick={stopConstellation}>
                                销毁星座
                            </Button>
                        </Col>
                        <Col span={6}>

                        </Col>
                </Row>
            </Form>
            <Row>
                <Divider
                    style={{
                        borderColor: '#7cb305',
                    }}
                >
                    {secondSplitContent}
                </Divider>
            </Row>
            <Card>
                <Viewer style={{height: "62.4vh"}} timeline={false} homeButton={false} geocoder={false} animation={false} navigationHelpButton={false} fullscreenButton={false}>
                    {allInstancePositions}
                    {allLinks}
                </Viewer>
            </Card>
            {/*提示框*/}
            <Modal
                title={promptBoxTitle}
                open={promptBoxOpen} // 是否进行开启
                onOk={handlePromptOkCicked}
                onCancel={handlePromptCancelClicked}
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