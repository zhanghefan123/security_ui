import axios from "axios";
import {topologyServerAddr, topologyServerPort, UrlBase} from "./base"

const startTopologyUrl = "startTopology"
const stopTopologyUrl = "stopTopology"
const getTopologyStateUrl = "getTopologyState"
const getWideAreaNetworkTopologyUrl = "/topologies/wide_area_network_topology.txt"
const getDataCenterTopologyUrl = "/topologies/multicast_path_validation_topology.txt"
const getManetTopologyUrl = "/topologies/path_validation_topology.txt"
const startAttackRequestUrl = "startAttack"
const startTxRateTestUrl = "startTxRateTest"
const stopTxRateTestUrl = "stopTxRateTest"
const installChannelAndChaincodeUrl = "installChannelAndChaincode"
const saveTopologyUrl = "saveTopology"
const getTopologyDescriptionUrl = "getTopologyDescription"
const changeStartDefenceUrl = "changeStartDefence"
const stopUrl = "/stop"
const startAttackUrl = "/start_attack"
const stopAttackUrl = "/stop_attack"
const startMaliciousSynchoronizeUrl = "/start_malicious_synchronize"
const stopMaliciousSynchronizeUrl = "/stop_malicious_synchronize"

export const changeStartDefenceRequest = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${changeStartDefenceUrl}`, params).then((response)=>{
        response_callback(response)
    },(error)=>{
        error_callback(error)
    })
}


// topologyDescriptionRequest 向后端发送请求获取详细的拓扑描述
export const topologyDescriptionRequest = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${getTopologyDescriptionUrl}`, params).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// saveTopology 进行拓扑的保存
export const saveTopologyRequest = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${saveTopologyUrl}`, params).then(response=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}


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

// getPathValidationTopology 获取路径验证拓扑
export const getPathValidationTopology = (response_callback, error_callback) => {
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

// startTxRateTest 开启 tps 测速
export const startTxRateTest = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/${startTxRateTestUrl}`).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// stopTxRateTest 停止 tps 测速
export const stopTxRateTest = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/${stopTxRateTestUrl}`).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}


// installChannelAndChaincode 安装 channel 和链码
export const installChannelAndChaincode = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/${installChannelAndChaincodeUrl}`).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const stopNode = (port, response_callback, error_callback) => {
    let urlTmp = `http://${topologyServerAddr}:${port}${stopUrl}`
    axios.post(urlTmp).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    }
    )
}

export const startAttack = (port, response_callback, error_callback) => {
    let urlTmp = `http://${topologyServerAddr}:${port}${startAttackUrl}`
    axios.post(urlTmp).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const stopAttack = (port, response_callback, error_callback) => {
    let urlTmp = `http://${topologyServerAddr}:${port}${stopAttackUrl}`
    axios.post(urlTmp).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const startMaliciousSynchronize = (port, response_callback, error_callback) => {
    let urlTmp = `http://${topologyServerAddr}:${port}${startMaliciousSynchoronizeUrl}`
    axios.post(urlTmp).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const stopMaliciousSynchronize = (port, response_callback, error_callback) => {
    let urlTmp = `http://${topologyServerAddr}:${port}${stopMaliciousSynchronizeUrl}`
    axios.post(urlTmp).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// 当页面关闭的时候的操作
export const pageClose = () => {
    window.navigator.sendBeacon(`${UrlBase}/${stopTopologyUrl}`);
}