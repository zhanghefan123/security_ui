import axios from "axios";
import {UrlBase} from "./base";

const startWebShellUrl = "startWebShell"
const stopWebShellUrl = "stopWebShell"

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