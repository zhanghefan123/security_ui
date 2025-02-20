import axios from "axios";
import {UrlBase} from "./base";

const getConstellationStateUrl = "getConstellationState"
const getInstancePositionsUrl = "getInstancePositions"
const startConstellationUrl = "startConstellation"
const stopConstellationUrl = "stopConstellation"
const getAvailableGroundStationsUrl = "/ground_stations/ground_stations.txt"
const changeTimeStepUrl= "changeTimeStep"

export const changeTimeStepRequest = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${changeTimeStepUrl}`, params).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

// 注意在进行 public 下静态文件的获取的时候, 发送的是 get 请求, 并且没有前缀 UrlBase
export const getAvailableGroundStations = (response_callback, error_callback) => {
    axios.get(`${getAvailableGroundStationsUrl}`).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const getConstellationStateRequest = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/${getConstellationStateUrl}`).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const getInstancePositionsRequest = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/${getInstancePositionsUrl}`).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const startConstellationRequest = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${startConstellationUrl}`, params).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const stopConstellationRequest = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/${stopConstellationUrl}`).then((response) => {
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}