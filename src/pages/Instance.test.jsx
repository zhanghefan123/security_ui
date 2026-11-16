import React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {Instance} from "./Instance";
import {getNodeDetails, openNodeShell, closeNodeShell, releaseNodeShell} from "../requests/instance";

jest.mock("../requests/instance", () => ({getNodeDetails: jest.fn(), openNodeShell: jest.fn(), closeNodeShell: jest.fn(), releaseNodeShell: jest.fn()}));
jest.mock("react-router-dom", () => ({useParams: () => ({containerName: "ChainMakerNode_1"}), Link: ({children}) => <a href="/topology">{children}</a>}));
jest.mock("antd", () => {
    const React = require("react");
    const Empty = ({description}) => <p>{description}</p>;
    Empty.PRESENTED_IMAGE_SIMPLE = "empty";
    return {
        Alert: ({message, description}) => <div>{message}{description}</div>,
        Button: ({children, onClick, loading}) => <button disabled={loading} onClick={onClick}>{children}</button>,
        Card: ({children, title, extra}) => <section>{title}{extra}{children}</section>,
        ConfigProvider: ({children}) => children, Empty, Spin: () => <span>loading</span>,
        Tabs: ({items}) => <>{items.map(item => <div key={item.key}>{item.label}{item.children}</div>)}</>,
        Tag: ({children}) => <span>{children}</span>,
    };
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    getNodeDetails.mockResolvedValue({data: {name: "ChainMakerNode-1", status: "running", cpu_percent: 12.5, memory_bytes: 1048576, routes: [{name: "IPv4", content: "default via 10.0.0.1"}], configs: [{name: "chainmaker.yml", content: "chain_id: chain1"}]}});
    openNodeShell.mockResolvedValue({data: {address: "127.0.0.1", port: 9000, pid: 42}});
    closeNodeShell.mockResolvedValue({});
});
afterEach(() => jest.useRealTimers());

test("opens one terminal under StrictMode; manual mode never polls or creates more shells", async () => {
    const {unmount, container} = render(<React.StrictMode><Instance/></React.StrictMode>);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(openNodeShell).toHaveBeenCalledTimes(1);
    expect(openNodeShell).toHaveBeenCalledWith("ChainMakerNode-1");
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    expect(screen.getByText("12.5%")).toBeInTheDocument();
    expect(screen.getByText("default via 10.0.0.1")).toBeInTheDocument();
    const initialRequests = getNodeDetails.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(getNodeDetails).toHaveBeenCalledTimes(initialRequests);
    fireEvent.click(screen.getByText("手动刷新"));
    await act(async () => {});
    expect(getNodeDetails).toHaveBeenCalledTimes(initialRequests + 1);
    fireEvent.click(screen.getByText("重载终端"));
    expect(openNodeShell).toHaveBeenCalledTimes(1);
    unmount();
    expect(closeNodeShell).toHaveBeenCalledWith(42);
});

test("closes a shell whose creation finishes after leaving the page", async () => {
    let finish;
    openNodeShell.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const {unmount} = render(<Instance/>);
    await act(async () => { jest.advanceTimersByTime(1); });
    unmount();
    await act(async () => { finish({data: {pid: 43}}); });
    expect(closeNodeShell).toHaveBeenCalledWith(43);
});

test("pagehide releases the terminal and failures offer an explicit retry", async () => {
    openNodeShell.mockRejectedValueOnce(new Error("gotty unavailable"));
    const {unmount} = render(<Instance/>);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(screen.getByText(/gotty unavailable/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("重试连接"));
    await act(async () => { jest.advanceTimersByTime(1); });
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(releaseNodeShell).toHaveBeenCalledWith(42);
    unmount();
    expect(closeNodeShell).not.toHaveBeenCalled();
});
