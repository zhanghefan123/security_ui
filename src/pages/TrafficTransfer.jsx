import React, {useEffect, useRef, useState} from "react";
import {Alert, Button, Collapse, Form, InputNumber, Modal, Select} from "antd";
import {SendOutlined, StopOutlined} from "@ant-design/icons";
import TrafficPathProbabilities from "./TrafficPathProbabilities";
import "./TrafficTransfer.css";

export const networkLabels = {IP: "IPv4", IPV6: "IPv6", SRV6: "SRv6", LIR: "LiR", ICING: "ICING", OPT: "OPT", SELIR: "SELiR", EPIC: "EPIC", SEC_PATH_MAB: "SEC_PATH_MAB"};
export const defaultNetworks = Object.entries(networkLabels).map(([value, label]) => ({value, label}));
const networkCapabilities = {IP: "ipv4", IPV6: "ipv6", SRV6: "srv6", LIR: "lir", ICING: "path_validation", OPT: "path_validation", SELIR: "path_validation", EPIC: "path_validation"};
export const supported = (node, mode) => mode === "SEC_PATH_MAB" ? Boolean(node?.sec_path_mab) : Boolean(node?.[networkCapabilities[mode]]);
export const activeStates = new Set(["preparing", "running", "draining", "stopping"]);
const stateNames = {preparing: "正在准备", running: "正在传输", draining: "等待接收完成", stopping: "正在停止", completed: "已完成", cancelled: "已停止", failed: "传输失败"};
const failureText = error => error.response?.data?.message || error.message || "传输请求失败";

export function useTraffic(enabled, api) {
    const [task, setTask] = useState(null);
    const [p2p, setP2P] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [pending, setPending] = useState(false);
    const sessionRef = useRef(null);
    useEffect(() => {
        setTask(null); setP2P(null); setNodes([]); setError(""); setActionError(""); setPending(false);
        if (!enabled) return;
        const session = {controller: new AbortController(), revision: 0, pending: false};
        sessionRef.current = session;
        let timer;
        const poll = async () => {
            const revision = session.revision;
            try {
                const data = await api.get(session.controller.signal);
                if (sessionRef.current !== session || revision !== session.revision || session.pending) return;
                setTask(data.task); setP2P(data.p2p || null); setNodes(data.nodes || data.stations || []); setError("");
            } catch (error) {
                if (!session.controller.signal.aborted && revision === session.revision) setError(failureText(error));
            } finally {
                if (!session.controller.signal.aborted) timer = setTimeout(poll, 1000);
            }
        };
        poll();
        return () => { sessionRef.current = null; session.controller.abort(); clearTimeout(timer); };
    }, [enabled, api]);
    const act = async (request) => {
        const session = sessionRef.current;
        if (!session || session.pending) return false;
        session.pending = true; session.revision++; setPending(true); setActionError("");
        try {
            const data = await request(session.controller.signal);
            if (sessionRef.current !== session) return false;
            setTask(data.task); setError(""); return true;
        } catch (error) {
            if (!session.controller.signal.aborted) setActionError(failureText(error));
            return false;
        } finally {
            session.pending = false; session.revision++;
            if (sessionRef.current === session) setPending(false);
        }
    };
    const stale = Boolean(error) || (task && task.sampling_supported !== false && activeStates.has(task.state) && task.state !== "preparing" &&
        (!task.sampled_at || Date.now() - Date.parse(task.sampled_at) > 5000));
    return {task, p2p, nodes, error, actionError, pending, stale, active: Boolean(task && activeStates.has(task.state)),
        start: params => act(signal => api.start(params, signal)),
        stop: () => task && act(signal => api.stop(task.id, signal))};
}

const stationLabel = station => station.label && station.label !== station.name
    ? `${station.label} · ${station.name}` : station.name;
const bytes = value => `${((value || 0) / 1024 / 1024).toFixed(2)} MiB`;

export function TrafficPanel({source, onClose, traffic, title = "节点传输", networks = defaultNetworks}) {
    const [form] = Form.useForm();
    const network = Form.useWatch("network", form) || "IPV6";
    const transport = Form.useWatch("transport", form) || "UDP";
    const maxPayload = transport === "UDP" ? (["IPV6", "SRV6"].includes(network) ? 1400 : 548) : 65536;
    const selectedTarget = Form.useWatch("target", form);
    const sourceNode = traffic.nodes.find(n => n.name === source?.containerName);
    const targetNode = traffic.nodes.find(n => n.name === selectedTarget);
    const sourceSupports = mode => supported(sourceNode, mode) && (mode !== "SEC_PATH_MAB" || Boolean(sourceNode?.mab_target));
    const initialNetwork = networks.find(n => sourceSupports(n.value))?.value || networks[0].value;
    useEffect(() => {
        if (!source) return;
        form.resetFields();
        form.setFieldsValue({network: initialNetwork});
    }, [source, initialNetwork, form]);
    const submit = async values => {
        if (await traffic.start({...values, mab: values.network === "SEC_PATH_MAB" ? values.mab : undefined, source: source.containerName})) onClose();
    };
    return <Modal title={<span><SendOutlined /> {title}</span>} open={Boolean(source)} onCancel={onClose}
        footer={null} rootClassName="traffic-dialog" width={540}>
        <p className="traffic-source">源节点 <strong>{source?.name}</strong></p>
        <Form form={form} layout="vertical" onFinish={submit} initialValues={{network: "IPV6", transport: "UDP", duration: 30, rate_mbps: 1, payload_size: 512, mab: {batch_size:100,mini_batch_size:20,learning_rate:0.01,minimum_delivery_ratio:0.9}}}>
            <Form.Item name="target" label="目标节点" rules={[{required: true, message: "请选择另一个节点"}]}>
                <Select placeholder="选择接收数据的节点" options={traffic.nodes.filter(n => n.name !== source?.containerName).map(n => ({
                    value: n.name, label: stationLabel(n), disabled: !supported(n, network) || (network === "SEC_PATH_MAB" && n.name !== sourceNode?.mab_target),
                }))} popupClassName="traffic-select-dropdown" />
            </Form.Item>
            <div className="traffic-form-grid">
                <Form.Item name="network" label="网络模式"><Select onChange={() => form.setFieldValue("target", undefined)} options={networks.map(n => ({...n, disabled: !sourceSupports(n.value)}))} popupClassName="traffic-select-dropdown" /></Form.Item>
                <Form.Item name="transport" label="传输协议"><Select options={[{value: "UDP", label: "UDP"}, {value: "TCP", label: "TCP"}]} popupClassName="traffic-select-dropdown" /></Form.Item>
                <Form.Item name="duration" label="持续时间（秒）" rules={[{required: true}]}><InputNumber min={1} max={120} precision={0} /></Form.Item>
                <Form.Item name="rate_mbps" label="目标发送速率（Mbps）" rules={[{required: true}]}><InputNumber min={0.01} max={10} step={0.1} /></Form.Item>
                <Form.Item name="payload_size" dependencies={["network", "transport"]} label={transport === "UDP" ? "UDP 报文大小（字节）" : "每次写入大小（字节）"} rules={[{required: true, type: "number", min: 24, max: maxPayload, message: `请输入 24～${maxPayload} 字节`}]}><InputNumber min={24} max={maxPayload} precision={0} /></Form.Item>
            </div>
            {network === "SEC_PATH_MAB" && <><Alert type="info" showIcon message={`学习目标：${sourceNode?.mab_target || "当前节点不是学习源"}`} description="沿用拓扑启动时的学习策略，支持手动调整链路 ratio；不启用自动故障调度。按正向数据包着色，学习反馈和 TCP 回程不参与链路采样。" />
                <Collapse items={[{key:"mab",label:"高级学习参数",children:<div className="traffic-form-grid">
                    <Form.Item name={["mab","batch_size"]} label="批次包数" rules={[{required:true,type:"number",min:1,max:60000}]}><InputNumber min={1} max={60000} precision={0}/></Form.Item>
                    <Form.Item name={["mab","mini_batch_size"]} label="微批次包数（动态策略）" rules={[{required:true,type:"number",min:1,max:60000}]}><InputNumber min={1} max={60000} precision={0}/></Form.Item>
                    <Form.Item name={["mab","learning_rate"]} label="学习率" rules={[{required:true,type:"number",min:0.000001,max:1}]}><InputNumber min={0.000001} max={1} step={0.01}/></Form.Item>
                    <Form.Item name={["mab","minimum_delivery_ratio"]} label="最小交付率" rules={[{required:true,type:"number",min:0.000001,max:0.999999}]}><InputNumber min={0.000001} max={0.999999} step={0.01}/></Form.Item>
                </div>}]} /></>}
            <p className="traffic-note">{network === "SEC_PATH_MAB" && "学习控制器根据反馈选路。"}红色深浅显示每秒正向接口报文数。目标速率是应用发送上限，实际速率受链路及协议影响。发送持续时间最多 120 秒，离开页面后仍会自动结束。</p>
            {["SELIR", "EPIC"].includes(network) && <p className="traffic-note">SELiR 快慢版本、EPIC L3/L4 使用当前拓扑配置，两端需保持一致。</p>}
            {!["IP", "IPV6", "SRV6"].includes(network) && <p className="traffic-note">任务结束或停止后自动释放本次协议映射；等待清理完成后可切换协议。</p>}
            {sourceNode && !networks.some(n => supported(sourceNode, n.value)) && <Alert type="warning" showIcon message="该节点没有可用的传输协议，请检查节点网络配置。" />}
            {traffic.active && <Alert type="info" showIcon message="已有传输任务，请先在任务卡片中停止。" />}
            {(traffic.error || traffic.actionError) && <Alert type="error" showIcon message={traffic.actionError || traffic.error} />}
            <div className="traffic-form-actions"><Button onClick={onClose}>关闭</Button><Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={traffic.pending}
                disabled={traffic.active || Boolean(traffic.error) || !sourceSupports(network) || !supported(targetNode, network) || (network === "SEC_PATH_MAB" && selectedTarget !== sourceNode?.mab_target)}>开始传输</Button></div>
        </Form>
    </Modal>;
}

export function TrafficCard({traffic, title = "节点传输"}) {
    const {task} = traffic;
    if (!task && !traffic.error) return null;
    const label = name => {
        const station = traffic.nodes.find(n => n.name === name);
        return station?.label || name;
    };
    const maximum = Math.max(0, ...Object.values(task?.links || {}).map(l => l.forward_pps || 0));
    return <section className="traffic-card" aria-label={`${title}任务`}>
        <div className="traffic-card-heading"><span><SendOutlined /> {title}</span>{task && <span aria-live="polite" className={`traffic-task-state ${traffic.active ? "is-active" : ""}`}>{stateNames[task.state] || task.state}</span>}</div>
        {task && <>
            {traffic.p2p && <p className="traffic-note">拓扑链路当前显示真实 ChainMaker P2P 流量；下方为独立测试任务的统计。</p>}
            <div className="traffic-endpoints">{label(task.source)} <span>→</span> {label(task.target)}</div>
            <div className="traffic-task-meta">{networkLabels[task.network] || task.network} · {task.transport} · {task.duration} 秒 · {task.rate_mbps} Mbps</div>
            <div className="traffic-task-metrics">{task.sampling_supported !== false && <span>最高链路包速率 <strong>{traffic.stale ? "未知" : `${Math.round(maximum).toLocaleString()} 包/秒`}</strong></span>}
                {!traffic.active && <><span>发送 / 接收 <strong>{bytes(task.sent_bytes)} / {bytes(task.received_bytes)}</strong></span>
                    <span>接收有效吞吐 <strong>{(task.goodput_mbps || 0).toFixed(3)} Mbps</strong></span></>}</div>
            {task.sampling_supported !== false ? <><div className="traffic-color-legend"><span>少</span><i /><span>多 · ≥ 1000 包/秒</span></div>
                <p className="traffic-note">按接收接口计数。网络卸载可能合并报文，计数不等同于物理线速包数。</p>
                {task.sampling_note && <p className="traffic-note">{task.sampling_note}</p>}</> : <p className="traffic-note">{task.sampling_note || "当前协议仅统计端点收发，不提供逐链路着色。"}</p>}
            {(traffic.stale || task.sample_error || task.sample_drops > 0) && <p className="traffic-warning">{traffic.stale ? "统计暂不可用，已恢复链路原色。" : task.sample_error ? `采集异常：${task.sample_error}` : `采集器丢失 ${task.sample_drops} 个报文，统计可能偏低。`}</p>}
            {task.error && <p className="traffic-error">{task.error}</p>}
            {!traffic.active && task.network === "SEC_PATH_MAB" &&
                <TrafficPathProbabilities key={task.id} history={task.path_probability_history} />}
            {traffic.active && <Button size="small" danger icon={<StopOutlined />} loading={traffic.pending || task.state === "stopping"} onClick={traffic.stop}>停止传输</Button>}
        </>}
        {(traffic.error || traffic.actionError) && <p className="traffic-error">{traffic.actionError || traffic.error}</p>}
    </section>;
}

export function intensity(pps) {
    if (pps >= 1000) return {color: "#ce263c", width: 5};
    if (pps >= 100) return {color: "#ef4d52", width: 4};
    if (pps >= 10) return {color: "#ff8179", width: 3};
    return {color: "#ffb6a9", width: 2};
}
