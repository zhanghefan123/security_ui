const topologyServerPort = process.env.REACT_APP_TOPOLOGY_SERVER_PORT
const topologyServerAddr = process.env.REACT_APP_TOPOLOGY_SERVER_ADDR
export const UrlBase =  `http://${topologyServerAddr}:${topologyServerPort}`