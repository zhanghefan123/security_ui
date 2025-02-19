import React, {useEffect, useRef, useState} from "react";
import {Button, Card, Col, Divider, Form, message, Modal, Row, Select, Table} from "antd";
import {InputNumber} from "antd/lib";
import {BoxGraphics, Entity, PointGraphics, PolylineGraphics, Viewer} from "resium";
import {
    getAvailableGroundStations,
    getConstellationStateRequest,
    getInstancePositionsRequest,
    startConstellationRequest,
    stopConstellationRequest
} from "../requests/constellation";
import {Cartesian3, ScreenSpaceEventHandler, ScreenSpaceEventType} from "cesium";
import * as Cesium from "cesium";
import {ProForm} from "@ant-design/pro-components";

// react for cesium 官方参考网址 https://resium.reearth.io/components/PointGraphics

// Constellation 页面
export function Constellation(props) {
    // 对视图的引用
    const viewerRef = useRef(null);

    // 1. 常量的定义
    // ---------------------------------------------------------------------------------------------
    const nameOfForm = "constellation_configuration"
    const orbitNumberFieldName = ["轨道数量", "orbit_number"]
    const satellitePerOrbitFieldName = ["每轨道卫星数量", "satellite_per_orbit"]
    const groundStationsFieldName = ["地面站列表", "ground_stations"]
    const firstSplitContent = "配置面板"
    const secondSplitContent = "可视化界面"
    // ---------------------------------------------------------------------------------------------

    // 2. 表单结构
    // ---------------------------------------------------------------------------------------------
    const [startConstellationForm] = ProForm.useForm()
    const tableColumns = [
        {
            title: "参数",
            dataIndex: "paramsDescription",
            key: "paramsDescription"
        },
        {
            title: "参数值",
            dataIndex: "paramsValue",
            key: "paramsValue"
        }
    ]
    // ---------------------------------------------------------------------------------------------

    // 3. 星座参数
    // ---------------------------------------------------------------------------------------------
    const [orbitNumber, setOrbitNumber] = useState(1)
    const [satellitePerOrbit, setSatellitePerOrbit] = useState(11)
    const [availableGroundStations, setAvailableGroundStations] = useState([])
    const [availableGroundStationsMapping, setAvailableGroundStationsMapping] = useState({})
    const [selectedGroundStations, setSelectedGroundStations] = useState([])
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

    // 8. 控制组件初始化步骤的状态
    // ---------------------------------------------------------------------------------------------
    const [alreadyGetPosition, setAlreadyGetPosition] = useState(0)
    // ---------------------------------------------------------------------------------------------

    // 8. 组件初始化第一步 -> 进行星座状态的获取, 以及可选的地面站的获取
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        // 在刚开始的时候进行星座状态的获取
        GetConstellationState()

        // 在刚开始的时候进行可选的地面站的获取
        GetAvailableGroundStations()

        // 注册监听器 -> 这里进行延迟加载
        setTimeout(() => {
            registerHandler()
        }, 50)

        // 卸载的时候触发的回调
        return () => {
            if (instanceTimer) {
                clearInterval(instanceTimer)
            }
        }
    }, []);

    // registerHandler 注册处理器
    function registerHandler() {
        const viewer = viewerRef.current.cesiumElement
        const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)

        // 监听点击事件
        handler.setInputAction((movement) => {
            let pick = viewer.scene.pick(movement.position)
            let entity = pick.id
            // 如果是红色的话那么转为绿色
            if (entity.box) {
                if (Cesium.Color.equals(entity.box.material.color._value, Cesium.Color.RED)) {
                    // 从红色转绿色, 将地面站添加到地面站列表之中
                    entity.box.material = Cesium.Color.GREEN.withAlpha(1)
                    // 进行state的更新
                    setSelectedGroundStations(prevSelectedGroundStations => {
                        startConstellationForm.setFieldsValue({
                            "地面站列表": [...prevSelectedGroundStations, entity.name]
                        })
                        return [...prevSelectedGroundStations, entity.name]
                    })
                } else {
                    // 从绿色转红色, 将地面站从地面站列表之中移除
                    entity.box.material = Cesium.Color.RED.withAlpha(1)
                    // 进行 state 和表单内字段的更新
                    setSelectedGroundStations(prevSelectedGroundStations => {
                            // 找到相应的元素的位置
                            let index = prevSelectedGroundStations.indexOf(entity.name)
                            // 已经找到了相应的元素
                            if (index > -1) {
                                // 利用这个位置进行删除
                                prevSelectedGroundStations.splice(index, 1)
                                // 需要调用 react 自己的方法进行设置
                                startConstellationForm.setFieldsValue({
                                    "地面站列表": [...prevSelectedGroundStations]
                                })
                            } else { // 如果没有找到相应的元素则需要进行报错
                                message.error({
                                    content: "cannot find the ground station"
                                })
                            }
                            return [...prevSelectedGroundStations]
                        }
                    )
                }
            }
        }, ScreenSpaceEventType.RIGHT_CLICK);
    }

    // 获取星座的状态
    function GetConstellationState() {
        getConstellationStateRequest((response) => {
            if (response.data["state"] === "up") {
                setCurrentConstellationState(true)

                // 进行 timer 的创建
                let timer = setInterval(() => {
                    getInstancePositions()
                }, 1000)

                // 进行 instanceTimer 的设置
                setInstanceTimer(timer)
            } else if (response.data["state"] === "down") {
                setCurrentConstellationState(false)
            } else {
                message.error({
                    content: "unsupported constellation state"
                })
            }
        }, (error) => {
            message.error({
                content: "could not get the status from the backend server"
            })
        })
    }

    function GetAvailableGroundStations() {
        getAvailableGroundStations((response) => {
            let ground_stations = response.data["ground_stations"]
            for (let i = 0; i < ground_stations.length; i++) {
                let groundStationMap = ground_stations[i]
                let groundStationInstance = {
                    name: groundStationMap["name"],
                    longitude: parseFloat(groundStationMap["longitude"]),
                    latitude: parseFloat(groundStationMap["latitude"]),
                }
                setAvailableGroundStations(prevAvailableGroundStations => {
                    return [...prevAvailableGroundStations, groundStationInstance]
                })
                setAvailableGroundStationsMapping(prevAvailableGroundStationsMapping => {
                    return {
                        ...prevAvailableGroundStationsMapping,
                        [groundStationInstance["name"]]: groundStationInstance
                    }
                })
            }
            // 许可进入组件初始化的第二步
            setAlreadyGetPosition(1)
        }, (error) => {
            message.error({
                content: "cannot retrieve available ground_stations"
            })
        })
    }

    // ---------------------------------------------------------------------------------------------

    // 8. 组件初始化第二步 -> 将获取到的可选地面站的列表放到图中
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        if (1 === alreadyGetPosition) {
            let positions = []
            for (let index in availableGroundStations) {
                let availableGroundStation = availableGroundStations[index]
                // Entity 的 id 属性是为了进行 getById 的唯一的查找
                let position = (
                    <Entity
                        id={availableGroundStation.name}
                        key={availableGroundStation.name}
                        name={availableGroundStation.name}
                        description={availableGroundStation.name}
                        position={Cartesian3.fromRadians(
                            availableGroundStation.longitude,
                            availableGroundStation.latitude,
                            0,
                        )}
                    >

                        <BoxGraphics
                            dimensions={new Cesium.Cartesian3(100000, 100000, 100000)} // 长、宽、高均为 10 米
                            material={Cesium.Color.RED.withAlpha(1)}     // 颜色和透明度, 注意当一开始没有任何地面站被选中, 所以地面站的颜色为红色
                            outline={true}                                 // 显示边框
                            outlineColor={Cesium.Color.BLACK}
                            fill={true}
                        />
                        {/*<PointGraphics*/}
                        {/*    pixelSize={10}*/}
                        {/*    color={Cesium.Color.RED.withAlpha(0.5)}*/}
                        {/*/>*/}
                    </Entity>
                )
                positions.push(position)
            }
            setAllInstancePositions(positions)
        }
    }, [alreadyGetPosition])
    // ---------------------------------------------------------------------------------------------

    // 9. 获取卫星位置的函数
    // ---------------------------------------------------------------------------------------------
    function getInstancePositions() {
        getInstancePositionsRequest((response) => {
            let positions = []
            let links = []

            // 进行节点的放置
            // --------------------------------------------------------------------
            for (let containerName in response.data.positions) {
                // Entity 的 id 属性是为了进行 getById 的唯一的查找
                let position = undefined
                // 进行节点类型名的获取
                let typeName = response.data.positions[containerName]["node_type"]
                if ("NormalSatellite" === typeName) {
                    // 如果是卫星
                    position = (
                        <Entity
                            id={containerName}
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
                } else {
                    // 如果是地面站
                    position = (
                        <Entity
                            id={containerName}
                            key={containerName}
                            name={containerName}
                            description={containerName}
                            position={Cartesian3.fromRadians(
                                response.data.positions[containerName]["longitude"],
                                response.data.positions[containerName]["latitude"],
                                response.data.positions[containerName]["altitude"]
                            )}
                        >
                            {/*<PointGraphics pixelSize={10}/>*/}
                            <BoxGraphics
                                dimensions={new Cesium.Cartesian3(100000, 100000, 100000)} // 长、宽、高均为 100000 米
                                material={Cesium.Color.GREEN.withAlpha(1)}     // 颜色和透明度, 注意当一开始没有任何地面站被选中, 所以地面站的颜色为红色
                                outline={true}                                 // 显示边框
                                outlineColor={Cesium.Color.BLACK} // 边框颜色
                                fill={true} // 是否进行填充
                            />
                        </Entity>
                    )
                }
                positions.push(position)
            }

            // 如果没有则进行返回
            if (positions.length === 0) {
                return
            }
            // --------------------------------------------------------------------

            // 进行链路的放置
            // --------------------------------------------------------------------
            // 进行星地链路的处理
            for(let linkId in response.data.gsls) {
                let sourceContainerName = response.data.gsls[linkId][0]
                let targetContainerName = response.data.gsls[linkId][1]
                let lineData = [
                    response.data.positions[sourceContainerName]["longitude"],
                    response.data.positions[sourceContainerName]["latitude"],
                    response.data.positions[sourceContainerName]["altitude"],
                    response.data.positions[targetContainerName]["longitude"],
                    response.data.positions[targetContainerName]["latitude"],
                    response.data.positions[targetContainerName]["altitude"],
                ]
                let GSL = (
                    <Entity
                        key={linkId + sourceContainerName + targetContainerName}
                        name={linkId + sourceContainerName + targetContainerName}
                        description={`source node ${sourceContainerName} <----> target node ${targetContainerName}`}
                    >
                        <PolylineGraphics
                            positions={Cartesian3.fromRadiansArrayHeights(lineData)}
                            material={Cesium.Color.ORANGE.withAlpha(1)}
                        >
                        </PolylineGraphics>
                    </Entity>
                )
                links.push(GSL)
            }


            // 进行星间链路的处理
            for (let linkId in response.data.isls) {
                let sourceContainerName = response.data.isls[linkId][0]
                let targetContainerName = response.data.isls[linkId][1]
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
                            material={Cesium.Color.GREEN.withAlpha(1)}
                        >
                        </PolylineGraphics>
                    </Entity>
                )
                links.push(link)
            }
            // --------------------------------------------------------------------

            setAllInstancePositions(positions)
            setAllLinks(links)
        }, (error) => {
            console.log(error)
        })
    }

    // ---------------------------------------------------------------------------------------------


    // 10. 当提示框的ok按钮所对应的处理函数
    // ---------------------------------------------------------------------------------------------
    function handlePromptOkCicked() {
        if (promptBoxType === promptBoxTypes.startConstellation) { // 处理 startConstellation
            // 设置对话框进行显示
            setPromptBoxLoading(true)
            // 创建出选择出来的地面站信息
            let selectedGroundStationInstances = []
            // 进行遍历将选择出来的实例找出来
            for (let index in selectedGroundStations) {
                let groundStationName = selectedGroundStations[index]
                selectedGroundStationInstances.push(availableGroundStationsMapping[groundStationName])
            }
            // 进行参数的设置
            const params = {
                [orbitNumberFieldName[1]]: orbitNumber,
                [satellitePerOrbitFieldName[1]]: satellitePerOrbit,
                [groundStationsFieldName[1]]: selectedGroundStationInstances
            }
            // 进行实际的请求的发送
            startConstellationRequest(params, (response) => {
                // 说明已经成功启动了星座
                message.success({
                    content: "successfully start the constellation"
                })
                // 设置当前星座的状态
                setCurrentConstellationState(true)
                // 去掉加载状态
                setPromptBoxLoading(false)
                // 进行对话框的关闭
                setPromptBoxOpen(false)
                // 进行 timer 的创建
                let timer = setInterval(() => {
                    getInstancePositions()
                }, 1000)
                // 将其设置到 instanceTimer 之中
                setInstanceTimer(timer)
            }, (error) => {
                // 说明启动星座失败
                message.error({
                    content: `start constellation error ${error}`
                })
                // 去掉对话框的加载状态
                setPromptBoxLoading(false)
                // 进行对话框的关闭
                setPromptBoxOpen(false)
            })
        } else if (promptBoxType === promptBoxTypes.stopConstellation) { // 处理 stopConstellation
            // 设置对话框的显示
            setPromptBoxLoading(true)
            // 进行实际的请求的发送
            stopConstellationRequest((response) => {
                // 停止拓扑成功
                message.success({
                    content: "successfully stop the constellation"
                })
                setCurrentConstellationState(false)
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)

                // 进行周期性计时器的停止
                if (instanceTimer) {
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
                if (instanceTimer) {
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
    function handlePromptCancelClicked() {
        setPromptBoxOpen(false)
    }

    // ---------------------------------------------------------------------------------------------

    // 12. 验证失败所对应的处理函数
    // ---------------------------------------------------------------------------------------------
    function onValidateStartConstellationFailed() {
        setPromptBoxOpen(true)
        setPromptBoxTitle("start constellation failed")
        setPromptBoxText("please finish the selection of required arguments")
    }

    // ---------------------------------------------------------------------------------------------

    // 13. 验证成功开始发送消息
    // ---------------------------------------------------------------------------------------------
    function onStartConstellationFinish() {
        setPromptBoxType(promptBoxTypes.startConstellation)
        let tableValues = [
            {
                key: "1",
                paramsDescription: orbitNumberFieldName[0],
                paramsValue: orbitNumber,
            },
            {
                key: "2",
                paramsDescription: satellitePerOrbitFieldName[0],
                paramsValue: satellitePerOrbit,
            },
            {
                key: "3",
                paramsDescription: groundStationsFieldName[0],
                paramsValue: selectedGroundStations.join(",")
            }
        ]
        setPromptBoxOpen(true)
        setPromptBoxTitle("启动星座")
        setPromptBoxText(
            <Table dataSource={tableValues} columns={tableColumns}></Table>
        )
    }

    // ---------------------------------------------------------------------------------------------

    // 14. 当表单内的内容发生变化的时候的对应的处理函数
    // ---------------------------------------------------------------------------------------------
    function onStartConstellationValuesChange(changedValues) {
        // 实时更新轨道数量
        if (orbitNumberFieldName[0] in changedValues) {
            setOrbitNumber(changedValues[orbitNumberFieldName[0]])
        }
        // 实时更新每轨道卫星数量
        if (satellitePerOrbitFieldName[0] in changedValues) {
            setSatellitePerOrbit(changedValues[satellitePerOrbitFieldName[0]])
        }
        // 实时更新选择的地面站
        if (groundStationsFieldName[0] in changedValues) {
            // 进行 viewer 的获取
            const viewer = viewerRef.current.cesiumElement
            // 进行 state 的更新
            setSelectedGroundStations(changedValues[groundStationsFieldName[0]])
            // 进行所有的遍历
            for (let index = 0; index < availableGroundStations.length; index++) {
                // 进行名称的获取
                let groundStationName = availableGroundStations[index].name
                // 进行实体的获取
                let entity = viewer.entities.getById(groundStationName)
                // 判断是否在选择的列表之中
                if (changedValues[groundStationsFieldName[0]].includes(groundStationName)) {
                    // 如果在列表之中 -> 切换为绿色
                    entity.box.material = Cesium.Color.GREEN.withAlpha(1)
                } else {
                    // 如果不在列表之中 -> 切换为红色
                    entity.box.material = Cesium.Color.RED.withAlpha(1)
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------------

    // 15. stopConstellation 停止星座的回调函数
    // ---------------------------------------------------------------------------------------------
    function stopConstellation() {
        setPromptBoxType(promptBoxTypes.stopConstellation)
        setPromptBoxOpen(true)
        setPromptBoxTitle("停止星座")
        setPromptBoxText("请选择是否停止星座")
    }

    // ---------------------------------------------------------------------------------------------

    // 17. 真实的前端界面
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
                form={startConstellationForm}
                name={nameOfForm}
                onFinishFailed={onValidateStartConstellationFailed}
                onFinish={onStartConstellationFinish}
                onValuesChange={onStartConstellationValuesChange}
                labelCol={{
                    span: 6,
                }}
                wrapperCol={{
                    span: 18,
                }}
                initialValues={{
                    [orbitNumberFieldName[0]]: orbitNumber,
                    [satellitePerOrbitFieldName[0]]: satellitePerOrbit,
                    [groundStationsFieldName[0]]: selectedGroundStations
                }}
            >
                <Row style={{marginBottom: "-25px"}}>
                    <Col span={2}>

                    </Col>
                    <Col span={14}>
                        <Row justify={"center"}>
                            {/*<Col span={6}></Col>*/}
                            <Col span={2}></Col>
                            <Col span={11} style={{textAlign: "center"}}>
                                <Form.Item
                                    label={orbitNumberFieldName[0]}
                                    name={orbitNumberFieldName[0]}
                                    rules={[
                                        {
                                            required: true,
                                            message: "请选择轨道数量"
                                        }
                                    ]}
                                >
                                    <InputNumber style={{width: "100%"}} changeOnWheel></InputNumber>
                                </Form.Item>
                            </Col>
                            <Col span={11} style={{textAlign: "center"}}>
                                <Form.Item
                                    label={satellitePerOrbitFieldName[0]} // 在表单前面的内容
                                    name={satellitePerOrbitFieldName[0]}
                                    rules={[
                                        {
                                            required: true,
                                            message: "请选择每个轨道的卫星数量"
                                        }
                                    ]}
                                >
                                    <InputNumber style={{width: "100%"}} changeOnWheel></InputNumber>
                                </Form.Item>
                            </Col>

                            {/*<Col span={2}>*/}

                            {/*</Col>*/}
                        </Row>
                        <Row justify={"center"}>
                            <Col span={2}>

                            </Col>
                            <Col span={22}>
                                <Form.Item
                                    label={groundStationsFieldName[0]}
                                    name={groundStationsFieldName[0]}
                                    labelCol={{
                                        span: 3,
                                    }}
                                    wrapperCol={{
                                        span: 21,
                                    }}
                                >
                                    <Select
                                        mode="multiple"
                                        allowClear={true}
                                        style={{width: '100%'}}
                                        options={availableGroundStations.map((availableGroundStation) => ({
                                            label: availableGroundStation.name,
                                            value: availableGroundStation.name,
                                        }))}
                                    >
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>
                    </Col>
                    <Col span={4}>
                        <Row justify={"center"} style={{width: "100%", height: "50%"}}>
                            <Col span={24} style={{textAlign: "center"}}>
                                <Button type={"primary"} htmlType={"submit"} disabled={currentConstellationState}
                                        style={{width: "80%"}}>
                                    启动星座
                                </Button>
                            </Col>
                        </Row>
                        <Row>
                            <Col span={24} style={{textAlign: "center", height: "50%"}}>
                                <Button type={"primary"} danger style={{width: "80%"}}
                                        disabled={!currentConstellationState} onClick={stopConstellation}>
                                    销毁星座
                                </Button>
                            </Col>
                        </Row>
                    </Col>
                    <Col span={2}>

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
                <Row span={24}>
                    <Viewer ref={viewerRef} style={{height: "60.4vh", width: "100%"}} timeline={false}
                            homeButton={false} geocoder={false} animation={false} navigationHelpButton={false}
                            fullscreenButton={false}>
                        {allInstancePositions}
                        {allLinks}
                    </Viewer>
                </Row>
            </Card>


            {/*提示框*/}
            {/*---------------------------------------------------------------------------------------------*/}
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
            {/*---------------------------------------------------------------------------------------------*/}
        </div>
    )
    // ---------------------------------------------------------------------------------------------
}