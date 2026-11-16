import React, {useEffect, useState} from "react";
import {getTopologyTraffic, startTopologyTraffic, stopTopologyTraffic} from "../requests/topology_traffic";
import {TOPOLOGY_SELECTED_STATE} from "../entities/topology_graph_styles";
import {activeStates, intensity, networkLabels, useTraffic} from "./TrafficTransfer";

const api = {get: getTopologyTraffic, start: startTopologyTraffic, stop: stopTopologyTraffic};
export function useTopologyTraffic(enabled) {
    const traffic = useTraffic(enabled, api);
    const [now, setNow] = useState(Date.now);
    const sampling = enabled && traffic.p2p?.state === "running";
    // 请求阻塞时也要让过期颜色消失，不能仅靠下一次成功响应触发刷新。
    useEffect(() => {
        if (!sampling) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [sampling]);
    const p2pAvailable = !traffic.error && sampling && !traffic.p2p.sample_error &&
        Math.max(now, Date.now()) - Date.parse(traffic.p2p.sampled_at) <= 5000;
    return {...traffic, p2pAvailable};
}
const levels = [1, 10, 100, 1000];
const stateFor = pps => `traffic-${levels.filter(level => pps >= level).pop() || 1}`;
export const trafficEdgeStyles = Object.fromEntries(levels.map(level => {
    const style = intensity(level);
    return [`traffic-${level}`, {stroke: style.color, lineWidth: style.width}];
}));

export function ChainMakerTrafficCard({traffic}) {
    const {p2p} = traffic;
    if (!p2p) return null;
    const available = traffic.p2pAvailable;
    const maximum = Math.max(0, ...Object.values(p2p.links || {}).map(link => link.forward_pps || 0));
    const status = p2p.state === "preparing" ? "正在启动采样" : available ? "正在采样" : "采样不可用";
    return <section className="traffic-card" aria-label="ChainMaker P2P 链路流量">
        <div className="traffic-card-heading"><span>ChainMaker P2P 链路流量</span><span aria-live="polite">{status}</span></div>
        <div className="traffic-task-meta">{networkLabels[p2p.network] || p2p.network} · 所有节点对 · 双向汇总</div>
        <div className="traffic-task-metrics"><span>最高链路包速率 <strong>{available ? `${Math.round(maximum).toLocaleString()} 包/秒` : "未知"}</strong></span></div>
        <div className="traffic-color-legend"><span>少</span><i /><span>多 · ≥ 1000 包/秒</span></div>
        <p className="traffic-note">按接收接口统计真实 P2P TCP 报文，包含 ACK、握手和重传，排除学习反馈。每秒更新，无需发起测试传输；无流量时恢复原色。网络卸载可能合并报文。</p>
        {(traffic.error || p2p.sample_error) && <p className="traffic-warning">采集异常：{traffic.error || p2p.sample_error}。已恢复链路原色。</p>}
        {!available && !traffic.error && !p2p.sample_error && p2p.state !== "preparing" && <p className="traffic-warning">采样已停止或过期，已恢复链路原色。</p>}
        {p2p.sample_drops > 0 && <p className="traffic-warning">采集器丢失 {p2p.sample_drops} 个报文，统计可能偏低。</p>}
    </section>;
}

// G6 states only affect the rendered edge; saved topology models retain their styles.
export function useTopologyTrafficEdges(graph, traffic) {
    const {task, stale, p2p, p2pAvailable} = traffic;
    useEffect(() => {
        if (!graph || graph.destroyed) return;
        const apply = () => {
            if (graph.destroyed) return;
            graph.getEdges().forEach(edge => {
                const key = edge.getModel().edge_id;
                // 常驻 P2P 独立于测试任务；任务结束不会清空业务颜色。
                // 有 P2P 时始终采用业务视图，避免异常时混入另一种统计口径。
                const pps = p2p
                    ? (p2pAvailable ? p2p.links?.[key]?.forward_pps || 0 : 0)
                    : (!stale && !task?.sample_error && task?.sampling_supported !== false && activeStates.has(task?.state)
                        ? task?.links?.[key]?.forward_pps || 0 : 0);
                const desired = pps > 0 ? stateFor(pps) : null;
                const previous = edge.getStates().filter(state => state in trafficEdgeStyles);
                if (previous.length === (desired ? 1 : 0) && (!desired || previous[0] === desired)) return;
                const selected = edge.hasState(TOPOLOGY_SELECTED_STATE);
                if (selected) graph.setItemState(edge, TOPOLOGY_SELECTED_STATE, false);
                previous.forEach(state => graph.setItemState(edge, state, false));
                if (desired) graph.setItemState(edge, desired, true);
                if (selected) graph.setItemState(edge, TOPOLOGY_SELECTED_STATE, true);
            });
        };
        apply();
        graph.on("afterrender", apply);
        return () => {
            if (graph.destroyed) return;
            graph.off("afterrender", apply);
            graph.getEdges().forEach(edge => {
                edge.getStates().filter(state => state in trafficEdgeStyles)
                    .forEach(state => graph.setItemState(edge, state, false));
            });
        };
    }, [graph, task, stale, p2p, p2pAvailable]);
}
