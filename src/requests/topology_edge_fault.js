import axios from "axios";
import {UrlBase} from "./base";

const call = (path, data, signal) => axios.post(`${UrlBase}/${path}`, data, {signal, timeout: 60000}).then(r => r.data);
export const getTopologyEdgeFault = (edgeID, signal) => call("getTopologyEdgeFault", {edge_id: edgeID}, signal);
export const setTopologyEdgeFault = (data, signal) => call("setTopologyEdgeFault", data, signal);
