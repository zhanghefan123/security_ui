import React, {useEffect, useRef, useState} from "react";
import {Button, Card, Form, message, Modal, Progress, Select, Slider, Switch, Table} from "antd";
import {InputNumber} from "antd/lib";
import {BoxGraphics, Entity, PointGraphics, Viewer} from "resium";
import {
    changeTimeStepRequest,
    getAvailableGroundStations,
    getConstellationStateRequest,
    getInstancePositionsRequest,
    getStopProgressRequest,
    startConstellationRequest,
    stopConstellationRequest
} from "../requests/constellation";
import * as Cesium from "cesium";
import {Cartesian3, ScreenSpaceEventHandler, ScreenSpaceEventType, Transforms} from "cesium";
import {ProForm} from "@ant-design/pro-components";
import {GlobalOutlined} from "@ant-design/icons";
import {ConstellationLabelContext, ConstellationNameLabel} from "./ConstellationLabels";
import {ConstellationContextMenu} from "./ConstellationContextMenu";
import {ConstellationOrbitSettings, DEFAULT_ORBIT_CONFIG} from "./ConstellationOrbitSettings";
import {ConstellationOrbits} from "./ConstellationOrbits";
import {ConstellationTrafficCard, ConstellationTrafficContext, ConstellationTrafficLink, ConstellationTrafficPanel, useConstellationTraffic} from "./ConstellationTraffic";
import "./Constellation.css";

// react for cesium 官方参考网址 https://resium.reearth.io/components/PointGraphics

// 星座启动/初始化各步骤的中文名称，用于进度条展示
const CONSTELLATION_STEP_LABELS = {
    SetHostReceiveMemory: "设置接收缓存",
    GenerateSatellites: "生成卫星",
    GenerateGroundStations: "生成地面站",
    GenerateSubnets: "生成子网",
    GenerateISLs: "生成星间链路",
    GenerateGSLs: "生成星地链路",
    GenerateFrrConfigurationFiles: "生成 FRR 配置",
    GenerateAddressMapping: "生成地址映射",
    GeneratePortMapping: "生成端口映射",
    CalculateAndWriteSegmentRoutes: "计算段路由",
    CalculateAndWriteLiRRoutes: "计算 LiR 路由",
    GenerateIfnameToLinkIdentifierMapping: "生成接口映射",
    GenerateSatelliteLinks: "生成卫星 veth",
    StartSatelliteContainers: "启动卫星容器",
    StartGroundStationContainers: "启动地面站容器",
    SetVethNameSpaces: "设置 veth 命名空间",
    StartEtcdService: "启动 Etcd 服务",
    StoreToEtcd: "写入 Etcd",
    CreateServiceContext: "创建服务上下文",
    InitializeISLVisibility: "初始化星间链路可视性",
    StartPositionService: "启动位置服务",
    StartUpdateDelayService: "启动延迟更新服务",
};

// Constellation 页面
export function Constellation(props) {
    const [controlsCollapsed, setControlsCollapsed] = useState(false);
    // 0. 对视图的引用
    // ---------------------------------------------------------------------------------------------
    const viewerRef = useRef(null);
    // ---------------------------------------------------------------------------------------------

    // 1. 常量的定义
    // ---------------------------------------------------------------------------------------------
    const nameOfForm = "constellation_configuration"
    const orbitNumberFieldName = ["轨道数量", "orbit_number"]
    const satellitePerOrbitFieldName = ["每轨道卫星数量", "satellite_per_orbit"]
    const groundStationsFieldName = ["地面站列表", "ground_stations"]
    const timeStepFieldName = ["步长", "time_step"]
    const minimumElevationAngleFieldName = ["最小仰角", "minimum_elevation_angle"]
    const displayProjectionFieldName = ["显示覆盖范围", "display_projection"]
    const firstSplitContent = "配置面板"
    const secondSplitContent = "可视化界面"
    const ellipsoid = Cesium.Ellipsoid.WGS84;
    const R_EARTH = ellipsoid.maximumRadius;
    const MIN_ELEVATION_ANGLE = 5
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
    const [orbitConfig, setOrbitConfig] = useState({...DEFAULT_ORBIT_CONFIG});
    const [availableGroundStations, setAvailableGroundStations] = useState([])
    const [availableGroundStationsMapping, setAvailableGroundStationsMapping] = useState({})
    const [selectedGroundStations, setSelectedGroundStations] = useState([])
    const [selectedTimeStep, setSelectedTimestep] = useState(1)
    const [selectedMinimumElevationAngle, setSelectedMinimumElevationAngle] = useState(5)
    const [displayProjection, setDisplayProjection] = useState(false)
    const [showSatelliteNames, setShowSatelliteNames] = useState(true)
    const [showGroundStationNames, setShowGroundStationNames] = useState(true)
    const [showOrbits, setShowOrbits] = useState(true)
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

    // 4.5 销毁进度
    // ---------------------------------------------------------------------------------------------
    const [stopProgressPercent, setStopProgressPercent] = useState(0)
    const [stopProgressStep, setStopProgressStep] = useState("")
    const [stopInProgress, setStopInProgress] = useState(false)
    const stopProgressTimerRef = useRef(null)
    // ---------------------------------------------------------------------------------------------

    // 5. 当前星座的状态 (启动, 未启动)
    // ---------------------------------------------------------------------------------------------
    const [currentConstellationState, setCurrentConstellationState] = useState(false)
    const [constellationNeedsCleanup, setConstellationNeedsCleanup] = useState(false)
    const [contextMenu, setContextMenu] = useState(null);
    const [trafficSource, setTrafficSource] = useState(null);
    const trafficEnabled = currentConstellationState && !constellationNeedsCleanup && !stopInProgress;
    const traffic = useConstellationTraffic(trafficEnabled);
    useEffect(() => { if (!trafficEnabled) setTrafficSource(null); }, [trafficEnabled]);
    const interactionStateRef = useRef(null);
    interactionStateRef.current = {
        canOpen: currentConstellationState && !constellationNeedsCleanup && !stopInProgress && !promptBoxLoading,
        canEdit: !currentConstellationState && !constellationNeedsCleanup && !stopInProgress && !promptBoxLoading,
        selectedGroundStations,
        statusText: constellationNeedsCleanup ? "待清理" : stopInProgress ? "停止中" : currentConstellationState ? "星座已启动" : "未启动",
    };
    useEffect(() => { setContextMenu(null); }, [currentConstellationState, constellationNeedsCleanup, stopInProgress, promptBoxLoading, selectedGroundStations]);
    // ---------------------------------------------------------------------------------------------

    // 6. 所有实例的实时位置信息
    // ---------------------------------------------------------------------------------------------
    const [allInstancePositions, setAllInstancePositions] = useState([])
    const [allLinks, setAllLinks] = useState([])
    const [orbitPositions, setOrbitPositions] = useState({})
    useEffect(() => {
        if (!currentConstellationState || constellationNeedsCleanup) setOrbitPositions({});
    }, [currentConstellationState, constellationNeedsCleanup]);
    // ---------------------------------------------------------------------------------------------

    // 7. 获取实例状态的 timer
    // ---------------------------------------------------------------------------------------------
    const [instanceTimer, setInstanceTimer] = useState(null)
    useEffect(() => () => { if (instanceTimer) clearInterval(instanceTimer); }, [instanceTimer]);
    useEffect(() => () => { if (stopProgressTimerRef.current) clearInterval(stopProgressTimerRef.current); }, []);
    // ---------------------------------------------------------------------------------------------

    // 8. 控制组件初始化步骤的状态
    // ---------------------------------------------------------------------------------------------
    const [alreadyGetPosition, setAlreadyGetPosition] = useState(0)
    // ---------------------------------------------------------------------------------------------

    // 9. 组件初始化第一步 -> 进行星座状态的获取, 以及可选的地面站的获取
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        // 进行默认token的覆盖
        Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyNDZmZTBmNi01NDgyLTRjMzgtYmMwZi1hNWMxZTEzOWNmZTYiLCJpZCI6OTgwOTMsImlhdCI6MTc0MDAzOTUyNn0.04t7gl4vt3qHqWdaIeCDYgcNAotnxx8W3xTiTyJ_QBU"

        // 在刚开始的时候进行星座状态的获取
        GetConstellationState()

        // 在刚开始的时候进行可选的地面站的获取
        GetAvailableGroundStations()

        // 注册监听器 -> 这里进行延迟加载 -> 否则无法进行 viewer 的获取
        const unregisterHandler = RegisterHandler()

        // 卸载的时候触发的回调
        return () => {
            unregisterHandler();
            if (instanceTimer) {
                clearInterval(instanceTimer)
            }
        }
    }, []);

    // Register once; read current lifecycle/selection state through the ref.
    function RegisterHandler() {
        let timer;
        let handler;
        let canvas;
        let removeCameraListener;
        let disposed = false;
        const closeMenu = () => setContextMenu(null);
        const preventBrowserMenu = (event) => event.preventDefault();
        const register = () => {
            if (disposed) return;
            const viewer = viewerRef.current?.cesiumElement;
            if (!viewer || viewer.isDestroyed()) {
                timer = setTimeout(register, 50);
                return;
            }
            canvas = viewer.scene.canvas;
            canvas.addEventListener("contextmenu", preventBrowserMenu);
            removeCameraListener = viewer.camera.moveStart.addEventListener(closeMenu);
            handler = new ScreenSpaceEventHandler(canvas);
            handler.setInputAction((movement) => {
                if (disposed || viewer.isDestroyed()) return;
                // Coverage cones and link primitives may overlap a node. Only
                // entities tagged as satellites/ground stations can open this menu.
                let entity;
                let properties;
                for (const pick of viewer.scene.drillPick(movement.position, 8)) {
                    const candidate = pick?.id ?? pick?.primitive?.id;
                    const metadata = candidate?.properties?.getValue(viewer.clock.currentTime);
                    if (metadata && ["Satellite", "GroundStation"].includes(metadata.nodeType)) {
                        entity = candidate;
                        properties = metadata;
                        break;
                    }
                }
                if (!entity) {
                    closeMenu();
                    return;
                }
                const state = interactionStateRef.current;
                const runtime = properties.runtime === true;
                const containerName = properties.containerName;
                let name = runtime ? containerName : properties.stationName;
                if (runtime && properties.nodeType === "GroundStation") {
                    const match = /^GroundStation-([1-9]\d*)$/.exec(containerName);
                    const station = match && state.selectedGroundStations[Number(match[1]) - 1];
                    if (station) name = `${station} · ${containerName}`;
                }
                const rect = canvas.getBoundingClientRect();
                setContextMenu({
                    entityId: entity.id, name, containerName, nodeType: properties.nodeType,
                    runtime, stationName: properties.stationName,
                    selected: state.selectedGroundStations.includes(properties.stationName),
                    canOpen: runtime && state.canOpen, canEdit: !runtime && state.canEdit,
                    statusText: state.statusText,
                    x: rect.left + movement.position.x + 10,
                    y: rect.top + movement.position.y + 8,
                });
            }, ScreenSpaceEventType.RIGHT_CLICK);
        };
        timer = setTimeout(register, 0);
        return () => {
            disposed = true;
            clearTimeout(timer);
            canvas?.removeEventListener("contextmenu", preventBrowserMenu);
            removeCameraListener?.();
            if (handler && !handler.isDestroyed()) handler.destroy();
        };
    }

    function handleContextMenuAction(action, menu) {
        setContextMenu(null);
        const state = interactionStateRef.current;
        const viewer = viewerRef.current?.cesiumElement;
        if (!viewer || viewer.isDestroyed()) return;
        const entity = viewer.entities.getById(menu.entityId);
        if (!entity) return;
        if (action === "shell") {
            if (!menu.runtime || !state.canOpen || !menu.containerName) return;
            window.open(`/instance/${encodeURIComponent(menu.containerName)}`, "_blank", "noopener,noreferrer");
        } else if (action === "transmit") {
            if (!menu.runtime || !state.canOpen || menu.nodeType !== "GroundStation") return;
            setTrafficSource(menu);
        } else if (action === "locate") {
            viewer.flyTo(entity, {duration: 0.8, offset: new Cesium.HeadingPitchRange(0, -Math.PI / 3, 1500000)});
        } else if (action === "addStation" || action === "removeStation") {
            if (menu.runtime || !state.canEdit || !entity.box) return;
            const selected = action === "addStation";
            const stations = state.selectedGroundStations.filter((name) => name !== menu.stationName);
            if (selected) stations.push(menu.stationName);
            entity.box.material = (selected ? Cesium.Color.GREEN : Cesium.Color.RED).withAlpha(1);
            setSelectedGroundStations(stations);
            startConstellationForm.setFieldsValue({[groundStationsFieldName[0]]: stations});
        }
    }

    // 获取星座的状态
    function GetConstellationState() {
        getConstellationStateRequest((response) => {
            if (response.data["state"] === "up") {
                setConstellationNeedsCleanup(false);
                if (instanceTimer) clearInterval(instanceTimer);
                // 进行星座参数的打印
                console.log(response.data["constellation_params"])
                // 进行参数的获取
                let orbitNumber = response.data["constellation_params"]["orbit_number"]
                let satellitePerOrbit = response.data["constellation_params"]["satellite_per_orbit"]
                let groundStations = response.data["constellation_params"]["ground_stations"]
                let minimumElevationAngle = response.data["constellation_params"]["minimum_elevation_angle"]
                let timeStep = response.data["constellation_params"]["time_step"]
                const orbital = {...DEFAULT_ORBIT_CONFIG, ...response.data.constellation_params.orbit_config};
                setOrbitConfig(orbital);
                startConstellationForm.setFieldsValue({
                    orbit_config: orbital,
                    [orbitNumberFieldName[0]]: orbitNumber,
                    [satellitePerOrbitFieldName[0]]: satellitePerOrbit,
                    [groundStationsFieldName[0]]: groundStations,
                    [minimumElevationAngleFieldName[0]]: minimumElevationAngle,
                    [timeStepFieldName[0]]: timeStep,
                })
                setOrbitNumber(orbitNumber)
                setSatellitePerOrbit(satellitePerOrbit)
                setSelectedGroundStations(groundStations)
                setSelectedMinimumElevationAngle(minimumElevationAngle)
                setSelectedTimestep(timeStep)
                setCurrentConstellationState(true)

                // 进行 timer 的创建
                let timer = setInterval(() => {
                    getInstancePositions(displayProjection)
                }, 1000)

                // 进行 instanceTimer 的设置
                setInstanceTimer(timer)
            } else if (response.data["state"] === "down") {
                setCurrentConstellationState(false)
                setConstellationNeedsCleanup(false)
                if (instanceTimer) clearInterval(instanceTimer)
                setInstanceTimer(null)
            } else if (response.data["state"] === "failed") {
                setCurrentConstellationState(true)
                setConstellationNeedsCleanup(true)
                if (instanceTimer) clearInterval(instanceTimer)
                setInstanceTimer(null)
                message.error({content: response.data.message || "星座清理未完成，请点击销毁星座重试"})
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
                    longitude: parseFloat(groundStationMap["longitude"]) * (Math.PI / 180),
                    latitude: parseFloat(groundStationMap["latitude"]) * (Math.PI / 180),
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

    // 10. 组件初始化第二步 -> 将获取到的可选地面站的列表放到图中
    // ---------------------------------------------------------------------------------------------
    useEffect(() => {
        // 已经进行了位置的获取, 即 availableGroundStations 之中是有值的
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
                        properties={{nodeType: "GroundStation", stationName: availableGroundStation.name, runtime: false}}
                        position={Cartesian3.fromRadians(
                            availableGroundStation.longitude,
                            availableGroundStation.latitude,
                            0,
                        )}
                    >
                        <ConstellationNameLabel name={availableGroundStation.name} groundStation />
                        <BoxGraphics
                            dimensions={new Cesium.Cartesian3(100000, 100000, 100000)} // 长、宽、高均为 10 米
                            material={Cesium.Color.RED.withAlpha(1)}     // 颜色和透明度, 注意当一开始没有任何地面站被选中, 所以地面站的颜色为红色
                            outline={true}                                 // 显示边框
                            outlineColor={Cesium.Color.BLACK}
                            fill={true}
                        />
                    </Entity>
                )
                positions.push(position)
            }
            setAllInstancePositions(positions)
        }
    }, [alreadyGetPosition])
    // ---------------------------------------------------------------------------------------------

    // 11. 获取卫星位置的函数
    // ---------------------------------------------------------------------------------------------
    function stopProgressPolling() {
        if (stopProgressTimerRef.current) {
            clearInterval(stopProgressTimerRef.current)
            stopProgressTimerRef.current = null
        }
    }

    function getInstancePositions(displayProjectionOrNot) {
        getInstancePositionsRequest((response) => {
            let entities = []
            let links = []
            // 仅展示当前支持的星座实体；链路也使用同一份过滤后的位置数据。
            const positions = Object.fromEntries(
                Object.entries(response.data.positions).filter(([, position]) =>
                    position.node_type === "Satellite" || position.node_type === "GroundStation"
                )
            )
            setOrbitPositions(positions)

            // 进行节点的放置
            // --------------------------------------------------------------------
            for (let containerName in positions) {
                // 最终创建出来的实体
                let entity = undefined
                // 进行节点类型名的获取
                let typeName = positions[containerName]["node_type"]
                // 进行经度, 纬度, 高度的获取
                let longitude = positions[containerName]["longitude"]
                let latitude = positions[containerName]["latitude"]
                let altitude = positions[containerName]["altitude"]
                // 进行位置的构建
                let position = Cartesian3.fromRadians(
                    longitude,
                    latitude,
                    altitude
                )
                // 根据节点类型进行处理
                if (typeName === "Satellite") {
                    // 创建一个卫星点在指定的位置
                    entity = (
                        <Entity
                            id={containerName}
                            key={containerName}
                            name={containerName}
                            description={containerName}
                            position={position}
                            properties={{nodeType: "Satellite", containerName, runtime: true}}
                        >
                            <PointGraphics pixelSize={10}/>
                            <ConstellationNameLabel name={containerName} />
                        </Entity>
                    )

                    // 这里补充卫星的投影 projection
                    // --------------------------------------------------------------------
                    if (displayProjectionOrNot){
                        let projection_height = calculate_projection_height(selectedMinimumElevationAngle, altitude)
                        let projection_bottom_radius = calculate_projection_bottom_radius(selectedMinimumElevationAngle, altitude)
                        let projection_position = Cartesian3.fromRadians(
                            longitude,
                            latitude,
                            altitude - projection_height / 2
                        )
                        let orientation = Transforms.headingPitchRollQuaternion(
                            position,
                            Cesium.HeadingPitchRoll.fromDegrees(0, 0, 0) // 航向角、俯仰角、横滚角均为 0
                        );
                        let projection = <Entity
                            position={projection_position}
                            orientation={orientation}
                            cylinder={{
                                length: projection_height,
                                topRadius: 0,
                                bottomRadius: projection_bottom_radius,
                                material: Cesium.Color.YELLOW.withAlpha(0.5),
                                outline: false,
                            }}
                        >
                        </Entity>
                        entities.push(projection)
                    } else {
                        console.log("not display projection")
                    }
                    // --------------------------------------------------------------------



                } else {
                    // 如果是地面站
                    entity = (
                        <Entity
                            id={containerName}
                            key={containerName}
                            name={containerName}
                            description={containerName}
                            position={Cartesian3.fromRadians(
                                longitude,
                                latitude,
                                altitude
                            )}
                            properties={{nodeType: "GroundStation", containerName, runtime: true}}
                        >
                            {/*<PointGraphics pixelSize={10}/>*/}
                            <ConstellationNameLabel name={containerName} groundStation runtime />
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
                entities.push(entity)
            }

            // 清空不再存在或不受支持的节点及其链路。
            if (entities.length === 0) {
                setAllInstancePositions([])
                setAllLinks([])
                return
            }
            // --------------------------------------------------------------------

            // 进行链路的放置
            // --------------------------------------------------------------------
            // 进行星地链路的处理
            for(let linkId in response.data.gsls) {
                let sourceContainerName = response.data.gsls[linkId][0]
                let targetContainerName = response.data.gsls[linkId][1]
                if (!positions[sourceContainerName] || !positions[targetContainerName]) {
                    continue
                }
                let lineData = [
                    positions[sourceContainerName]["longitude"],
                    positions[sourceContainerName]["latitude"],
                    positions[sourceContainerName]["altitude"],
                    positions[targetContainerName]["longitude"],
                    positions[targetContainerName]["latitude"],
                    positions[targetContainerName]["altitude"],
                ]
                let GSL = (
                    <ConstellationTrafficLink
                        key={`gsl:${linkId}:${sourceContainerName}:${targetContainerName}`}
                        linkKey={`gsl:${linkId}:${sourceContainerName}:${targetContainerName}`}
                        source={sourceContainerName} target={targetContainerName}
                        positions={Cartesian3.fromRadiansArrayHeights(lineData)} baseColor={Cesium.Color.ORANGE}
                    />
                )

                links.push(GSL)
            }


            // 进行星间链路的处理
            for (let linkId in response.data.isls) {
                let sourceContainerName = response.data.isls[linkId][0]
                let targetContainerName = response.data.isls[linkId][1]
                let linkType = response.data.isls[linkId][2]
                if (!positions[sourceContainerName] || !positions[targetContainerName]) {
                    continue
                }
                let lineData = [
                    positions[sourceContainerName]["longitude"],
                    positions[sourceContainerName]["latitude"],
                    positions[sourceContainerName]["altitude"],
                    positions[targetContainerName]["longitude"],
                    positions[targetContainerName]["latitude"],
                    positions[targetContainerName]["altitude"],
                ]
                if(linkType === "intra_orbit"){
                    let link = (
                        <ConstellationTrafficLink
                            key={`isl:${linkId}:${sourceContainerName}:${targetContainerName}`}
                            linkKey={`isl:${linkId}:${sourceContainerName}:${targetContainerName}`}
                            source={sourceContainerName} target={targetContainerName}
                            positions={Cartesian3.fromRadiansArrayHeights(lineData)} baseColor={Cesium.Color.GREEN}
                        />
                    )
                    links.push(link)
                } else if(linkType === "inter_orbit"){
                    let link = (
                        <ConstellationTrafficLink
                            key={`isl:${linkId}:${sourceContainerName}:${targetContainerName}`}
                            linkKey={`isl:${linkId}:${sourceContainerName}:${targetContainerName}`}
                            source={sourceContainerName} target={targetContainerName}
                            positions={Cartesian3.fromRadiansArrayHeights(lineData)} baseColor={Cesium.Color.BLUE}
                        />
                    )
                    links.push(link)
                } else {
                    console.log("unsupported link type")
                }
            }
            // --------------------------------------------------------------------
            setAllInstancePositions(entities)
            setAllLinks(links)
        }, (error) => {
            console.log(error)
        })
    }


    // 根据在 https://blog.csdn.net/White__River/article/details/129734813 之中的公式进行计算锥体的底部半径
    // [1] minimum_support_elevation_degree 是最小支持的仰角
    // [2] satellite_height 是卫星的高度
    function calculate_projection_bottom_radius(minimum_support_elevation_degree, satellite_height){
        let E_rad = (minimum_support_elevation_degree) * (Math.PI / 180);
        let alpha_rad = Math.acos((R_EARTH / (R_EARTH + satellite_height)) * Math.cos(E_rad)) - E_rad
        return R_EARTH * Math.sin(alpha_rad)
    }

    // 根据在 https://blog.csdn.net/White__River/article/details/129734813 之中的公式进行计算锥体的总高度
    // [1] minimum_support_elevation_angle 是最小支持的仰角
    // [2] satellite_height 是卫星的高度
    function calculate_projection_height(minimum_support_elevation_degree, satellite_height){
        let E_rad = (minimum_support_elevation_degree) * (Math.PI / 180);
        let alpha_rad = Math.acos((R_EARTH / (R_EARTH + satellite_height)) * Math.cos(E_rad)) - E_rad
        return R_EARTH + satellite_height - R_EARTH * Math.cos(alpha_rad)
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
                orbit_config: orbitConfig,
                [orbitNumberFieldName[1]]: orbitNumber,
                [satellitePerOrbitFieldName[1]]: satellitePerOrbit,
                [groundStationsFieldName[1]]: selectedGroundStationInstances,
                [minimumElevationAngleFieldName[1]]: selectedMinimumElevationAngle,
                [timeStepFieldName[1]]: selectedTimeStep,
            }
            // 初始化启动进度
            setStopInProgress(true)
            setStopProgressPercent(0)
            setStopProgressStep("正在启动星座...")
            // 进行实际的请求的发送
            startConstellationRequest(params, (response) => {
                stopProgressPolling()
                setStopProgressPercent(100)
                setStopInProgress(false)
                setConstellationNeedsCleanup(false);
                if (instanceTimer) clearInterval(instanceTimer);
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
                    getInstancePositions(displayProjection)
                }, 1000)
                // 将其设置到 instanceTimer 之中
                setInstanceTimer(timer)
            }, (error) => {
                stopProgressPolling()
                setStopInProgress(false)
                // Re-read state so a failed rollback can be retried with the destroy button.
                GetConstellationState()
                message.error({
                    content: error.response?.data?.message || `启动星座失败：${error.message}`
                })
                // 去掉对话框的加载状态
                setPromptBoxLoading(false)
                // 进行对话框的关闭
                setPromptBoxOpen(false)
            })

            // 轮询启动进度
            stopProgressTimerRef.current = setInterval(() => {
                getStopProgressRequest("constellation", (res) => {
                    setStopProgressPercent(res.data?.percent ?? 0)
                    const step = res.data?.step
                    if (step) setStopProgressStep(CONSTELLATION_STEP_LABELS[step] || step)
                }, () => {})
            }, 300)
        } else if (promptBoxType === promptBoxTypes.stopConstellation) { // 处理 stopConstellation
            // 设置对话框的显示
            setPromptBoxLoading(true)
            // 立即停止位置轮询，避免在销毁期间继续请求 /getInstancePositions。
            // 后端 stopConstellation 会持有写锁数秒（等待容器清理完成），
            // 若不提前停掉定时器，期间的轮询会排队并在实例被置空后返回 409。
            if (instanceTimer) {
                clearInterval(instanceTimer)
                setInstanceTimer(null)
            }

            // 初始化销毁进度
            setStopInProgress(true)
            setStopProgressPercent(0)
            setStopProgressStep("正在销毁星座...")

            // 进行实际的请求的发送
            stopConstellationRequest((response) => {
                // 停止进度轮询
                stopProgressPolling()
                setStopProgressPercent(100)
                setStopInProgress(false)
                // 停止拓扑成功
                message.success({
                    content: "successfully stop the constellation"
                })
                setCurrentConstellationState(false)
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)

                // 进行页面的强制刷新
                window.location.reload()
            }, (error) => {
                // 停止进度轮询
                stopProgressPolling()
                setStopInProgress(false)
                // 保留销毁按钮，允许重试未完成的清理。
                setConstellationNeedsCleanup(true)
                setInstanceTimer(null)
                message.error({
                    content: error.response?.data?.message || `销毁星座失败：${error.message}`
                })
                setPromptBoxLoading(false)
                setPromptBoxOpen(false)
            })

            // 轮询销毁进度
            stopProgressTimerRef.current = setInterval(() => {
                getStopProgressRequest("constellation", (res) => {
                    setStopProgressPercent(res.data?.percent ?? 0)
                    const step = res.data?.step
                    if (step) setStopProgressStep(CONSTELLATION_STEP_LABELS[step] || step)
                }, () => {})
            }, 300)
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
            },
            {
                key: "4",
                paramsDescription: minimumElevationAngleFieldName[0],
                paramsValue: selectedMinimumElevationAngle
            },
            {
                key: "5",
                paramsDescription: timeStepFieldName[0],
                paramsValue: selectedTimeStep
            }
        ]
        setPromptBoxOpen(true)
        tableValues.push(
            {key: "orbit-altitude", paramsDescription: "标称轨道高度", paramsValue: `${orbitConfig.altitude_km} km`},
            {key: "orbit-inclination", paramsDescription: "轨道倾角", paramsValue: `${orbitConfig.inclination_deg}°`},
            {key: "orbit-raan", paramsDescription: "轨道面分布范围", paramsValue: `${orbitConfig.raan_span_deg}°`},
            {key: "orbit-phase", paramsDescription: "相邻轨道相位差", paramsValue: `${orbitConfig.phase_offset_deg}°`},
        );
        setPromptBoxTitle("启动星座")
        setPromptBoxText(
            <Table dataSource={tableValues} columns={tableColumns}></Table>
        )
    }

    // ---------------------------------------------------------------------------------------------

    // 14. 当表单内的内容发生变化的时候的对应的处理函数
    // ---------------------------------------------------------------------------------------------
    function onStartConstellationValuesChange(changedValues) {
        if (changedValues.orbit_config) setOrbitConfig(previous => ({...previous, ...changedValues.orbit_config}));
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
        // 更新选择的仰角
        if(minimumElevationAngleFieldName[0] in changedValues) {
            setSelectedMinimumElevationAngle(changedValues[minimumElevationAngleFieldName[0]])
        }
        // 实时更新选择的步长
        if(timeStepFieldName[0] in changedValues) {
            let changedTimeStamp = changedValues[timeStepFieldName[0]]
            // 进行 state 的设置
            setSelectedTimestep(changedTimeStamp)
            // 当星座启动之后才可以通过这种方式进行调整
            if (currentConstellationState && !constellationNeedsCleanup){
                // 进行请求的发送
                changeTimeStep(changedTimeStamp)
            }
        }
        // 更新选择是否显示卫星覆盖区域
        if(displayProjectionFieldName[0] in changedValues){
            console.log(`display projection changed to ${changedValues[displayProjectionFieldName[0]]}`)
            setDisplayProjection(changedValues[displayProjectionFieldName[0]])
            if(instanceTimer){
                clearInterval(instanceTimer)
                let timer = setInterval(() => {
                    getInstancePositions(changedValues[displayProjectionFieldName[0]])
                }, 1000)
                setInstanceTimer(timer)
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

    // 16. 当选择的步长变更的时候需要调用的函数
    function changeTimeStep(changedTimeStamp){
        const params = {
            [timeStepFieldName[1]]: changedTimeStamp
        }
        changeTimeStepRequest(params, (response)=>{
            message.success({
                content: `successfully change the time step to ${changedTimeStamp}`
            })
        }, (error)=>{
            message.error({
                content: "could not change the time step"
            })
        })
    }




    // 17. 真实的前端界面
    // ---------------------------------------------------------------------------------------------
    return (
        <div className="constellation-workbench">
          <header className="constellation-header">
            <div className="constellation-brand">
              <div className="constellation-brand-icon"><GlobalOutlined /></div>
              <div><div className="constellation-eyebrow">CONSTELLATION / SIMULATION CENTER</div><h1>链路感知的安全可控路由原型系统</h1></div>
            </div>
            <div className="constellation-header-actions">
              <div className={"constellation-status" + (currentConstellationState && !constellationNeedsCleanup ? " is-active" : "")}><span />{constellationNeedsCleanup ? "星座待清理" : currentConstellationState ? "星座运行中" : "星座未启动"}</div>
              <Button aria-controls="constellation-sidebar" aria-expanded={!controlsCollapsed}
                  onClick={() => setControlsCollapsed(collapsed => !collapsed)}>
                {controlsCollapsed ? "展开配置" : "收起配置"}
              </Button>
            </div>
          </header>
          <main className={"constellation-workspace" + (controlsCollapsed ? " is-controls-collapsed" : "")}>
            <aside id="constellation-sidebar" className="constellation-sidebar" aria-label="星座配置与运行控制" hidden={controlsCollapsed} tabIndex={0}>
              <Form form={startConstellationForm} name={nameOfForm} onFinishFailed={onValidateStartConstellationFailed} onFinish={onStartConstellationFinish} onValuesChange={onStartConstellationValuesChange} initialValues={{
                orbit_config: {...DEFAULT_ORBIT_CONFIG},
                [orbitNumberFieldName[0]]: orbitNumber,
                [satellitePerOrbitFieldName[0]]: satellitePerOrbit,
                [groundStationsFieldName[0]]: selectedGroundStations,
                [minimumElevationAngleFieldName[0]]: selectedMinimumElevationAngle,
                [timeStepFieldName[0]]: selectedTimeStep
              }} layout="vertical" className="constellation-settings">
                <Card className="constellation-panel" title={<span><span className="constellation-section-number">01</span>{firstSplitContent}</span>} extra={<span className="constellation-caption">星座参数</span>}>
                  <div className="constellation-field-grid"><Form.Item label={orbitNumberFieldName[0]} name={orbitNumberFieldName[0]} rules={[{
                      required: true,
                      message: "请选择轨道数量"
                    }]}>
                      <InputNumber min={1} precision={0} disabled={currentConstellationState} changeOnWheel></InputNumber>
                    </Form.Item><Form.Item label={satellitePerOrbitFieldName[0]} name={satellitePerOrbitFieldName[0]} rules={[{
                      required: true,
                      message: "请选择每个轨道的卫星数量"
                    }]}>
                      <InputNumber min={1} precision={0} disabled={currentConstellationState} changeOnWheel></InputNumber>
                    </Form.Item></div>
                  <ConstellationOrbitSettings config={orbitConfig} orbitNumber={orbitNumber} satellitePerOrbit={satellitePerOrbit}
                    disabled={currentConstellationState || promptBoxLoading} />
                  <Form.Item label={groundStationsFieldName[0]} name={groundStationsFieldName[0]}>
                    <Select mode="multiple" placeholder="选择地面站" maxTagCount="responsive" allowClear={true} disabled={currentConstellationState} options={availableGroundStations.map(availableGroundStation => ({
                      label: availableGroundStation.name,
                      value: availableGroundStation.name
                    }))} popupClassName="constellation-select-dropdown">
                    </Select>
                  </Form.Item>
                  <p className="constellation-field-note">可从列表选择地面站，也可在地球上右键选取。</p>
                  <div className="constellation-actions"><Button type={"primary"} htmlType={"submit"} disabled={currentConstellationState}>启动星座</Button>
                    <Button type={"primary"} danger disabled={!currentConstellationState} onClick={stopConstellation}>销毁星座</Button></div>
                </Card>
                <Card className="constellation-panel" title={<span><span className="constellation-section-number">02</span>仿真与显示</span>}>
                  <div className="constellation-field-grid constellation-display-fields"><Form.Item label={minimumElevationAngleFieldName[0]} name={minimumElevationAngleFieldName[0]}>
                      <InputNumber min={5} max={40} precision={0} value={selectedMinimumElevationAngle} />
                    </Form.Item><Form.Item label={displayProjectionFieldName[0]} name={displayProjectionFieldName[0]}>
                      <Switch value={displayProjection} onChange={value => {
                        setDisplayProjection(value);
                      }} checkedChildren="开" unCheckedChildren="关">
                      </Switch>
                    </Form.Item></div>
                  <div className="constellation-field-grid constellation-display-fields">
                    <Form.Item label="卫星名称" htmlFor="show-satellite-names">
                      <Switch id="show-satellite-names" aria-label="显示卫星名称" checked={showSatelliteNames} onChange={setShowSatelliteNames} checkedChildren="开" unCheckedChildren="关" />
                    </Form.Item>
                    <Form.Item label="地面站名称" htmlFor="show-ground-station-names">
                      <Switch id="show-ground-station-names" aria-label="显示地面站名称" checked={showGroundStationNames} onChange={setShowGroundStationNames} checkedChildren="开" unCheckedChildren="关" />
                    </Form.Item>
                  </div>
                  <div className="constellation-field-grid constellation-display-fields">
                    <Form.Item label="显示轨道" htmlFor="show-orbit-guides">
                      <Switch id="show-orbit-guides" aria-label="显示轨道" checked={showOrbits} onChange={setShowOrbits} checkedChildren="开" unCheckedChildren="关" />
                    </Form.Item>
                  </div>
                  <p className="constellation-field-note">淡蓝虚线表示当前近圆轨道，彩色直线表示通信链路。轨道在启动后随位置更新；每轨至少需 3 颗卫星及完整位置数据。</p>
                  <div className="constellation-step-controls"><Form.Item label={timeStepFieldName[0]} name={timeStepFieldName[0]}>
                      <Slider min={1} max={20} value={typeof selectedTimeStep === 'number' ? selectedTimeStep : 0} />
                    </Form.Item><InputNumber min={1} max={20} precision={0} value={selectedTimeStep} onChange={value => {
                      if (!Number.isInteger(value) || value < 1) return;
                      onStartConstellationValuesChange({[timeStepFieldName[0]]: value});
                      startConstellationForm.setFieldsValue({
                        "步长": value
                      });
                    }} aria-label="步长数值" className="constellation-step-value">
                    </InputNumber></div>
                  <div className="constellation-step-scale"><span>1 · 精细步长</span><span>20 · 较大步长</span></div>
                </Card>
              </Form>
              <div className="constellation-summary" aria-label="当前配置概览">
                <div><span>轨道数量</span><strong>{orbitNumber ?? "—"}</strong></div>
                <div><span>每轨道卫星</span><strong>{satellitePerOrbit ?? "—"}</strong></div>
                <div><span>已选地面站</span><strong>{selectedGroundStations.length}</strong></div>
              </div>
              <ConstellationTrafficCard traffic={traffic} />
            </aside>
            <section className="constellation-scene-panel" aria-label="三维星座视图">
              <div className="constellation-scene-header">
                <div><h2><GlobalOutlined />{secondSplitContent}</h2><p>卫星位置 · 轨道曲线 · 星间链路 · 地面站</p></div>
                <span className="constellation-scene-badge">星座仿真</span>
              </div>
              <div className="constellation-scene"><ConstellationLabelContext.Provider value={{showSatelliteNames, showGroundStationNames, groundStationNames: selectedGroundStations}}>
                <Viewer ref={viewerRef} timeline={false} homeButton={false} geocoder={false} animation={false} navigationHelpButton={false} fullscreenButton={false} className="constellation-viewer">
                  {currentConstellationState && !constellationNeedsCleanup && <ConstellationOrbits positions={orbitPositions}
                    orbitNumber={orbitNumber} satellitePerOrbit={satellitePerOrbit} show={showOrbits} />}
                  {allInstancePositions}
                  <ConstellationTrafficContext.Provider value={{task: traffic.task, stale: traffic.stale}}>
                    {allLinks}
                  </ConstellationTrafficContext.Provider>
                </Viewer>
              </ConstellationLabelContext.Provider></div>
              <footer className="constellation-scene-footer">
                <div className="constellation-legend"><span><i className="satellite" />卫星</span><span><i className="orbit-guide" />近圆轨道</span><span><i className="ground-selected" />已选地面站</span><span><i className="ground-available" />未选地面站</span></div>
                <span>拖拽旋转 · 滚轮缩放 · 右键节点打开操作菜单</span>
              </footer>
            </section>
          </main>
          <ConstellationContextMenu menu={contextMenu} onAction={handleContextMenuAction} onClose={() => setContextMenu(null)} />
          <ConstellationTrafficPanel source={trafficSource} traffic={traffic} onClose={() => setTrafficSource(null)} />
          <Modal title={promptBoxTitle} open={promptBoxOpen} onOk={handlePromptOkCicked} onCancel={handlePromptCancelClicked} okText={promptBoxOkText} cancelText={promptBoxCancelText} confirmLoading={promptBoxLoading} rootClassName="constellation-dialog">
            {promptBoxText}
            {stopInProgress && (
              <div style={{marginTop: 12}}>
                <Progress percent={stopProgressPercent} status="active" />
                <div style={{fontSize: 12, color: "#888", marginTop: 4}}>{stopProgressStep}</div>
              </div>
            )}
          </Modal>
        </div>
    )
    // ---------------------------------------------------------------------------------------------
}
