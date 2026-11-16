import React, {useEffect, useRef, useState} from "react";
import {Alert, Button, Form, Input, InputNumber, Tag} from "antd";
import {GetTxRateTest, startTxRateTest, stopTxRateTest} from "../requests/topology";

const defaults = {concurrency: 20, duration_seconds: 60, target_tps: 0, timeout_seconds: 30, drain_seconds: 30, prepare_seconds: 120};
const states = {preparing: "准备合约", running: "压测中", stopping: "等待交易与资源释放", completed: "已完成", failed: "失败"};
const active = task => ["preparing", "running", "stopping"].includes(task?.state);

export default function BlockchainBenchmark({ready, onTimes, onRates, isFisco, children}) {
    const [form] = Form.useForm();
    const [task, setTask] = useState(null);
    const [error, setError] = useState("");
    const [pollError, setPollError] = useState("");
    const [busy, setBusy] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const generation = useRef(0);
    const advancedRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        let timer;
        const poll = () => {
            const token = generation.current;
            GetTxRateTest(response => {
                if (cancelled || token !== generation.current) return;
                const next = response.data.task;
                setTask(next);
                onTimes(response.data.time_list.map(value => Number(value.toFixed(2))));
                onRates(response.data.rate_list);
                setPollError("");
                if (ready || active(next)) timer = setTimeout(poll, 1000);
            }, err => {
                if (cancelled || token !== generation.current) return;
                setPollError(err.response?.data?.message || "无法获取压测状态");
                if (ready) timer = setTimeout(poll, 3000);
            });
        };
        poll();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [ready, refresh, onTimes, onRates]);

    const mutate = (request, values) => {
        generation.current += 1;
        setBusy(true);
        setError("");
        const payload = values && Object.fromEntries(Object.entries(values).filter(([, value]) => value != null));
        request(response => {
            setTask(response.data.task);
            setBusy(false);
            setRefresh(value => value + 1);
        }, err => {
            setError(err.response?.data?.message || "压测操作失败");
            setBusy(false);
            setRefresh(value => value + 1);
        }, payload);
    };

    const download = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(task, null, 2)], {type: "application/json"}));
        const link = document.createElement("a");
        link.href = url;
        link.download = `tps-${task.id}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const latest = task?.samples.at(-1);
    const metrics = task ? [
        {label: "成功 TPS", value: (latest?.success_tps || 0).toFixed(2), unit: "笔/秒"},
        {label: "确认成功", value: task.succeeded.toLocaleString(), unit: "笔"},
        {label: "实际发送", value: (latest?.sent_rate || 0).toFixed(2), unit: "笔/秒"},
        {label: "平均确认延迟", value: task.mean_latency_ms.toFixed(2), unit: "ms"},
    ] : [];

    return <div className="blockchain-benchmark">
        <div className="benchmark-intro">
            <p className="topology-section-note">{ready ? "设置负载后开始压测，停止后等待在途交易确认。" : "启动区块链拓扑后，即可发起交易压测。"}</p>
            {task && <Tag color={{running: "cyan", completed: "green", failed: "red", stopping: "gold"}[task.state]}>{states[task.state] || task.state}</Tag>}
        </div>
        <Form form={form} layout="vertical" className="topology-settings-form" initialValues={defaults}
            disabled={busy || active(task)} onFinish={values => mutate(startTxRateTest, values)}
            onFinishFailed={() => { if (advancedRef.current) advancedRef.current.open = true; }}>
            <div className="benchmark-fields benchmark-basic-fields">
                <Form.Item name="concurrency" label="并发数" rules={[{required: true, message: "请填写并发数"}]}>
                    <InputNumber min={1} max={512} precision={0} />
                </Form.Item>
                <Form.Item name="duration_seconds" label="发送时长 · 秒" extra="0 表示手动停止" rules={[{required: true, message: "请填写发送时长"}]}>
                    <InputNumber min={0} max={3600} precision={0} />
                </Form.Item>
                <Form.Item name="target_tps" label="发送上限 · 笔/秒" extra="0 表示不限速" rules={[{required: true, message: "请填写发送上限"}]}>
                    <InputNumber min={0} max={1000000} />
                </Form.Item>
            </div>
            <details ref={advancedRef} className="topology-disclosure benchmark-advanced">
                <summary>高级参数<span className="topology-disclosure-hint">合约、超时与入口节点</span></summary>
                <div className="topology-disclosure-body">
                    <Form.Item name="contract" label={isFisco ? "已有 HelloWorld 合约地址" : "已有测试合约名称"}
                        extra={isFisco ? "留空时部署新合约" : "留空时使用默认准备流程"}>
                        <Input maxLength={256} />
                    </Form.Item>
                    <div className="benchmark-fields">
                        <Form.Item name="timeout_seconds" label="确认超时 · 秒" rules={[{required: true, message: "请填写确认超时"}]}>
                            <InputNumber min={1} max={600} precision={0} />
                        </Form.Item>
                        <Form.Item name="drain_seconds" label="停止后等待 · 秒" rules={[{required: true, message: "请填写等待时间"}]}>
                            <InputNumber min={1} max={600} precision={0} />
                        </Form.Item>
                        <Form.Item name="prepare_seconds" label="合约准备超时 · 秒" rules={[{required: true, message: "请填写准备超时"}]}>
                            <InputNumber min={1} max={600} precision={0} />
                        </Form.Item>
                        {isFisco && <Form.Item name="fisco_node_id" label="FISCO 入口节点" extra="留空自动选择">
                            <InputNumber min={1} precision={0} placeholder="自动选择" />
                        </Form.Item>}
                    </div>
                </div>
            </details>
        </Form>
        <div className="benchmark-actions">
            <Button type="primary" disabled={!ready || busy || active(task)} onClick={() => form.submit()}>开始压测</Button>
            <Button danger disabled={busy || !active(task) || task?.state === "stopping"} onClick={() => mutate(stopTxRateTest, {task_id: task.id})}>停止压测</Button>
            <Button disabled={!task || active(task)} onClick={download}>导出结果</Button>
        </div>
        {task?.state === "stopping" && <Alert type="info" showIcon message={`等待 ${task.sdk_active} 个 SDK 调用及资源清理；结束前不能启动新任务。`} />}
        {(error || pollError || task?.error || task?.export_error) && <Alert type="warning" showIcon message={error || pollError || task?.error || task?.export_error} />}
        {task ? <section className="benchmark-results" aria-label="本次压测结果">
            <dl className="benchmark-metrics">
                {metrics.map(metric => <div key={metric.label}>
                    <dt>{metric.label}</dt><dd>{metric.value}<span>{metric.unit}</span></dd>
                </div>)}
            </dl>
            <div className="benchmark-counts">
                <span>已发起 <strong>{task.sent}</strong></span>
                <span>失败 <strong>{task.failed}</strong></span>
                <span>结果未知 <strong>{task.unknown}</strong></span>
                <span>在途 <strong>{task.in_flight}</strong></span>
            </div>
            {children}
            <details className="topology-disclosure benchmark-task-details">
                <summary>任务详情<span className="topology-disclosure-hint">合约与统计口径</span></summary>
                <div className="topology-disclosure-body">
                    <dl className="benchmark-metadata">
                        <div><dt>工作负载</dt><dd>{task.workload}</dd></div>
                        <div><dt>合约</dt><dd>{task.contract || "准备中"}</dd></div>
                        <div><dt>准备耗时</dt><dd>{task.prepare_seconds.toFixed(2)} 秒</dd></div>
                        <div><dt>P95 延迟上界</dt><dd>{task.p95_latency_ms.toFixed(0)} ms</dd></div>
                        <div><dt>重复确认</dt><dd>{task.duplicates}</dd></div>
                    </dl>
                    <p className="topology-section-note">TPS 只统计本次交易的成功确认，合约准备不计时。三种链使用不同测试合约，不能直接作为等价负载比较。</p>
                </div>
            </details>
        </section> : <p className="benchmark-empty">开始压测后，将在这里展示确认速率、交易统计与 TPS 曲线。</p>}
    </div>;
}
