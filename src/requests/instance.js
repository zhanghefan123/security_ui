import axios from "axios";
import {UrlBase} from "./base";

const startWebShellUrl = "startWebShell"
const stopWebShellUrl = "stopWebShell"

export const getNodeDetails = (containerName, signal) => axios.post(`${UrlBase}/getNodeDetails`, {container_name: containerName}, {signal});
export const openNodeShell = (containerName) => axios.post(`${UrlBase}/${startWebShellUrl}`, {container_name: containerName});
export const closeNodeShell = (pid) => axios.post(`${UrlBase}/${stopWebShellUrl}`, {pid});
export const releaseNodeShell = (pid) => {
    const body = JSON.stringify({pid});
    if (!window.navigator.sendBeacon?.(`${UrlBase}/${stopWebShellUrl}`, body)) {
        fetch(`${UrlBase}/${stopWebShellUrl}`, {method: "POST", body, keepalive: true}).catch(() => {});
    }
};
