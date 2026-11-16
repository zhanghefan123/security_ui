import axios from "axios";
import {UrlBase} from "./base";

export const getTopologyTraffic = signal => axios.post(`${UrlBase}/getTopologyTraffic`, {}, {signal, timeout: 8000}).then(r => r.data);
export const startTopologyTraffic = (params, signal) => axios.post(`${UrlBase}/startTopologyTraffic`, params, {signal, timeout: 8000}).then(r => r.data);
export const stopTopologyTraffic = (id, signal) => axios.post(`${UrlBase}/stopTopologyTraffic`, {id}, {signal, timeout: 8000}).then(r => r.data);
