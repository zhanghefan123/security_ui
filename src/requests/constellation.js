import axios from "axios";
import {UrlBase} from "./base";

const getConstellationStateUrl = "getConstellationState"
const getInstancePositionsUrl = "getInstancePositions"
const startConstellationUrl = "startConstellation"
const stopConstellationUrl = "stopConstellation"

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