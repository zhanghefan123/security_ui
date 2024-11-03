import {Menu} from "antd";
import {NavLink} from "react-router-dom";
import {RoutesMapping} from "./RoutesContainer";

function GenerateHorizontalBarItems(){
    let resultList = []
    RoutesMapping.forEach((value, key) => {
        if (value[0] !== "命令行") {
            resultList.push({
                key: key,
                label: <NavLink to={value[1]}>{value[0]}</NavLink>
            })
        }
    })
    return resultList
}

export function HorizontalBar(props) {
    return (
        <div>
            <Menu
                theme="dark"
                mode="horizontal"
                defaultSelectedKeys={[0]}
                items={GenerateHorizontalBarItems()}
                style={{
                    flex: 1,
                    minWidth: 1000,
                }}
            />
        </div>
    )
}