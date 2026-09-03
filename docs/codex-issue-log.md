# Buzz Codex Lab 问题记录

这个文件记录用户反馈的问题、定位结论、修复内容和验证版本。每次处理新的用户问题时都要追加一条记录，不要覆盖历史记录。

## 记录格式

```markdown
## YYYY-MM-DD：问题标题

- 现象：
- 定位：
- 处理：
- 验证：
- 版本/提交：
```

## 2026-08-29：公网 Community 频道无法连接

- 现象：Buzz 已能正常启动，但同时配置公网 Relay 和 LAN Relay 时，公网 Community 的频道无法连接；使用 `d1c5eca5` 的其他电脑可以正常连接。
- 定位：公网 Relay 的 HTTP 和 WebSocket 服务均可用。HTTP `/query`、`/events` 请求错误地直接使用 LAN Host，Relay 按 Host 识别为另一 Community，导致公网 Community 的频道查询和消息发送落到错误租户。
- 处理：恢复 HTTP 查询和事件提交使用 canonical/public Relay URL；LAN 地址仅作为原生 WebSocket 的传输拨号地址，并保留公网 Host 作为 Community 身份。
- 验证：前端 TypeScript 类型检查通过；相关 Rust Relay 测试通过（本机两个网络监听测试因 Windows 套接字错误 `10055` 失败，与本次逻辑无关）。
- 版本/提交：`0.5.15-12` / `4d8997be`；测试包 `0.5.15-13` 基于同一提交重新构建。

## 2026-08-28：启动后一直加载

- 现象：正式应用标识下启动卡在加载界面，独立诊断标识正常；同一安装包在其他电脑正常。
- 定位：原应用标识的 WebView2 持久化状态包含失效的 active Community、旧 Relay 和频道缓存；Relay 后台日志仍显示可连接，因此不是服务端或网络故障。
- 处理：启动时修复失效 Community、清理过期 Relay/频道缓存，并为阻塞的启动阶段增加超时恢复界面；保留身份、Agent 配置和聊天记录。
- 验证：Community 测试 `14/14`、TypeScript 类型检查和格式检查通过。
- 版本/提交：`0.5.15-11` / `c8f21fc9`。

## 2026-08-29：公网 Community 无法连接并卡在加载界面

- 现象：点击公网 Community 后持续显示加载状态，无法点击其他位置；公网频道仍无法连接，内网 Community 不受影响。
- 定位：社区切换后的身份、资料和频道初始化依赖 Relay HTTP 请求。公网请求经过代理或连接半开时，旧客户端没有请求级超时，导致 Promise 长时间 pending，React 的 Community/Onboarding gate 无法释放。此前为避免 LAN Host 造成租户错配而移除 HTTP fallback，也同时失去了对代理异常的恢复路径。
- 处理：为 Relay HTTP 客户端增加 15 秒请求超时；公网 canonical URL 请求失败时仅切换到直连客户端重试，保持相同 URL、Host 和 NIP-98 `u` 标签，不把 LAN 地址当作另一个 Community；提交事件沿用同样的直连重试策略。
- 验证：`pnpm typecheck`、Biome 检查、`cargo check` 和 Relay 单元测试（30/30）通过。全量 `cargo fmt --check` 仍被工作区已有的未格式化文件阻塞，本轮改动文件本身未引入格式问题。
- 版本/提交：`0.5.15-12` / `4d8997be`；测试包 `0.5.15-13` 基于同一提交重新构建。

## 2026-08-29：Relay 断开时无法退出 Community

- 现象：公网或内网 Relay 断开后，点击退出 Community 会一直等待，无法完成本地移除。
- 定位：退出流程先等待 NIP-43 leave 请求被 Relay 接受；`leaveCommunity` 的网络超时直接向上抛出，`communities.removeCommunity` 因此不会执行。
- 处理：将超时、Relay unreachable、WebSocket/网络连接失败归类为连接故障，连接故障时继续完成本地退出；权限拒绝、协议错误等非连接错误仍然保留原有阻止退出行为。
- 验证：退出流程相关单元测试 8/8 通过，TypeScript 类型检查和 Biome 检查通过；全量桌面测试有 1 个既有环境相关失败，其余 4873 项通过。
- 版本/提交：`0.5.18` / 本次修复提交。

## 2026-08-29：启动更新日志弹窗卡住应用

- 现象：启动后更新日志弹窗覆盖整个应用，关闭后在启动状态重新渲染时可能再次出现，用户感觉 Buzz 一直卡在更新日志页面。
- 定位：`StartupChangelogDialog` 原先只判断 Community 配置已应用，不判断 AppReady 是否完成或 Relay 是否在线。因此公网 Relay 断连、缓存中的旧 Community 被恢复时，日志弹窗仍会覆盖启动恢复界面；同时组件重新挂载会把 `open` 重置为 `true`。
- 处理：将弹窗移动到 AppReady 完成后的渲染分支；Relay 未连接时使用非阻塞日志层，让底层重试/更换 Community 控件可操作；关闭按钮改为显式更新 Dialog 状态，并在进程级记录已关闭状态，覆盖按钮、右上角关闭和 Esc 关闭路径。
- 验证：`pnpm typecheck`、Biome 检查和现有启动日志单元测试通过。
- 版本/提交：`0.5.15-15` / `136a3cd1`；测试包已生成。

## 2026-08-29：Inbox Thread 上下文加载后页面定格

- 现象：打开 Inbox 中的 Thread 后一直显示 `Loading surrounding context...`，右侧页面像被定格。
- 定位：feed 轮询会替换选中 `FeedItem` 的对象引用，导致上下文 hydration effect 重复启动；Relay 重连等待或本地 `get_event` 请求没有统一总超时，`isLoading` 可能长期保持为 `true`。
- 处理：Thread 上下文改用事件字段作为稳定依赖，避免 feed 刷新重复启动请求；增加 15 秒总超时，超时后结束 loading 并显示上下文加载错误。
- 验证：`pnpm typecheck`、Biome 检查和启动日志单元测试通过；Thread 上下文回归测试待补充。
- 版本/提交：待提交。

## 2026-08-29：旧安装配置下 Thread 仍卡在加载

- 现象：使用旧安装配置打开 Inbox Thread 仍停在 `Loading surrounding context...`，而清空配置后的新环境正常。
- 定位：启动迁移只清理了 `buzz-channels.v1` 等目录索引缓存，却遗漏真正保存频道消息窗口的 `buzz-channel-messages.v1`；旧安装还会保留已经写入的 `buzz-storage-repair-v1` 标记，导致后续版本不会再次清理。
- 处理：增加 `buzz-storage-repair-v2` 迁移标记，并将频道消息快照纳入一次性清理范围。清理仅删除可重建的社区/频道缓存，保留 Community、身份、Agent 配置和服务端聊天记录。
- 验证：待运行桌面类型检查、Biome 和社区存储回归测试。

## 2026-08-29：旧配置仍可能恢复无效 Relay 状态

- 现象：清理频道缓存后，部分旧安装仍在打开 Inbox Thread 时卡住；截图同时显示 Thread 内容和 `Can't reach the relay`。
- 根因：旧 Community 记录中的公网/LAN 地址此前只做了宽松格式检查，失效的 LAN 地址、带路径/参数的 Relay 地址仍可能被恢复；冷启动 URL 中的旧 Thread 还会触发无超时的 `getEventById`。
- 处理：启动修复现在会丢弃空或带凭据、参数、路径的 Relay 配置，校验并规范 LAN 地址，失效 LAN 地址自动移除；冷启动 Thread anchor 增加 10 秒上限。
- 结果：旧配置即使存在，也会降级到可用的公网 Community 或可操作的错误状态，不再让单个旧请求锁住界面。

## 2026-08-29：离线时更新日志弹窗仍导致界面像卡住

- 现象：启动后更新日志弹窗出现，背景界面被锁定，Relay 断开时无法点击 Community 或重试控件。
- 根因：`StartupChangelogDialog` 虽然设置了 `modal={false}`，但共享 `DialogContent` 仍无条件创建全屏 `DialogOverlay`。透明 Overlay 仍覆盖整个 WebView，造成底层界面无法交互。
- 处理：为 `DialogContent` 增加 `showOverlay` 选项；启动更新日志使用 `showOverlay={false}`，同时保留普通设置对话框的默认模态遮罩。
- 结果：更新日志仍在启动时显示，但不再阻塞 Community/Relay 恢复操作；关闭按钮、右上角关闭和 Esc 仍可用。

### 追加定位：非模态 Dialog 仍参与全局交互管理

- 处理：启动更新日志不再使用 Radix Dialog，改为普通的非模态浮层；不创建 Overlay、FocusScope 或 DismissableLayer，仅浮层内容本身接收点击。

### 追加定位：日志列表滚动容器吞掉了关闭按钮

- 现象：更新日志可以上下滚动，但内容较长时“知道了”按钮位于滚动内容末尾，不在当前可视区域，用户感觉按钮点击无效。
- 处理：改为三行布局，标题固定、日志列表独立滚动、底部关闭按钮固定显示。

## 2026-08-29：LAN fast path 下更新日志可滚动但应用无法点击

- 现象：同一个 `0.5.15-20` 安装包在其他电脑正常；故障机启动后更新日志可以滚动，但“知道了”和其他 React 控件无响应，WebView 渲染进程持续占满一个 CPU 核心。
- 定位：两台电脑的 EXE SHA-256 完全一致。逐键 A/B 验证确认，仅当 active Community 同时保存公网 `relayUrl` 和 LAN `lanRelayUrl` 时复现。浏览器级 V8 trace 显示热点集中在 `subscribeLive -> subscribe -> ensureConnected` 和 presence subscription reconcile。提交拓扑确认 `Lin/develop` 从未包含上游 `6ea7a2b2`（#3320）的早到 Relay 帧缓冲修复；LAN fast path 并未删除该修复，而是让原有竞态更容易稳定触发。LAN 连接建立得更快，AUTH challenge 会在 `authRequest` 安装前到达并被丢弃，继而触发认证等待和订阅重试循环。公网连接较慢，所以问题具有机器和网络环境差异。
- 处理：恢复连接期间的入站帧缓冲；先安装 AUTH waiter，再按顺序排空早到帧；保留 LAN transport 和 canonical Relay 身份；增加缓冲顺序及溢出回归测试。
- 验证：Relay 单元测试 11/11、TypeScript typecheck、Biome、E2E build 均通过；两个确定性 early-AUTH E2E 均通过，覆盖首次认证/打开频道/首次发送，以及首轮 AUTH 签名挂起后超时重连；原有 initial-dial retry E2E 单独复跑通过；Tauri native WebSocket/LAN transport 测试 9/9 通过。仍需用保留原配置的安装包实机复测 CPU 与按钮交互。
- 版本/提交：待提交。

## 2026-08-30：点击“知道了”后进入 Community 卡死

- 现象：更新日志中的“知道了”现在可以点击，但进入 Community 后页面仍像卡死，旧配置/旧连接状态下尤其明显。
- 根因：Relay 认证成功后，`connect()` 仍等待旧连接的订阅回放和频道历史回补；回放会等待限流窗口、HTTP 修复请求或大量旧订阅。所有新挂载的 Community 查询共享同一个 `connectPromise`，因此会被旧回放串行阻塞，表现为进入后一直加载、消息框和页面交互不正常。
- 处理：认证成功即标记连接可用、启动连接看门狗并释放 `connectPromise`；订阅回放改为后台 best-effort 任务。新订阅立即发送自己的 REQ，回放期间若真实写入失败仍沿用原有连接重置/重连路径。若 LAN WebSocket 已完成握手但认证失败/超时，下一次自动重连单次跳过 LAN，改用公网 Relay；LAN 认证采用 8 秒上限，避免坏的内网端点长期占住启动流程。
- 验证：新增 E2E 回归场景，限流历史回补期间仍能发送新消息；待运行 Relay 重连用例、TypeScript 和 Biome 检查。
- 版本/提交：待提交。

## 2026-08-30：Community 需要 LAN/公网双地址探测与手动切换

- 需求：加入 Community 时可同时填写公网 Relay 地址和内网 Relay 地址；启动连接先验证内网，内网不可用时自动回退公网。已连接公网后，用户回到内网时需要一个按钮重新检测并自动切换到内网。
- 处理：保留公网地址作为 canonical Relay 身份和 AUTH 地址；native WebSocket 增加 LAN-only 探测配置与实际 transport 回报。Relay 客户端的探测会完成 WebSocket 握手和 NIP-42 AUTH，成功后保留现有 live subscriptions 切到 LAN，失败则立即改用公网并恢复正常 LAN-first/public-fallback 策略。Community 菜单新增“检测并切换到内网 Relay”按钮及检测中状态。
- 验证：TypeScript 类型检查、Biome、Tauri native WebSocket/LAN 单元测试通过；待构建本地安装包进行双地址实机验证。
- 版本/提交：待提交。

## 2026-08-30：实际位于内网但 Buzz 判断 LAN Relay 不可用

- 现象：客户端地址为 `192.168.191.102/24`，能够直连 `10.24.11.82:3000`，WebSocket 握手也能收到 AUTH challenge，但手动检测仍提示“内网不可用”。
- 根因：LAN fast path 通过明文 WebSocket 直连，同时保留公网 Host 进行 Community 租户绑定。Relay 因直连协议要求 NIP-42 `relay` 标签为 `ws://公网主机名`，客户端却一直按 canonical 公网配置签入 `wss://公网主机名`，严格认证因此返回 `auth-required: verification failed`。此前 UI 把握手、认证和网络失败统一显示成“内网不可用”，进一步掩盖了真实原因。
- 处理：LAN transport 的 AUTH 事件只把 canonical URL 的协议改为 `ws`，保留相同公网主机名和 Community 身份；公网 transport 继续使用原始 `wss`。手动检测结果现在区分 LAN 失败与公网回退失败，并显示 Relay 返回的具体错误。
- 验证：AUTH URL 与入站缓冲测试 5/5、TypeScript、Biome、Tauri native WebSocket 9/9、Relay NIP-42 9/9 通过。对真实 `10.24.11.82:3000` 保持公网 Host 的 A/B 探测中，`wss://公网主机名` 返回 `auth-required: verification failed`，`ws://同一公网主机名` 返回认证成功，直接确认根因与修复方向。待生成标识测试包进行实机验证。
- 版本/提交：`0.5.16` 本地发布；源代码提交见本次版本提交。

## 2026-08-31：ngrok 公网入口达到额度且无法切回旧域名

- 现象：当前公网入口 `content-swift-seemingly.ngrok-free.app` 返回 HTTP 403 / `ERR_NGROK_727`，用户希望切回此前的 `fairy-sigilistic-elizbeth.ngrok-free.dev`。
- 诊断：当前 ngrok agent 在线，但账号已达到当月 HTTP 请求上限。旧域名返回 `ERR_NGROK_3200`；使用当前凭据启动旧域名时，ngrok 明确返回 `ERR_NGROK_320`，说明域名保留在另一个账号。切换前备份与当前 `ngrok.yml` 的 token 指纹一致，机器上没有保存可用于旧域名所属账号的另一套凭据。
- 处理：保留现有 ngrok 配置和进程，未贸然覆盖 token 或切换域名。要恢复旧域名，需要先取得该域名所属账号的 authtoken；也可换用一个未超额账号的新域名。
- 验证：本地 ngrok API 报告 agent `online`；当前入口稳定返回 `ERR_NGROK_727`，旧入口稳定返回离线错误，relay 本机及 LAN 服务不受影响。
- 版本/提交：诊断时仓库为 `7bb6bc01`（`0.5.16`）。

### 追加处理：恢复旧账号和旧域名

- 用户重新配置旧域名所属账号的 authtoken 后，`buzz-ngrok.service` 成功启动，`fairy-sigilistic-elizbeth.ngrok-free.dev/_readiness` 返回 HTTP 200。
- 将 Relay canonical URL 和 ACP 默认 URL 切回 `wss://fairy-sigilistic-elizbeth.ngrok-free.dev`，停止已超额的 `content-swift-seemingly.ngrok-free.app` 独立隧道，并完整重启 Relay。

## 2026-08-31：公网 IP 直连被识别为未配置社区

- 现象：客户端直连 `ws://121.192.177.100:3000` 时进入 Profile 创建流程，随后收到 `relay returned 404 Not Found: relay: no community is configured for this host`。
- 定位：relay 使用请求 Host 选择社区；现有社区主 Host 是 `fairy-sigilistic-elizbeth.ngrok-free.dev`，数据库没有公网 IP 的 Host 别名。另，服务器实际网卡地址是 `121.192.177.100/26`，不是用户提到的 `121.192.177.119`；后者在本机端口探测中连接被拒绝。由于端口为 3000，实际 Host 需要匹配 `121.192.177.100:3000`。
- 处理：将 `121.192.177.100` 和 `121.192.177.100:3000` 写入 `community_host_aliases`，均指向现有社区 `fairy-sigilistic-elizbeth.ngrok-free.dev`，不创建新社区、不迁移已有数据。
- 验证：通过 `Host: 121.192.177.100:3000` 的本地 NIP-11 请求返回 HTTP 200；canonical 域名仍返回 HTTP 200。无需重启 relay，Host 别名查询为请求级数据库读取。
- 版本/提交：运行时仓库为 `7bb6bc01`（`0.5.16`）。

## 2026-08-31：同一 Relay 经不同 Host 进入后 Profile 和历史记录分裂

- 现象：通过公网 IP 进入同一 relay 时要求重新建立 Profile，进入后看不到此前的频道和历史记录。
- 定位：数据库中存在两个独立 Community：`content-swift-seemingly.ngrok-free.app` 有 2715 条事件、101 个用户和 27 个频道；后来恢复的 `fairy-sigilistic-elizbeth.ngrok-free.dev` 被启动流程创建为新 Community，只有 71 条事件、9 个用户和 3 个频道。IP Host 别名最初指向后者。同一用户公钥在历史 Community 有 318 条事件、在新 Community 只有 17 条，直接证明数据被 Host 边界分开，而不是客户端丢失历史。
- 处理：保留两个 Community 的数据；将原 `fairy` 小 Community 改名为 `legacy-fairy-sigilistic-elizbeth.ngrok-free.dev`，将历史 `content-swift` Community 的主 Host 改为当前 `fairy` 域名，并把 `content-swift`、`121.192.177.100`、`121.192.177.100:3000`、`121.192.177.119`、`121.192.177.119:3000` 全部设为历史 Community 的别名。完整重启 relay 后，部署 Community 确认为历史 Community id `0a3b5be4-3092-4ac9-99a7-be8de0892bcb`。
- 验证：canonical Host 和 IP Host 的本地 readiness 均返回 HTTP 200；relay 启动日志显示 `Deployment community ensured` 指向历史 Community。公网 ngrok transient unit 同时消失，因此补建持久化 `buzz-ngrok.service` 后单独验证公网入口。
- 版本/提交：运行时仓库为 `7bb6bc01`（`0.5.16`）。

## 2026-08-31：工作站绑定公网 IPv4 并保留内网连接

- 现象：用户希望在保留内网地址 `10.24.11.82` 可连接的同时，为工作站绑定公网地址 `121.192.177.100/26`，公网网关为 `121.192.177.65`。
- 定位：当前唯一有链路的网卡为 `ens1f3`，已有 `10.24.11.82/26` 和默认网关 `10.24.11.65`；其他网口均无载波。公网地址可作为同一网卡的第二地址，但两个网关不能直接并列为默认路由，应为公网源地址配置独立路由表和策略规则。
- 处理：完成 NetworkManager 配置语法校验，方案为保留内网默认路由，增加公网地址、`table 177` 的公网直连/默认路由，以及 `from 121.192.177.100/32` 的策略规则。尝试修改现有连接时因当前会话没有管理员授权而返回 `Insufficient privileges`，未改变系统网络配置。
- 验证：只读检查确认当前内网地址和路由保持不变；公网网关连通性尚未验证，需管理员应用配置后测试 ARP/ICMP 和实际服务端口。
- 版本/提交：工作区 `Lin/develop`，未创建提交。

### 追加验证

- 用户已用管理员权限成功执行 NetworkManager 配置并重新应用到 `ens1f3`。
- `10.24.11.82/26` 与 `121.192.177.100/26` 同时存在；`ip rule` 显示 `from 121.192.177.100 lookup 177`；公网流量解析为经 `121.192.177.65` 出口。
- 公网网关 `121.192.177.65` ping 3/3 成功，延迟约 0.84–4.01 ms；内网默认路由未被替换。

## 2026-09-01：删除 Custom Agent 后人格卡片重新出现在 Agents 区域

- 现象：删除下方 Custom agents 中的 Agent 后，同名卡片重新出现在上方 Agents 区域。
- 定位：旧版 Codex task Agent 记录可能带有迁移生成的 `personaId`。删除实例只移除了 managed-agent 记录，但仍保持该人格定义为 active；统一列表刷新后，失去任务实例过滤条件的定义被重新渲染为普通 Agents 卡片。
- 处理：删除绑定 Codex task 的最后一个实例时，仅对非内置、非团队、未共享且非共享目录副本的人格自动设为 inactive；普通自定义人格、内置人格和仍被其他实例使用的人格不受影响。删除完成后同时刷新 managed agents、relay agents 和 personas 查询。
- 验证：待运行 Tauri Rust 测试、桌面 TypeScript/格式检查，并验证删除任务 Agent 后不会出现重复卡片。
- 版本/提交：待提交。

## 2026-09-01：Codex Code Mode host 缺失导致运行时警告

- 现象：Agent Activity 中出现 `Code Mode is unavailable because failed to spawn code-mode host ...\\codex-code-mode-host.exe: host executable was not found`，但普通 Codex 对话仍可能继续返回结果。
- 定位：Windows Codex 更新会在 `%LOCALAPPDATA%\\OpenAI\\Codex\\bin` 中短暂或长期留下只有 `codex.exe` 的版本目录；Buzz 之前始终传入 `-c features.code_mode_host=true`，Codex 随后按当前运行时版本哈希查找同目录 sidecar，找不到就把该警告作为 Agent 输出返回。该 sidecar 是 Codex Desktop/CLI 的可选安装组件，不属于 Buzz 安装包，Buzz 不应假定每台机器都有它。
- 处理：将 app-server 主程序和 Code Mode host 解耦探测。只要 `codex.exe` 存在即可启动共享 app-server；仅在同目录存在匹配 `codex-code-mode-host(.exe)` 时传入 `features.code_mode_host=true`。启动日志新增 `code_mode_host=enabled|unavailable`，便于区分可选能力缺失与运行时本身启动失败。
- 验证：Tauri Codex runtime 单元测试 9/9、桌面 TypeScript typecheck 通过；本次文件 rustfmt 通过。缺少 sidecar 时验证不再带 Code Mode 开关，有 sidecar 时保持原行为。
- 版本/提交：`0.5.18` / `45e2e9b4`。

## 2026-09-02：Android 附件发送长时间停留在 Sending

- 现象：Android 端发送一个很小的附件仍需约 2 秒，早前个别发送接近 7.8 秒；分阶段日志显示读取约 220 ms、上传约 1.11 秒、消息发布确认约 599 ms。
- 定位：附件字节和 relay 服务端不是主要瓶颈。平板连接名为 `ASUS_5G` 的网络时实际工作在 2412 MHz，直连 relay 的请求在 136 ms 至 2.1 秒之间抖动；relay 本机处理消息仅约 21 ms，MinIO 健康检查约 5.5 ms。切换到 5220 MHz 网络后，连续请求稳定在 98 至 119 ms。客户端 publish 路径和 relay 出站路径均没有固定 500 ms 等待。
- 处理：保留文件读取、上传、签名和 relay 确认的分阶段诊断日志；移动端媒体上传优先使用已验证的 LAN transport，并复用 HTTP client；新媒体上传先检查租户 sidecar，sidecar 不存在时跳过无意义的 blob `HEAD`。测试过 Android Wi-Fi low-latency lock，但没有稳定收益，未纳入产品代码。
- 验证：真实附件发送降至约 1.13 秒，其中读取 57 ms、上传 412 ms、消息准备/签名/确认 650 ms；`buzz-media` 121 项测试和移动端相关 123 项测试通过，`flutter analyze` 无问题，debug APK 已在实机安装验证。
- 版本/提交：基于 `047c8141`，本次 PR 待提交。

## 2026-09-02：登录后 Inbox 线程部分上下文未加载

- 现象：登录后打开 Home/Inbox 的线程详情，消息主体可以显示，但顶部出现 `Some message context could not be loaded.`，部分根消息、父消息或上下文没有补齐。
- 定位：Inbox 冷启动会通过 `get_event` 按事件 ID补拉线程祖先；桌面 Tauri 命令此前只查询少量 kind，遗漏了 legacy stream、job 生命周期、workflow、Git、forum vote 及 huddle 生命周期等公开事件。另一个问题是请求可能发生在首次 AUTH 或重连窗口，临时 relay 失败会被永久记录为加载错误。
- 处理：新增明确的公开 `EVENT_LOOKUP_KINDS` 集合，覆盖可作为线程根/父事件的公开类型，同时排除 recipient-gated、author-only 和其他受限事件，避免放宽 relay 访问边界；Inbox 上下文加载现在监听 relay 连接状态，非 `connected` 阶段的失败不再显示为持久错误，并会在连接认证成功后重新 hydration。
- 验证：新增 Rust 单元测试锁定关键公开 kind 均可查找且 lookup filter 不含 p-gated kind；消息命令测试 13/13、Inbox 辅助测试 23/23、桌面 TypeScript、Biome、E2E 构建和本次文件 rustfmt 检查通过。全量桌面测试共 4,883 个用例，其中 4,882 个通过、1 个与本次改动无关的既有失败。
- 版本/提交：待提交。

## 2026-09-02：Buzz 无法直接挂载到共享域名子路径

- 现象：学校只能提供一个指向 443 端口的域名；Buzz 当前需要占用该域名的根路径，无法直接配置为 `https://example.edu.cn/buzz`，因此不便与同一域名下的其他服务共存。
- 定位：Relay URL 同时承担 WebSocket 地址、NIP-42/NIP-98 签名身份和 HTTP API 基址。Relay 的 NIP-42 校验当前按 `scheme://host` 重建签名 URL，Mobile 的 `/query`、`/upload` 等请求使用根路径解析，CLI/ACP 和媒体安全检查也假设 `/query`、`/events`、`/media` 位于根路径。仅在 Caddy 使用 `handle_path /buzz/*` 会造成路由可达但认证 URL 或媒体路径不一致。
- 处理：当前移动端 PR 不混入该跨协议改造。短期方案是在同一个 443 虚拟主机中，按根路径 WebSocket Upgrade 和 Buzz 已知 API/媒体/邀请路径转发到 relay，其余请求转发到其他服务；Buzz 仍使用根 canonical URL，但不再独占整个端口。真正的可配置 base path 作为独立后续 PR，统一修改 Relay、Desktop、Mobile、CLI、ACP、媒体和邀请链接。
- 验证：已检查 Relay Axum 路由、NIP-42 URL 重建、Mobile HTTP/media URL 解析、CLI/ACP bridge 与媒体路径校验，确认当前版本没有端到端 base-path 支持；共享 443 分流方案尚需结合实际域名和同机其他服务进行 Caddy 配置验证。
- 版本/提交：基于 `047c8141`；后续 base-path PR 待创建。

## 2026-09-02：校园反向代理域名已生效但尚未回源到 Buzz

- 现象：学校工单显示 `chemlabagent.xmu.edu.cn` 的备案、DNS 和反向代理配置已完成，用户询问是否已经获得公网 IP。
- 定位：这不是把公网地址直接绑定到 `10.24.11.82`，而是由学校公网反向代理接收请求后通过 HTTP 80 回源。公网 DNS 当前为 `chemlabagent.xmu.edu.cn CNAME beianban.xmu.edu.cn`，解析到 `210.34.0.61` 和 `2001:da8:e800::61`；工单中的 `219.229.81.240/30` 是源站防火墙需要放行的反向代理来源网段。公网 HTTP/HTTPS 请求均已到达备案网关，但返回 Apache `400` 故障页。源站 `10.24.11.82:80` 和 `:3000` 均可连接，`:80` 的 Caddy 只返回空 `200`，Buzz relay 位于 `:3000` 并正常返回 NIP-11 信息。
- 处理：尚未修改源站。下一步应让 Caddy 在 HTTP 80 上将 `chemlabagent.xmu.edu.cn`（含 WebSocket Upgrade、HTTP API 和媒体路径）反向代理到 `127.0.0.1:3000`，放行来自 `219.229.81.240/30` 的 80 端口访问，并遵守学校要求：源站不启用 HTTP/2、不将 80 重定向到 443。外部客户端使用 `https://`/`wss://chemlabagent.xmu.edu.cn`，TLS 由学校网关终止。
- 验证：公网入口连通时间约 50–60 ms，但当前状态码为 `400`；源站直连 `:3000` 返回 `200`，版本 `0.2.1`。完成 Caddy 和防火墙配置后需重新验证 HTTPS、WSS、NIP-42、媒体上传下载和历史社区身份迁移。
- 版本/提交：仅诊断和记录，未创建代码提交。

### 追加处理与验证

- Caddy 已改为在专用的 HTTP `:80` 入口将整站请求反代到 `127.0.0.1:3000`，因此同时覆盖 WebSocket、NIP-11、事件查询/发布、媒体、邀请、Git HTTP 和 webhook；配置明确不启用源站 TLS，也不把 80 重定向到 443。原配置已备份为 `/etc/caddy/Caddyfile.bak-20260902-chemlabagent`，中间版本备份为 `/etc/caddy/Caddyfile.bak-20260902-host-routing`。
- 将 `chemlabagent.xmu.edu.cn` 写入 `community_host_aliases`，映射到历史 ngrok 社区 `0a3b5be4-3092-4ac9-99a7-be8de0892bcb`，没有创建新社区；随后把 relay 持久化环境中的 `RELAY_URL` 与 `BUZZ_RELAY_URL` 更新为 `wss://chemlabagent.xmu.edu.cn` 并重启 `hl` 用户的 `buzz-relay.service`。旧 ngrok service 暂时保持 active，作为学校入口恢复前的回退。
- 源站使用新域名 Host、旧 ngrok Host 和内网 IP Host 均返回 HTTP 200；经 Caddy 的 WebSocket 握手返回 `101 Switching Protocols` 并收到 NIP-42 `AUTH` challenge。重启后的 relay 进程已加载新 canonical URL，旧 ngrok 公网入口仍返回 200。
- 学校公网 IPv4 `210.34.0.61` 与 IPv6 `2001:da8:e800::61` 仍返回 Apache 400。短时抓包显示公网请求未从学校反代回到 `.82`，而随后内网直连请求正常到达；UFW 当前已允许 80 入站，因此剩余问题在学校反代配置下发或网关侧回源链路，不在 Buzz/Caddy。待学校入口返回 Buzz NIP-11 后，再验证公网 WSS、认证和媒体，并停用旧 ngrok 回退。

### ngrok 退役与主社区迁移

- 用户确认不再保留 ngrok。迁移检查发现 relay 首次以新 `RELAY_URL` 重启时，在既有 alias 之外自动创建了一个 `chemlabagent.xmu.edu.cn` 空壳社区 `f45a5eae-96b9-47b9-af6c-60f2be349000`；它只有 1 条自动 owner membership，没有事件、频道、用户、审计或邀请数据。保护性 SQL 前置条件两次阻止了不完整迁移，所有失败事务均整体回滚。
- 在验证空壳无业务数据后，显式删除其 owner membership 和 community 行；将历史社区 `0a3b5be4-3092-4ac9-99a7-be8de0892bcb` 的主 Host 从 `fairy-sigilistic-elizbeth.ngrok-free.dev` 更新为 `chemlabagent.xmu.edu.cn`，并删除 `fairy-sigilistic-elizbeth.ngrok-free.dev`、`content-swift-seemingly.ngrok-free.app` 相关映射。内网和旧公网 IP aliases 保持不变。
- 重启 relay 后新域名和 `10.24.11.82` 均返回 200，两个 ngrok Host 均返回 404；历史社区仍有 2928 条事件。随后停止并禁用 Buzz 的 system/user ngrok services，删除 `/etc/systemd/system/ngrok-buzz.service` 与 `/home/hl/.config/systemd/user/buzz-ngrok.service`，确认无 ngrok 进程或残留 unit。全局 `/usr/local/bin/ngrok` 未删除，避免影响机器上其他潜在用途。
- 学校公网入口仍为 Apache 400，因此 ngrok 退役后校外 Buzz 暂不可用，需网络中心修复反代回源后恢复；内网 relay 不受影响。

### 源站反代白名单

- 按学校反代通知，将 UFW 的 `80/tcp Anywhere` 和对应 IPv6 广泛放行删除；新增 `219.229.81.240/30 -> 80/tcp` 的学校反代白名单，并保留 `10.24.11.64/26 -> 80/tcp` 供源站内网维护。UFW 默认入站策略继续为 deny。
- Caddy 本机回源验证仍返回 200；纯 HTTP 80 没有 TLS、HTTP/2 或 80 到 443 跳转。公网 IPv4/IPv6 复测仍返回学校 Apache 400，进一步确认剩余问题不在源站防火墙。
- `3000/tcp` 仍用于 Buzz 的校园网直连和 LAN fast path，不属于学校反代入口；在确认所有客户端已能通过新公网域名稳定回退前暂不收紧。服务器上的 `19030`、`8787`、`8788` 属于其他服务，本次没有修改。

## 2026-09-02：网站未认证导致公网 DNS 未切换到反代平台

- 现象：备案管理页面中项目 2389 显示“未认证”；正常访问 `chemlabagent.xmu.edu.cn` 仍进入学校 Apache 400 页面，用户询问是否需要完成认证。
- 定位：厦大权威 DNS `ns1.xmu.edu.cn` 和 `ns2.xmu.edu.cn` 均仍返回 `chemlabagent.xmu.edu.cn CNAME beianban.xmu.edu.cn`，最终为 `210.34.0.61`/`2001:da8:e800::61`。强制将同一域名解析到工单中的反代 IP `219.229.81.240` 时，HTTP 返回 302、HTTPS 使用有效证书返回 Buzz NIP-11 200，证明反代后端和源站已经接通；未认证备案状态与尚未执行的正式 DNS 切换一致。
- 处理：需要按页面说明下载备案 PDF，并在 OA 的“流程管理 → 发起流程 → 信息网络服务 → 网站备案审批流程”提交认证；同时明确勾选或填写需要开放校外访问。认证完成后应由网络中心将权威 DNS 从 `beianban.xmu.edu.cn` 切到反代平台，而不是由源站管理员把公网 DNS 直接指向 `10.24.11.82`。
- 验证：强制解析到 `219.229.81.240` 的 HTTPS/NIP-11 已返回 200；但同一路径的 WebSocket Upgrade 当前返回普通 NIP-11 200 而不是 101，说明学校反代还需确认启用并透传 WebSocket `Upgrade`。完成认证和 DNS 切换后必须复测 WSS/NIP-42。
- 版本/提交：仅诊断和记录，未创建代码提交。

### 审批通过后复测

- OA 流程截图显示备案管理员审核、网站群反代管理员审核和 DNS 配置均已通过，但厦大权威 DNS 及 `1.1.1.1`、`223.5.5.5` 仍一致返回旧备案页 CNAME；正常 HTTPS 和 WebSocket 请求继续得到 Apache 400。当前活动 DNS 服务器也返回相同结果，排除单机缓存。
- 结论：流程状态已完成，但公网权威 DNS 视图尚未实际发布，或 DNS 管理员只配置了校内 `A 10.24.11.82` 视图。需请 DNS 配置处理人核查公网记录并将其指向反代平台 `219.229.81.240`；完成后仍需单独启用 WebSocket Upgrade。

## 2026-09-02：同域名 `/services/*` 路由冲突审计

- 现象：用户希望在 Buzz 占用根域名的同时，通过 Caddy 将 `/services/<name>/` 分配给其他服务，并确认该前缀是否与 Buzz 冲突。
- 定位：扫描 Relay、媒体、Git、邀请、管理后台和 Web SPA 路由后，没有发现 `/services` 路由或字面路径。Buzz 当前占用的顶层命名空间包括根 WebSocket/NIP-11、`/.well-known`、`/info`、`/health`、`/_*`、`/events`、`/query`、`/count`、`/upload`、`/media`、`/api`、`/operator`、`/moderation`、`/workflows`、`/hooks`、`/huddle`、`/git`、`/internal`、`/invite`、`/repos`、`/reports`、`/feedback` 和 `/assets`。SPA fallback 只接管邀请页及可选 Git Web 页面，任意 `/services/...` 在 Relay 内会返回 404。
- 处理：确认 `/services/<service>/` 可作为 Caddy 保留命名空间。应在 Buzz 的 catch-all 反代之前使用 `handle_path /services/<service>/*`，其他请求继续交给 `127.0.0.1:3000`。新增服务仍需正确处理被剥离的前缀、静态资源绝对路径、Cookie Path、OAuth 回调、重定向和自身 WebSocket 路径。
- 验证：仓库级 `rg` 路由审计未发现 `/services`、`/labservice` 或 `/labservices` 冲突；尚未在生产 Caddy 中添加具体服务路由。为降低与通用或未来标准路径发生冲突的概率，后续实验室托管服务优先使用复数命名空间 `/labservices/<service>/`。
- 版本/提交：仅诊断和记录，未创建代码提交。

## 2026-09-03：`.82` 上 Buzz 的 50 并发下载容量基线

- 现象：用户计划约 50 人使用 Buzz，需要确认同时下载附件是否会压垮 `10.24.11.82`，以及大文件是否应迁移到 Aliya。
- 定位：`.82` 有 192 个逻辑 CPU、251 GiB 内存、约 14 TB NVMe，Buzz debug relay 常驻约 190 MiB；活动网卡 `ens1f3` 为 1 Gbps。媒体当前存放在 `.82` 本机 `/data` 上的 MinIO，完整下载由 relay 从 S3 流式转发，Range 请求单块上限 16 MiB。服务器资源不是首要瓶颈，实际限制是客户端接入、校园网和学校公网反代路径。
- 处理：使用 relay 的 874,814 B 公共 Web bundle 做无状态阶梯压测，避免写入数据库或媒体桶；分别从当前电脑、Aliya 和 `.82` 本机测试公网、校园网直连与源站回环。50 并发测试完成后未继续扩大压力；`.82` 经公网反代回环进入 50 并发时 SSH 管理连接曾被重置，随即确认 Caddy、relay、SSH 和公网入口均保持健康。
- 验证：`.82` 本机回环 50 并发约 4.82 Gbps；当前电脑经 `10.24.11.82:3000` 直连 50 并发为 88.12 Mbps；当前电脑经公网域名 50 并发三轮均无 HTTP 失败，总吞吐 32.26–40.18 Mbps；Aliya 作为第二客户端经公网 50 并发无失败并达到 86.80 Mbps，已等于该机器 86.7 Mbps Wi-Fi 链路上限。结果证明 50 个小附件并发不会压垮 Buzz，但不能据此承诺 50 个大文件的下载时延。
- 结论：常规图片和小附件继续使用 `.82` 本机 MinIO。Aliya 当前经 Wi-Fi 接入且上限约 86.7 Mbps，不适合作为大文件分流节点；仅把 S3 后端搬到 Aliya还会增加一跳，公网文件仍经过 `.82`/学校反代，不能卸载出口。若需要稳定分发几十至数百 MB 文件，应采用具备独立 HTTPS 地址的对象存储/CDN，并通过短期签名 URL 保持 Buzz 授权；在此之前建议对单文件大小、并发下载和每用户速率设置保守上限。
- 版本/提交：部署基线为 `.82` 上 `/home/hl/workplace/buzz/target/debug/buzz-relay`；本次仅压测和记录，未创建代码提交。

### Aliya 链路校正

- 首次读取 Aliya 网卡时，远程 PowerShell 命令受到本地变量与引号展开干扰，得到的 `86.7 Mbps Wi-Fi` 归因不可靠。重新使用 UTF-16LE EncodedCommand 读取实时状态后，确认 Aliya 的 `以太网 3` 为 Up、协商速率 1 Gbps，IPv4 为 `192.168.1.56`，默认路由经 `192.168.1.1`；Wi-Fi 当前为 Disconnected。
- 再次执行公网 50 并发下载，`Test-NetConnection` 选择 `以太网 3` 到 `219.229.81.240:443`。测试期间有线网卡接收增加 48,106,040 B、Wi-Fi 增量为 0，总吞吐 85.85 Mbps。因此该结果不是 Aliya Wi-Fi 上限，更可能是学校公网反代、源站回源路径或约 100 Mbps 的中间链路限制。
- 修正结论：不能依据本轮结果排除 Aliya 作为独立大文件节点，但也尚未证明它具备更高公网出口。需要在 Aliya 上提供一个临时大文件 HTTPS 端点，并从至少两台校外机器直接下载，测量其真实出站带宽；只有客户端绕过 `.82` 和学校 Buzz 反代时，Aliya 分流才有容量收益。

## 2026-09-03：学校公网反代 WebSocket 恢复

- 现象：用户确认网络中心可能已修复 WebSocket，需要验证 `wss://chemlabagent.xmu.edu.cn` 是否真正支持 Upgrade 和 Buzz NIP-42。
- 定位：公网 DNS 当前指向 `applg219.xmu.edu.cn` / `219.229.81.240`。此前公网入口只能返回普通 HTTP/NIP-11，无法完成 Upgrade；本次公网 ClientWebSocket 已成功进入 Open 并收到 relay 的 `["AUTH", challenge]`。
- 处理：从当前电脑分别连接公网 WSS 与校园网 `ws://10.24.11.82:3000` 并读取首帧；随后对公网进行 10 次短连接稳定性测试。
- 验证：公网首次连接约 53.5 ms，内网约 9.8 ms，首帧均为 NIP-42 AUTH challenge；公网 10/10 成功，连接与首帧耗时最小 19.4 ms、平均 36.5 ms、最大 123.7 ms。说明学校反代已透传 WebSocket Upgrade。尚未使用成员私钥完成 NIP-42 签名、订阅、发布闭环。
- 版本/提交：线上 `.82` 部署验证；仅诊断和记录，未创建代码提交。

## 2026-09-03：移植 Block 上游的 Relay 韧性、Agent 在线态与移动端冷启动优化

- 现象：当前 Desktop 的历史订阅在 relay 返回 rate-limit `CLOSED` 后直接失败；Agent 卡片把本地 lifecycle 记录等同于在线状态；频道首次历史加载失败会显示成空频道。Mobile 同时串行等待每频道 live subscription，并为每条消息用整个社区 emoji 表构造正则，频道较多时冷启动和渲染明显变慢。
- 定位：对照 Block 主线 `6f6093243`、`d5a73b9f3`、`00e61eafa` 和 `b593c7d7f`，四类问题都已在上游用独立机制处理：history CLOSED 透明重试、presence 作为 Agent availability 真值、显式 timeline error surface，以及先发布有限频道快照后分批建立 live subscription。当前分支与主线的 Mobile provider 已明显分叉，因此没有直接 cherry-pick。
- 处理：Desktop history subscription 保存 filter/timeout，在共享 rate-limit gate 后换 subscription id 重试，最多 3 次并正确清理 CLOSE/timeout；Agent 启停、删除、卡片、profile pane/popover 统一从已连接 relay 的成功 presence 查询推导 availability，未知状态不再伪装 Offline；频道冷加载失败显示带 Retry 的错误态，已有缓存的刷新失败仍保留消息列表。Mobile 先返回频道快照，再按排序后的最多 128 个 `#h` 值建立 live subscription，替换订阅就绪前保留旧覆盖；emoji matcher 只包含正文实际引用的 shortcode；relay 的显式 `retry in 0s` 不再错误开启 10 秒全局 gate。
- 验证：Desktop 相关 102 个测试、TypeScript、Biome 与 `git diff --check` 通过。新增 Mobile 测试覆盖快照不等待订阅、129 个频道分成 128+1、emoji 大词表裁剪和零秒 retry hint；当前 Windows 环境没有可调用的 Flutter SDK，未能执行 `flutter analyze/test`。Mobile 文件大小门禁仅报告当前分支已有的 `compose_bar_widget.dart`、`media_upload.dart` 和 `relay_session.dart` 超限；本次新增 lifecycle 为 203 行，`channels_provider.dart` 已降至 811 行，且没有增加 `relay_session.dart` 行数。
- 版本/提交：基于 `19902806e`，参考 Block 上游上述四个提交；待提交。

## 2026-09-03：移植 Block 上游的身份恢复与 Profile 查询韧性修复

- 现象：审计 `block/buzz` 最新主线时，需要筛选可安全移植到当前分支、并能改善身份丢失和头像/名称偶发加载失败的修复。
- 定位：当前 `recover_from_keyring` 在检查备用 `identity.key` 和迁移标记前就删除无法解析的 keyring 值；对仅有迁移标记而没有备用文件的安装，这会销毁最后一份身份材料。`useUsersBatchQuery` 同时沿用全局单次重试策略，短暂 relay 失败后可能长期保留原始公钥、缺失头像或损坏的 mention 展示。
- 处理：按 Block 上游 `e5a7e26a1` 调整身份恢复顺序，先尝试有效文件恢复；存在迁移标记但无法恢复时进入 `Lost` 且保留 keyring 值，仅在无标记的首次启动路径中清理并生成新身份。按上游 `6f6093243` 为 profile 批量查询增加 3 次指数退避，并只在查询已处于 error 时随窗口重新聚焦而重试。
- 验证：`app_state::` 定向 Rust 测试 50/50 通过，新增 profile 韧性测试 2/2 通过，`pnpm typecheck` 与 `cargo fmt --manifest-path desktop/src-tauri/Cargo.toml --all` 通过；仓库 `just desktop-tauri-fmt` 仅因当前 PowerShell 环境找不到 `sh` 未能启动，其内部相同的 cargo fmt 命令已直接执行成功。
- 版本/提交：基于 `19902806e`，参考 Block 上游 `e5a7e26a1` 与 `6f6093243`；本地待提交。

## 2026-09-03：Flutter 工具链恢复与移动端全量验证

- 现象：上一轮 Mobile 冷启动优化因本机找不到可调用的 Flutter SDK，只完成了代码审查和新增测试，尚未实际运行 `flutter analyze/test`。
- 定位：项目的 `mobile/android/local.properties` 已指向用户级 Flutter `3.41.7`，SDK 文件完整但未加入系统 `PATH`。首次执行目标测试进一步暴露出一个真实竞态：频道快照返回后，异步未读补拉可能在 Riverpod provider 已释放时写入 `state`；自定义 emoji 的共享冒号测试也漏算了正文中一个合法的 `:wave:` 出现位置。
- 处理：直接通过绝对路径使用仓库锁定的 Flutter `3.41.7` / Dart `3.11.5`，不修改系统 `PATH`；在未读补拉的网络等待后及最终状态写入前检查 provider 是否仍挂载，释放后丢弃异步结果；修正 emoji 测试期望并应用 Dart formatter，删除静态分析发现的未使用订阅字段。
- 验证：`flutter doctor -v` 确认 Android SDK 35、JDK 17、许可证和已连接 Android 16 平板均正常；`flutter pub get`、全项目 Dart 格式检查、`flutter analyze` 均通过；目标回归测试 24/24、完整 `flutter test` 1388/1388 通过。文件大小门禁仍只报告当前分支已有的 `compose_bar_widget.dart`、`media_upload.dart` 和 `relay_session.dart` 超限，没有新增超限文件。
- 版本/提交：基于 `34676df49`；移动端生命周期修复待提交。

## 2026-09-03：Buzz 启动后 Inbox Thread 误显上下文错误

- 现象：刚打开 Buzz、未进行任何操作时，Inbox 的 Thread 详情会在已经显示部分消息的同时出现红色 `Some message context could not be loaded.` 提示。
- 定位：启动阶段会并发读取 Thread 的祖先消息；HTTP `/query` 偶发返回 rate-limit 时，共享限流门虽然被开启，但当前 `getEventById` 调用仍立即失败。Inbox 将这类瞬时失败与永久缺失一并记为上下文错误，UI 又在已有可用消息时仍无条件显示破坏性错误条。
- 处理：为 Inbox 的单条上下文读取增加最多 3 次的限流感知重试，等待现有共享 rate-limit gate 后再读；永久性的 `event not found` 不重试。错误条在加载期间保持隐藏，并且只有上下文加载结束且可见消息不超过 1 条时才显示；已取得至少 2 条可用上下文时保留内容、不再误报。
- 验证：新增重试与错误条条件测试 5/5 通过，Inbox 相关目标测试 27/27 通过，Biome 与 TypeScript 类型检查通过。Desktop 全量单测 4898/4899 通过，唯一失败为无关的 `useDocumentVisible` 计时用例，单独重跑 4/4 通过。
- 版本/提交：基于 `f223dd2fd`；待提交。

## 2026-09-03：频道重进卡顿与图片预览关闭闪烁

- 现象：重新进入已有消息的频道时界面有明显停顿；放大消息图片后关闭预览，底层图片像是重新渲染并短暂闪烁。
- 定位：频道切换为隔离滚动状态会重建虚拟时间线。初次定位到底部时，时间线固定保留最多 100 条尾部消息并立即建立三屏缓冲；探针确认普通频道仅 11 条可见却挂载 50 条，重 Markdown 频道仅 2 条可见却挂载 60 条。图片侧还会在本地 media proxy 就绪后把已挂载图片从 `buzz-media://` 切到 loopback URL，并在 lightbox 完全卸载后才恢复底图，造成重新解码或合成层切换可见。
- 处理：初始保留尾部缩小为覆盖一屏最矮消息所需的 24 条；首帧只建立一屏虚拟缓冲，再用两个 idle slice 恢复三屏 WebKit 快速滚动保护。渐进图片组件改为 memoized，并在媒体 URL 变化时先预加载、解码新来源再替换；lightbox 返回动画到达缩略图时提前恢复已解码底图，背景淡出结束后再卸载 overlay。
- 验证：4 倍 CPU、8 次 warm channel switch 中，普通频道中位耗时由 `2936.4 ms` 降至 `1211.9 ms`，long-task 总量由 `1290.5 ms` 降至 `554.5 ms`；重 Markdown 频道由 `3985.9 ms` 降至 `1989.9 ms`，long-task 总量由 `2234.0 ms` 降至 `1117.5 ms`。图片 gallery 10/10、media proxy late-readiness 1/1、虚拟滚动与频道切换目标用例 6/6 通过，TypeScript E2E build 通过。
- 版本/提交：基于 `6257dea59`；待提交。

### 按估算高度保留首屏

- 现象：第一轮已把固定尾部从 100 条降到 24 条，但重 Markdown/媒体频道的 24 条仍可能占据十几屏，4 倍 CPU 下 warm re-entry 仍接近 2 秒。
- 定位：虚拟列表已有逐条高度估算，但初始 `keepMounted` 只按消息数量截取，没有利用估算结果；因此短文本所需的一屏行数和高内容所需的两三行无法同时兼顾。
- 处理：初始尾部改为从最新消息向前累计估算高度，达到一屏即停止，同时保留 24 条硬上限；后续动态 retention 与三屏快速滚动缓冲策略保持不变。
- 验证：同一 4 倍 CPU、8 次 warm switch 基准中，普通频道中位耗时进一步由 `1211.9 ms` 降至 `853.0 ms`，重 Markdown 频道由 `1989.9 ms` 降至 `551.7 ms`；相比最初分别下降约 71% 和 86%。冷切换最长单次 long task 中位数为 `279 ms`。首屏定位、快速滚动覆盖、频道切换和 live tail 目标用例 6/6 通过，retention 单元测试 1/1 通过。
- 版本/提交：基于 `b80ab8cc6`；待提交。
## 2026-09-02：Buzz 退出后遗留 Codex shared app-server

- 现象：Buzz 启动的 `codex.exe app-server --listen ws://127.0.0.1:51919` 在 Buzz 父进程退出后继续运行，锁住 Codex Desktop 管理的运行时目录；后续 Codex 更新因 `EPERM` 无法刷新二进制，并误报 `Unable to locate the Codex CLI binary`。
- 定位：`spawn_codex_shared_runtime` 启动子进程并记录 PID 后立即丢弃 `Child`，该进程既不在 managed-agent 进程表中，也未绑定 Windows kill-on-close Job Object，应用退出路径因此无法回收它。现场确认遗留 PID `35120` 的父进程已经退出，执行路径位于 ChatGPT 管理的 Codex runtime，监听端口为 `51919`。
- 处理：Buzz 现在只登记自己实际启动的 shared app-server，保留其 `Child`；Windows 下立即绑定 kill-on-close Job Object，正常退出/重启时在 managed agents 停止后显式回收整棵进程树，异常退出时由 Job Object 回收。连接到启动前已存在的外部 shared server 时不登记所有权，也不会在 Buzz 退出时终止它。启动探测失败时立即回收本次启动的进程。
- 验证：新增 Windows Job Object 回归测试，确认关闭所有权句柄后子进程在 2 秒内退出；该测试 1/1、既有 Codex shared-runtime 测试 9/9 通过，三个修改的 Rust 文件 `rustfmt --check` 和 `git diff --check` 通过。Tauri lib 全量测试 2,357 通过、9 失败、11 ignored；9 个失败来自 Windows 环境缺少 Unix `true` 命令及既有 provider fixture/egress inventory 漂移，均不涉及本次生命周期文件。
- 版本/提交：分支 `codex/codex-lifecycle-cleanup`，提交见本条所在提交。

## 2026-09-02：修正 Codex shared runtime 所有权，并恢复 Windows Agent Stop

- 现象：上一条未合并方案会在 Buzz 退出时一并终止共享 app-server，导致仍打开的 Codex Desktop 静默失去 backend；同时 Windows 上点击 Codex task Agent 的 `Disconnect Buzz` 可能无法及时释放 task。
- 定位：shared app-server 是 Buzz 与 Codex Desktop 共用的电脑级服务，不应归 Buzz 窗口所有；真正需要避免的是它长期锁住 Codex Desktop、ChatGPT 或 Scientist 的可更新 runtime 目录。另查明 `stop_managed_agent_runtime` 使用的 `process_is_running` 在 Windows 固定返回 `false`，会跳过已跟踪 harness 的终止步骤并直接等待仍在运行的子进程。
- 处理：推翻上一条未合并的 kill-on-quit 方案。Windows 首次启动 shared app-server 前，将 `codex.exe`、Code Mode host、command runner 和 sandbox setup 复制到 Buzz 管理的版本化不可变目录；成功启动后主动释放 `Child` 句柄，让 backend 跨 Buzz 退出继续服务，而 Codex 更新不再被锁。启动探测失败时仍只回收本次新进程。显式 Stop 改为对已跟踪 `Child` 调用 `try_wait`，仍运行时终止整棵进程树并等待退出，然后清理 receipt/session cache；Agent 身份和 Codex task 绑定保持不变。
- 验证：Codex lifecycle Rust 测试 11/11、runtime command 测试 10/10、前端 Agent Connect/Disconnect 行为测试 8/8 通过。新增测试确认版本更新产生新缓存且旧版本保持可执行、Buzz 丢弃子进程句柄后 backend 仍存活，以及 Windows Stop 确实终止运行中的进程树。`managed_agents` 扩展测试 980 通过、5 失败；失败均为 Windows 环境无法启动 Unix `env`/`true` 或 PATH 占位命令的既有跨平台夹具，不涉及本次修改路径。
- 版本/提交：分支 `codex/codex-lifecycle-cleanup`，待提交。
