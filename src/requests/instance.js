import axios from "axios";
import {UrlBase} from "./base";

const startWebShellUrl = "startWebShell"
const stopWebShellUrl = "stopWebShell"
const startCaptureInterfaceRateUrl = "startCaptureInterfaceRate"
const stopCaptureInterfaceRateUrl = "stopCaptureInterfaceRate"


export const startWebShell = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${startWebShellUrl}`, params).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const stopWebShell = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${stopWebShellUrl}`, params).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const startCaptureInterfaceRate = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/${startCaptureInterfaceRateUrl}`, params).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const stopCaptureInterfaceRate = (params) => {
    window.navigator.sendBeacon(`${UrlBase}/${stopCaptureInterfaceRateUrl}`, JSON.stringify(params))
}

