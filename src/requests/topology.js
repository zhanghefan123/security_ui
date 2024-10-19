import axios from "axios";
import {UrlBase} from "./base"

export const startTopology = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/startTopology`, params).then(response=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const stopTopology = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/stopTopology`).then(response=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

