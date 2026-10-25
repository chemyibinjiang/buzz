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

## 2026-09-12：仓库构建产物占用过大

- 现象：仓库目录占用约 65GB，主要由历史 Cargo target、Tauri target 和旧安装包组成。
- 定位：Git 历史仅约 0.1GB；`desktop/src-tauri/target` 约 32.5GB，根目录 `target` 约 26.5GB，仓库 `dist` 约 5.1GB。当前正式发布使用独立的 `D:\BuzzCodexLabBuild0519` 缓存和 `D:\BuzzCodexLabRelease` 产物目录。
- 处理：删除仓库内两个旧 target 和历史 `dist`，保留 D 盘发布缓存、签名材料和 `0.5.19` 安装包；将本地发布说明固定为使用 D 盘构建缓存，避免重新使用 C 盘旧缓存。
- 验证：仓库占用降至约 0.87GB；D 盘缓存中的 `0.5.19` 安装包仍存在且 SHA-256 为 `9e12ddde449d87bc86d1ca05c86010b4899918747b64313e30dab885c46329d1`；Git 工作区无代码改动。
- 版本/提交：`0.5.19`，本条所在本地维护提交。

## 2026-09-07：同步远端修改并发布 Buzz Codex Lab 0.5.19

- 现象：需要拉取 `Lin/develop` 的最新远端修改，并发布正式版本 `0.5.19`。
- 定位：远端新增动态 Codex runtime 端口、长 task 恢复、shared runtime 连接门禁、孤立 task Agent 定义清理、欢迎 Agent 跨 Relay 复用及相关 UI/迁移修复；本地工作区在同步前干净。
- 处理：快进同步到 `4f329130`，更新桌面版本源和应用内/仓库 changelog，使用本地 updater key 与 DPAPI 密码生成签名 Windows 安装包并更新正式 Release 与 updater manifest。
- 验证：Agent/runtime 定向前端测试 58/58、独立缓存 Rust 迁移测试编译通过、Windows NSIS 构建、updater 签名验证及 GitHub Release 资产回读通过。
- 版本/提交：`0.5.19` / `e9f490ea`。

## 2026-09-07：同步最新分支并发布 Buzz Codex Lab 0.5.18

- 现象：需要将 `Lin/develop` 的最新修改打包为启用在线更新的正式版本 `0.5.18`。
- 定位：本地与 `origin/Lin/develop` 已同步到提交 `4689d1a1`；工作区中的未提交内容是 `0.5.18` 版本号、应用内更新日志和仓库 changelog 的发布准备改动。
- 处理：同步桌面端各版本源为 `0.5.18`，补充最近 Relay 安全、慢连接恢复、Community 状态清理与 Codex shared runtime 生命周期相关更新日志；使用本地 updater key 和 DPAPI 密码签名构建，并发布正式 GitHub Release 与滚动 updater manifest。
- 验证：更新日志测试 3/3、版本相关 Biome 检查、Tauri 独立缓存检查、Windows NSIS 构建和 updater 签名验证通过；GitHub Release 资产已回读确认。
- 版本/提交：`0.5.18` / `4c21528e`。

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

## 2026-09-05：新版 Codex Desktop backend 路径导致 Start 接管检查漏检

- 现象：Xiaoxin 同时运行 Codex Desktop 私有 app-server 与 Buzz shared app-server 时，本地 task Agent 点击 Connect Buzz 后直接进入监听状态，没有先显示 `Close and reconnect`。由于 task-bound Agent 使用 lazy worker，冲突会被延迟到首条工作消息才暴露。
- 定位：Buzz 只把 Windows Appx 安装目录下的 `app/resources/codex.exe` 识别为 Desktop backend；新版 Codex Desktop 实际从 `%LOCALAPPDATA%/OpenAI/Codex/bin/<version>/codex.exe` 启动 app-server。现场 PID `20536` 是 `ChatGPT.exe` 的子进程，但因路径不同未进入 `private_app_server_process_ids`。
- 处理：Windows 进程分类同时识别已验证 Desktop 进程树中的 `codex.exe app-server` 后代，并保留旧 Appx backend 路径匹配；监听 shared URL 的 backend 继续排除，独立 CLI app-server 也不会因路径相似被误判。这样 Start/Restart 会在创建 Agent worker 前触发现有接管确认。
- 验证：Tauri `codex_desktop` 定向测试 11/11 通过，覆盖 LocalAppData Desktop 子进程、旧 Appx backend、shared listener 与无关 CLI backend。随后构建并在 Xiaoxin 安装 `0.5.18-local.1`：新版准确显示 1 个私有 app-server，Connect 前弹出 `Close and reconnect`，且确认前没有启动 `buzz-acp`；确认后旧私有 PID 消失，Codex Desktop 重开并复用原 shared PID `2596`。临时 Agent 经 DM 返回精确文本 `BUZZ_LOCK_LIVE_OK`，日志记录 5 秒后 lazy worker 回收且没有 writer conflict；Disconnect 后 harness 退出，Desktop 与 shared runtime 保持运行。
- 版本/提交：PR 分支 `codex/detect-versioned-codex-desktop`；Xiaoxin 验收安装包基于原始测试提交 `9760ec38`，版本 `0.5.18-local.1_9760ec382776`。

## 2026-09-06：同步上游安全、身份恢复与慢 Relay 韧性修复

- 现象：定制分支落后于上游三项重要修复：ACP 会在验证 Nostr 事件签名之前更新路由和回放状态；损坏或暂时不可解析的 keyring 身份可能在恢复前被删除；慢 Relay 下 profile、通知目标回复和限流关闭的历史订阅可能过早失败。
- 定位：分别对应上游 #7010、#7203 和 #7188。跨频道 busy-owner 调度修复 #7337 经评估后按当前产品优先级暂不移植。
- 处理：ACP 在任何路由、水位线、成员关系或控制队列处理前验证事件 ID 与 Schnorr 签名；Desktop 身份恢复先探测有效 `identity.key`，存在迁移标记时保留不可解析的 keyring 材料并进入 `Lost`；Desktop 为 profile 批量读取、目标 thread reply 和限流关闭的历史订阅加入有界重试与恢复。合并时保留定制分支的 thread 编辑、删除和 reaction aux 补拉，并为纯 Node 测试隔离 Tauri/Relay 依赖。
- 验证：`app_state::` 50/50、thread reply 10/10、profile/relay recovery 20/20 测试通过，Desktop TypeScript typecheck 通过；新增 ACP 签名验证用例通过。全量 ACP 测试受既有 Windows/WSL shell 夹具影响出现无关失败并生成错误路径的临时捕获文件，已清理并改用聚焦验证。
- 版本/提交：分支 `codex/upstream-security-relay-resilience`，基于 `origin/Lin/develop` 的 `99b85750`；提交见本条所在分支。
## 2026-09-05：Windows 退出登录被长期 shared app-server 日志锁阻塞

- 现象：`59.77.33.59:6000` 的 Buzz 在用户点击退出登录并重启后挂住，持续保留 `.xyz.chemyibinjiang.buzz.codexlab.reset-pending`；stderr 报错为无法将整个 app-data 目录重命名为 `.reset-trash`，Windows 返回 `Access is denied (os error 5)`。
- 定位：退出登录已经正确写入 reset sentinel，问题发生在下一次启动的两阶段清理。Buzz 有意让 Codex shared app-server 跨窗口退出继续运行，但旧版把该进程的 stdout/stderr 放在 app-data 下；现场独占锁探针确认只有 `agents/logs/codex-shared-runtime.stdout.log` 和 `codex-shared-runtime.stderr.log` 被长期 app-server 占用，因此 Windows 不允许重命名其父目录。shared backend 的生命周期策略正确，错误在于把电脑级服务日志放进了身份级 reset 边界。
- 处理：Windows 新启动的 shared runtime 日志迁移到 app-data 同级的隐藏目录，避免长期进程锁住退出登录清理目标；错误诊断仍回退读取旧日志。为兼容已经运行旧 backend 的机器，整目录原子重命名失败时仅允许保留上述两个精确日志路径，其余数据先递归移动到 rollback trash，keychain 删除成功后清除，失败则完整恢复；任何其他锁定文件仍会失败并回滚。
- 验证：新增 Windows 独占句柄回归测试，确认旧 shared-runtime 日志保持打开时身份数据仍被删除、sentinel 清除且 backend 无需退出；另一个测试确认 keychain 失败会恢复设置并保留 sentinel。reset 聚焦测试 16/16、Windows shared-runtime 聚焦测试 4/4 通过。随后在原问题机器安装 `0.5.18-local.2_c0572483dd83`：先用非交互 SSH 会话验证 keyring 不可用时全部数据正确回滚；再从已登录桌面会话启动，reset sentinel 和 rollback trash 均被清除，旧 Agent PID receipts 归零，两份锁定日志保留，shared app-server 始终保持原 PID `32764` 且 readiness 返回 HTTP 200。
- 版本/提交：分支 `codex/windows-signout-shared-runtime-logs`；代码提交 `c0572483`，远端验收安装包 SHA-256 `69e5dcdd35a4d8aa81cb8e86ff0c8464b3698cb63f0cd4977af5d9a136b26071`。

## 2026-09-07：删除 Codex task Agent 后遗留 Custom agent 卡片

- 现象：用户删除已绑定 Codex task 的 Agent 后，实例和 task binding 已消失，但 Agents 页面仍显示一个 inactive、报错状态的同名 Custom agent 卡片。
- 定位：旧 standalone-agent backfill 会以实例 pubkey 作为 64 位 definition slug；`delete_managed_agent` 删除最后一个 task 实例时只把该迁移定义标记为 inactive，没有删除，因此 UI 正确地继续展示了本地 definition 空壳。
- 处理：删除 Codex task 实例时，若最后引用的 definition id 等于被删实例 pubkey 且不属于 built-in、team 或 shared catalog，则同步删除迁移生成的 definition；普通可复用 persona 仍只停用。启动迁移另会备份 store，并清理已存在的 inactive、无引用、64 位 pubkey definition。
- 验证：backfill 聚焦测试 9/9、删除判定测试 2/2 通过；覆盖已有幽灵清理、仍被实例引用的定义保留、普通自定义 persona 保留以及新删除流程判定。
- 版本/提交：分支 `codex/remove-orphaned-task-agent`，待提交。

## 2026-09-07：Relay 地址迁移后 Welcome Team 身份重复

- 现象：Channel members 的 Agent 搜索中同时出现两套 Fizz、Honey 和 Bumble；本地记录显示它们分别创建于旧 relay 地址和新的校园网地址，具有不同公钥。
- 定位：managed-agent 运行层已采用 agents-everywhere 语义，忽略实例创建时保存的 relay pin，始终连接当前 workspace relay；Welcome Team 初始化和 kickoff 仍按旧 `relay_url` 做严格匹配，地址迁移后误判三个内置身份不存在并重新创建。
- 处理：Welcome Team 的查找、kickoff 和历史身份复用统一遵循 agents-everywhere 语义，不再让创建时 relay 字符串参与身份选择；Agents 页面新增 `Open Codex Desktop` 主操作，shared runtime 健康时直接打开 Desktop，setup、unavailable 或私有 runtime 冲突时才展示诊断与接管面板。
- 验证：Welcome Team 聚焦单测 20/20、Codex shared-runtime 面板单测、Desktop TypeScript typecheck 与 Biome 检查通过；E2E mock build 成功，并在 1280×720 下验证 Agents 页入口和 runtime dialog。独立截图助手同时改用可取消、1 秒封顶的动画等待，修复 loading spinner 卸载时的 `AbortError`。
- 版本/提交：分支 `codex/remove-orphaned-task-agent`，待提交。

## 2026-09-07：Codex task Agent 启动可绕过 Desktop 私有 backend 检查

- 现象：电脑级 shared app-server 已在 `ws://127.0.0.1:51919` 运行时，Codex Desktop 仍可能保留自己的私有 app-server；部分 Agent 启动入口只检查 shared 端口可达，随后才以 task writer conflict 或加载超时失败。
- 定位：Desktop 状态面板和接管操作已经能识别经验证的 Codex Desktop 私有 backend，但 `spawn_agent_child` 的统一 task-binding 前置检查没有复用该判定。自动恢复、跨频道唤醒等不经过设置面板的入口因此仍可绕过。
- 处理：本地 Codex task 在任何 harness spawn 前都重新检查 Codex Desktop 进程树；发现私有 backend 时立即拒绝，并引导用户通过显式确认的 Take over 流程重连。SSH task 不检查本机 Desktop，独立 Codex CLI、Scientist Connector 和其他未验证进程也不会被误杀。
- 验证：Codex Desktop 进程分类与 takeover 聚焦测试 12/12、错误呈现测试 36/36、Desktop TypeScript typecheck 与 Biome 检查通过；本次修改文件单独通过 rustfmt 检查。全仓库 fmt 仍报告 `Lin/develop` 基线中的既有格式差异，本次未改动这些文件。
- 版本/提交：分支 `codex/remove-orphaned-task-agent`，待提交。

## 2026-09-07：Desktop 正在工作的 Codex task 被误报为 60 秒加载超时

- 现象：`数据复写管家` 在 Buzz 中反复显示“60 秒内未加载”，点击 Retry 仍然失败。
- 定位：task `01a07496-5d2b-7493-b631-6af817f0e0ce` 同时在 Codex Desktop 中处于 active 状态，Desktop backend 正常持有 writer lock；harness 实际约 1 秒内收到 adapter 包装后的 `-32603 Internal error`，并未等待 60 秒。用户运行的是未包含统一 Start 前置检查的旧 Desktop GUI，因此 Retry 仍启动了 harness；日志解析又把所有 identity-bound load 错误统一改写为 `-32004`。该 task 的 rollout 约 61.4 MB，空闲后使用 `session/load` 还会产生不必要的完整历史回放。
- 处理：沿用统一 spawn 前置检查，在任何入口发现 Codex Desktop 私有 backend 时直接显示 Busy/Take over，不启动 harness；日志解析保留嵌入的 Agent 错误码，仅在错误文本确实包含 timeout 时标记 `-32004`。对声明 `sessionCapabilities.resume` 的 adapter，identity-bound task 改用 `session/resume`，恢复 Codex 上下文但不经 ACP 回放完整历史；旧 adapter 继续回退 `session/load`。
- 验证：现场确认 task 在 Codex Desktop 中为 active，51919 shared runtime 健康且当前 lock 与 Desktop 占用一致；resume capability/request、Desktop 日志错误解析及 Codex 聚焦测试通过。完整 Busy UI 需安装含 Desktop 前置检查的新构建后复测，空闲 task 的真实 resume 仍待验收。
- 版本/提交：分支 `codex/remove-orphaned-task-agent`，待提交。

## 2026-09-07：从 Buzz 显式启动 Codex Desktop 并收敛 app-server

- 现象：用户需要从 Buzz 启动 Codex，并确保 Codex Desktop 不再保留与 51919 shared runtime 竞争的私有 app-server；原入口名为 `Open Codex Desktop`，冲突处理藏在 runtime 面板的 `Take over` 中，意图不清晰。
- 定位：backend 已具备安全接管流程：只终止经包身份、父子进程树和 executable path 验证的 Codex Desktop 及其私有 backend，保留 shared app-server，并以 `CODEX_APP_SERVER_WS_URL` 重开 Desktop。独立 Codex CLI、SSH runtime 与 Scientist Connector 不属于目标集合。
- 处理：Agents 页和 runtime 面板统一使用 `Start Codex Desktop`。检测到冲突时显示明确确认框，说明会中断 active turn/未保存草稿，并将操作命名为 `Close conflicts and start`；确认后复用现有安全接管流程。
- 验证：runtime panel 聚焦测试、Desktop typecheck 与 Biome 检查通过；进程终止边界由既有 Codex Desktop 分类和 takeover Rust 测试覆盖。
- 版本/提交：分支 `codex/remove-orphaned-task-agent`，待提交。

## 2026-09-07：Codex shared runtime 固定端口冲突

- 现象：`CODEX_APP_SERVER_WS_URL` 固定指向 `ws://127.0.0.1:51919`；若该端口被非共享服务占用，Buzz 无法启动 shared runtime，Desktop 与 task Agent 也没有共同迁移到其他端口的机制。
- 定位：shared runtime 配置只持久化 `enabled`，状态探测、Desktop 启动和本地 task binding 分别从默认值或旧绑定读取 URL。直接在启动器里换端口会让多个消费者指向不同 backend。
- 处理：将 `51919` 保留为首选端口，并在版本化配置中持久化实际 URL。健康的已配置 runtime 会直接复用；首选端口被无关进程占用时，仅在 loopback 上顺延探测 `51920..51950`，绝不终止占用者。成功启动后原子保存地址；状态面板、Desktop 启动/接管和每次本地 Agent spawn 均读取该地址，旧 task binding 自动刷新。SSH 和显式远程 URL 不参与本地端口改写。
- 验证：Tauri 编译通过；Codex Desktop 聚焦测试 16/16、shared-runtime 默认解析测试 1/1、runtime panel 测试 2/2 通过，Desktop TypeScript typecheck 与 Biome 检查通过。新增用例覆盖旧配置兼容、候选端口范围、远程 URL 不改写和真实 loopback 端口占用；现场现有 51919 shared runtime 保持原 PID 且 readiness 为 HTTP 200。
- 版本/提交：分支 `codex/remove-orphaned-task-agent`，待提交。

## 2026-10-10：频道内为 Agent 设置定时任务 / Heartbeat

- 现象/需求：用户希望直接在群聊频道中选择 Agent、设置周期与指令，让 Agent 到期后自动工作；任务列表和执行事件必须能区分是谁、从哪个频道、通过哪种入口创建的任务。
- 诊断：ACP 原有 heartbeat 是进程级自唤醒参数，无法按频道、按 Agent 由群聊用户配置，也没有可供其他成员审计的创建来源。现有 `buzz-workflow` 已具备频道持久化、cron/interval、暂停删除、运行历史和跨 Relay 重启去重，适合作为调度底座。
- 处理：新增 `prompt_agent` workflow action 和 relay-only `kind:40009` 定时指令事件；事件记录目标 Agent、创建者、workflow ID、来源类型、来源频道和可选来源事件。Relay 到期时确认目标仍在频道并签名发布，ACP 使用不可伪造的 `created_by` 归因执行现有 `Who can send instructions` 权限检查。Desktop 频道栏新增定时任务入口，仅列出当前频道 Agent，并在 Workflow 管理页展示任务创建者、来源、频道和目标 Agent。
- 验证：`buzz-workflow` 全量单元测试 159/159（另 2 项 Postgres 测试按设计 ignored）、workflow schema 54/54、ACP 配置 119/119、ACP 创建者归因 3/3、Relay 定时事件结构 1/1、`buzz-core` relay-only kind 1/1 通过；`cargo check -p buzz-workflow -p buzz-acp -p buzz-relay`、Desktop TypeScript、10 个相关文件的 Biome 和前端定时任务测试 3/3 通过。Desktop 全量测试中的失败集中在既有 thread reply/visibility-gated hook 用例，与本次 workflow/频道任务文件无交集。
- 版本/提交：待提交。

## 2026-10-10：本地 Codex ACP Agent 在频道提示需要运行 `codex login`

- 现象：安装 Heartbeat 测试包后，在频道中向 `Experiment Designer` 发消息会收到“needs configuration / run `codex login`”提示；用户此前使用 Codex Desktop 时未见该提示。
- 诊断：该身份是本地 `codex-acp` 自定义 Agent（`agent_command: codex-acp`），不是通过 51919 shared runtime 绑定的 Codex task Agent。现场 `codex login status` 返回 `Not logged in`，且用户目录不存在 `.codex/auth.json`；与此同时 Codex Desktop 通过自己的 app-server daemon 登录会话运行，因此 Desktop 可用不代表独立 Codex CLI 已登录。Agent 日志显示它自 2026-09-24 起已因同一项 readiness requirement 进入 setup-listener 模式，当时未解析到频道所以没有发布提醒；本次加入频道后才显现，并非 Heartbeat 调度代码导致。
- 处理：本轮仅完成现场诊断，不修改鉴权语义。此类自定义 `codex-acp` Agent 需要按实际鉴权方式建立 CLI 凭据后重启 Agent：ChatGPT 账号使用 `codex login`，API 用户使用 `codex login --with-api-key`。当前频道提示只写 `run codex login`，对 API 用户不够准确；如果目标是复用 Codex Desktop 上下文，应创建 Codex task Agent 并走 shared runtime，而不是把普通 `codex-acp` Agent 的 readiness 检查绕过。
- 验证：`codex-cli 0.162.1` 可解析；`codex login status` 退出码为 1 并输出 `Not logged in`；Agent 运行日志明确记录 `setup payload present`、`requirements=1` 以及配置提醒事件成功发布，Relay 连接正常。
- 版本/提交：诊断基于 `0.5.19-heartbeat-test`，功能工作区待提交。

## 2026-10-11：纠正 Codex ACP `codex login` 提示的根因

- 现象：同一台机器改回旧安装包后，本地 `codex-acp` Agent 仍提示“needs configuration / run `codex login`”；因此该问题与 Heartbeat 测试包及 Buzz UI 中的 API Key 配置无关。
- 诊断：现场 Codex 配置选择了自定义 `model_provider`，且该 provider 明确设置 `requires_openai_auth = false`。但 Desktop 的 `collect_missing_requirements()` 对所有 Codex runtime 都无条件执行 `codex login status`；退出码非零即产生 `CliLogin` requirement。Runtime 随后注入 `BUZZ_ACP_SETUP_PAYLOAD`，使 `buzz-acp` 在真正启动 `codex-acp`、连接自定义 provider 之前就进入 setup-listener。现有 Codex config bridge 虽读取 `model_provider`，却未把所选 provider 的 `requires_openai_auth` 暴露给 readiness，因此把“当前 provider 不需要 OpenAI 登录”错误解释成“缺少登录”。
- 处理：Codex readiness 现在读取当前 `model_provider` 对应的 `requires_openai_auth`。只有明确为 `false` 时跳过 `codex login status`，同时仍检查 Codex CLI 与 ACP adapter 是否安装；默认 OpenAI、显式 `true`、无法解析或无法分类的配置继续使用原登录探测，不放宽安全兜底。未改用户凭据、Codex 配置或 Agent 数据。
- 验证：Agent 历史日志显示同一 Agent 早期曾正常启动 `codex-acp`，自 2026-09-24 起稳定进入 `setup-listener`；失败日志发生在 ACP adapter 启动之前。新增 5 个 provider 认证语义测试和 2 个 readiness 回归测试；Codex config bridge 19/19、Codex readiness 3/3 通过。现场正在运行的是既有 `0.5.19` 安装，而非 Heartbeat 测试包。
- 版本/提交：修复位于 `Lin/develop` 当前工作区，未提交；测试安装包 `0.5.19-codex-provider-auth-test` 已生成，SHA-256 为 `1db6606f4f28c639b05e5303baee95cdac88d8dc0d458c7cb7a5bb106a683826`。

## 2026-10-11：Experiment Designer 无回复，Codex provider 请求返回 503

- 现象：用户在 Buzz 向 `Experiment Designer` 发送消息后长时间没有回复，怀疑消息未送达；Codex UI 同时提示会话已在另一个应用打开。
- 定位：本机 managed-agent 记录确认该 Agent 使用绑定 task `01a057fd-92ae-74f1-a520-1a7e57195c86` 和共享 app-server `ws://127.0.0.1:51919`。Buzz 进程于 21:42:17 启动，21:42:18 已连接 Relay、订阅 2 个频道并设为 online；同一 Codex task 在 21:42:23 开始处理、21:48:30 结束，task completion 的 `last_agent_message` 为空，错误为自定义 OpenAI-compatible `/v1/responses` endpoint 返回 `503 Service Unavailable`。因此消息进入绑定的 Codex task，但模型服务端没有生成回复；Codex UI 的“会话已在另一个应用打开”对应 Buzz 持有该 task writer lock，是共享 task 正在被 Buzz 使用的提示，不是 Relay 投递失败。
- 处理：本轮仅完成只读诊断，未改用户的 Codex provider、密钥、task binding 或 Relay 配置。现有 ACP 队列对一般应用错误最多重试 10 次，退避从约 5 秒递增到 300 秒，只有最终 dead-letter 后才向频道发送失败提示；因此上游持续返回 503 时，用户可能等待很久才看到终态提示。Readiness 修复只移除了不适用于该自定义 provider 的 `codex login` 门槛，并未验证 provider 端到端可用，不能作为“回复链路已修复”的证据。
- 验证：只读取 Buzz managed-agent 日志、task binding、进程树和本地 Codex task 的结构化状态/错误元数据；未读取或输出会话正文与密钥，未发送探测请求。现场证据时间为 2026-10-11 21:42–21:48（Asia/Shanghai）。
- 版本/提交：运行包为 `0.5.19-codex-provider-auth-test`；诊断记录添加于当前 `Lin/develop` 工作区，未提交。上游 provider 的 503 需要检查其服务/网关状态；Buzz 的延迟失败提示属于可独立改进的用户体验问题。

## 2026-10-12：模型服务 5xx 时 Agent 长时间无回复

- 现象：消息已经进入绑定的 Codex task，但模型服务返回 HTTP 503 后，频道只持续显示 Agent 工作状态，用户无法判断消息是否收到，也无法在合理时间内得到成功回复或明确终态。
- 诊断：消息投递和 Codex task binding 正常；当前选中的新 provider 是 `custom`，请求地址为 `http://59.77.33.211:8371/v1`，且 `requires_openai_auth = false`。现场对 `/models` 与 `/responses` 的鉴权请求均约 11 秒后返回 HTTP 503，无代理直连 8371 端口则连接失败。旧 `packycode` provider 已停用，不能作为恢复或回退目标。ACP adapter 自身默认还会执行 4 次 HTTP retry、5 次 stream retry，Buzz 又把 502/503/504 当作普通应用错误，套用最多 10 次、最长 300 秒一级的外层退避；两层重试相乘，会让同一条消息长时间静默等待。
- 处理：不保存、不恢复、也不回退旧 provider；Buzz 每次启动 Codex ACP 时读取当前 `model_provider`，并在 session-scoped `CODEX_CONFIG` 中显式选择它，因此恢复历史 task 时也会从旧 provider 切换到当前 provider。对当前非 OpenAI provider 同时把 adapter 内层 request/stream retry 设为 0、stream idle 上限设为 60 秒；provider 地址、认证与模型仍完全来自用户当前配置。本机活动配置中未选中的旧 `packycode` provider 定义也已移除，历史 session 日志只作为审计记录保留。Buzz 识别 ACP `AgentError` 中的 HTTP 502/503/504：首次失败保留原消息、立即在原频道/线程确认已收到，刷新 ACP Agent 进程后自动再尝试一次；第二次仍失败则发布明确终态并停止重试。其他应用错误继续使用原有通用重试策略，认证错误仍立即终止。
- 验证：临时 Codex CLI 探测确认 retry 配置可将同一 503 从约 6 分钟压缩到约 13 秒；`cargo check -p buzz-acp` 及新增的 provider overlay、overlay 深度合并、502/503/504 分类、单次外层重试边界测试通过。Windows PowerShell 下全量库测试 765/834 通过，其余 69 项因测试夹具依赖 Unix `cat/sh` 而失败；改用 Git Bash 后 798/834 通过，剩余 36 项仍是同一批 ACP shell 脚本夹具在当前 Windows 执行环境提前退出，和本次分类/队列逻辑无关。新 provider 当前仍持续返回 503；Buzz 可以快速识别、保留并重试消息，但实际生成答案仍需该 provider 恢复可用。
- 版本/提交：当前 `Lin/develop` 工作区，待提交。

## 2026-10-12：定时任务 / Heartbeat 界面及本地时区重复规则

- 现象/需求：用户确认连接恢复后，要求频道 Agent 定时任务具备截图中的大指令输入框、每日重复、北京时间、折叠高级选项，以及每 N 周、星期多选、开始时间等自定义设置，并保留任务来源。
- 诊断：原有任务入口主要暴露 cron/interval，cron 按 UTC 执行，不能直接表示截图中的本地时间和以开始日期为基准的每 N 天/周规则；仅修改界面或把日期规则转换成普通 cron 会导致执行时间或周期错误。
- 处理：重做 Schedule a task 弹窗，支持 Daily、Weekdays、Weekly、Custom 和 Heartbeat；默认本地时区 09:00，名称可从指令首行生成，高级设置提供时区、开始日期及来源说明。Workflow 编辑和列表保留并显示 calendar 规则及来源。Relay 增加 IANA 时区日历调度，按开始日期计算每 N 天/周，沿用确定性 UTC 执行锚点与数据库去重，并处理夏令时缺失/重复时间。使用与部署说明见 `docs/scheduled-agent-tasks.md`。
- 验证：`buzz-workflow` 165 项单元测试通过（2 项 Postgres 测试 ignored），覆盖北京时间、跨月每两天、每两周、夏令时和序列化互斥；workflow Clippy no-deps、Rust fmt、Relay/ACP cargo check、Desktop typecheck、25 个相关文件 Biome 与文本字号检查通过。前端 8 项测试、新增 3 项 Playwright 弹窗测试及现有 9 项 Workflow 测试通过；截图核对每日和自定义星期界面。界面测试使用 mock Relay，尚未验证真实 Relay 到期后 Agent 回复。
- 检查限制：当前 Windows Hermit bootstrap 失败且无可用 `just`、Postgres/Redis 工具，未完成 `just ci` / `just test`。包含依赖的 Clippy 被既有 `buzz-core/src/agent_handoff.rs` 警告阻断，全仓 Desktop 文件长度门禁也被其他已有超限文件阻断，本次新日历/弹窗文件未超限。实际定时执行需同步升级 Relay。
- 版本/提交：`0.5.19`，`Lin/develop` 当前工作区，未提交；本轮未生成安装包。

## 2026-10-14：定时 Agent 任务已保存但无法查看且每次执行失败

- 现象：频道内可成功创建 Heartbeat / 定时任务，但弹窗关闭后没有明确的查看入口，目标 Agent 也没有按时响应。
- 诊断：Relay 数据库确认两个 5 分钟任务均已持久化，调度器也按期创建了 7 次 run；所有 run 都失败于 `scheduled target is not a registered Agent`。目标 pubkey 实际是活跃频道成员并能正常回复，但 Desktop-managed Agent 没有 Relay `agent_owner_pubkey` 记录，调度发送路径错误地把两种身份记录当成必须同时存在。UI 创建成功后只显示短暂 toast，没有跳转任务详情。
- 处理：定时指令的 Relay 交付边界改为“目标仍是当前频道活跃成员”，不再要求无关的 `agent_owner_pubkey`；kind 40009 仍为 Relay-only、精确 `p` 标记目标，ACP 仍验证 `created_by` 和 Agent 的指令权限。创建成功后直接跳转新任务详情，弹窗也增加 `View scheduled tasks` 入口，便于查看执行历史和失败原因。
- 验证：Relay `workflow_sink` 聚焦单元测试 18/18 通过，`cargo check -p buzz-relay` 通过；新增 Postgres 回归用例覆盖“频道成员存在但 owner 注册为空”的 Desktop-managed Agent（本地无 Postgres，按约定保持 ignored）。Desktop 定时任务 helper 测试 8/8、TypeScript typecheck、目标文件 Biome 检查，以及 E2E 弹窗测试 3/3 均通过；E2E 覆盖创建任务后进入 Workflow 查看页。真实 Relay 数据库与日志已确认修复前任务按期产生 run、失败原因统一为错误的 Agent 注册门槛。
- 版本/提交：Buzz Codex Lab `0.5.19`，随本条修复提交至 `Lin/develop`。

## 2026-10-17：发布 Buzz Codex Lab 0.5.20 正式版

- 现象：需要将 `0.5.19` 之后完成的 Agent 定时任务、Workflow 清理和 Focus Thread Markdown 阅读体验更新写入用户可见日志，并发布为正式版本 `0.5.20`。
- 定位：`Lin/develop` 已包含频道/私聊 Agent 定时任务与 Heartbeat、任务查看/停止/删除及跨 Agent 交付修复、孤立 Workflow 定义清理、Focus Thread 可调宽度和完整文档型 Markdown 主题；发布前桌面版本源仍为 `0.5.19`，应用内更新日志尚未包含这些内容。
- 处理：将桌面端四处版本源统一更新为 `0.5.20`，补充应用内最近十日更新日志和仓库 Changelog；使用本地 updater 私钥、DPAPI 密码及 `D:\BuzzCodexLabBuild-current-provider` 增量缓存生成签名 updater 安装包。创建并推送 `buzz-codex-lab-v0.5.20`，发布非 draft、非 pre-release 的正式 GitHub Release，并将 `buzz-codex-lab-latest` 的安装包、签名和 `latest.json` 更新到 `0.5.20`。滚动通道按约定仅保留当前 `0.5.20` 与前一正式版 `0.5.19` 的安装包及签名。
- 验证：更新日志测试 3/3、Desktop TypeScript、Biome、文本字号门禁及 diff 检查通过；缓存构建完成 Windows NSIS 安装包，updater 公钥验签通过。安装包 SHA-256 为 `0F44DA152B730814C93483A1D76F9E791F46C4150661C183AE0B9826A841214A`；GitHub 回读确认版本化 Release `isDraft=false`、`isPrerelease=false`、目标提交为 `45a5bb43746eadba83d3f87d11855b6694e84bf9`，在线 `latest.json` 返回版本 `0.5.20` 并指向对应安装包。
- 版本/提交：Buzz Codex Lab `0.5.20`；发布准备提交 `45a5bb43`；正式 Release：`https://github.com/chemyibinjiang/buzz/releases/tag/buzz-codex-lab-v0.5.20`。

## 2026-10-14：Heartbeat 已保存并执行，但未出现在 Workflow 总列表

- 现象：用户从聊天内成功创建 Heartbeat 后，在 Workflow 总列表中看不到该任务。
- 诊断：Relay 数据库确认任务 `af7f5542-b9a9-4e66-bcb5-6e311b2f0607` 已于 21:33 保存，并按 3 分钟周期持续生成 `completed` run；任务属于 DM 频道。总列表此前先读取 Desktop 本地 `isMember` 频道投影，再把这些频道 ID 拼成 `#h` 查询；隐藏 DM、频道元数据延迟或本地投影缺失会让真实存在的 Workflow 被查询范围排除。
- 处理：新增“当前身份可访问的全部 Workflow”Tauri 查询，总列表直接依赖 Relay 的权威频道访问范围，不再以本地频道列表决定 Workflow 是否可见；本地频道数据只用于补充频道名称。创建和编辑频道选择仍只展示本地有效成员频道。
- 验证：`cargo check --manifest-path desktop/src-tauri/Cargo.toml` 通过（仅有仓库既有的未使用代码警告）；Desktop TypeScript `tsc --noEmit`、目标文件 Biome、`pnpm build:e2e` 通过；定时任务 Playwright smoke 回归 4/4 通过，新增用例确认本地频道投影不参与总列表查询。`cargo fmt --check` 仍被工作区其他既有、非本轮文件的格式差异阻断，本轮改动未扩大该差异。
- 版本/提交：Buzz Codex Lab `0.5.19-heartbeat-conversation-fix`，功能提交 `cef61bf2`。

## 2026-10-14：Heartbeat 结果只出现在 Inbox，原 Agent 私聊时间线不可见

- 现象：Heartbeat 已执行且 Inbox 能收到 Agent 的提及通知，但进入用户与该 Agent 的 DM 后看不到对应回复。
- 诊断：真实 Relay 事件确认 kind:40009 定时指令和 Agent kind:9 回复均属于同一个 DM；但自动交付把回复加成了对 kind:40009 的 NIP-10 thread reply。kind:40009 是仅供 Agent 消费、Desktop 不渲染的隐藏事件，因此回复挂在一个不可见的 thread root 下，普通 DM 时间线排除了它，而 Inbox 仍会因 `p` 提及展示通知。
- 处理：task-bound Agent 遇到定时指令时将最终答案发布为当前频道的顶层 kind:9 消息，不再回复隐藏的 kind:40009；结果继续携带 Workflow ID 与 scheduled-task 来源标签。普通聊天消息和可见线程仍保持原有 reply anchoring。非自动交付 Agent 的提示也明确要求定时任务结果和附件作为顶层消息发送。
- 验证：真实 Relay 数据确认同一 DM 中 kind:40009 触发事件之后的 Agent kind:9 回复带有指向该隐藏事件的 `e/reply` 标签，复现了 Inbox 可见但聊天时间线不可见的路径。新增 4 项聚焦回归，覆盖提示要求顶层交付、task-bound 定时结果无 `e` 标签、缺少 Workflow 标签时仍保持顶层，以及普通消息仍按原规则回复可见触发事件，全部通过；`cargo check -p buzz-acp`、Rustfmt 与 `git diff --check` 通过。完整 `cargo test -p buzz-acp --lib` 在 Windows 因既有测试依赖 Unix `cat` 命令而有 69 项失败（772 项通过）；`cargo clippy -p buzz-acp --lib -- -D warnings` 被 `buzz-core/src/agent_handoff.rs` 的既有 `needless_as_bytes` 告警阻断，均与本轮改动无关。
- 版本/提交：Buzz Codex Lab `0.5.19-heartbeat-conversation-fix`，功能提交 `cef61bf2`。

## 2026-10-15：定时任务缺少停止控制，部分结果仍未进入 Channel / DM 时间线

- 现象：Workflow 详情只有 Edit 和 Trigger，没有停止定时执行的按钮；定时任务 run 显示 `completed`，但用户仍只能在 Inbox 观察到相关通知，所属 Channel 或 Agent 私聊内没有稳定出现最终回复。
- 诊断：`completed` 只代表 Relay 的 `prompt_agent` 步骤已发布隐藏的 kind:40009 指令，不代表 Agent 已完成回答。本机目标 Agent 日志进一步确认，任务重叠时控制信号可能在 `session/prompt` JSON 已写入、但 NDJSON 换行尚未写入的 await 边界取消该 future，随后 `session/cancel` 被直接拼到同一行；codex-acp 报 `Unexpected non-whitespace character after JSON` 并重启，因此该轮没有 final answer 可供时间线展示。现有自动顶层投递还只覆盖 task-bound Agent，其他 Agent 仍依赖提示词自行发送，不是确定性路径。
- 处理：Workflow 详情新增 Stop / Resume，分别把定义的 `enabled` 写为 `false` / `true`，保留历史和手动 Trigger；状态与列表通过既有 query invalidation 刷新。ACP prompt 写入增加“完整请求帧已 flush”握手，只有跨过该边界后控制信号才可取消 turn，防止 prompt 与 cancel 粘连。kind:40009 到达正在工作的同一会话时只排队，不再 steer / cancel 当前人工回复或另一个定时任务。所有定时 turn 都改由 harness 捕获 final answer、签名并发布为所属 Channel 或 DM 的顶层 kind:9 消息；提示明确禁止 Agent 再重复发送同一段文本，普通人工消息的回复锚点保持原样。
- 验证：`cargo check -p buzz-acp`、Rustfmt、Desktop TypeScript typecheck、`pnpm build:e2e` 与 `git diff --check` 通过；定时任务 Rust 聚焦测试覆盖非 task-bound 任务也由 harness 投递、顶层消息无隐藏 reply root、Workflow/source 标签、定时事件不打断 in-flight turn 与普通回复不回归。`scheduled-agent-task.spec.ts` 5/5 通过，新增用例真实点击 Stop / Resume 并确认保存的 Workflow YAML 在 `enabled: false` 与 `enabled: true` 间切换。
- 版本/提交：`Lin/develop` 当前工作区，待提交；基线为 `54561655`。

## 2026-10-15：定时任务委派另一个 Agent 后，结果只进入 Inbox/thread

- 现象：用户设置定时任务，让 Agent A 通知 Agent B 向用户问好。Workflow run 显示 completed，Agent A 的任务总结出现在 Channel，但 Agent B 的实际问候只在 Inbox/thread 中可见；打开 thread 还提示 `Some message context could not be loaded`，Channel 主时间线或用户私聊均没有该交付。
- 诊断：定时任务的 kind:40009 是隐藏 Relay 控制事件，但 prompt 格式化仍把它当作普通人类顶层消息，为 Agent A 生成指向该隐藏事件的 `--reply-to`。A 的委派因此挂在不可见根下，B 的回复继续嵌套；Desktop 能从 Inbox 的 mention 索引看到子事件，却无法加载隐藏根或把回复放入普通时间线。另外，A 的委派只 p-tag 了 B，把任务创建者写成普通文本，B 的 harness 无法判断这是面向人的最终交付。
- 处理：scheduled turn 现在完全忽略隐藏事件的 thread 结构，不生成 reply anchor，并明确要求协调、委派、附件等所有 CLI send 均不得使用 `--reply-to`。提示会把经过验证的 `created_by` pubkey 提供给 A，要求面向创建者的委派使用显式 `--mention`。当 B 收到“Agent 发送者 + 人类 p-tag”的委派时，prompt 明确要求顶层 Channel/DM 交付；task-bound harness 同样强制最终答案无 `e` thread 标签，并自动保留人类接收者的 p-tag，因此不依赖模型自行选择正确回复位置。
- 验证：新增聚焦回归覆盖带隐藏 `e/reply` 标签的 scheduled event 不生成 `--reply-to`、scheduled prompt 包含创建者明确 mention 指令、Agent→Agent→human 委派生成顶层交付提示，以及 task-bound harness 的最终事件无 `e` 标签并保留人类 `p` 标签。新增 3 项聚焦测试、scheduled 相关 8 项和 reply-anchor 相关 7 项均通过；`cargo check -p buzz-acp`、`cargo clippy -p buzz-acp --lib --no-deps -- -D warnings`、Rustfmt 与 `git diff --check` 通过。
- 版本/提交：`Lin/develop` 当前工作区，基线 `5bbbb50b`，待提交。

## 2026-10-15：Workflow 点击 Delete 后仍留在列表

- 现象：Workflow / Heartbeat 列表中点击 Delete 并确认后，项目仍然存在，用户无法判断删除请求是否失败。
- 诊断：Relay 的 Workflow 专用 NIP-09 `a` tag 分支只删除了调度数据库中的 Workflow 及 run/approval，没有软删除列表查询依赖的 addressable `kind:30620` 定义事件，因此刷新后旧定义会再次出现。Desktop 还始终用当前人类身份的 pubkey 构造删除坐标，对由其所有 Agent 签名创建的 Workflow 会指向错误 owner；前端又在请求完成前关闭对话框且不显示错误。
- 处理：Relay 现在使用 `a` tag 中的真实目标 pubkey 删除调度记录，并同时按 `(kind, pubkey, d-tag)` 软删除 `kind:30620` 定义；旧的名称型坐标会先解析为实际 Workflow UUID。Desktop 删除前先查询现有定义事件，使用它的真实签名者构造 NIP-09 坐标，仍由 Relay 验证人类 owner 删除 Agent 事件的授权。UI 等待请求成功后才关闭对话框，显示 `Deleting…`，失败时保留项目并显示错误 toast，成功时立即从当前缓存列表移除后再刷新 Relay 数据。
- 验证：`cargo check -p buzz-relay`、Desktop TypeScript typecheck、Tauri 聚焦单测和 E2E build 通过；Workflow Playwright 10/10 通过，覆盖删除成功后列表消失，以及 Relay 删除拒绝时对话框/项目保留并显示错误。真实环境要生效必须同步部署本次 Relay 修改。
- 版本/提交：`Lin/develop` 当前工作区，基线 `8c0971e7`，待提交。

## 2026-10-16：Focus Thread 长内容阅读疲劳

- 现象：用户反馈 Thread 展开界面阅读长篇 Agent 回复时非常疲劳；截图显示正文密集、行距和段落间距偏小，鼠标经过长消息时整块灰色悬停背景进一步加重视觉负担，希望采用接近 Codex 的专注阅读版式。
- 诊断：Focus Thread 虽然已经使用居中限宽列，但仍完全复用并排聊天的紧凑消息样式：正文为 `text-sm/leading-5`（14px/20px）、消息纵向内边距仅 4px、段落连续间距仅 6px，且普通消息启用整行 `bg-muted` 悬停背景。宽屏下阅读列上限 880px，使长行与低行距叠加。
- 处理：仅在 Focus Thread 启用舒适阅读密度，阅读列收窄至 760px，Markdown 正文提升为 16px/28px，扩大段落、代码块、表格和引用块之间的留白，并增加消息纵向间距；Focus 模式关闭整块消息灰底悬停反馈，操作栏和所有消息、附件及线程功能继续保留。并排 Thread 维持原紧凑密度，避免占用频道空间。
- 验证：Desktop TypeScript、目标文件 Biome 检查和 `check:px-text` 通过；E2E 构建通过；模式切换 helper 单测 6/6 通过；Focus Thread Playwright smoke 2/2 通过，覆盖舒适模式标记、760px 最大阅读宽度、16px/28px 正文、12px 消息纵向内边距，以及切回并排视图后恢复 compact。另用 1280×720 实际截图检查，正文列、段落留白和输入框对齐符合专注阅读预期，且长消息不再出现整块灰色悬停底色。
- 版本/提交：`Lin/develop` 当前工作区，基线 `5a0db3bc`，待提交。

## 2026-10-16：Focus Thread 固定窄栏不适合表格与科研图片

- 现象：上一版将 Focus Thread 阅读列固定收窄到 760px，纯文本行长更舒适，但用户反馈实际内容经常包含宽表格、谱图和附件，固定窄栏造成额外换行与横向空间浪费，希望阅读宽度可调整。
- 诊断：把 Codex 的文本阅读版心直接套用于 Buzz 的混合媒体消息并不合理；Focus Thread 同时承担长文、表格、图片和代码展示，需要以较宽默认值保留信息密度，并允许用户按内容类型选择阅读宽度。
- 处理：默认阅读宽度调整为 1040px，在可用空间不足时仍自动缩至容器宽度；Focus Thread 标题栏新增收窄、恢复默认和加宽按钮，正文列右边缘支持连续拖动与双击复位，宽度限制在 640–1400px 并持久保存。消息列表与底部输入框继续共享同一宽度，并排 Thread 不受影响。
- 验证：Desktop TypeScript、E2E 构建、目标文件 Biome、`check:px-text` 和 `git diff --check` 通过；宽度 helper 单测 2/2 通过；Focus Thread Playwright smoke 2/2 通过，覆盖默认 1040px、按钮收窄/复位、本地持久化、拖动收窄/双击复位，以及 Focus/Split 切换后的阅读位置和交互隔离。视觉检查确认标题栏宽度控制保持紧凑，1040px 默认列可容纳更宽的表格和科研图片。
- 版本/提交：`Lin/develop` 当前工作区，基线 `57eaf58a`，待提交。

## 2026-10-16：历史遗留的 Workflow 半删除后无法再次删除

- 现象：Workflows 列表仍显示数个已禁用的定时任务，点击后运行历史返回 `404 workflow not found`，再次点击 Delete 也无法让它们从列表消失。
- 诊断：这些任务的 scheduler 数据库行已被旧版删除逻辑移除，但列表依赖的 addressable `kind:30620` 定义事件仍存活，形成“数据库已删、定义仍在”的半删除状态。后续 NIP-09 删除虽然已经具备清理定义事件的逻辑，却先调用 owner-scoped 数据库 DELETE；数据库行已不存在时会返回 NotFound 并提前终止，因此永远执行不到定义事件清理。
- 处理：Relay 的 Workflow 删除改为幂等清理。owner-scoped DELETE 返回 NotFound 时，再按当前 Community 和 Workflow UUID 做一次权威查询：确认数据库行确实已经不存在后，继续软删除 `kind:30620` 定义；如果行仍存在，说明是 owner 坐标不匹配，继续拒绝删除，避免越权清理其他 owner 的定义。正常删除及缓存失效路径保持不变。
- 验证：`cargo check -p buzz-relay` 通过；Relay `handlers::side_effects::tests` 聚焦单测 7/7 通过，`git diff --check` 通过。删除前的 NIP-09 授权仍要求操作者是定义作者或该 Agent 的 owner；数据库行仍存在但坐标 owner 不匹配时明确失败，只有权威查询确认行已不存在时才继续清理定义。仍需真实 Relay 部署后验证历史遗留定义消失；只有 Desktop 安装包无法清理服务端数据。
- 版本/提交：`Lin/develop` 当前工作区，基线 `3174bc6c`，待提交。

## 2026-10-16：Agent 能正常回复，但 Activity 面板始终为空

- 现象：`test talk 2` 在 `#general` 能正常收到消息并回复，但右侧 Activity 面板持续显示 `No ACP activity yet`，无法查看该 Agent 的思考和工具活动。
- 诊断：客户端本地 Activity archive 中，该 Agent 的 kind `24200` observer 事件数量为 0；Relay 数据库中该 Agent `2aef5243…` 已是 Relay member，但 `users.agent_owner_pubkey` 仍为 NULL。Relay 日志在每次正常 kind:9 回复后都出现同一 Agent 的 `/events` 403，说明 observer frame 被拒绝。根因是 closed Relay 的成员检查先发现 Agent 已是直接成员，立即返回 `MembershipDecision::Member`，没有继续解析有效的 NIP-OA auth tag；认证处理只对 `ViaOwner` 或 open Relay 路径执行 `materialize_nip_oa_owner`，因此这种“已是成员但缺少 owner 映射”的历史 Agent 永远无法自动回填。普通聊天事件不要求该映射，所以聊天正常；kind `24200` 要求已注册 Agent，因此 Activity 被拒绝。
- 处理：本轮仅完成证据化诊断，未修改产品代码。后续修复应让携带有效 NIP-OA tag 的直接成员也尝试幂等回填 Agent→Owner 映射，并让 ACP 在 observer frame 收到 `accepted=false` 时记录明确告警、避免静默按成功确认。
- 验证：Agent 本机日志确认四次回复均发布到 channel `fed94bb4-5142-5ca4-aa62-91ddf2a895bb`；本地 archive 查询确认该 Agent/channel 均无 observer 事件；Relay journal 在 `13:32:51`、`13:37:50`、`13:42:51`、`13:47:54` UTC 均记录该 Agent 的普通 kind:9 事件 accepted=true，随后 Activity `/events` 请求 status=403/accepted=false；Relay DB 确认 `agent_owner_pubkey IS NULL`。
- 版本/提交：`Lin/develop`，基线 `289158e1`；诊断记录，尚未修复或提交。

## 2026-10-16：Focus Thread 科研长文与表格排版不如 ChatGPT 清晰

- 现象：用户对比 ChatGPT App 与 Buzz 的同类科研回答后，认为 Buzz 阅读疲劳。Buzz 截图显示 1040px 阅读列在宽屏抽屉中占比过小；Markdown 表格使用圆角边框、灰色表头和 14px 紧凑字号，表格按内容宽度横向撑开，四列证据矩阵只能看到前两列并出现横向滚动。
- 诊断：Focus Thread 虽已把正文提升为 16px/28px，但共享 `MarkdownTable` 又固定使用 `text-sm`，抵消了舒适阅读字号；`w-max` 与内容固有宽度使多列表格优先横向扩张而不是换行。1040px 默认列更适合普通长文，不适合宽屏上的四列科研证据表。
- 处理：Focus Thread 默认阅读宽度提升到 1520px、可调上限提升到 1800px，原有收窄/复位/加宽和拖拽持久化继续保留。专注模式 Markdown 增加文档型层级与段落节奏；表格改为 16px/28px、固定列布局和安全换行，四列表按 23%/31%/23%/23% 分配列宽，移除圆角外框与灰色表头，仅保留清晰表头线和轻量行分隔。普通频道、Inbox 和并排 Thread 的紧凑表格不受影响。
- 验证：Desktop TypeScript、Biome 和 `check:px-text` 通过；E2E build 通过；Focus Thread Playwright 2/2 通过，覆盖 16px/28px 正文和表格、无表格外框、透明表头、固定列布局、无横向溢出，以及阅读宽度按钮/拖拽/持久化和 Focus/Split 切换。实际 1280×720 mock 截图确认四列同时可见并自动换行。
- 版本/提交：`Lin/develop` 当前工作区，基线 `289158e1`，待提交。

## 2026-10-17：Focus Thread 只优化表格，整体 Markdown 仍不像 ChatGPT

- 现象：上一版已经解决四列科研表格横向溢出，但用户指出视觉改动仍主要集中在表格；标题、连续段落、嵌套列表、任务列表、引用、链接、代码块、行内代码、公式和分隔线仍各自沿用紧凑聊天样式，没有形成 ChatGPT App 那种连续、统一的长文阅读层级。
- 诊断：Focus Thread 的正文尺寸和大量相邻元素间距此前由 `MessageRow` 中的一串 Tailwind 选择器临时覆盖，Markdown 组件本身又会丢弃 GFM 列表类名和表格单元格属性。结果是每种节点缺少同一排版系统：引用仍为斜体聊天引用，代码块仍是紧凑附件卡，任务列表语义类无法用于布局，公式没有长式滚动与留白规则，外链也缺乏清晰的文档型识别。
- 处理：将 Focus Thread 改为独立的长文 Markdown 主题，以 16px/28px 正文为基准统一标题层级、段落节奏、列表缩进与嵌套间距、混合任务列表、非斜体引用块、蓝色文档链接、代码块、行内代码、KaTeX 行间公式、分隔线、媒体和无卡片表格。Markdown 组件现在保留 GFM 的 `className`、表格对齐等语义属性，并为标题、段落、列表、引用和分隔线提供稳定标记；普通频道、Inbox 和并排 Thread 继续使用原紧凑样式。
- 验证：新增一条包含长段落、H1/H2/H3、嵌套列表、已完成/未完成任务、引用、外链、TypeScript 代码块、行内/行间公式、分隔线、行内代码和四列表格的 Focus Thread E2E 场景；断言字号与行距、标题权重、段落间距、任务列表语义、引用样式、代码块、公式横向滚动、链接识别、表格固定布局及无横向溢出，并生成上下两张实际界面截图。Desktop TypeScript、Biome、文本字号门禁和 E2E build 通过，Focus Thread Playwright 3/3 通过。
- 版本/提交：Buzz Codex Lab `0.5.19`，随本条修复提交至 `Lin/develop`。

## 2026-10-17：同一账户跨电脑 Agent 不同步且远端 Codex task 被误判为本机待配置 Agent

- 现象：同一 Buzz 账户在两台电脑的 Agents 页面内容不一致。Codex thread/task 导入的 Agent 在创建电脑上位于 Custom agents，另一台电脑却只显示同步到 Relay 的 Persona，并被混入普通 Agent 区；从另一台电脑点击 Start 或发送消息后出现 `needs configuration / Set the provider field`，用户也缺少主动刷新同账户 Agent 的入口。
- 诊断：Persona(kind:30175) 和 Managed Agent 的公开投影(kind:30177)已有跨设备同步，但 Codex task binding（task id、workspace、app-server/SSH 信息）按安全设计只保存在本机。30177 又没有携带“源自 Codex task”的非敏感分类标记，另一台电脑只能看到 persona link，于是把定义渲染成可在本机启动的 Persona 卡；启动后自然进入本机 readiness/setup-listener，并错误要求配置本机 Provider。直接复制 ManagedAgent、私钥或 Provider/API Key 会破坏设备边界并泄露敏感信息，因此不能用“完整配置同步”解决。
- 处理：kind:30177 增加向后兼容的 `codex_task` 布尔来源标记，boot reconcile 与交互保存从本机 binding sidecar 读取该事实，但不发布 task id、目录、app-server、SSH 或凭据。Relay Agent 目录同时暴露可信的 `persona_id`、`codex_task` 和 `managed_definition`。Agents 页面把同 owner、已验证且仅存在于另一设备的 Managed Agent 作为独立 Remote 卡片展示；Codex task Remote 卡始终进入 Custom agents，不提供本机 Start/Edit，只打开 Agent profile/消息入口；若旧版本曾基于同一 persona 误建本机副本，远端 task 投影会优先隐藏该错误启动入口。页面新增 `Sync agents`，主动拉取并落地当前账户的 persona/team/managed-agent heads 后刷新本机、Relay 和 Persona 查询，而非仅刷新缓存。
- 验证：前端分组与 Persona sync 聚焦测试 8/8 通过，覆盖远端 Codex task 固定进入 Custom agents、普通远端 persona 保持分组且不成为本机实例，以及手动同步会等待全部 owner 事件完成落地；Rust 聚焦测试验证仅公开 `codex_task` 标记而不泄漏 task/workspace/app-server/SSH 字段，以及 Relay 目录正确返回 Codex 来源与 persona。Desktop TypeScript、Biome、`check:px-text`、Rustfmt、Tauri 编译和两个 Tauri 聚焦测试通过；新增 Playwright 回归确认同账户远端 Codex task 显示在 Custom agents、显示 Remote online、没有本机 Start 控件和重复 Persona 启动卡。Tauri 编译仅有仓库既有 unused 警告。
- 版本/提交：Buzz Codex Lab `0.5.20` 后续工作区，`Lin/develop`，待提交。

## 2026-10-17：Agents 页面显示同名不同公钥的远端重复项及已删除旧 Agent

- 现象：Agents 页面当前电脑的三个 Codex task Agent（`Experiment Designer`、`test talk 1`、`test talk 2`）之外，还显示五个“On another computer”条目。用户确认前三个确实是本机 Agent，并指出同名条目的公钥不同是错误状态。
- 诊断：本机 `managed-agents.json` 与 Codex task binding sidecar 确认上述三个当前 Agent 各自有本机身份记录和 task binding。`managed-agents.json.pre-backfill.bak` 还保留旧的 `Experiment Designer`、`Flowsim Operator` 和 `Manage DDA simulations` 身份；本机旧运行日志也确认这些身份曾在此安装上启动，但当前主配置中已不存在。当前 Relay 目录投影只根据拥有者签名、`managed_definition`、`codex_task`、本机 pubkey 是否存在及 NIP-09 / NIP-IA 删除记录来决定显示；kind:30177 没有稳定的逻辑 Agent ID 或设备实例来源字段，因此同名而 pubkey 不同的身份被当成不同 Agent。更早版本若删除时未发布 kind:5 / kind:13535 tombstone，启动 reconcile 明确不会根据本机文件缺失自动删除远端记录，以避免误删另一台设备的 Agent，旧身份就会继续出现。现有证据能确认至少三条远端卡片是本机历史身份残留；两条 `test talk` 远端副本的来源设备仍需检查 Relay 原始记录才能断言。
- 处理：本轮仅核验并记录根因，未按名称自动去重、隐藏或向 Relay 删除记录。仅按名称合并会误伤用户有意创建的同名 Agent；自动把缺少本机记录视为删除也会误删其他电脑上的有效 Agent。正确修复需要在远端卡片提供经过 owner 校验的显式“移除/归档”路径，并为跨设备 Agent 建立稳定逻辑身份或设备清单，不能把各设备独立生成的公钥伪装成同一个身份。
- 验证：检查了当前本机 Agent 配置、task binding、迁移前备份、相关 Agent 运行日志，以及 Relay Agent 投影和 tombstone/reconcile 代码路径；未访问或输出私钥、Auth tag、API key 或 task 会话正文。未修改产品代码，尚未验证 Relay 上各远端公钥是否已有墓碑。
- 版本/提交：Buzz Codex Lab `0.5.20`，基线 `f84276e2`；本条为诊断记录，待后续实现修复。

## 2026-10-18：同一 Codex task 在不同电脑上被创建为不同 Agent 身份

- 现象：同一 Buzz 账户切换电脑后，再次从相同 Codex task 创建 Agent 会生成新的 Nostr 密钥和公钥；Relay 因而显示多个同名但公钥不同的 Agent，消息、设置和运行状态也被拆成不同身份。
- 诊断：Codex task binding 仅保存在设备本地，公开的 kind:30177 此前只有 `codex_task: true`，没有可用于识别“这是同一个 task”的稳定字段。每台电脑只能知道本机 binding，创建流程只检查本机 `codex-task-bindings.json`，所以跨设备必然重新生成密钥。按名称合并不安全，因为用户可以合法创建同名 Agent；同步私钥、workspace、SSH 或 app-server 配置又会破坏设备和凭据边界。
- 处理：为规范化 Codex task UUID 生成带域分隔的 SHA-256 `codex_task_key`，通过 owner 验证后的 kind:30177 公开投影同步；不公开原始 task ID、workspace、app-server、SSH 配置或凭据。启动 reconcile 和交互保存都会补发该指纹。选择 task 时 UI 会提示已存在的同账户远端 Agent并禁用创建；真正的 Rust 创建命令也会查询 Relay 目录并在生成新密钥前拒绝重复，避免绕过 UI。旧版没有指纹的历史 Agent保持兼容且不会被自动删除，防止误删其他设备仍在运行的身份。
- 验证：Rust 单测覆盖相同 UUID 的大小写形式生成相同 64 位指纹、不同 task 生成不同指纹、公开内容不包含 task/workspace/SSH 字段，以及 Relay 目录能解析指纹；Tauri `cargo check`、Desktop TypeScript typecheck 和目标 Biome 检查通过。待用两台电脑实测：第一台新版本启动后发布指纹，第二台同步 Agent 后选择同一 task，应显示已有远端 Agent且无法生成第二个公钥。
- 版本/提交：Buzz Codex Lab `0.5.20` 后续测试版，`Lin/develop`，基线 `f84276e2`，待提交。

## 2026-10-21：Windows 托盘没有 @ 提示且 Buzz 不在系统通知应用列表

- 现象：Windows 右下角 Buzz 托盘图标在收到 @ 提及后没有任何未读提示；Windows `设置 > 系统 > 通知` 的应用列表中也找不到 Buzz，无法像普通桌面应用一样查看或调整其通知权限。
- 诊断：托盘原生层此前只同步 Agent activity 菜单，从未接收聊天未读或 mention 状态，也没有动态更新图标。系统通知虽通过 Tauri 的 `window.Notification` shim 最终调用 WinRT toast，但插件在后台线程中丢弃投递错误；安装器只给 Start Menu 快捷方式写入 AppUserModelID，没有显式创建 `HKCU\Software\Classes\AppUserModelId\<identifier>` 的显示名和图标注册。本机注册表核验确认 `xyz.chemyibinjiang.buzz.codexlab` 的 AppUserModelId 和 Notifications Settings 项均不存在，因此 Windows 无法稳定把 toast 归属为 Buzz，失败时前端还会误判为发送成功。
- 处理：把当前 Community 已有的去重桌面 badge 计数与其他 Community 的 mention 数汇总后同步到原生托盘；Windows 托盘在计数大于零时给原图标叠加带白色描边的绿色圆点，并在 tooltip 显示未读数量，清零或切换 Community 时恢复默认图标。Windows 通知改走可返回实际投递结果并保留点击句柄的原生 Rust 路径，使用应用配置中的稳定 AppUserModelID，点击后继续通过既有 target 路由打开对应频道/线程。NSIS 安装/卸载钩子和应用启动同时维护 AppUserModelId 的 DisplayName、IconUri 与背景色注册，兼容旧安装直接升级修复。
- 验证：Desktop TypeScript typecheck、目标 Biome 检查、E2E build、Tauri `cargo check` 和 Rustfmt 通过；托盘图标聚焦 Rust 单测 1/1 通过，确认尺寸不变、左上角像素不受影响且右下角生成绿色提示点；通知与 Community Rail 聚焦前端测试 8/8 通过。完整 Desktop Node 测试运行到 4598 项时有 10 项既有 thread-replies loader 用例因测试 loader 返回 `null` 报 `ERR_INVALID_RETURN_PROPERTY_VALUE`，失败集中在同一未改动模块，本轮相关测试均通过。
- 版本/提交：Buzz Codex Lab `0.5.20` 后续测试版，`Lin/develop`，基线 `7234c283`，本条修复提交。

## 2026-10-21：Windows 通知身份已注册但 Buzz 通知开关仍被锁死

- 现象：安装上一版后，收到 @ 时托盘绿点已经正常出现，但 Buzz 的 Desktop alerts 开关保持关闭并提示“Desktop notifications are blocked”；Windows 通知应用列表中仍没有 Buzz，导致用户既无法在 Buzz 内启用，也无法先在 Windows 中启用。
- 诊断：AppUserModelID 注册已经成功写入，但前端在调用新的 Windows 原生通知命令之前，仍先读取 WebView/Tauri 通知插件的浏览器式 permission。该旧权限接口返回 `denied` 后会直接阻止原生 toast 投递并关闭 Buzz 内设置。Windows 桌面应用实际上没有浏览器式授权弹窗，而系统通常要在第一条原生 toast 成功提交后才创建 per-app 通知设置项，因此形成了“没有系统条目就不能启用、没有启用就永远不发送首条 toast”的死锁。
- 处理：Windows 改用原生权限状态命令，读取系统全局 `ToastEnabled` 和当前 AppUserModelID 的 per-app `Enabled`；只有明确为 `0` 才视为 blocked，设置项尚未生成时返回 `default` 而不是旧插件的 `denied`。用户打开 Desktop alerts 时会先补齐通知身份并发送一条原生确认通知，以触发 Windows 创建 Buzz 的通知应用条目；普通消息在该系统条目仍处于首次创建窗口时也允许直接尝试原生投递，避免再次形成权限死锁。E2E bridge 同步支持新增命令。
- 验证：Rustfmt、Tauri `cargo check`、Desktop TypeScript typecheck、目标 Biome、E2E build 与通知聚焦前端测试通过；Windows 原生权限状态单测 4/4 通过，覆盖首次无 per-app 条目、全局关闭、单应用关闭和已有条目未显式覆盖四种情况。本机还确认安装包已正确写入 `xyz.chemyibinjiang.buzz.codexlab` 身份，Start Menu 快捷方式的 AppUserModelID 与之相同，而 Windows per-app 通知键确实尚不存在，符合权限死锁诊断。最终 toast 展示和 Windows 设置列表登记待新安装包实测。
- 版本/提交：Buzz Codex Lab `0.5.20` 后续测试版，`Lin/develop`，基线 `35dcee1c`，本条修复提交。

## 2026-10-21：发布 Buzz Codex Lab 0.5.21 正式版

- 现象/需求：Windows 托盘 @ 提示、系统原生通知注册与通知开关修复已经通过用户实机测试，需要整理更新日志并发布可在线升级的 `0.5.21` 正式版；同时纳入同账户跨电脑同步 Codex task Agent、Custom Agents 归类和跨设备稳定 task 指纹等近期改进。
- 处理：将 Desktop、Tauri 和 updater 版本统一更新为 `0.5.21`，在根更新日志与应用内最近十日更新日志中记录主要变化；使用本地 updater 私钥生成带 Tauri updater 签名的 Windows NSIS 安装包。创建并推送 `buzz-codex-lab-v0.5.21` 标签，发布非草稿、非预发布的 GitHub Release；滚动通道 `buzz-codex-lab-latest` 更新为 `0.5.21`，并按保留策略仅留下当前 `0.5.21`、前一版 `0.5.20` 及 `latest.json`，未导出 zip。
- 验证：Desktop TypeScript typecheck、目标 Biome、`startupChangelog.test.mjs` 3/3、Tauri `cargo check` 和 `git diff --check` 通过；本地安装包 updater 签名验证通过。安装包大小 `230405552` 字节，SHA-256 为 `1af4bdb411cfcf5d1ad7ce33d0198ed4fee745bff329d509aae9edf10658893b`。在线 `latest.json` 回读版本为 `0.5.21`，下载 URL 指向 `Buzz-Codex-Lab_0.5.21_db2ac881cfe1_x64-setup.exe`，线上签名与本地产物一致。正式 Release 为 `https://github.com/chemyibinjiang/buzz/releases/tag/buzz-codex-lab-v0.5.21`，状态为 `isDraft=false`、`isPrerelease=false`。
- 版本/提交：Buzz Codex Lab `0.5.21`，发布提交 `db2ac881cfe1`；本条发布记录随后提交到 `Lin/develop`，版本标签继续固定指向发布提交。

## 2026-10-21：Codex 导入 Agent 无法清晰选择推理等级且保存不生效

- 现象：Codex task 导入的 Agent 编辑界面把普通模型和 `high`、`xhigh`、`max` 等推理等级混在一个很长的 Model 列表里，前部只看到不带等级的模型；即使选中带等级的条目并保存，重新运行时仍使用 task 原来的模型与推理等级。
- 诊断：Codex ACP 的真实可切换 ID 是 `model[effort]`，但 Desktop 同时把 stable config 中不带等级的基础模型排在列表顶部，没有为 reasoning effort 提供独立控制。更关键的是，task-bound Agent 启动时由设备本地 `CodexTaskBinding.model` 覆盖普通 `ManagedAgentRecord.model`；编辑保存只更新 record，并且带有 Agent definition 链接的 task Agent 还会完全省略 model 写入，因此所选值无法进入实际启动配置。
- 处理：Codex task 编辑器将基础模型与 Reasoning effort 拆成两个选择框，并从 ACP 返回的组合 ID 动态生成该模型真实支持的等级，明确显示 `xhigh (extra high)`；保存时仍写入 Codex ACP 要求的规范 `model[effort]`。task-bound Agent 即使链接了 Agent definition 也允许保存 task 专属模型，并同步更新设备本地 task binding；binding 写入失败时回滚普通 Agent record，避免两个配置源再次分叉。
- 验证：直接运行本机 Codex ACP `models --json`，确认 stable 基础模型与 unstable `model[effort]` 组合同时返回，并包含 `high`、`xhigh`、`max`、`ultra` 等实际能力。新增前端纯函数回归 3/3 通过，覆盖组合 ID 拆装、基础模型去重和 `xhigh (extra high)` 等等级排序；Tauri `codex_tasks::tests` 16/16 通过，覆盖 task binding 从 `gpt-5.6-sol[high]` 更新为 `gpt-5.6-sol[xhigh]`。Desktop TypeScript typecheck、目标 Biome、文本字号门禁、Rustfmt、Tauri `cargo check` 与 `git diff --check` 通过；仅有仓库既有 unused 警告。
- 版本/提交：Buzz Codex Lab `0.5.21` 测试包，功能提交 `73950952289051de82492f7243f5b17d8e855202`；测试安装包 `Buzz-Codex-Lab_0.5.21_739509522890_x64-setup.exe`，SHA-256 `494fe8d59aca33f08759872c2b2c4cb461938ee87ce4797df730e58d88e23dc6`，使用 D 盘增量缓存构建并通过 updater 签名校验。

## 2026-10-23：Agent 显示长会话提醒并因服务过载中断输出

- 现象：用户截图同时显示长 thread 多次 compaction 可能降低准确性的提醒，以及 `stream disconnected before completion: Our servers are currently overloaded. Please try again later.`。
- 诊断：前者是会话上下文压缩提醒；后者是模型请求流未正常完成且服务返回过载信息，两条提示不能直接建立因果关系。仅凭截图无法确定过载发生在 OpenAI 还是用户配置的兼容 API/中转服务，也无法确认 HTTP 状态码或是否为持续故障；没有证据指向 Buzz Relay 或本次模型选择修复。
- 处理：建议稍后重试；若任务执行过文件修改或命令，先核对执行结果再重试。长期使用的会话可通过总结交接后创建新 task 减少上下文压缩负担。持续过载需核对实际请求服务及日志；本轮未修改产品代码或服务配置。
- 验证：读取截图并核对 OpenAI 官方 error-codes 文档，官方将模型临时过载列为可等待后重试的服务错误；未获取故障设备 runtime/API 日志，未复现服务过载。
- 版本/提交：用户截图未显示版本；本条为诊断记录，未生成安装包。

## 2026-10-23：允许其他用户私聊已明确开放权限的 Agent

- 现象/需求：其他用户无法从资料页向另一位用户的 Agent 发起私聊，希望由 Agent 所有者单独控制是否开放。
- 诊断：ACP 已支持 `allow_non_owner_dm`，编辑器也已有本机配置，但公开的 owner 签名 kind:30177 定义没有发布该权限，同账户入站同步也没有应用它；资料页 Message 入口仍只允许所有者使用。Relay 已支持创建私聊及向 Agent 推送新会话成员关系，不需要新增服务端接口。
- 处理：公开投影发布明确的开启/关闭值，同步到同账户配置；仅信任经过 NIP-OA 所有者验证的定义，旧客户端缺省不授予公共私聊权限，入站旧定义不覆盖已有本机设置，未就绪 Agent 不公布开放权限。资料页按该权限开放 Message，保留编辑、语音和记忆管理的原有权限边界。编辑器明确说明允许其他用户私聊及运行中 Agent 需要重启。
- 验证：ACP 私聊权限测试 5/5、Tauri 私聊相关测试 6/6、Agent 目录转换测试 6/6、前端权限 helper 测试 2/2、资料页 Playwright 测试 3/3 通过，覆盖关闭时隐藏 Message、开启后进入正确 Agent 的私聊、最新关闭定义优先于旧开启定义及普通用户快捷操作回归；TypeScript、目标 Biome、文本字号门禁、Rustfmt、E2E build 和 diff 空白检查通过。尚未进行真实双账户消息往返测试；本轮未修改 Relay。
- 版本/提交：Buzz Codex Lab `0.5.21`，功能提交 `cd1d11e8`；缓存构建安装包 [Buzz-Codex-Lab_0.5.21_cd1d11e813b8_x64-setup.exe](D:/BuzzCodexLabRelease/Buzz-Codex-Lab_0.5.21_cd1d11e813b8_x64-setup.exe)，大小 230211195 字节，SHA-256 `469551101707a1de44b3b4e5d2c4d353cdadb4e3627bcdda23c7b1eef9daa061`。安装包未启用 updater 签名。

## 2026-10-23：Codex task Agent 重启后仍持续显示 Restart required

- 现象：Windows Agents 页面中在线的 Codex task Agent 一直显示 Restart required，手动重启后状态仍未清除；截图中 Agent 的 task 模型包含 `gpt-5.6-sol[xhigh]`。
- 诊断：Agent 启动时，Desktop 从设备本地 `CodexTaskBinding.model` 覆盖普通模型配置，并把覆盖后的模型写入实际子进程和启动快照；但 Restart required 的 prospective 快照计算漏了 task binding 覆盖，持续拿普通 persona/instance 模型比较。只要二者不同（例如 `xhigh` 与 `high`），每次重启后的启动值仍会与比较值不同，徽标因此永久存在。此外，新增的 `allow_non_owner_dm` 环境设置此前没有纳入启动快照，无法正确报告这项配置变化。
- 处理：summary 快照比较现在使用与启动相同的 task binding 模型覆盖；启动快照同时记录 `allow_non_owner_dm`，使该设置变更会提示重启、重启应用新值后差异清除。添加了 task 模型一致性和私聊权限漂移回归测试，并将新快照字段加入逐字段 diff 覆盖。
- 验证：专门回归 `task_binding_model_is_used_by_spawn_and_restart_snapshots` 通过；相关快照测试 64 项通过。该测试集合另有 1 项既有 Windows 测试 `no_sentinel_reaches_the_owning_process_debug_output` 因无法启动占位进程（`program not found`）失败，非本次断言或实现导致。尚未在用户设备实测；不涉及 Relay。
- 版本/提交：Buzz Codex Lab `0.5.22`，功能基线 `765e82c8`；发布构建使用本条修复及对应版本更新提交，安装包待本地构建。
