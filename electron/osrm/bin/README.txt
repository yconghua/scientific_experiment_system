将 OSRM 可执行程序放入本目录（打包时随应用一起分发）：

  osrm-extract.exe
  osrm-partition.exe
  osrm-customize.exe
  osrm-routed.exe

并将预处理配置文件放入 profiles/ 子目录：

  profiles/car.lua      （含 lib/ 目录，来自 OSRM profiles 发布包）

Windows 构建版 exe 通常自带 profiles 目录，把整个 profiles 文件夹复制到这里即可。
