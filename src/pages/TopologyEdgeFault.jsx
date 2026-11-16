import React, {useEffect, useRef, useState} from "react";
import {Alert, Button, Checkbox, Form, InputNumber, Modal, Space, Spin, Typography, message} from "antd";
import {getTopologyEdgeFault, setTopologyEdgeFault} from "../requests/topology_edge_fault";

const endpoint = value => String(value).replace(/_(\d+)$/, "-$1");
const percent = fault => (fault?.corrupt_ppm ?? 0) / 10000;
const toPPM = value => Math.round(value * 10000);
const errorText = error => error.response?.data?.message || error.message || "链路配置请求失败";

// 运行值只从内核回读，不能用画布中的启动配置替代。
export default function TopologyEdgeFault({edge, running, onClose, onConfigured}) {
    const [form] = Form.useForm();
    const [busy, setBusy] = useState(false);
    const [snapshot, setSnapshot] = useState(null);
    const [error, setError] = useState("");
    const [same, setSame] = useState(false);
    const [save, setSave] = useState(false);
    const controller = useRef(null);
    const source = endpoint(edge.source);
    const target = endpoint(edge.target);

    function fill(forward, reverse) {
        form.setFieldsValue({forward: percent(forward), reverse: percent(reverse)});
        setSame(percent(forward) === percent(reverse));
    }

    async function refresh() {
        controller.current?.abort();
        const request = new AbortController();
        controller.current = request;
        setBusy(true);
        setError("");
        setSnapshot(null);
        try {
            const result = await getTopologyEdgeFault(edge.edge_id, request.signal);
            if (request.signal.aborted) return;
            setSnapshot(result);
            if (result.forward.fault && result.reverse.fault) fill(result.forward.fault, result.reverse.fault);
        } catch (e) {
            if (!request.signal.aborted) setError(errorText(e));
        } finally {
            if (!request.signal.aborted) setBusy(false);
        }
    }

    useEffect(() => {
        if (running) refresh();
        else fill(edge.forward_fault, edge.reverse_fault);
        return () => controller.current?.abort();
        // 父组件按链路与运行状态设置 key，每次打开都重新读取。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const failures = snapshot ? [snapshot.reason, snapshot.forward.error, snapshot.reverse.error].filter(Boolean) : [];
    const writable = !running || (!!snapshot?.manual_available && !!snapshot.forward.fault && !!snapshot.reverse.fault);

    async function apply() {
        let values;
        try { values = await form.validateFields(); } catch { return; }
        const forward = toPPM(values.forward);
        const reverse = toPPM(same ? values.forward : values.reverse);
        if (!running) {
            onConfigured({
                forward_fault: {...edge.forward_fault, drop_ppm: edge.forward_fault?.drop_ppm ?? 0, corrupt_ppm: forward},
                reverse_fault: {...edge.reverse_fault, drop_ppm: edge.reverse_fault?.drop_ppm ?? 0, corrupt_ppm: reverse},
            }, false);
            onClose();
            return;
        }
        const request = new AbortController();
        controller.current = request;
        setBusy(true);
        setError("");
        try {
            const result = await setTopologyEdgeFault({edge_id: edge.edge_id, forward_ppm: forward, reverse_ppm: reverse}, request.signal);
            if (request.signal.aborted) return;
            setSnapshot(result);
            if (!result.forward.applied || !result.reverse.applied) {
                setError("未全部应用成功。请查看各方向结果，刷新当前值后重试；已成功的方向不会自动回滚。");
                return;
            }
            fill(result.forward.fault, result.reverse.fault);
            message.success("两个方向的篡改概率已应用并回读确认");
            if (save) {
                onConfigured({forward_fault: result.forward.fault, reverse_fault: result.reverse.fault}, true);
                onClose();
            }
        } catch (e) {
            if (!request.signal.aborted) {
                setSnapshot(null);
                setError(`${errorText(e)}；当前值可能已改变，请刷新确认。`);
            }
        } finally {
            if (!request.signal.aborted) setBusy(false);
        }
    }

    const ratioRules = [{required: true, type: "number", min: 0, max: 100, message: "请输入 0–100 的百分比"}];
    return <Modal open title="链路故障配置" onCancel={busy ? undefined : onClose} closable={!busy} maskClosable={false}
        footer={<Space><Button disabled={busy} onClick={onClose}>关闭</Button>
            {running && <Button disabled={busy} onClick={refresh}>刷新当前值</Button>}
            <Button type="primary" loading={busy} disabled={!writable} onClick={apply}>{running ? "应用到运行拓扑" : "确定"}</Button></Space>}>
        <Space direction="vertical" size="middle" style={{width: "100%"}}>
            <Typography.Text strong>{source} ↔ {target}</Typography.Text>
            <Typography.Text type="secondary">链路标识：{edge.edge_id}</Typography.Text>
            <Alert type="info" showIcon message="仅影响 SEC_PATH_MAB 数据包"
                description="篡改认证值的概率，默认 0%。不影响 ACK、会话建立包及其他协议；设为 0% 可取消篡改。原有主动丢包配置保持不变。" />
            {error && <Alert type="error" showIcon message={error} />}
            {failures.map((text, i) => <Alert key={i} type="warning" showIcon message={text} />)}
            {running && snapshot && <div>
                {[[snapshot.forward, `${source} → ${target}`], [snapshot.reverse, `${target} → ${source}`]].map(([direction, label]) =>
                    <div key={label}>{label}：{direction.fault ? `当前篡改 ${percent(direction.fault)}% · 主动丢包 ${direction.fault.drop_ppm / 10000}%` : "当前值未知"}{direction.applied ? "（已应用）" : ""}</div>)}
            </div>}
            <Spin spinning={busy}>
                <Form form={form} layout="vertical" disabled={busy || !writable}>
                    <Form.Item label={`${source} → ${target} 篡改概率`} name="forward" rules={ratioRules}>
                        <InputNumber min={0} max={100} precision={4} step={1} addonAfter="%" style={{width: "100%"}} />
                    </Form.Item>
                    <Checkbox checked={same} disabled={busy || !writable} onChange={e => setSame(e.target.checked)}>双向使用相同篡改概率</Checkbox>
                    {!same && <Form.Item label={`${target} → ${source} 篡改概率`} name="reverse" rules={ratioRules}>
                        <InputNumber min={0} max={100} precision={4} step={1} addonAfter="%" style={{width: "100%"}} />
                    </Form.Item>}
                </Form>
            </Spin>
            {running ? <>
                <Checkbox checked={save} disabled={busy} onChange={e => setSave(e.target.checked)}>应用成功后保存为下次启动配置</Checkbox>
                <Typography.Text type="secondary">默认仅修改本次运行。勾选保存后会打开“保存拓扑”窗口，填写名称并保存才会写入文件。可以在页面路径学习过程中手动修改；手动故障配置与自动故障调度互斥。</Typography.Text>
            </> : <Typography.Text type="secondary">确定后写入画布配置；使用“保存拓扑”可持久保存。启动时需启用 SEC_PATH_MAB 才会影响业务。</Typography.Text>}
        </Space>
    </Modal>;
}
