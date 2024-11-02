import axios from "axios";
import {topologyServerAddr, topologyServerPort, UrlBase} from "./base"

const startTopologyUrl = "startTopology"
const stopTopologyUrl = "stopTopology"
const getTopologyStateUrl = "getTopologyState"
const getWideAreaNetworkTopologyUrl = "/topologies/wide_area_network_topology.txt"
const getDataCenterTopologyUrl = "/topologies/datacenter_topology.txt"
const getManetTopologyUrl = "/topologies/manet_topology.txt"
const startAttackRequestUrl = "startAttack"

// startToplogy 启动的时候的函数
export const startTopology = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${startTopologyUrl}`, params).then(response=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// stopTopology 停止的时候的函数
export const stopTopology = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/${stopTopologyUrl}`).then(response=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// getTopologyState 获取拓扑状态
export const getTopologyState = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/${getTopologyStateUrl}`).then(response=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// getWideAreaNetworkTopology 获取广域网拓扑
export const getWideAreaNetworkTopology = (response_callback, error_callback) => {
    axios.get(`${getWideAreaNetworkTopologyUrl}`).then(response=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// getDataCenterTopology 获取数据中心拓扑
export const getDataCenterTopology = (response_callback, error_callback) => {
    axios.get(`${getDataCenterTopologyUrl}`).then(response=>{
        response_callback(response)
    }, (error)=> {
        error_callback(error)
    })
}

// getManetTopology 获取自组网拓扑
export const getManetTopology = (response_callback, error_callback) => {
    axios.get(`${getManetTopologyUrl}`).then(response=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// startAttackRequest 开启攻击请求
export const startAttackRequest = (maliciousNodeId, params, response_callback, error_callback) => {
    let listeningPort = parseInt(topologyServerPort) + maliciousNodeId
    console.log(`http://${topologyServerAddr}:${listeningPort}/${startAttackRequestUrl}`)
    axios.post(`http://${topologyServerAddr}:${listeningPort}/${startAttackRequestUrl}`, params).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}