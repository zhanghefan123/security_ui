import React, {createContext, useContext} from "react";
import {Entity, PolylineGraphics} from "resium";
import * as Cesium from "cesium";
import {getConstellationTraffic, startConstellationTraffic, stopConstellationTraffic} from "../requests/constellation_traffic";
import {useTraffic, TrafficPanel, TrafficCard, activeStates, intensity} from "./TrafficTransfer";

const api = {get: getConstellationTraffic, start: startConstellationTraffic, stop: stopConstellationTraffic};
const networks = [{value: "IPV6", label: "IPv6"}, {value: "SRV6", label: "SRv6"}];
export const ConstellationTrafficContext = createContext({task: null, stale: false});
export const useConstellationTraffic = enabled => useTraffic(enabled, api);
export const ConstellationTrafficPanel = props => <TrafficPanel {...props} title="地面站传输" networks={networks} />;
export const ConstellationTrafficCard = props => <TrafficCard {...props} title="地面站传输" />;

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

export function ConstellationTrafficLink({linkKey, source, target, positions, baseColor}) {
    const {task, stale} = useContext(ConstellationTrafficContext);
    const stats = task?.links?.[linkKey];
    const unavailable = stale || Boolean(task?.sample_error);
    const pps = !unavailable && activeStates.has(task?.state) ? (stats?.forward_pps || 0) : 0;
    const style = pps > 0 ? intensity(pps) : null;
    const description = `${escapeHTML(source)} ↔ ${escapeHTML(target)}` + (task ?
        `<br/>任务方向：${escapeHTML(task.source)} → ${escapeHTML(task.target)}<br/>正向：${unavailable ? "未知" : (stats?.forward_pps || 0).toFixed(1)} 包/秒 · 累计 ${stats?.forward_packets || 0} 包<br/>返回：${unavailable ? "未知" : (stats?.reverse_pps || 0).toFixed(1)} 包/秒 · 累计 ${stats?.reverse_packets || 0} 包${task.sample_drops ? "<br/>采集存在丢包，统计可能偏低" : ""}` : "");
    return <Entity id={`traffic-link:${linkKey}`} name={`${source} ↔ ${target}`} description={description}>
        <PolylineGraphics positions={positions} material={style ? Cesium.Color.fromCssColorString(style.color) : baseColor}
            width={style?.width || 1} arcType={Cesium.ArcType.NONE} />
    </Entity>;
}
