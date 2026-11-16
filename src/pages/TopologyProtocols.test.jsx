import React, {useState} from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {TopologyProtocols} from "./TopologyProtocols";
import {defaultTopologyProtocols} from "../entities/topology_protocols";

jest.mock("antd", () => {
    const React = require("react");
    const Form = ({children}) => <div>{children}</div>;
    Form.Item = ({children}) => <div>{children}</div>;
    return {Form, Space: ({children}) => <div>{children}</div>, Alert: ({message}) => <p>{message}</p>,
        Checkbox: ({children, checked, disabled, onChange}) => <label><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />{children}</label>,
        Select: () => null};
});

function Selection({disabled = false}) {
    const [value, onChange] = useState(defaultTopologyProtocols);
    return <TopologyProtocols value={value} onChange={onChange} disabled={disabled} />;
}

test("validation changes do not disable LiR and both OSPF versions can be enabled", () => {
    render(<Selection />);
    fireEvent.click(screen.getByLabelText("路径验证协议"));
    fireEvent.click(screen.getByLabelText("路径验证协议"));
    expect(screen.getByLabelText("LiR")).toBeChecked();
    fireEvent.click(screen.getByLabelText("OSPFv3（IPv6）"));
    expect(screen.getByLabelText("OSPFv2（IPv4）")).toBeChecked();
    expect(screen.getByLabelText("OSPFv3（IPv6）")).toBeChecked();
});

test("startup in progress locks the selection", () => {
    render(<Selection disabled />);
    expect(screen.getByLabelText("LiR")).toBeDisabled();
    expect(screen.getByLabelText("路径验证协议")).toBeDisabled();
});
