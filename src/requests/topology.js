import axios from "axios";
import {UrlBase} from "./base"

const startTopologyUrl = "startTopology"
const stopTopologyUrl = "stopTopology"
const getTopologyStateUrl = "getTopologyState"


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

