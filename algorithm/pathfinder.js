/**
 * ==================================================
 * 高精度最短路径计算服务（纯 Node.js）
 * 适用于 Electron 桌面应用
 * ==================================================
 * 
 * 【依赖安装】
 *   npm install geodesy
 * 
 * 【使用方式】
 *   const { findShortestPath } = require('./pathfinder');
 *   const result = findShortestPath(inputData);
 * 
 * 【输入格式】
 *   {
 *     coordinate_type: 'wgs84',      // 坐标系类型：wgs84|gcj02|bd09|latlng|经纬度|平面坐标
 *     nodes: [                       // 节点列表
 *       { id: 'A', coords: [116.4, 39.9] }  // [经度, 纬度] 或 [x, y]
 *     ],
 *     edges: [                       // 边列表
 *       { from: 'A', to: 'B', weight: 1000 } // weight 可选，不填则自动计算
 *     ],
 *     start: 'A',                    // 起点节点 ID
 *     end: 'B'                       // 终点节点 ID
 *   }
 * 
 * 【输出格式】
 *   {
 *     path: ['A', 'B', 'C'],         // 最短路径节点序列
 *     distance: 15234.56,            // 总距离（地理坐标时单位：米）
 *     path_coords: [[116.4, 39.9], [116.5, 39.8]]  // 路径各节点坐标
 *   }
 * 
 * 【错误输出】
 *   { error: '错误描述' }
 * ==================================================
 */

// ---------- 导入第三方高精度地理计算库 ----------
const { LatLon } = require('geodesy');

/**
 * ==========================================
 * 一、距离计算函数
 * ==========================================
 */

/**
 * 基于 WGS-84 椭球体的高精度测地线距离
 * 使用 geodesy 库的 LatLon.distanceTo 方法（底层实现 Karney 算法）
 * 精度：亚毫米级（< 1mm）
 * 
 * @param {number} lon1 - 起点经度（度）
 * @param {number} lat1 - 起点纬度（度）
 * @param {number} lon2 - 终点经度（度）
 * @param {number} lat2 - 终点纬度（度）
 * @returns {number} 距离（米）
 */
function geodesicDistance(lon1, lat1, lon2, lat2) {
    // LatLon 构造函数参数顺序为 (纬度, 经度)
    const p1 = new LatLon(lat1, lon1);
    const p2 = new LatLon(lat2, lon2);
    return p1.distanceTo(p2);
}

/**
 * 平面欧氏距离（用于非地理坐标系）
 * 
 * @param {number} x1 - 起点 x 坐标
 * @param {number} y1 - 起点 y 坐标
 * @param {number} x2 - 终点 x 坐标
 * @param {number} y2 - 终点 y 坐标
 * @returns {number} 距离（与输入坐标同单位）
 */
function euclideanDistance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * ==========================================
 * 二、Dijkstra 核心算法
 * ==========================================
 */

/**
 * Dijkstra 最短路径算法（优先队列实现）
 * 时间复杂度：O(E log V)，其中 E 为边数，V 为节点数
 * 
 * @param {Object} graph - 邻接表，格式为 { nodeId: { neighborId: weight, ... } }
 * @param {string} start - 起点节点 ID
 * @param {string} end - 终点节点 ID
 * @returns {Object|null} { path: [id1, id2, ...], distance: number } 或 null（无路径）
 */
function dijkstra(graph, start, end) {
    // 如果起点或终点不在图中，直接返回 null
    if (!graph[start] || !graph[end]) return null;

    // 优先队列：[累计距离, 当前节点, 路径数组]
    const pq = [[0, start, [start]]];
    // 已访问集合（防止重复处理）
    const visited = new Set();

    while (pq.length > 0) {
        // 按累计距离升序排列（模拟优先队列）
        // 注意：如果图很大（> 10^5 节点），建议替换为真正的堆实现
        pq.sort((a, b) => a[0] - b[0]);
        const [dist, node, path] = pq.shift();

        // 如果节点已访问，跳过（避免处理过时的队列条目）
        if (visited.has(node)) continue;
        visited.add(node);

        // 到达终点，返回结果
        if (node === end) {
            return { path, distance: dist };
        }

        // 遍历当前节点的所有邻居
        for (const [neighbor, weight] of Object.entries(graph[node])) {
            // 如果邻居未访问，加入队列
            if (!visited.has(neighbor)) {
                pq.push([dist + weight, neighbor, [...path, neighbor]]);
            }
        }
    }

    // 队列耗尽仍未找到路径
    return null;
}

/**
 * ==========================================
 * 三、对外唯一接口（业务逻辑组装层）
 * ==========================================
 */

/**
 * 查找最短路径（主入口函数）
 * 
 * @param {Object} inputData - 输入数据对象
 * @param {string} inputData.coordinate_type - 坐标系类型（'wgs84', 'gcj02', 'bd09', 'latlng', '经纬度', 或其他）
 * @param {Array} inputData.nodes - 节点列表 [{ id, coords: [x, y] }]
 * @param {Array} inputData.edges - 边列表 [{ from, to, weight? }]
 * @param {string} inputData.start - 起点 ID
 * @param {string} inputData.end - 终点 ID
 * @returns {Object} { path, distance, path_coords } 或 { error }
 */
function findShortestPath(inputData) {
    try {
        // ----- 1. 解构输入参数 -----
        const { coordinate_type = '', nodes = [], edges = [], start, end } = inputData;

        // ----- 2. 必填字段校验 -----
        if (!nodes.length || !edges.length || start == null || end == null) {
            return { error: "Missing required fields: 'nodes', 'edges', 'start', 'end'" };
        }

        // ----- 3. 构建节点坐标字典（ID → 坐标数组）-----
        const nodeCoords = {};
        for (const node of nodes) {
            // 检查每个节点的完整性和有效性
            if (!node.id || !node.coords || node.coords.length < 2) {
                return { error: `Invalid node: ${JSON.stringify(node)}` };
            }
            nodeCoords[node.id] = node.coords;
        }

        // 检查起点和终点是否存在于节点列表中
        if (!nodeCoords[start] || !nodeCoords[end]) {
            return { error: `Start '${start}' or end '${end}' not found in nodes` };
        }

        // ----- 4. 根据坐标系类型选择距离函数 -----
        // 如果 coordinate_type 包含地理坐标系关键词，使用高精度测地线距离
        const isGeographic = /wgs84|gcj02|bd09|latlng|经纬度/i.test(coordinate_type);
        const distFunc = isGeographic ? geodesicDistance : euclideanDistance;

        // ----- 5. 构建邻接表（无向图）-----
        // 初始化所有节点的邻接表
        const graph = {};
        for (const id of Object.keys(nodeCoords)) {
            graph[id] = {};
        }

        // 遍历边列表，构建图
        for (const edge of edges) {
            const { from, to, weight } = edge;

            // 跳过无效边（节点不存在）
            if (!nodeCoords[from] || !nodeCoords[to]) continue;

            // 计算或获取边权重
            let finalWeight = weight;
            if (finalWeight == null) {
                // 如果用户未指定权重，根据坐标自动计算
                const c1 = nodeCoords[from];
                const c2 = nodeCoords[to];
                finalWeight = distFunc(c1[0], c1[1], c2[0], c2[1]);
            }

            // 无向图：双向添加边
            graph[from][to] = finalWeight;
            graph[to][from] = finalWeight;
        }

        // ----- 6. 执行 Dijkstra 算法 -----
        const result = dijkstra(graph, start, end);
        if (!result) {
            return { error: `No path found from '${start}' to '${end}'` };
        }

        // ----- 7. 组装返回结果 -----
        // 提取路径上各节点的坐标（便于前端绘制地图）
        const pathCoords = result.path.map(id => nodeCoords[id]);

        return {
            path: result.path,           // 节点 ID 列表
            distance: result.distance,    // 总距离
            path_coords: pathCoords      // 路径坐标数组
        };
    } catch (err) {
        // 捕获所有未预期的异常，返回友好错误信息
        return { error: err.message };
    }
}

/**
 * ==========================================
 * 四、模块导出
 * ==========================================
 * 仅导出核心函数，保持接口简洁
 */
module.exports = { findShortestPath };