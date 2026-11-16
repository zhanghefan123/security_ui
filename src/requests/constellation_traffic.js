import axios from "axios";
import {UrlBase} from "./base";

export const getConstellationTraffic = (signal) => axios.post(`${UrlBase}/getConstellationTraffic`, {}, {signal, timeout: 8000}).then(r => r.data);
export const startConstellationTraffic = (params, signal) => axios.post(`${UrlBase}/startConstellationTraffic`, params, {signal, timeout: 8000}).then(r => r.data);
export const stopConstellationTraffic = (id, signal) => axios.post(`${UrlBase}/stopConstellationTraffic`, {id}, {signal, timeout: 8000}).then(r => r.data);
