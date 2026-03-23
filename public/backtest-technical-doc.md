# 收敛三角形回测技术文档

## 1. 文档目的

本文档说明 `technical_pattern` 项目中“收敛三角形形态回测”功能的技术实现，包括：

- 回测入口与调用链
- 输入数据与前置条件
- 回测参数含义
- 开仓 / 平仓 / 成本 / 资金曲线的计算逻辑
- 绩效指标定义
- 当前实现边界与注意事项

本文档面向开发、联调、复核策略逻辑时使用。

---

## 2. 代码位置

### 2.1 页面入口

- 回测触发位置：[src/views/pattern/index.vue:877-883](src/views/pattern/index.vue#L877-L883)
- 页面中的回测参数初始化：[src/views/pattern/index.vue:638-649](src/views/pattern/index.vue#L638-L649)
- 页面中的回测结果展示：[src/views/pattern/index.vue:337-475](src/views/pattern/index.vue#L337-L475)

页面在执行检测时，会先做形态识别，再基于识别出的历史形态执行回测：

```ts
if (multiPatternResult.value.patterns.length > 0) {
  backtestResult.value = runBacktest(klineData.value, multiPatternResult.value.patterns, backtestParams)
} else {
  backtestResult.value = null
}
```

### 2.2 回测模块

- 回测主函数：[src/utils/pattern/backtest/engine.ts:318-491](src/utils/pattern/backtest/engine.ts#L318-L491)
- 回测类型定义：[src/utils/pattern/backtest/types.ts](src/utils/pattern/backtest/types.ts)
- 绩效指标计算：[src/utils/pattern/backtest/metrics.ts](src/utils/pattern/backtest/metrics.ts)
- 形态结果类型：[src/utils/pattern/types.ts:58-115](src/utils/pattern/types.ts#L58-L115)

---

## 3. 回测整体流程

## 3.1 调用链

页面点击“执行检测”后，核心流程位于 [src/views/pattern/index.vue:855-906](src/views/pattern/index.vue#L855-L906)：

1. 调用 `detectLatestConfirmedPattern` 识别最近一个已确认形态。
2. 调用 `detectMultiPatterns` 识别所有历史形态。
3. 将最近形态并入历史形态列表，避免遗漏最近一次已确认突破。
4. 若 `patterns.length > 0`，调用 `runBacktest(klineData, patterns, backtestParams)`。
5. 将回测结果写入 `backtestResult`，供页面统计卡片和交易表格展示。

## 3.2 回测主循环

`runBacktest` 的执行流程位于 [src/utils/pattern/backtest/engine.ts:318-491](src/utils/pattern/backtest/engine.ts#L318-L491)，逻辑可概括为：

1. 合并默认参数与页面传入参数。
2. 从全部形态中筛出“有效且已确认突破”的形态。
3. 以 `breakoutDay` 为键建立突破日映射。
4. 按时间顺序遍历每根 K 线。
5. 若当前有持仓，先检查是否满足平仓条件。
6. 若当前无持仓，再检查当天是否有突破信号触发开仓。
7. 每个交易日都记录一条资金曲线点。
8. 遍历完成后，如仍有持仓，则在最后一个交易日强制平仓。
9. 基于交易记录和资金曲线计算绩效指标，最终返回 `BacktestResult`。

---

## 4. 输入数据与前置条件

## 4.1 K 线数据

回测输入的行情数据类型为 `KLineData`，定义见 [src/utils/pattern/types.ts:139-145](src/utils/pattern/types.ts#L139-L145)：

```ts
interface KLineData {
  dates: number[]
  open: (number | null)[]
  high: (number | null)[]
  low: (number | null)[]
  close: (number | null)[]
  volume: (number | null)[]
}
```

页面在加载数据后会先做标准化处理，剔除 `close` 为空或非法的记录，处理函数位于 [src/views/pattern/index.vue:692-717](src/views/pattern/index.vue#L692-L717)。

这意味着回测模块默认接收到的是“已清洗后的交易日序列”。

## 4.2 形态数据

回测并不是直接扫描 K 线产生交易，而是依赖“形态识别结果”作为信号源。

`ConvergingTriangleResult` 中，与回测强相关的字段定义见 [src/utils/pattern/types.ts:89-115](src/utils/pattern/types.ts#L89-L115)：

- `isValid`：是否有效形态
- `breakoutDir`：突破方向，`up | down | none`
- `breakoutDay`：突破日索引
- `breakoutDate`：突破日日期
- `breakoutConfirmed`：突破是否确认
- `breakoutConfirmDays`：确认天数
- `breakoutPrice`：突破价格
- `breakoutVolume`：突破成交量
- `patternHeight`：形态高度
- `patternStartDate` / `patternEndDate`：形态起止日期

## 4.3 哪些形态会真正进入回测

在 [src/utils/pattern/backtest/engine.ts:337-346](src/utils/pattern/backtest/engine.ts#L337-L346) 中，回测只保留下列形态：

- `pattern.isValid === true`
- `pattern.breakoutDay !== null`
- `pattern.breakoutDir !== 'none'`
- `pattern.breakoutConfirmed === true`

也就是说：

1. 仅识别出形态还不够；
2. 必须存在明确突破日；
3. 必须存在明确突破方向；
4. 必须是“已确认突破”，待确认信号不会进入回测。

这保证了回测交易信号的来源相对保守。

---

## 5. 回测参数

回测参数类型定义见 [src/utils/pattern/backtest/types.ts:16-35](src/utils/pattern/backtest/types.ts#L16-L35)，默认值见 [src/utils/pattern/backtest/types.ts:40-49](src/utils/pattern/backtest/types.ts#L40-L49)。

页面当前初始化参数见 [src/views/pattern/index.vue:639-649](src/views/pattern/index.vue#L639-L649)。

| 参数 | 默认值 | 含义 |
| --- | ---: | --- |
| `takeProfitRatio` | `0.10` | 止盈比例，达到 10% 即止盈 |
| `stopLossRatio` | `0.05` | 止损比例，亏损达到 5% 即止损 |
| `commissionRate` | `0.0003` | 佣金费率 |
| `stampDutyRate` | `0.001` | 印花税率，仅卖出时收取 |
| `slippageRate` | `0.001` | 滑点比例 |
| `positionSize` | `1.0` | 单笔仓位占可用现金比例 |
| `maxHoldingDays` | `20` | 最大持仓天数 |
| `initialCapital` | `100000` | 初始资金 |
| `allowShort` | `true` | 是否允许对向下突破执行做空 |

### 5.1 页面当前暴露给用户的参数

当前页面上直接提供配置的回测参数见 [src/views/pattern/index.vue:191-250](src/views/pattern/index.vue#L191-L250)：

- 止盈比例
- 止损比例
- 佣金费率
- 最大持仓天数
- 是否允许做空

说明：

- `stampDutyRate`、`slippageRate`、`positionSize`、`initialCapital` 已在代码中支持，但当前页面未提供独立控件修改，使用的是初始化值。
- 若后续要扩展回测面板，这几个参数可直接映射到 UI。

---

## 6. 开仓逻辑

开仓逻辑位于 [src/utils/pattern/backtest/engine.ts:172-232](src/utils/pattern/backtest/engine.ts#L172-L232)。

## 6.1 触发时机

在主循环中，如果当前没有持仓且当天索引命中 `breakoutDays`，则触发开仓，见 [src/utils/pattern/backtest/engine.ts:398-418](src/utils/pattern/backtest/engine.ts#L398-L418)。

即：

- 一个有效形态对应一个 `breakoutDay`
- 回测在突破日当天开仓
- 同一时刻只允许一笔持仓

## 6.2 交易方向

方向由 `pattern.breakoutDir` 决定，见 [src/utils/pattern/backtest/engine.ts:182-187](src/utils/pattern/backtest/engine.ts#L182-L187)：

- `up` -> `long`（做多）
- `down` -> `short`（做空）
- 若为 `short` 且 `allowShort = false`，则该信号直接跳过

## 6.3 入场价格

开仓使用突破日 `close[index]` 作为原始入场价，见 [src/utils/pattern/backtest/engine.ts:190-197](src/utils/pattern/backtest/engine.ts#L190-L197)。

实际成交价会进一步叠加滑点，由 `calcExecutionPrice` 计算，见 [src/utils/pattern/backtest/engine.ts:50-77](src/utils/pattern/backtest/engine.ts#L50-L77)。

滑点处理规则：

- 做多开仓：成交价 = 原价 + 滑点
- 做多平仓：成交价 = 原价 - 滑点
- 做空开仓：成交价 = 原价 - 滑点
- 做空平仓：成交价 = 原价 + 滑点

本质上是把滑点朝“不利于交易者”的方向处理。

## 6.4 股数与仓位

下单数量计算见 [src/utils/pattern/backtest/engine.ts:199-205](src/utils/pattern/backtest/engine.ts#L199-L205)：

```ts
const availableCash = cash * params.positionSize
const quantity = Math.floor(availableCash / entryPrice / 100) * 100
```

含义：

- 先按 `positionSize` 计算本次可用资金；
- 再按成交价换算可买股数；
- 最终向下取整到 100 股整数倍。

因此当前实现默认是 A 股风格的整手交易模型。

## 6.5 止盈止损价

止盈止损价格由 `calcStopPrices` 计算，见 [src/utils/pattern/backtest/engine.ts:107-125](src/utils/pattern/backtest/engine.ts#L107-L125)。

做多：

- 止盈价 = `entryPrice * (1 + takeProfitRatio)`
- 止损价 = `entryPrice * (1 - stopLossRatio)`

做空：

- 止盈价 = `entryPrice * (1 - takeProfitRatio)`
- 止损价 = `entryPrice * (1 + stopLossRatio)`

### 6.6 开仓后现金变化

一旦开仓成功，主循环会执行：

```ts
cash -= position.entryPrice * position.quantity
```

位置见 [src/utils/pattern/backtest/engine.ts:406-409](src/utils/pattern/backtest/engine.ts#L406-L409)。

注意：这里扣减的是成交金额本身，不包含开仓佣金的即时现金扣减；佣金在最终单笔交易净盈亏里体现。

---

## 7. 平仓逻辑

## 7.1 平仓检查顺序

持仓存在时，主循环会优先检查平仓条件，见 [src/utils/pattern/backtest/engine.ts:371-395](src/utils/pattern/backtest/engine.ts#L371-L395)。

平仓判定函数为 `checkExitConditions`，位于 [src/utils/pattern/backtest/engine.ts:130-167](src/utils/pattern/backtest/engine.ts#L130-L167)。

判定顺序如下：

1. 先检查止盈
2. 再检查止损
3. 最后检查是否超出最大持仓天数

## 7.2 止盈止损判定

对做多仓位：

- `currentHigh >= takeProfitPrice` 触发止盈
- `currentLow <= stopLossPrice` 触发止损

对做空仓位：

- `currentLow <= takeProfitPrice` 触发止盈
- `currentHigh >= stopLossPrice` 触发止损

说明：

- 使用的是当日 `high/low` 触发条件，而不是只看收盘价；
- 如果同一天理论上既触发止盈又触发止损，当前代码按“先止盈、后止损”的顺序处理。

## 7.3 超时平仓

若 `position.holdingDays >= maxHoldingDays`，则返回 `timeout`，见 [src/utils/pattern/backtest/engine.ts:161-164](src/utils/pattern/backtest/engine.ts#L161-L164)。

超时平仓在执行层面使用当日收盘价作为原始出场价，见 [src/utils/pattern/backtest/engine.ts:248-256](src/utils/pattern/backtest/engine.ts#L248-L256)。

## 7.4 遍历结束后的强制平仓

如果回测结束时仍有持仓，会在最后一个交易日强制按 `timeout` 平仓，见 [src/utils/pattern/backtest/engine.ts:445-460](src/utils/pattern/backtest/engine.ts#L445-L460)。

这保证了结果中不会残留未平仓状态。

---

## 8. 成交价与交易成本

## 8.1 佣金与印花税

交易成本函数 `calcTransactionCost` 位于 [src/utils/pattern/backtest/engine.ts:82-102](src/utils/pattern/backtest/engine.ts#L82-L102)。

规则如下：

- 佣金：`max(amount * commissionRate, 5)`，双向收取，单笔最低 5 元
- 印花税：`amount * stampDutyRate`，仅卖出时收取

这里的“卖出”是由 `isSell` 控制，当前回测在出场时统一按 `isSell = true` 处理。

## 8.2 滑点成本

滑点不仅会影响成交价，也会单独统计为成本：

- 开仓滑点成本：`abs(rawEntryPrice - entryPrice) * quantity`
- 平仓滑点成本：`abs(rawExitPrice - finalExitPrice) * quantity`

相关代码见：

- 开仓：[src/utils/pattern/backtest/engine.ts:207-214](src/utils/pattern/backtest/engine.ts#L207-L214)
- 平仓：[src/utils/pattern/backtest/engine.ts:261-277](src/utils/pattern/backtest/engine.ts#L261-L277)

## 8.3 单笔净盈亏

平仓时会先计算毛盈亏，再扣除成本，见 [src/utils/pattern/backtest/engine.ts:265-281](src/utils/pattern/backtest/engine.ts#L265-L281)。

做多：

- `grossPnL = (exitPrice - entryPrice) * quantity`

做空：

- `grossPnL = (entryPrice - exitPrice) * quantity`

净盈亏：

- `netPnL = grossPnL - totalCost - entrySlippage - exitSlippage`

其中 `totalCost` 当前包含的是出场佣金 + 印花税，开仓佣金单独保存在 `trade.entryCommission` 字段中，但未在 `netPnL` 公式里直接再次扣减。

---

## 9. 资金曲线计算

资金曲线记录逻辑位于 [src/utils/pattern/backtest/engine.ts:421-442](src/utils/pattern/backtest/engine.ts#L421-L442)。

每日会计算：

- `cash`：当前现金
- `positionValue`：若持仓则为 `quantity * currentClose`
- `equity`：`cash + positionValue`
- `drawdown`：相对历史最高净值的回撤金额
- `drawdownPct`：相对历史最高净值的回撤比例

并生成 `EquityPoint`：

```ts
{
  date,
  index,
  equity,
  cash,
  positionValue,
  drawdown,
  drawdownPct,
}
```

类型定义见 [src/utils/pattern/backtest/types.ts:124-132](src/utils/pattern/backtest/types.ts#L124-L132)。

---

## 10. 绩效指标

绩效指标计算位于 [src/utils/pattern/backtest/metrics.ts:224-338](src/utils/pattern/backtest/metrics.ts#L224-L338)。

## 10.1 基础指标

- `totalTrades`：总交易数
- `winningTrades`：盈利笔数
- `losingTrades`：亏损笔数
- `winRate`：胜率 = 盈利笔数 / 总笔数

## 10.2 收益类指标

- `totalReturnAmount`：所有交易净盈亏之和
- `totalReturn`：总收益率 = `totalReturnAmount / initialCapital`
- `avgReturn`：单笔平均收益率
- `avgWinReturn`：盈利交易平均收益率
- `avgLossReturn`：亏损交易平均收益率

## 10.3 盈亏质量指标

- `profitLossRatio`：平均盈利 / 平均亏损绝对值
- `profitFactor`：总盈利 / 总亏损绝对值

## 10.4 风险指标

- `maxDrawdown`：最大回撤金额
- `maxDrawdownPct`：最大回撤比例
- `maxConsecutiveLosses`：最大连续亏损次数
- `maxConsecutiveWins`：最大连续盈利次数

## 10.5 风险调整收益指标

- `sharpeRatio`：夏普比率，基于日收益率年化，默认无风险利率 3%，实现见 [src/utils/pattern/backtest/metrics.ts:80-121](src/utils/pattern/backtest/metrics.ts#L80-L121)
- `sortinoRatio`：索提诺比率，只考虑下行波动，见 [src/utils/pattern/backtest/metrics.ts:123-164](src/utils/pattern/backtest/metrics.ts#L123-L164)
- `calmarRatio`：卡玛比率 = 年化收益 / 最大回撤，见 [src/utils/pattern/backtest/metrics.ts:166-181](src/utils/pattern/backtest/metrics.ts#L166-L181)

## 10.6 持仓、极值、多空、成本统计

此外还会统计：

- 平均 / 最大 / 最小持仓天数
- 最大单笔盈利 / 亏损
- 多头交易数、空头交易数及各自胜率
- 总佣金、总印花税、总滑点、总交易成本
- `costPctOfReturn`：成本占收益比例

完整字段见 [src/utils/pattern/backtest/types.ts:137-191](src/utils/pattern/backtest/types.ts#L137-L191)。

---

## 11. 页面展示结果

当前页面中，回测结果卡片展示了以下关键指标，位置见 [src/views/pattern/index.vue:337-475](src/views/pattern/index.vue#L337-L475)：

### 11.1 顶部汇总

- 交易笔数：`backtestResult.trades.length`
- 总收益率标签：`backtestResult.totalReturn`

### 11.2 指标区

第一行：

- 胜率 `metrics.winRate`
- 盈亏比 `metrics.profitLossRatio`
- 总收益率 `totalReturn`
- 最大回撤 `metrics.maxDrawdownPct`

第二行：

- 夏普比率 `metrics.sharpeRatio`
- 盈利因子 `metrics.profitFactor`
- 平均持仓天数 `metrics.avgHoldingDays`
- 最大连续亏损次数 `metrics.maxConsecutiveLosses`

### 11.3 交易记录表

表格展示的字段包括：

- 方向（做多 / 做空）
- 入场日期
- 出场日期
- 入场价
- 出场价
- 持仓天数
- 平仓原因
- 收益率
- 净盈亏

对应代码见：

- 指标卡片：[src/views/pattern/index.vue:347-399](src/views/pattern/index.vue#L347-L399)
- 交易表格：[src/views/pattern/index.vue:404-472](src/views/pattern/index.vue#L404-L472)

---

## 12. 当前实现特征与边界

## 12.1 当前实现特征

1. **事件驱动**：交易信号完全由形态突破事件驱动，不做连续择时。
2. **单持仓模型**：同一时间最多只持有一笔仓位。
3. **日线级判定**：开平仓逻辑基于日 K 的 `high / low / close` 计算。
4. **已确认突破过滤**：只回测已确认突破，信号更保守。
5. **支持双向交易**：可以配置是否允许向下突破做空。
6. **交易成本显式建模**：佣金、印花税、滑点均有单独处理。

## 12.2 需要注意的边界

1. **同日只保留一个突破映射**
   `breakoutDays` 使用 `Map<number, ConvergingTriangleResult>`，若多个形态落在同一个 `breakoutDay`，后写入的会覆盖先写入的形态，见 [src/utils/pattern/backtest/engine.ts:348-353](src/utils/pattern/backtest/engine.ts#L348-L353)。

2. **单账户单仓位**
   当前不支持同时持有多笔交易，也不支持组合层面的并发信号管理。

3. **开仓佣金未即时体现在现金扣减公式中**
   开仓时现金只扣减成交金额，未同步扣减开仓佣金，见 [src/utils/pattern/backtest/engine.ts:406-409](src/utils/pattern/backtest/engine.ts#L406-L409)。

4. **止盈优先于止损**
   同一根 K 线若上下波动同时覆盖止盈 / 止损价格，当前代码按检测顺序优先判定止盈，见 [src/utils/pattern/backtest/engine.ts:140-158](src/utils/pattern/backtest/engine.ts#L140-L158)。

5. **交易单位固定为 100 股整数倍**
   这更接近 A 股场景，不适用于碎股或非整手市场。

6. **页面未暴露全部回测参数**
   页面只暴露部分参数，其他参数仍使用代码默认值。

---

## 13. 对外接口

主回测函数签名如下，见 [src/utils/pattern/backtest/engine.ts:318-322](src/utils/pattern/backtest/engine.ts#L318-L322)：

```ts
export function runBacktest(
  klineData: KLineData,
  patterns: ConvergingTriangleResult[],
  params: Partial<BacktestParams> = {}
): BacktestResult
```

### 输入

- `klineData`：标准化后的 K 线数据
- `patterns`：收敛三角形检测结果列表
- `params`：可覆盖默认值的回测参数

### 输出

返回 `BacktestResult`，包含：

- `params`
- `startDate` / `endDate` / `totalDays`
- `trades`
- `equityCurve`
- `metrics`
- `initialCapital`
- `finalEquity`
- `totalReturn`

类型定义见 [src/utils/pattern/backtest/types.ts:196-216](src/utils/pattern/backtest/types.ts#L196-L216)。

---

## 14. 结论

当前回测实现已经形成一条完整链路：

- 从收敛三角形识别结果中提取已确认突破信号；
- 在突破日驱动开仓；
- 依据止盈 / 止损 / 超时规则平仓；
- 记录逐日资金曲线；
- 输出交易明细与绩效指标；
- 最终在页面中完成结果展示。

对于当前项目来说，这套实现适合用于：

- 验证收敛三角形突破信号的历史表现；
- 比较不同检测参数与回测参数的策略差异；
- 为后续扩展更复杂的仓位管理、组合管理、信号过滤提供基础。
