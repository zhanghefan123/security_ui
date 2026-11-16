# 1. 启动注意事项

- [1] 修改 .env 之中的 REACT_APP_TOPOLOGY_SERVER_ADDR 到服务器的地址
- [2] 执行 npm install
- [3] 执行 npm start

# 2. 其他事项
- [1] 需要注意 cesium 的 version, 如果 cesium 的 version 不对, 可能导致资源 (例如: 地球), 加载不出来

# 3. 拓扑页面入口

- `/topology` 是唯一的拓扑工作台，组件为 `src/pages/Topology.jsx`，支持平行链路、保存、导入及启动拓扑。
- 旧地址 `/topology_only` 自动替换当前历史记录并跳转到 `/topology`，不再维护独立页面或导航入口。
- 节点终端、资源、路由和配置统一在 `/instance/:containerName` 查看，从拓扑节点右键菜单进入。旧页面的实时采集图表和多 WebShell 代码已移除。
