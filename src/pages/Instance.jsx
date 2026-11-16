import React, {useEffect, useState} from "react";
import {Alert, Button, Card, ConfigProvider, Empty, Spin, Tabs, Tag} from "antd";
import {ArrowLeftOutlined, CodeOutlined, PauseCircleOutlined, PlayCircleOutlined, ReloadOutlined} from "@ant-design/icons";
import {Link, useParams} from "react-router-dom";
import {getNodeDetails, openNodeShell, closeNodeShell, releaseNodeShell} from "../requests/instance";
import "./Instance.css";

const errorText = (error) => error?.response?.data?.message || error?.message || "请求失败，请重试";
const formatBytes = (value) => value == null ? "—" : value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(2)} GiB` : `${(value / 1024 ** 2).toFixed(1)} MiB`;

function TextSections({sections, emptyText}) {
    if (!sections?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText}/>;
    return sections.map((section) => <section className="instance-text-section" key={section.name}>
        <h3>{section.name}</h3>
        {section.error && <Alert type="warning" showIcon message="读取失败" description={section.error}/>}
        {!section.error && <pre>{section.content || "暂无条目"}</pre>}
        {section.truncated && <p>内容较长，仅显示前 128 KiB，可在终端中查看完整内容。</p>}
    </section>);
}

export function Instance() {
    const {containerName = ""} = useParams();
    const name = containerName.replace(/_(\d+)$/, "-$1");
    const isConstellationNode = /^(Satellite|GroundStation)-\d+$/.test(name);
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailsError, setDetailsError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [shell, setShell] = useState(null);
    const [shellError, setShellError] = useState("");
    const [shellAttempt, setShellAttempt] = useState(0);
    const [frameVersion, setFrameVersion] = useState(0);

    useEffect(() => { setSnapshot(null); setAutoRefresh(false); }, [name]);

    // Each request replaces the current snapshot; no history is retained.
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setDetailsError("");
        getNodeDetails(name, controller.signal).then(({data}) => {
            if (!controller.signal.aborted) setSnapshot(data);
        }).catch((error) => {
            if (!controller.signal.aborted) setDetailsError(errorText(error));
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [name, refresh]);

    // Wait until the previous request finishes, then schedule the next snapshot.
    // Switching off, changing nodes, refreshing manually or leaving cancels the timer.
    useEffect(() => {
        if (!autoRefresh || loading) return;
        const timer = setTimeout(() => setRefresh((value) => value + 1), 5000);
        return () => clearTimeout(timer);
    }, [autoRefresh, loading, name, refresh]);

    useEffect(() => {
        let disposed = false;
        let pid;
        setShell(null);
        setShellError("");
        // Defer creation so React's effect probe cannot create a second terminal.
        const timer = setTimeout(() => {
            openNodeShell(name).then(({data}) => {
                if (disposed) {
                    closeNodeShell(data.pid).catch(() => releaseNodeShell(data.pid));
                    return;
                }
                pid = data.pid;
                const address = data.address.includes(":") && !data.address.startsWith("[")
                    ? `[${data.address}]` : data.address;
                setShell({...data, url: `http://${address}:${data.port}`});
            }).catch((error) => {
                if (!disposed) setShellError(errorText(error));
            });
        }, 0);
        const onPageHide = () => {
            disposed = true;
            clearTimeout(timer);
            if (pid) { releaseNodeShell(pid); pid = undefined; }
        };
        const onPageShow = (event) => {
            if (event.persisted) setShellAttempt((value) => value + 1);
        };
        window.addEventListener("pagehide", onPageHide);
        window.addEventListener("pageshow", onPageShow);
        return () => {
            disposed = true;
            clearTimeout(timer);
            window.removeEventListener("pagehide", onPageHide);
            window.removeEventListener("pageshow", onPageShow);
            if (pid) closeNodeShell(pid).catch(() => releaseNodeShell(pid));
        };
    }, [name, shellAttempt]);

    const capturedAt = snapshot?.captured_at ? new Date(snapshot.captured_at).toLocaleString("zh-CN") : "尚未获取";
    const running = snapshot?.status === "running";

    return <ConfigProvider theme={{token: {
        colorPrimary: "#55c8e8", colorBgContainer: "#111d2e", colorBorderSecondary: "#24354a",
        colorText: "#e6edf7", colorTextSecondary: "#8da2bb", borderRadius: 10,
    }}}>
        <main className="instance-workbench">
            <header className="instance-header">
                <div className="instance-brand">
                    <span className="instance-brand-icon"><CodeOutlined/></span>
                    <div><div className="instance-eyebrow">节点控制台</div><h1>{name}</h1></div>
                    <Tag color={running ? "green" : "default"}>{running ? "运行中" : snapshot?.status || "待获取"}</Tag>
                </div>
                <Link to={isConstellationNode ? "/constellation" : "/topology"} className="instance-back"><ArrowLeftOutlined/> {isConstellationNode ? "返回星座" : "返回拓扑"}</Link>
            </header>
            <div className="instance-toolbar">
                <div><h2>节点概览</h2><p>采集时间：{capturedAt}{loading && snapshot ? " · 正在刷新" : ""}</p><p>{autoRefresh ? "定时刷新已开启 · 每次请求完成后间隔 5 秒刷新" : "手动模式 · 点击按钮更新节点信息"}</p></div>
                <div className="instance-refresh-actions">
                    <Button icon={<ReloadOutlined/>} loading={loading} onClick={() => setRefresh((value) => value + 1)}>手动刷新</Button>
                    <Button className={autoRefresh ? "instance-auto-refresh is-active" : "instance-auto-refresh"}
                        aria-pressed={autoRefresh}
                        icon={autoRefresh ? <PauseCircleOutlined/> : <PlayCircleOutlined/>}
                        onClick={() => setAutoRefresh((value) => !value)}>
                        {autoRefresh ? "停止定时刷新" : "开启定时刷新（5秒）"}
                    </Button>
                </div>
            </div>
            {detailsError && <Alert type="error" showIcon message="节点信息获取失败" description={detailsError}/>}
            {snapshot?.stats_error && <Alert type="warning" showIcon message="资源信息暂不可用" description={snapshot.stats_error}/>}
            <section className="instance-metrics" aria-label="节点资源信息">
                <Card><div className="instance-metric-label">CPU 使用率</div><div className="instance-metric-value">{snapshot?.cpu_percent == null ? "—" : `${snapshot.cpu_percent.toFixed(1)}%`}</div><p>100% 对应一个逻辑核心</p></Card>
                <Card><div className="instance-metric-label">内存使用</div><div className="instance-metric-value">{formatBytes(snapshot?.memory_bytes)}</div><p>可用上限 {snapshot?.memory_limit ? formatBytes(snapshot.memory_limit) : "—"}</p></Card>
                <Card><div className="instance-metric-label">CPU 配额</div><div className="instance-metric-value">{snapshot ? (snapshot.cpu_limit > 0 ? `${snapshot.cpu_limit} 核` : "未限制") : "—"}</div><p title={snapshot?.container_id}>容器 ID：{snapshot?.container_id?.slice(0, 12) || "—"}</p></Card>
                <Card><div className="instance-metric-label">容器镜像</div><div className="instance-image-name">{snapshot?.image || "—"}</div><p>启动时间：{snapshot?.started_at ? new Date(snapshot.started_at).toLocaleString("zh-CN") : "—"}</p></Card>
            </section>
            <section className="instance-content">
                <Card title={<><CodeOutlined/> WebShell</>} className="instance-terminal"
                    extra={shell && <Button size="small" icon={<ReloadOutlined/>} onClick={() => setFrameVersion((value) => value + 1)}>重载终端</Button>}>
                    {shell ? <iframe key={`${shell.pid}-${frameVersion}`} title={`${name} WebShell`} src={shell.url}/>
                        : shellError ? <div className="instance-terminal-state"><Alert type="error" showIcon message="终端连接失败" description={shellError}/><Button onClick={() => setShellAttempt((value) => value + 1)}>重试连接</Button></div>
                            : <div className="instance-terminal-state"><Spin/><p>正在连接节点终端…</p></div>}
                </Card>
                <Card className="instance-details" title="节点详情">
                    <Tabs items={[
                        {key: "routes", label: "路由条目", children: <TextSections sections={snapshot?.routes} emptyText={loading ? "正在读取路由…" : "暂无路由信息"}/>},
                        {key: "configs", label: "配置文件", children: <TextSections sections={snapshot?.configs} emptyText={loading ? "正在读取配置…" : "暂无配置信息"}/>},
                    ]}/>
                </Card>
            </section>
        </main>
    </ConfigProvider>;
}
