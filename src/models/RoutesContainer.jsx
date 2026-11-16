import {Navigate, Route, Routes} from "react-router-dom";
import {Topology} from "../pages/Topology";
import {Constellation} from "../pages/Constellation";
import {Instance} from "../pages/Instance";
import {TestApp} from "../pages/Test";
import {Home} from "../pages/Home";

export const RoutesMapping = new Map([
    [5, ["系统首页", "/", <Home/>]],
    [0, ["拓扑配置界面", "/topology", <Topology/>]],
    [1, ["星座可视化界面", "/constellation", <Constellation/>]],
    [2, ["命令行", "/instance/:containerName", <Instance/>]],
    [3, ["测试", "/test", <TestApp/>]],
])

// GenerateRoutes 进行路由 Tags 的生成
function GenerateRoutes() {
    let RouteTagList = []
    RoutesMapping.forEach((value, key) => {
        RouteTagList.push(
            <Route key={key} path={value[1]} element={value[2]}></Route>
        )
    })
    return RouteTagList
}


export function RoutesContainer(props) {
    return (
        <Routes>
            {GenerateRoutes()}
            {/* 兼容旧书签；导航菜单只保留主拓扑工作台。 */}
            <Route path="/topology_only" element={<Navigate to="/topology" replace/>}/>
        </Routes>
    )
}
