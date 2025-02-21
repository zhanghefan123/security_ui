import {Entity, PointGraphics, Viewer} from "resium";
import * as Cesium from "cesium";
import {Cartesian3, Color, Transforms} from "cesium";
import React, {useEffect} from "react";

export function TestApp() {

    const satellite_height = 781500

    // 卫星位置（经度、纬度、高度）
    const ellipsoid = Cesium.Ellipsoid.WGS84;
    const R_EARTH = ellipsoid.maximumRadius;
    const satellite_position = Cartesian3.fromDegrees(0, 0, satellite_height); // GEO 卫星
    const projection_position = Cartesian3.fromDegrees(0, 0, satellite_height - calculate_project_height()/2);
    const orientation = Transforms.headingPitchRollQuaternion(
        satellite_position,
        Cesium.HeadingPitchRoll.fromDegrees(0, 0, 0) // 航向角、俯仰角、横滚角均为 0
    );

    useEffect(() => {
        console.log(`R_EARTH: ${R_EARTH}`)
    }, []);

    return (
        <Viewer>
            <Entity
                position={satellite_position}
            >
                <PointGraphics pixelSize={10}/>
            </Entity>


            <Entity
                position={projection_position}
                orientation={orientation} // 设置实体的方向
                cylinder={{
                    length: calculate_project_height(), // 圆锥体高度
                    topRadius: 0, // 顶部半径为 0
                    bottomRadius: calculate_bottom_radius(), // 底部半径
                    material: Color.YELLOW.withAlpha(0.5), // 半透明黄色
                    outline: false, // 显示轮廓线
                }}
            />
        </Viewer>
    );

    function calculate_project_height(){
        let E_degree = 5
        let E_rad = (E_degree) * (Math.PI / 180);
        let alpha_rad = Math.acos((R_EARTH / (R_EARTH + satellite_height)) * Math.cos(E_rad)) - E_rad
        let project_height = R_EARTH + satellite_height - R_EARTH * Math.cos(alpha_rad)
        console.log(`project height: ${project_height}`)
        return project_height
    }

    //
    function calculate_bottom_radius(){
        console.log("satellite height:", satellite_height)
        let E_degree = 5
        let E_rad = (E_degree) * (Math.PI / 180);
        let alpha_rad = Math.acos((R_EARTH / (R_EARTH + satellite_height)) * Math.cos(E_rad)) - E_rad
        console.log(R_EARTH * Math.sin(alpha_rad))
        return R_EARTH * Math.sin(alpha_rad)
    }
}