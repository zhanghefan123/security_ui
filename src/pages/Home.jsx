import React from "react";
import {Link} from "react-router-dom";
import {ArrowRightOutlined, DeploymentUnitOutlined, GlobalOutlined} from "@ant-design/icons";
import "./Home.css";

function TopologyIllustration() {
    const nodes = [[82, 64], [82, 176], [188, 120], [294, 64], [294, 176], [400, 120]];
    const edges = [[0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5]];

    return (
        <svg viewBox="0 0 480 240" fill="none" aria-hidden="true" focusable="false">
            <g stroke="currentColor" strokeWidth="1.5" opacity="0.45">
                {edges.map(([from, to]) => <path key={`${from}-${to}`} d={`M ${nodes[from].join(" ")} L ${nodes[to].join(" ")}`} />)}
            </g>
            {nodes.map(([x, y], index) => (
                <g key={index} transform={`translate(${x} ${y})`}>
                    <circle r={index === 2 ? 29 : 23} fill="#10283b" stroke="currentColor" strokeOpacity="0.25" />
                    <rect x="-12" y="-9" width="24" height="18" rx="4" fill="#173b51" stroke="currentColor" />
                    <path d="M -6 -2 H 6 M -6 3 H 1" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="6" cy="3" r="1.5" fill="currentColor" />
                </g>
            ))}
            <g fill="currentColor"><circle cx="135" cy="92" r="3" /><circle cx="241" cy="148" r="3" /><circle cx="347" cy="92" r="3" /></g>
        </svg>
    );
}

function ConstellationIllustration() {
    return (
        <svg viewBox="0 0 480 240" fill="none" aria-hidden="true" focusable="false">
            <circle cx="240" cy="120" r="77" fill="#10283b" stroke="currentColor" strokeOpacity="0.5" />
            <g stroke="currentColor" strokeOpacity="0.22">
                <ellipse cx="240" cy="120" rx="35" ry="77" />
                <ellipse cx="240" cy="120" rx="61" ry="77" />
                <ellipse cx="240" cy="120" rx="77" ry="30" />
                <path d="M 163 120 H 317 M 240 43 V 197 M 174 81 H 306 M 174 159 H 306" />
            </g>
            <g stroke="currentColor" strokeOpacity="0.65">
                <ellipse cx="240" cy="120" rx="145" ry="49" transform="rotate(-25 240 120)" />
                <ellipse cx="240" cy="120" rx="132" ry="48" transform="rotate(32 240 120)" strokeDasharray="4 6" />
            </g>
            {[[113, 143], [351, 61], [326, 192]].map(([x, y], index) => (
                <g key={index} transform={`translate(${x} ${y}) rotate(-25)`} stroke="currentColor" fill="#173b51">
                    <rect x="-6" y="-7" width="12" height="14" rx="2" />
                    <path d="M -6 0 H -12 M 6 0 H 12" />
                    <rect x="-22" y="-5" width="10" height="10" rx="1" />
                    <rect x="12" y="-5" width="10" height="10" rx="1" />
                </g>
            ))}
        </svg>
    );
}

const workspaces = [
    {
        path: "/topology", number: "01", title: "拓扑配置", english: "TOPOLOGY WORKBENCH",
        description: "构建网络拓扑，配置节点与链路，开展路由控制与安全实验。",
        features: ["节点与链路编排", "安全攻防配置", "运行状态监测"],
        icon: <DeploymentUnitOutlined />, illustration: <TopologyIllustration />, action: "进入拓扑工作台",
    },
    {
        path: "/constellation", number: "02", title: "星座可视化", english: "CONSTELLATION SIMULATION",
        description: "配置卫星轨道与地面站，在三维场景中观察星座运行与链路连接。",
        features: ["卫星轨道配置", "地面站管理", "三维星座展示"],
        icon: <GlobalOutlined />, illustration: <ConstellationIllustration />, action: "进入星座仿真",
    },
];

export function Home() {
    return (
        <div className="portal-home">
            <div className="portal-shell">
                <header className="portal-header">
                    <div className="portal-brand">
                        <span className="portal-brand-icon"><DeploymentUnitOutlined /></span>
                        <div>
                            <div className="portal-eyebrow">LINK-AWARE ROUTING / CONTROL CENTER</div>
                            <p className="portal-brand-title">链路感知的安全可控路由原型系统</p>
                        </div>
                    </div>
                    <span className="portal-header-label">系统首页</span>
                </header>

                <main className="portal-main">
                    <section className="portal-intro" aria-labelledby="portal-title">
                        <div className="portal-eyebrow">NETWORK & CONSTELLATION</div>
                        <h1 id="portal-title">连接网络，探索星空</h1>
                        <p>从网络拓扑到卫星星座，选择工作台，开启仿真实验。</p>
                    </section>

                    <nav className="portal-workspaces" aria-label="选择仿真工作台">
                        {workspaces.map(workspace => (
                            <Link className="portal-card" to={workspace.path} key={workspace.path} aria-labelledby={`portal-title-${workspace.number}`}>
                                <div className="portal-card-top">
                                    <span className="portal-module-icon">{workspace.icon}</span>
                                    <span className="portal-module-number">WORKSPACE / {workspace.number}</span>
                                </div>
                                <div className="portal-illustration">{workspace.illustration}</div>
                                <div className="portal-card-content">
                                    <div className="portal-eyebrow">{workspace.english}</div>
                                    <h2 id={`portal-title-${workspace.number}`}>{workspace.title}</h2>
                                    <p>{workspace.description}</p>
                                    <ul className="portal-features">
                                        {workspace.features.map(feature => <li key={feature}>{feature}</li>)}
                                    </ul>
                                </div>
                                <div className="portal-card-action"><span>{workspace.action}</span><ArrowRightOutlined /></div>
                            </Link>
                        ))}
                    </nav>
                    <p className="portal-hint">选择上方工作台，进入对应的配置与可视化界面</p>
                </main>

                <footer className="portal-footer"><span>链路感知 · 安全可控 · 仿真验证</span><span>NETWORK SIMULATION PLATFORM</span></footer>
            </div>
        </div>
    );
}
