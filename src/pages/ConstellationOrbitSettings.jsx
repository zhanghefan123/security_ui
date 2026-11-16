import React from "react";
import {Form, InputNumber, Select} from "antd";

export const DEFAULT_ORBIT_CONFIG = Object.freeze({
    altitude_km: 762.304154, inclination_deg: 90, raan_span_deg: 180, phase_offset_deg: 0,
});

export function ConstellationOrbitSettings({config, orbitNumber, satellitePerOrbit, disabled}) {
    const angle = Number.isFinite(config.inclination_deg) ? config.inclination_deg : 90;
    const kind = angle === 90 ? "近圆极轨" : angle === 0 || angle === 180 ? "近圆赤道轨道" : "近圆倾斜轨道";
    const numberRule = (min, max) => [{required: true, type: "number", min, max, message: `请输入 ${min}–${max} 之间的数值`}];
    return <div className="constellation-orbit-settings">
        <div className="constellation-field-grid">
            <Form.Item name={["orbit_config", "altitude_km"]} label="标称轨道高度（km）" rules={numberRule(200, 2000)}>
                <InputNumber min={200} max={2000} precision={3} disabled={disabled} />
            </Form.Item>
            <Form.Item name={["orbit_config", "inclination_deg"]} label="轨道倾角（°）" rules={numberRule(0, 180)}>
                <InputNumber min={0} max={180} precision={3} disabled={disabled} />
            </Form.Item>
            <Form.Item name={["orbit_config", "raan_span_deg"]} label="轨道面分布范围" rules={[{required: true}]}>
                <Select disabled={disabled} popupClassName="constellation-select-dropdown" options={[
                    {label: "180° · 半周分布", value: 180}, {label: "360° · 全周分布", value: 360},
                ]} />
            </Form.Item>
            <Form.Item name={["orbit_config", "phase_offset_deg"]} label="相邻轨道相位差（°）" rules={numberRule(0, 359.999)}>
                <InputNumber min={0} max={359.999} precision={3} disabled={disabled} />
            </Form.Item>
        </div>
        <div className="constellation-orbit-summary" aria-label="星座构型概览">
            <strong>{kind} · {orbitNumber || "—"} 轨 × {satellitePerOrbit || "—"} 星</strong>
            <span>标称高度 {Number.isFinite(config.altitude_km) ? config.altitude_km.toFixed(3) : "—"} km · 倾角 {config.inclination_deg ?? "—"}°</span>
            <span>轨道面间隔 {orbitNumber > 0 ? (config.raan_span_deg / orbitNumber).toFixed(2) : "—"}° · 邻轨相位差 {config.phase_offset_deg ?? "—"}°</span>
        </div>
        <p className="constellation-field-note">轨道参数在内部转换为 TLE；实际高度随轨道传播变化。相位差表示下一轨道同编号卫星沿轨道前移的角度，0° 表示同相位。</p>
        <p className="constellation-field-note">同轨首尾相连，跨轨连接相邻轨道同编号卫星，首末轨道不额外闭环。所有 ISL 均按位置快照检查地球遮挡，并保留极区限制。</p>
    </div>;
}
