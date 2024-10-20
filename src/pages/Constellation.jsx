import React, {useState} from "react";
import {Button, Card, Col, Divider, Form, message, Modal, Row, Table} from "antd";
import {InputNumber} from "antd/lib";
import {Viewer} from "resium";
import {startConstellationRequest, stopConstellationRequest} from "../requests/constellation";


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
    const [promptBoxType, setPromptBoxType] = useState()
    const [promptBoxTitle, setPromptBoxTitle] = useState("Warning");
    const [promptBoxOpen, setPromptBoxOpen] = useState(false)
    const [promptBoxText, setPromptBoxText] = useState("please input the required arguments")
    const [promptBoxOkText, setPromptBoxOkText] = useState("ok")
    const [promptBoxCancelText, setPromptBoxCancelText] = useState("cancel")
    const [promptBoxLoading, setPromptBoxLoading] = useState(false)

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
            <Table dataSource={tableValues}
                   columns={tableColumns}>
            </Table>
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
                            <Button type={"primary"} htmlType={"submit"} style={{width: "80%"}}>
                                start
                            </Button>
                        </Col>
                        <Col span={2} style={{textAlign: "center"}}>
                            <Button type={"primary"} danger style={{width:"80%"}} onClick={stopConstellation}>
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