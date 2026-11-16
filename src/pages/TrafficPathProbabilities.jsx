import React, {useMemo, useState} from "react";
import {Button, Modal, Select} from "antd";
import {LineChartOutlined} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";

const maximumVisiblePaths = 12;

function ProbabilityChart({history}) {
    const paths = useMemo(() => history.paths.map((path, index) => ({
        ...path, index,
        label: `P${path.id}：${path.node_ids.map(id => history.nodes?.[id] || `节点 ${id}`).join(" → ")}（链路 ${path.link_ids.join(" → ")}）`,
        peak: Math.max(...history.samples.map(sample => sample.probabilities[index] || 0)),
    })), [history]);
    const [selected, setSelected] = useState(() => [...paths].sort((a, b) => b.peak - a.peak || a.id - b.id)
        .slice(0, 8).map(path => path.id));
    const option = useMemo(() => ({
        animation: false,
        backgroundColor: "transparent",
        textStyle: {color: "#c8d5e6"},
        color: ["#7bdad1", "#ffbd70", "#8ba8ff", "#ef8fbc", "#a6d975", "#caa0ff", "#64b5f6", "#ef8070", "#d4d670", "#65c4a0", "#bdac9a", "#e5a5ec"],
        grid: {left: 60, right: 28, top: 52, bottom: 100},
        legend: {type: "scroll", top: 8, textStyle: {color: "#c8d5e6"}},
        tooltip: {
            trigger: "axis", renderMode: "richText", confine: true,
            formatter: entries => entries.length ? [
                `${Number(entries[0].value[0]).toFixed(3)} 秒`,
                ...entries.map(entry => `${entry.seriesName}：${Number(entry.value[1]).toFixed(2)}%`),
            ].join("\n") : "",
        },
        xAxis: {type: "value", min: 0, name: "首次选路后的时间（秒）", nameLocation: "middle", nameGap: 32,
            axisLabel: {formatter: value => Number(value.toFixed(3))}, splitLine: {show: false}},
        yAxis: {type: "value", min: 0, max: 100, name: "选择概率", axisLabel: {formatter: "{value}%"},
            splitLine: {lineStyle: {color: "#29384c"}}},
        dataZoom: [{type: "inside", filterMode: "none"}, {type: "slider", bottom: 8, height: 22, textStyle: {color: "#a3b3c9"}}],
        series: paths.filter(path => selected.includes(path.id)).map(path => ({
            id: String(path.id), name: `P${path.id}`, type: "line", step: "end",
            showSymbol: history.samples.length <= 20, symbolSize: 5,
            data: history.samples.map(sample => [sample.seconds, sample.probabilities[path.index] * 100]),
        })),
    }), [history, paths, selected]);
    return <>
        <p className="traffic-note">记录选路时实际抽样的概率。横轴从首次选路开始，包含后续接入准备时间；沿用旧路径的等待轮次不产生新点。曲线不表示实际发送占比。</p>
        <label className="traffic-probability-label" htmlFor="traffic-probability-paths">显示路径（最多 {maximumVisiblePaths} 条）</label>
        <Select id="traffic-probability-paths" mode="multiple" className="traffic-probability-select" value={selected}
            onChange={setSelected} optionFilterProp="label" maxTagCount="responsive" placeholder="选择需要对比的路径"
            options={paths.map(path => ({value: path.id, label: path.label,
                disabled: selected.length >= maximumVisiblePaths && !selected.includes(path.id)}))} />
        <ReactECharts option={option} notMerge style={{height: 390, width: "100%"}} />
        <p className="traffic-note">共 {history.decisions} 次选路，保留 {history.samples.length} 个时间点，{paths.length} 条候选路径。
            {history.stride > 1 ? `已按约每 ${history.stride} 次选路降采样，保留首尾记录；点之间的短暂变化可能未显示。` : "未降采样。"}
            {history.samples.length === 1 && "本次仅有一次选路记录，显示为单点。"}</p>
        {history.error && <p className="traffic-warning">{history.error}</p>}
    </>;
}

export default function TrafficPathProbabilities({history}) {
    // 打开时固定已完成任务的历史，避免状态轮询重置图表缩放及路径选择。
    const [displayed, setDisplayed] = useState(null);
    if (!history?.samples?.length || !history?.paths?.length) {
        return <p className="traffic-note">暂无路径概率记录：任务尚未进入选路阶段，或节点镜像未提供概率历史。</p>;
    }
    return <div className="traffic-probability-result">
        <Button icon={<LineChartOutlined />} onClick={() => setDisplayed(history)}>查看路径概率曲线</Button>
        <Modal title="SEC_PATH_MAB 路径选择概率" open={Boolean(displayed)} onCancel={() => setDisplayed(null)}
            footer={null} width={960} className="traffic-dialog" destroyOnClose>
            {displayed && <ProbabilityChart history={displayed} />}
        </Modal>
    </div>;
}
