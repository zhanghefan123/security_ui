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
    // 参数
    const nameOfForm = "constellation_configuration"
    const orbitNumberField = "orbit_number"
    const satellitePerOrbitField = "satellite_per_orbit"
    const firstSplitContent = "配置面板"
    const secondSplitContent = "可视化界面"
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
    const [orbitNumber, setOrbitNumber] = useState()
    const [satellitePerOrbit, setSatellitePerOrbit] = useState()

    // 提示框的内容
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

    // 当前星座的状态
    const [currentConstellationState, setCurrentConstellationState] = useState(false)

    // 所有实例的实时位置信息
    const [allInstancePositions, setAllInstancePositions] = useState([])
    const [allLinks, setAllLinks] = useState([])


    // 开始的时候周期性的进行获取
    useEffect(() => {
        // 在开启的时候获取状态
        GetConstellationState()

        // 在开启的时候请求
        let timer = setInterval(()=>{
            getInstancePositions()
        }, 1000)

        // 卸载的时候触发的回调
        return ()=>{
            clearInterval(timer)
        }
    }, []);

    // 进行卫星星座的状态的获取
    function GetConstellationState(){
        getConstellationStateRequest((response)=>{
            if (response.data["state"] === "up"){
                setCurrentConstellationState(true)
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

    // 获取卫星位置
    // 获取实例的实时的位置
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


    // 提示框处理函数1
    function handlePromptOkCicked(){
        if (promptBoxType === promptBoxTypes.startConstellation) { // 处理 startConstellation
            setPromptBoxLoading(true)
            const params = {
                orbit_number: orbitNumber,
                satellite_per_orbit: satellitePerOrbit,
            }
            startConstellationRequest(params, (response)=>{
                message.success({
                    content: "successfully start the constellation"
                })
                setCurrentConstellationState(true)
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            }, (error)=>{
                message.error({
                    content: `start constellation error ${error}`
                })
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })
        } else if(promptBoxType === promptBoxTypes.stopConstellation) { // 处理 stopConstellation
            setPromptBoxLoading(true)
            stopConstellationRequest((response)=>{
                message.success({
                    content: "successfully stop the constellation"
                })
                setCurrentConstellationState(false)
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            }, (error) => {
                message.error({
                    content: `stop constellation error ${error}`
                })
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })
        } else {
            console.error("unsupported prompt box type")
        }

    }

    // 提示框处理函数2
    function handlePromptCancelClicked(){
        setPromptBoxOpen(false)
    }

    // 验证失败 -> 开启提示框
    function onValidateStartConstellationFailed(){
        setPromptBoxOpen(true)
        setPromptBoxTitle("start constellation failed")
        setPromptBoxText("please finish the selection of required arguments")
    }

    // 验证成功开始发送消息
    function onStartConstellationFinish(){
        setPromptBoxType(promptBoxTypes.startConstellation)
        let tableValues = [
            {
                key: "1",
                paramsDescription: orbitNumberField,
                paramsValue: orbitNumber,
            },
            {
                key: "2",
                paramsDescription: satellitePerOrbitField,
                paramsValue: satellitePerOrbit,
            }
        ]
        setPromptBoxOpen(true)
        setPromptBoxTitle("start constellation")
        setPromptBoxText(
            <Table dataSource={tableValues} columns={tableColumns}></Table>
        )
    }

    // 当值发生变化的时候进行的操作
    function onStartConstellationValuesChange(changedValues){
        if(satellitePerOrbitField in changedValues){
            setSatellitePerOrbit(changedValues[satellitePerOrbitField])
        }
        if(orbitNumberField in changedValues){
            setOrbitNumber(changedValues[orbitNumberField])
        }
    }

    // stopConstellation 停止星座
    function stopConstellation(){
        setPromptBoxType(promptBoxTypes.stopConstellation)
        setPromptBoxOpen(true)
        setPromptBoxTitle("stop constellation")
        setPromptBoxText("please decide whether to stop the constellation")
    }

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
                name={{nameOfForm}}
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
                                label={orbitNumberField}
                                name={orbitNumberField}
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
                                label={satellitePerOrbitField} // 在表单前面的内容
                                name={satellitePerOrbitField}
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
                                start
                            </Button>
                        </Col>
                        <Col span={2} style={{textAlign: "center"}}>
                            <Button type={"primary"} danger style={{width:"80%"}} disabled={!currentConstellationState} onClick={stopConstellation}>
                                stop
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
                <Viewer style={{height: "500px"}} timeline={false} homeButton={false} geocoder={false} animation={false} navigationHelpButton={false} fullscreenButton={false}>
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
}