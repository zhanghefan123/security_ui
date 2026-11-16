import React from "react";
import {Alert, Checkbox, Form, InputNumber, Select, Space} from "antd";
import {chainmakerCarriers, defaultChainmakerMab, topologyProtocolError} from "../entities/topology_protocols";

export function TopologyProtocols({value, onChange, disabled, hasChainmaker = false}) {
    const update = patch => onChange({...value, ...patch});
    const learning = value.chainmaker_p2p === "SEC_PATH_MAB";
    const mab = {...defaultChainmakerMab(), ...value.chainmaker_mab};
    const updateMab = patch => update({chainmaker_mab: {...mab, ...patch}});
    const error = topologyProtocolError(value);
    return <section className="topology-protocols" aria-label="拓扑协议选择">
        <p>配置本次拓扑的网络能力，启动后需停止拓扑才能修改。</p>
        <Space wrap style={{marginBottom: 16}}>
            {[["ospfv2", "OSPFv2（IPv4）"], ["ospfv3", "OSPFv3（IPv6）"], ["srv6", "SRv6"], ["lir", "LiR"]].map(([key, label]) =>
                <Checkbox key={key} checked={value[key]} disabled={disabled} onChange={e => update({[key]: e.target.checked})}>{label}</Checkbox>)}
            <Checkbox checked={value.path_validation} disabled={disabled}
                onChange={e => update({path_validation: e.target.checked, ...(!e.target.checked ? {sec_path_mab: 0, routing_table_type: 1} : {})})}>路径验证协议</Checkbox>
        </Space>
        <p>LiR 默认开启，与路径验证独立；OSPFv2 和 OSPFv3 可以同时开启。</p>
        {(hasChainmaker || (value.chainmaker_p2p && value.chainmaker_p2p !== "IP")) && <>
            <Form.Item label="ChainMaker P2P 承载协议" labelCol={{span: 24}}>
                <Select popupClassName="topology-protocol-dropdown" aria-label="ChainMaker P2P 承载协议"
                    value={value.chainmaker_p2p || "IP"} disabled={disabled}
                    onChange={chainmaker_p2p => update({chainmaker_p2p,
                        ...(chainmaker_p2p === "SEC_PATH_MAB" ? {path_validation: true, sec_path_mab: 1,
                            routing_table_type: value.routing_table_type === 3 ? 1 : value.routing_table_type,
                            chainmaker_mab: {batch_size: mab.batch_size, learning_rate: mab.learning_rate, minimum_delivery_ratio: mab.minimum_delivery_ratio}}
                            : learning ? {sec_path_mab: 0} : {})})}
                    options={chainmakerCarriers} />
            </Form.Item>
            <p>此选项控制 ChainMaker 节点之间的真实 P2P 连接；RPC 和管理接口保持原有通信。</p>
            <p>ICING、OPT、SELiR、EPIC 需要开启路径验证；可以独立关闭 LiR。SELiR 和 EPIC 的版本沿用后端拓扑配置。</p>
            {learning && <>
                <p>每个 ChainMaker 自动学习到所有其他 ChainMaker 的路径，各目标独立采样、反馈和更新概率。候选保留全部最短路，并加入无环候选图允许的不同跳数绕行路径；不保证覆盖全部绕行。学习随拓扑持续运行，没有业务时等待，不需要选择节点对。</p>
                <Space wrap>
                    <Form.Item label="批次包数"><InputNumber aria-label="批次包数" min={1} max={60000} precision={0} disabled={disabled} value={mab.batch_size} onChange={batch_size => updateMab({batch_size})} /></Form.Item>
                    <Form.Item label="学习率"><InputNumber aria-label="学习率" min={.000001} max={1} step={.01} disabled={disabled} value={mab.learning_rate} onChange={learning_rate => updateMab({learning_rate})} /></Form.Item>
                    <Form.Item label="最小交付率（%）"><InputNumber aria-label="最小交付率（%）" min={.01} max={99.99} step={1} disabled={disabled} value={mab.minimum_delivery_ratio * 100} onChange={rate => updateMab({minimum_delivery_ratio: rate == null ? null : rate / 100})} /></Form.Item>
                </Space>
                <p>以上参数应用于各节点的每个目标。所有 P2P 方向及纯 TCP ACK 均走 SEC_PATH_MAB；纯 ACK 不占学习批次的采样配额。</p>
            </>}
        </>}
        {value.path_validation && <>
            <Form.Item label="路由表类型" labelCol={{span: 24}}>
                <Select popupClassName="topology-protocol-dropdown" aria-label="路由表类型" value={value.routing_table_type} disabled={disabled} onChange={routing_table_type => update({routing_table_type})}
                    options={[{value: 1, label: "单播数组表"}, {value: 2, label: "哈希表（单播 / 组播）"}, {value: 3, label: "多路径实验表（不兼容 LiR）"}]} />
            </Form.Item>
            <Form.Item label="SEC_PATH_MAB 策略" labelCol={{span: 24}}>
                <Select popupClassName="topology-protocol-dropdown" aria-label="SEC_PATH_MAB 策略" value={value.sec_path_mab} disabled={disabled || learning} onChange={sec_path_mab => update({sec_path_mab})}
                    options={[{value: 0, label: "关闭"}, {value: 1, label: "固定批次"}, {value: 2, label: "动态批次"}, {value: 3, label: "路径级 MAB"}]} />
            </Form.Item>
            {value.sec_path_mab > 0 && <p>SEC_PATH_MAB 要求拓扑满足其路径结构约束，启动前由后端校验。</p>}
        </>}
        {error && <Alert type="error" showIcon message={error} />}
    </section>;
}
