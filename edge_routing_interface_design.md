# Edge Routing Refactor Interface Design

## 目标

将当前集中在 `js/edges.js` 内的连线几何逻辑拆成三个独立模块：

- 端点选择模块：只负责为边生成候选端点或端点对。
- 路由搜索模块：只负责在给定端点条件下生成直线、折线或弧线方案。
- 冲突消解模块：只负责处理端口占用、平行边偏移、边间重叠等全局约束。

本设计的目标不是一次性重写算法，而是先定义稳定接口，使现有逻辑可以逐步迁移到模块化结构中。

## 现状问题

当前实现主要集中在 `js/edges.js` 的 `edgePath()` 中，存在以下耦合：

- `resolveEndpoint()`、`sectionEdgePoint()`、`allocatePort()` 混合了几何索引、端点选择和局部冲突处理。
- `edgePath()` 同时负责端点选择、跨面板特殊规则、路径搜索、平行边偏移、标签落点。
- `usedPorts` 把端口唯一性约束写死在端点选择阶段，导致端点选择依赖边遍历顺序。
- `collisionShapes` 是全局静态数据，路由搜索无法显式声明“障碍来自节点、区域还是其他边”。
- 自连和相连已经分流，但仍然由单个入口函数直接决定最终路径，后续扩展空间有限。

这类耦合导致三件事很难做：

- 单独替换端点评分策略。
- 在不动端点逻辑的情况下迭代路由算法。
- 把“端口唯一性”和“平行边避让”做成全局优化，而不是渲染顺序副作用。

## 目标结构

建议新增一个 `js/edge-layout/` 目录，采用如下拆分：

```text
js/
  edge-layout/
    index.js                # 总调度器 EdgeLayoutEngine
    geometry-index.js       # 节点/区域/障碍物索引
    endpoint-selector.js    # 端点候选生成与评分
    route-planner.js        # 路径搜索与路径评分
    conflict-resolver.js    # 端口占用、偏移、重叠消解
    edge-labels.js          # 标签落点，可后续拆出
    types.js                # JSDoc typedef 或常量
```

其中：

- `geometry-index.js` 是辅助模块，不属于三个核心决策模块，但作为三者共享输入非常必要。
- `index.js` 只负责调用顺序和结果组装，不直接包含几何规则。
- `edge-labels.js` 可以在第二阶段再拆，第一阶段也可以继续留在 `route-planner.js` 内。

## 共享数据模型

下面的接口用 JSDoc 语义表达，保持与当前 JavaScript 代码风格一致。

```javascript
/** @typedef {{ x: number, y: number }} Point */

/**
 * @typedef {Object} EdgeSpec
 * @property {string} id
 * @property {string} source
 * @property {string} target
 * @property {string} color
 * @property {string[]} seriesIds
 * @property {string} label
 * @property {'self'|'connected'} connectionType
 */

/**
 * @typedef {Object} EndpointRef
 * @property {string} ownerId
 * @property {'node'|'section'} ownerType
 * @property {'in'|'out'|'loop-start'|'loop-end'} role
 * @property {Point} point
 * @property {string=} portId
 * @property {number=} score
 * @property {Object=} meta
 */

/**
 * @typedef {Object} EndpointPairCandidate
 * @property {string} edgeId
 * @property {EndpointRef} start
 * @property {EndpointRef} end
 * @property {number} localScore
 * @property {Object=} meta
 */

/**
 * @typedef {Object} RouteCandidate
 * @property {string} edgeId
 * @property {'line'|'polyline'|'arc'} kind
 * @property {Point[]} waypoints
 * @property {number} routeScore
 * @property {Point} labelPos
 * @property {Object=} meta
 */

/**
 * @typedef {Object} EdgeLayoutDraft
 * @property {EdgeSpec} edge
 * @property {EndpointPairCandidate} endpoints
 * @property {RouteCandidate} route
 * @property {number} totalScore
 */

/**
 * @typedef {Object} FinalEdgeLayout
 * @property {string} edgeId
 * @property {string} path
 * @property {Point} labelPos
 * @property {EndpointRef} start
 * @property {EndpointRef} end
 * @property {Object=} adjustments
 */

/**
 * @typedef {Object} GeometryIndex
 * @property {Map<string, Object>} nodesById
 * @property {Map<string, Object>} sectionsById
 * @property {Map<string, Point[]>} portsByShape
 * @property {Object[]} obstacles
 * @property {Object} panels
 */

/**
 * @typedef {Object} LayoutContext
 * @property {GeometryIndex} geometry
 * @property {Map<string, Object>} edgeOffsets
 * @property {Object} options
 */
```

## 模块一：端点选择 EndpointSelector

### 职责

- 根据边类型生成候选端点。
- 只处理“从哪里出发、落到哪里”，不处理路径能否避障。
- 只做局部评分，不做全局占用决策。

### 不负责的内容

- 不检查障碍穿越。
- 不处理平行边偏移。
- 不持有 `usedPorts` 这类全局可变状态。

### 接口

```javascript
export function createEndpointSelector(config = {}) {
  return {
    enumerate(edge, context) {},
    score(edge, candidate, context) {},
    pickInitial(edge, candidates, context) {},
  };
}
```

### 输入

- `edge: EdgeSpec`
- `context.geometry`: 节点、区域、端口分布、面板信息
- 可选 `config`: 候选上限、方向偏好、跨面板偏好、自连偏好侧

### 输出

- `enumerate()` 返回 `EndpointPairCandidate[]`
- `pickInitial()` 返回一个局部最优端点对，供路由器先行尝试

### 推荐规则

#### 相连 `connected`

- 节点到节点：
  - 从 `SHAPE_PORTS` 中按方向和距离筛出前 `K` 个出端口。
  - 对目标同样筛出前 `K` 个入端口。
  - 形成最多 `K * K` 个端点对。
- 区域到节点：
  - 区域边界点不要只返回单点。
  - 应返回面向目标方向的 3 到 5 个候选边界点。
- 跨面板边：
  - 不直接在这里强制选最终端点。
  - 只给候选加上“偏向走廊侧”的加分。

#### 自连 `self`

- 生成若干固定弧线端点对，如右侧、上侧、左侧、下侧。
- 每个端点对带上建议弧度和建议包络大小。
- 不在本模块决定最终弧线形状。

### 当前逻辑映射

- `resolveEndpoint()` 迁移到 `geometry-index.js`
- `sectionEdgePoint()` 迁移到 `endpoint-selector.js` 的区域候选生成器
- `selectSelfLoopEndpoints()` 迁移到 `endpoint-selector.js`
- `allocatePort()` 需要拆分：
  - 端口枚举和局部距离评分保留在 `endpoint-selector.js`
  - “端口是否已被占用”迁到 `conflict-resolver.js`

## 模块二：路由搜索 RoutePlanner

### 职责

- 在给定端点对的前提下搜索路径。
- 判断直线、折线、弧线是否可行。
- 对候选路径打分并返回局部最优方案。

### 不负责的内容

- 不负责端点唯一性。
- 不处理多条边之间的重叠冲突。
- 不修改端点选择结果。

### 接口

```javascript
export function createRoutePlanner(config = {}) {
  return {
    plan(edge, endpointPair, context) {},
    score(edge, routeCandidate, context) {},
    toSvgPath(routeCandidate) {},
  };
}
```

### 输入

- `edge: EdgeSpec`
- `endpointPair: EndpointPairCandidate`
- `context.geometry.obstacles`
- 可选 `config`: 是否把区域视为障碍、最大拐点数、走廊偏好、标签偏移规则

### 输出

- `plan()` 返回 `RouteCandidate[]`
- 每个候选都必须包含：
  - `kind`
  - `waypoints`
  - `labelPos`
  - `routeScore`

### 推荐规则

#### 相连 `connected`

- 先测直线。
- 若直线碰撞，则尝试 1 拐点 L 形。
- 再尝试 2 拐点 Z 形。
- 再尝试走廊搜索或网格化搜索。
- 路径评分建议同时考虑：
  - 总长度
  - 拐点数
  - 是否靠近障碍物
  - 是否穿过区域
  - 标签可放置空间

#### 自连 `self`

- 接收端点模块给出的自连端点对。
- 生成弧线或三次贝塞尔曲线。
- 自连不再复用普通折线逻辑。

### 当前逻辑映射

- `isSegmentBlocked()`、`isPolylineBlocked()` 迁到 `route-planner.js`
- `findSafeCorridors()`、`findPolylineRoute()` 迁到 `route-planner.js`
- `buildSelfLoopPath()` 拆成：
  - 端点选择部分进入 `endpoint-selector.js`
  - 弧线路径生成进入 `route-planner.js`
- `labelPos` 的计算可以先保留在 `route-planner.js`，第二阶段再拆到 `edge-labels.js`

## 模块三：冲突消解 ConflictResolver

### 职责

- 处理全局约束，而不是单条边局部最优。
- 负责端口占用、平行边偏移、边间重叠校正。
- 决定在多条边竞争同一端口时，谁保留、谁回退到候选二或候选三。

### 不负责的内容

- 不生成初始候选端点。
- 不做底层障碍碰撞检测。

### 接口

```javascript
export function createConflictResolver(config = {}) {
  return {
    reservePorts(edgeDrafts, context) {},
    applyParallelOffsets(edgeDrafts, context) {},
    resolve(edgeDrafts, context) {},
  };
}
```

### 输入

- 一组 `EdgeLayoutDraft[]`
- `context.edgeOffsets`
- 可选 `config`: 端口冲突回退层数、平行边偏移规则、边边最小距离

### 输出

- `resolve()` 返回 `FinalEdgeLayout[]`
- 每条边都应附带调整信息，便于调试：

```javascript
{
  edgeId: 'black_usfbo_usbanks',
  adjustments: {
    portFallbackLevel: 1,
    offsetIndex: 2,
    offsetPx: 8,
    rerouted: false,
  }
}
```

### 推荐规则

- 端口唯一性从 `usedPorts` 转移到这里。
- 平行边分组规则保留现有 `computeOffsets()` 的无向对分组思路。
- 冲突消解顺序建议：
  1. 先保端口唯一性。
  2. 再做平行边偏移。
  3. 最后做边边重叠微调。

### 当前逻辑映射

- `usedPorts` 迁到 `conflict-resolver.js`
- `computeOffsets()`、`OFFSET_PX` 迁到 `conflict-resolver.js`
- 目前 `edgePath()` 中的垂线偏移逻辑迁到 `applyParallelOffsets()`

## 总调度器 EdgeLayoutEngine

### 职责

- 按固定顺序调用三个模块。
- 管理上下文构建。
- 把最终几何结果转换成当前渲染层需要的 `_path` 和 `_labelPos`。

### 接口

```javascript
export function createEdgeLayoutEngine({
  geometryIndex,
  endpointSelector,
  routePlanner,
  conflictResolver,
}) {
  return {
    layoutEdges(edges) {},
  };
}
```

### 推荐流程

```javascript
function layoutEdges(edges, context) {
  const drafts = [];

  for (const edge of edges) {
    const endpointCandidates = endpointSelector.enumerate(edge, context);

    const routeDrafts = endpointCandidates.flatMap(candidate =>
      routePlanner.plan(edge, candidate, context).map(route => ({
        edge,
        endpoints: candidate,
        route,
        totalScore: candidate.localScore + route.routeScore,
      }))
    );

    drafts.push(pickBestLocalDraft(routeDrafts));
  }

  const resolved = conflictResolver.resolve(drafts, context);
  return resolved.map(layout => ({
    ...layout,
    path: routePlanner.toSvgPath(layout.route || layout),
  }));
}
```

### 关键要求

- 模块间只能通过显式数据结构通信，不能直接共享可变全局状态。
- `renderEdges()` 只拿最终结果，不再调用几何算法。
- 每次全量重算时，调度器返回完整的 `Map<edgeId, FinalEdgeLayout>`。

## GeometryIndex 设计

虽然用户要求拆成三个核心模块，但如果没有统一的几何索引，这三个模块都会重复访问 `NODES`、`SECTIONS`、`SHAPE_SIZES`、`SHAPE_PORTS`。

建议增加一个只读索引层：

```javascript
export function buildGeometryIndex({ nodes, sections, shapeSizes, shapePorts, options }) {
  return {
    nodesById,
    sectionsById,
    portsByShape,
    obstacles,
    panels,
    resolveAnchor(id) {},
    listObstacleShapes(filters) {},
  };
}
```

### 作用

- 统一替代现在的 `nodeMap`、`sectionMap`、`collisionShapes`
- 支持障碍来源配置：
  - 只看节点
  - 节点 + 区域
  - 节点 + 区域 + 已布局边包围盒

## 推荐文件级 API

为了让迁移时改动最小，建议各文件先暴露以下 API：

```javascript
// js/edge-layout/endpoint-selector.js
export function createEndpointSelector(config) {}

// js/edge-layout/route-planner.js
export function createRoutePlanner(config) {}

// js/edge-layout/conflict-resolver.js
export function createConflictResolver(config) {}

// js/edge-layout/geometry-index.js
export function buildGeometryIndex(input) {}

// js/edge-layout/index.js
export function createEdgeLayoutEngine(services) {}
```

## 迁移路线

### 阶段 1：包裹现有逻辑，不改行为

- 新建 `edge-layout/` 目录。
- 把 `nodeMap`、`sectionMap`、`collisionShapes` 搬到 `geometry-index.js`。
- 把 `edgePath()` 改成调度器壳函数。
- 端点选择模块先只暴露一个 `pickInitial()`，内部仍调用现有端口逻辑。
- 路由模块先直接复用 `findPolylineRoute()` 和现有跨面板逻辑。
- 冲突模块先只接管 `computeOffsets()`，端口唯一性暂时仍保持原样。

### 阶段 2：移除遍历顺序副作用

- 把 `usedPorts` 从端点选择移到冲突模块。
- 端点选择改为输出多个候选端点对，而不是直接返回唯一端点。
- 冲突模块在全局范围内决定最终端口占用。

### 阶段 3：升级路由评分

- 路由模块对每个端点对生成多个路径候选。
- 总调度器按 `端点分 + 路径分 + 冲突惩罚` 选最优方案。
- 区域障碍、标签碰撞、边边重叠都可作为附加评分项。

## 与当前函数的一一映射

```text
当前函数/状态                     -> 目标归属
resolveEndpoint()                -> geometry-index.resolveAnchor()
sectionEdgePoint()               -> endpoint-selector.enumerateSectionCandidates()
allocatePort()                   -> endpoint-selector.scorePorts()
usedPorts                        -> conflict-resolver.reservePorts()
collisionShapes                  -> geometry-index.obstacles
isSegmentBlocked()               -> route-planner.isBlocked()
findSafeCorridors()              -> route-planner.findSafeCorridors()
findPolylineRoute()              -> route-planner.planPolyline()
computeOffsets()                 -> conflict-resolver.computeParallelOffsets()
buildSelfLoopPath()              -> endpoint-selector + route-planner
edgePath()                       -> edge-layout/index.layoutEdges()
```

## 最小可行重构顺序

如果目标是最短路径完成拆分，建议按下面顺序进行：

1. 先抽 `GeometryIndex`。
2. 再抽 `RoutePlanner`，因为当前碰撞与折线路径最容易独立。
3. 再抽 `EndpointSelector`，但先保留单候选输出。
4. 最后抽 `ConflictResolver`，接管 `usedPorts` 与偏移。

这样做的原因是：

- 路由模块天然偏纯函数，最容易先稳定下来。
- 端点模块和冲突模块之间目前耦合最深，应在接口明确后再拆。

## 验收标准

- `renderEdges()` 不再直接调用端点选择或路径搜索细节。
- 单元测试可以分别验证：
  - 端点枚举是否正确
  - 路由是否避开障碍
  - 冲突消解是否保证端口唯一和偏移稳定
- 改变某一模块的实现时，其他模块接口不需要联动修改。
- 新增连线类型时，只需要：
  - 端点模块增加候选生成规则
  - 路由模块增加对应路径生成器
  - 不需要改渲染层

## 当前建议

如果下一步要开始实际拆文件，建议先做一个“行为等价版”重构：

- 不改变现有视觉结果
- 先把函数移动到新模块
- 通过 `createEdgeLayoutEngine()` 暴露统一入口

等接口稳定后，再做第二轮算法改进，例如：

- 端点候选对联合评分
- 区域障碍纳入直线/折线判定
- 自连弧线自动选择最佳侧边
- 标签避让纳入冲突消解