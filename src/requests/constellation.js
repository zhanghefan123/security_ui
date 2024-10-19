import axios from "axios";
import {UrlBase} from "./base";

export const startConstellationRequest = (params, response_callback, error_callback) => {
    axios.post(`${UrlBase}/startConstellation`, params).then((response)=>{
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}

export const stopConstellationRequest = (response_callback, error_callback) => {
    axios.post(`${UrlBase}/stopConstellation`).then((response) => {
        response_callback(response)
    }, (error)=>{
        error_callback(error)
    })
}