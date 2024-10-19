import {Route, Routes} from "react-router-dom";
import {Topology} from "../pages/Topology";
import {Constellation} from "../pages/Constellation";

export const RoutesMapping = new Map([
    [0, ["拓扑配置界面", "/topology", <Topology/>]],
    [1, ["星座可视化界面", "/constellation", <Constellation/>]]
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
        </Routes>
    )
}