/** 与 db.ts 默认种子「IT技术」下叶子分类 name 完全一致 */
import { STATIC_EXTRA_POSTS_BY_PREFIX } from "./synthetic-it-data-static-extra-posts.js";

export type SyntheticBundle = {
  categoryName: string;
  /** externalKey 前缀，仅字母数字横线 */
  keyPrefix: string;
  posts: {
    title: string;
    html: string;
    comments: { body: string; replies?: string[] }[];
    /** 可选；缺省时 synthetic-it-run.ts 使用 `/uploads/synthetic/{keyPrefix}-{idx}.webp` */
    images?: string[];
    /** 仅 LLM 动态帖使用；静态 bundle 可省略 */
    imageSearchQuery?: string;
  }[];
};

function paras(...lines: string[]) {
  return lines.map((t) => `<p>${t}</p>`).join("\n");
}

/** 将每层顶层评论线程翻倍（追问楼层），与全局扩容口径对齐 */
function commentsDoubled(
  rows: { body: string; replies?: string[] }[],
): { body: string; replies?: string[] }[] {
  const mirror = rows.map((r) => {
    const short = r.body.length > 28 ? `${r.body.slice(0, 28)}…` : r.body;
    return {
      body: `承接上文：关于「${short}」在线上你会先用哪条指标验收？`,
      replies:
        r.replies && r.replies.length > 0
          ? [...r.replies, "还要看灰度窗口与回滚预案是否到位。"]
          : ["我一般会先对齐监控大盘再扩大流量。"],
    };
  });
  return [...rows, ...mirror];
}

/** 内置静态正文（不经 LLM）；由 SYNTHETIC_USE_STATIC_BUNDLE=1 启用。
 * 每个 bundle.posts.length 须与 constraints 中每分类帖子数 16～60 一致。 */
const SYNTHETIC_IT_STATIC_BUNDLES_RAW: SyntheticBundle[] = [
  {
    categoryName: "后端",
    keyPrefix: "be",
    posts: [
      {
        title: "REST 设计与幂等重试",
        html: paras(
          "在 HTTP 语义里，PUT 通常表达「用请求体整体替换目标资源」；PATCH 表达「对资源做部分更新」。两者是否幂等：规范上 PUT 被定义为幂等，重复提交应得到与单次提交一致的资源状态。",
          "PATCH 的实现既可以是幂等的，也可以不是，取决于服务端语义。例如「将计数器加 1」若用 PATCH 表达，天然非幂等；若 PATCH 表达「把邮箱改成某个固定值」，则可实现幂等。",
          "客户端重试时，应配合幂等键（Idempotency-Key）或利用天然幂等的动词与语义，避免重复扣款、重复下单等副作用。银行与支付场景普遍采用「业务流水号 + 服务端去重表」。",
        ),
        comments: [
          {
            body: "如果 PATCH 里用 JSON Merge Patch，字段缺失代表删除吗？",
            replies: [
              "要看 Content-Type 与约定：application/merge-patch+json 按 RFC 7396；若未约定，服务端应在文档里写明「缺失字段」的含义，避免歧义。",
            ],
          },
          { body: "我们用 POST /actions/refund 这种 RPC 风格算反模式吗？" },
        ],
      },
      {
        title: "JWT 结构与校验要点",
        html: paras(
          "JSON Web Token 典型由 Header.Payload.Signature 三段 Base64url 组成。服务端用密钥校验签名后，应信任 Payload 中的 exp（过期时间）与 nbf（生效时间），并校验签发方 aud、iss 是否与当前业务匹配。",
          "JWT 内的声明一旦被签发，在过期前通常无法单方面作废，除非维护黑名单或与会话版本号结合；因此「敏感权限即时收回」场景要谨慎依赖纯 JWT。",
          "浏览器环境下把长期有效的刷新令牌放在 HttpOnly、Secure、SameSite 适当的 Cookie 中，比在 localStorage 存放长期令牌更能降低 XSS 窃取后的影响面（仍需严防 XSS）。",
        ),
        comments: [
          {
            body: "能把用户角色列表全塞进 JWT 吗？",
            replies: [
              "可以但不建议无限膨胀；角色变更要与过期策略或版本号协同，否则容易出现权限滞后。",
            ],
          },
        ],
      },
      {
        title: "数据库连接池与尾延迟",
        html: paras(
          "连接池缓解频繁建连成本，但池上限过高会让数据库同时活跃连接激增，触发上下文切换与锁竞争，尾延迟上升。",
          "经验上先用「压测 + 监控」得到拐点：观察活跃连接、等待队列、P95/P99 查询时间与错误率，再调 pool max。",
          "云托管数据库常有最大连接数配额；多实例服务要把「各实例 pool 之和」控制在配额内并留出管理连接余量。",
        ),
        comments: [{ body: "HikariCP 的 minimumIdle 要不要设成跟 max 一样？" }],
      },
      {
        title: "Redis 穿透击穿雪崩",
        html: paras(
          "缓存穿透：查询根本不存在的数据，缓存无法命中又打到数据库。可用布隆过滤器或缓存空值（短 TTL）拦截热点穿透模式。",
          "缓存击穿：热点键过期瞬间大量请求同时Miss并穿透到数据库。可用互斥重建、逻辑过期、热点键永不过期加异步刷新等策略。",
          "缓存雪崩：大量键在同一时刻过期或 Redis 故障导致流量洪峰压垮数据库。常用随机 TTL 偏移、多级缓存、限流与熔断配合。",
        ),
        comments: [
          {
            body: "缓存空值会不会把 Redis 撑爆？",
            replies: [
              "对不存在键做空值缓存时要限制 key 空间或配合布隆过滤器；恶意构造任意 key 时需网关层限流。",
            ],
          },
        ],
      },
      {
        title: "TraceID 与链路排障",
        html: paras(
          "跨多个服务的调用中，统一生成或透传 trace id（及 span id）能把日志、指标、链路追踪关联到同一用户请求。",
          "常见做法是网关或服务入口生成 W3C Trace Context，随后在 HTTP header（如 traceparent）或消息队列元数据中向下传递。",
          "没有关联 ID 时，线上排障往往只能靠时间窗口近似拼接，成本高且易误判。",
        ),
        comments: [
          {
            body: "OpenTelemetry 和我们自己传 UUID 有什么区别？",
            replies: [
              "OTel 提供标准化语义、采样与多后端导出；自研 UUID 也能工作但生态对接成本高。",
            ],
          },
        ],
      },
      {
        title: "gRPC 与 REST 选型",
        html: paras(
          "gRPC 基于 HTTP/2，常用 Protocol Buffers，适合内部微服务之间高频、强类型的调用，二进制体积小，天然支持流式。",
          "面向公网浏览器或第三方集成时，REST/JSON 更易调试与兼容；gRPC-Web 需要额外网关与工具链。",
          "团队契约演进要特别注意 proto 字段兼容策略（只增不改语义、reserved 废弃字段编号等）。",
        ),
        comments: [{ body: "gRPC deadline 一定要设吗？" }],
      },
      {
        title: "API 版本与弃用策略",
        html: paras(
          "对外 API 通常在路径或 Header 中携带版本号（如 /v1）；破坏性变更应递增主版本或提供并行版本窗口，并在文档中标注弃用时间与迁移指南。",
          "Deprecation 公告可通过响应头或文档给客户预留适配周期；服务端可统计旧版本流量决定是否延长兼容窗口。",
          "内部微服务可用 protobuf package 版本或契约仓库约束；对外 JSON API 更依赖 semver 纪律与清晰的迁移手册。",
        ),
        comments: [
          { body: "Sunset 日期必须写死吗？" },
          {
            body: "兼容层可以永久保留吗？",
            replies: ["成本高且易被遗忘；通常设截止时间并配合监控与告警。"],
          },
        ],
      },
      {
        title: "API 网关限流与熔断",
        html: paras(
          "网关在边缘可做令牌桶或分布式计数限流，保护上游不被突发流量冲垮；应与业务错误区分并返回可预期的 429。",
          "熔断在错误率或延迟超阈值时快速失败，避免级联拖垮；半开探测恢复需要谨慎调参以免抖动。",
          "降级可返回缓存页、静态占位或裁剪功能；须与产品对齐并在监控看板可见当前模式。",
        ),
        comments: [
          {
            body: "限流键用 IP 还是用户 id？",
            replies: ["匿名接口常用 IP 配合指纹；登录态优先用户维度，降低共用 NAT 误伤。"],
          },
        ],
      },
    ],
  },
  {
    categoryName: "前端",
    keyPrefix: "fe",
    posts: [
      {
        title: "Vue3 组合式与类型",
        html: paras(
          "组合式 API 把同一功能的 ref/reactive、方法与生命周期收敛到 setup 或 <script setup> 中，便于按「功能横切」拆出 composable，而不是按选项类型纵向堆积。",
          "TypeScript 下，ref 解包与 props 类型在 <script setup> 中有较好的推导体验；复杂 props 建议用接口定义并在组件外复用。",
          "与选项式并存：迁移期可混用，但长期维护建议在新模块优先组合式以降低巨型组件的理解成本。",
        ),
        comments: [
          {
            body: "watch 和 watchEffect 什么时候选哪个？",
            replies: [
              "需要明确监听源与懒执行时用 watch；依赖自动收集的快速副作用可用 watchEffect。",
            ],
          },
        ],
      },
      {
        title: "浏览器事件循环与渲染",
        html: paras(
          "每个宏任务（如一次脚本执行、setTimeout 回调）结束后，会清空微任务队列（Promise.then、queueMicrotask）。",
          "渲染通常在宏任务与微任务处理后的时机进行（具体调度因浏览器实现略有差异），因此长时间占用主线程会阻塞交互与帧调度。",
          "把重计算拆到 Web Worker 或使用 scheduler.postTask（可用性视浏览器而定）有助于保持首帧与交互响应。",
        ),
        comments: [{ body: "requestAnimationFrame 算宏任务吗？" }],
      },
      {
        title: "CSP 缓解 XSS 风险",
        html: paras(
          "CSP 通过 Content-Security-Policy 响应头限制脚本、样式、图片等资源的来源与执行方式，默认拒绝内联脚本可降低反射型 XSS 的直接执行面。",
          "nonce 或 hash 可在保留必要内联脚本的同时收紧策略；部署时需避免宽泛的 unsafe-inline 长期存在。",
          "CSP 不能替代输入输出编码与框架自动转义；多层防御仍然必要。",
        ),
        comments: [
          {
            body: "report-uri 还在用吗？",
            replies: [
              "推荐迁移到 report-to/reporting API；旧浏览器的 report-uri 仍可能被兼容一段时间。",
            ],
          },
        ],
      },
      {
        title: "Web Vitals 核心指标",
        html: paras(
          "Largest Contentful Paint 衡量视口内最大内容元素渲染时间，反映加载体验的关键感知节点。",
          "Interaction to Next Paint 关注交互后的下一次绘制延迟，更贴近真实卡顿体验（FID 只考察首次输入）。",
          "Cumulative Layout Shift 累计意外布局偏移，图片/广告未预留尺寸是常见来源；width/height 或 aspect-ratio 有助于稳定布局。",
        ),
        comments: [{ body: "实验室数据和实地 RUM 差别很大正常吗？" }],
      },
      {
        title: "TypeScript 严格模式",
        html: paras(
          "开启 strictNullChecks 后，undefined/null 必须显式处理，能在编译期挡住大量「运行时才发现的空引用」。",
          "noImplicitAny 强迫未知类型显式标注或由类型推导给出边界，减少「隐式 any」带来的重构风险。",
          "渐进迁移可行：按目录或按模块打开 strict 子集，配合类型覆盖率指标逐步提高。",
        ),
        comments: [
          {
            body: "TS 类型能在运行时校验吗？",
            replies: ["不能自动；需要 zod/io-ts 等在边界（API 响应）做 runtime schema。"],
          },
        ],
      },
      {
        title: "无障碍与语义化控件说明",
        html: paras(
          "当控件没有可见文本时，aria-label 可提供可访问名称；但若存在可见文本，应避免重复或冲突的可访问名称计算。",
          "键盘可操作性与焦点顺序（tab order）与 ARIA 同等重要；仅靠标签修饰无法替代语义化元素（button、a）。",
          "用自动化规则（axe）辅助扫描，再结合屏幕阅读器抽样验证。",
        ),
        comments: [{ body: "div onClick 模拟按钮最大的问题是什么？" }],
      },
      {
        title: "前端路由 history 选型",
        html: paras(
          "history 模式依赖服务端回退到 index.html，部署时要注意 Nginx/网关 rewrite；hash 模式兼容性更好但 URL 不够简洁。",
          "Vue Router / React Router 均支持 basename，用于子路径部署；切换模式要考虑 SEO 与外链书签。",
          "SSR 与静态导出场景下路由策略会影响构建产物与缓存策略，应在项目初期与运维对齐。",
        ),
        comments: [
          { body: "SPA 首屏 SEO 一定要 SSR 吗？" },
          {
            body: "hash 路由会影响埋点吗？",
            replies: ["不会天然失效，但要确认分析工具监听正确的路由变更事件。"],
          },
        ],
      },
      {
        title: "CSS 架构与维护性",
        html: paras(
          "BEM 通过命名约定降低样式冲突；utility-first 通过原子类加快迭代，但需要团队熟悉设计令牌与 purge 策略。",
          "层叠与特异性战争往往来自全局样式泄漏；CSS Modules、scoped 样式或 Shadow DOM 各有利弊。",
          "设计系统（tokens + 组件库）能把视觉一致性前置到约束层，减少页面级随意覆盖。",
        ),
        comments: [{ body: "Tailwind 会让 HTML 很臃肿吗？" }],
      },
    ],
  },
  {
    categoryName: "Android",
    keyPrefix: "and",
    posts: [
      {
        title: "Activity 生命周期简述",
        html: paras(
          "典型 Activity 会经历 onCreate → onStart → onResume；进入后台走 onPause/onStop；销毁走 onDestroy（不一定总在屏幕旋转时销毁，取决于配置）。",
          "默认情况下配置变更可能导致 Activity 重建；可用 ViewModel 保存 UI 相关状态，持久数据仍建议落库或用 SavedStateHandle 适度保存。",
          "AndroidManifest 中 configChanges 可以减少重建，但要确认你真的想自行处理配置更新而非禁用框架默认流程。",
        ),
        comments: [
          {
            body: "ViewModel 能持有 Context 吗？",
            replies: [
              "不要持有 Activity Context；可用 ApplicationContext，或借助 AndroidViewModel。",
            ],
          },
        ],
      },
      {
        title: "Kotlin 协程调度器",
        html: paras(
          "Dispatchers.Main 适合轻量 UI 相关逻辑或与 UI 框架交互；耗时 IO 用 Dispatchers.IO；CPU 密集计算倾向 Dispatchers.Default。",
          "withContext 切换调度器而不是阻塞线程；避免在 Main 上执行重度计算导致掉帧。",
          "结构化并发：使用 supervisorScope 或 SupervisorJob 控制子协程失败是否在粒度上向上传播。",
        ),
        comments: [{ body: "GlobalScope 为什么常被 lint 警告？" }],
      },
      {
        title: "Compose 重组直觉解释",
        html: paras(
          "Compose 在状态变化时可能重新执行 Composable 函数以更新界面；无副作用的计算应尽量快速，副作用放到 LaunchedEffect/SideEffect 等可控位置。",
          "remember 用于在重组之间保持实例；mutableStateOf 变化会触发相应范围的重组。",
          "列表场景使用稳定的 key（如 LazyColumn items(key = ...)）有助于定位变更、减少不必要重组。",
        ),
        comments: [{ body: "Modifier.clickable 里启动网络请求可以吗？" }],
      },
      {
        title: "R8 混淆与反射序列化",
        html: paras(
          "代码收缩可能移除「看似未使用」但通过反射访问的类与方法；需要在规则文件中 keep 相应符号，或为 Gson/Moshi 等配置保留策略。",
          "混淆会重命名类成员；若 JNI 或插件协议依赖稳定符号名，同样要 keep。",
          "发布构建务必对混淆产物做冒烟测试，而非仅在 debug 验证功能。",
        ),
        comments: [{ body: "Resource shrinking 会把动态加载的图片删掉吗？" }],
      },
      {
        title: "Android 权限请求时机",
        html: paras(
          "危险权限应在「用户能理解为何需要」的时机请求；首次冷启动连环弹窗会降低授权率与评分。",
          "shouldShowRequestPermissionRationale 可帮助判断是否需要在 UI 上解释用途再跳转设置页。",
          "权限被拒后的降级路径（功能不可用提示）应清晰，而不是静默失败。",
        ),
        comments: [{ body: "分区存储 scoped storage 对文件读写有什么影响？" }],
      },
      {
        title: "RecyclerView 复用要点",
        html: paras(
          "ViewHolder 缓存 itemView 与子视图引用，避免 findViewById 在滚动时重复遍历层级，降低滚动卡顿与 GC 压力。",
          "DiffUtil 可在数据集变更时计算最小更新集合，配合 ListAdapter 提交列表更高效。",
          "过度绘制与布局层级仍需要 ConstraintLayout/merge 等手段协同优化。",
        ),
        comments: [{ body: "GridLayoutManager 可以跨列吗？" }],
      },
      {
        title: "WorkManager 后台任务",
        html: paras(
          "WorkManager 面向需要可靠执行且可推迟的后台任务（如同步、清理）；系统会根据省电策略与网络约束调度执行，而非即时 Guarantee。",
          "与前台 Service、JobScheduler 相比，WorkManager 提供更统一的链式任务与重试语义；但仍要注意重复入队和幂等设计。",
          "约束条件（网络、电量、存储）应在业务可接受范围内声明，否则任务长期积压会影响体验与数据新鲜度。",
        ),
        comments: [
          {
            body: "能用 WorkManager 做实时推送吗？",
            replies: ["不适合；推送仍依赖 FCM 与系统通道，WM 用于收尾与补偿更合适。"],
          },
        ],
      },
      {
        title: "Material 主题与深色模式",
        html: paras(
          "MaterialTheme 与 DayNight 可帮助应用在浅色/深色间切换；颜色应来源于语义色板而非硬编码十六进制散落各处。",
          "向量图标与适量阴影在深色背景下对比度需单独校验；动态主题（Material You）还要考虑用户壁纸取色。",
          "WebView 与第三方 SDK 若未适配深色，可能出现刺眼反差；必要时隔离容器或强制浅色兜底。",
        ),
        comments: [{ body: "强制深色要不要跟系统走？" }],
      },
    ],
  },
  {
    categoryName: "iOS",
    keyPrefix: "ios",
    posts: [
      {
        title: "Swift 异步并发直觉",
        html: paras(
          "async 函数可在挂起点切换执行上下文；默认 actor 隔离规则保证 UI 相关代码在主 actor 上更新界面（SwiftUI/UIKit 场景）。",
          "不要用 sleep 阻塞线程等待异步结果；应使用 await 表达挂起，让运行时调度其他任务。",
          "Task 的生命周期需结合取消（Task.checkCancellation）与结构化并发（async let、task group）管理，避免泄漏长任务。",
        ),
        comments: [
          {
            body: "Task.detached 什么时候需要？",
            replies: [
              "需要明确脱离当前 actor 上下文运行隔离代码时；但要谨慎处理线程安全与取消传递。",
            ],
          },
        ],
      },
      {
        title: "UIKit 视图生命周期",
        html: paras(
          "loadView/viewDidLoad 负责视图构建与一次性初始化；viewWillAppear/viewDidAppear 在展示前后触发，可能多次调用。",
          "viewWillLayoutSubviews/viewDidLayoutSubviews 在布局变化时调用，适合依赖最终 frame 的约束更新（仍需避免过度布局）。",
          "内存警告时应释放可重建的大缓存；持久状态交给模型层管理。",
        ),
        comments: [{ body: "viewDidLoad 里发起网络请求可以吗？" }],
      },
      {
        title: "Swift ARC 与循环引用",
        html: paras(
          "闭包捕获 self 容易造成引用循环；使用 [weak self] 或在生命周期明确时用 unowned（确认不会变为悬空引用）。",
          "delegate 协议属性常用 weak var 避免双向强引用。",
          "计时器、通知观察者等注册对象需要在适当时机 invalidate/remove，否则延迟释放甚至崩溃。",
        ),
        comments: [
          {
            body: "unowned 比 weak 性能更好吗？",
            replies: ["略微减少可选开销，但错误使用会导致运行时崩溃；默认优先 weak。"],
          },
        ],
      },
      {
        title: "URLSession 与 ATS",
        html: paras(
          "对 DataTask 调用 cancel 会触发错误回调；调用方应区分用户取消与真实网络错误（可用 URLError.cancelled）。",
          "大文件下载可使用下载任务并配合后台会话配置；要注意 identifier 与持久化恢复。",
          "ATS（App Transport Security）要求 HTTPS 例外需在 Info.plist 明确声明并限定域名。",
        ),
        comments: [{ body: "GET 请求可以把敏感参数放 query 吗？" }],
      },
      {
        title: "SwiftUI 状态包装选型",
        html: paras(
          "@State 适合值类型视图私有状态；引用类型且需要跨子视图共享时用 ObservableObject 配合 @StateObject/@ObservedObject。",
          "父视图传入 @ObservedObject 时，实例应由父持有以保证生命周期；否则子视图重建可能导致对象反复创建。",
          "性能敏感列表使用 Lazy 容器与 Identifiable 稳定标识，避免不必要的整表刷新。",
        ),
        comments: [{ body: "@EnvironmentObject 找不到时会怎样？" }],
      },
      {
        title: "隐私清单与权限字符串",
        html: paras(
          "访问相机、相册、定位等敏感能力需要在 Info.plist 提供用途说明字符串；缺失会导致审核拒绝或运行时崩溃。",
          "隐私清单（Privacy Manifest）帮助声明收集的数据类型与 SDK 行为，遵守平台合规要求。",
          "最小化采集：只请求业务必需的权限与数据字段，并在产品内解释用途，有助于建立信任。",
        ),
        comments: [{ body: "ATT 弹窗一定要首发就出现吗？" }],
      },
      {
        title: "Combine 与异步背压",
        html: paras(
          "Combine 将异步事件建模为 Publisher/Subscriber 链路；背压在此生态中不如 RxJava 显式，通常通过缓冲策略与丢弃策略在运算符层消化。",
          "UIKit 集成时注意线程 hops：接收 UI 更新应切换到主调度器；长时间映射应避免阻塞下游。",
          "与 async/await Interop 可用 Continuations 封装；团队应统一「何时 Combine、何时结构化并发」的边界。",
        ),
        comments: [
          { body: "Combine 会泄漏吗？" },
          {
            body: "AnyCancellable 要特意持有吗？",
            replies: ["订阅需要保存在生命周期容器内；丢失会导致链路取消或过早结束。"],
          },
        ],
      },
      {
        title: "Keychain 存令牌要点",
        html: paras(
          "访问级别决定令牌是否在设备锁定时可读；更高安全性伴随可用性折衷，业务要能解释取舍。",
          "与 Face ID/Touch ID 结合可使用访问控制标志保护敏感项；失败回退路径要清晰避免用户锁死。",
          "迁移到新容器或账号体系时要考虑旧数据清理；遗留令牌可能成为换新设备后的幽灵会话。",
        ),
        comments: [{ body: "Keychain 和 UserDefaults 怎么选？" }],
      },
    ],
  },
  {
    categoryName: "人工智能",
    keyPrefix: "ai",
    posts: [
      {
        title: "监督学习与无监督简介",
        html: paras(
          "监督学习使用带标签的数据优化模型，使预测接近给定标签；典型任务包括分类与回归。",
          "无监督学习在无标签数据上寻找结构，例如聚类、降维与密度估计；评价指标与任务定义更依赖业务解读。",
          "半监督与自监督介于两者之间：利用大量无标签数据构造辅助任务或伪标签以提升下游表现。",
        ),
        comments: [
          {
            body: "聚类结果如何和业务对齐？",
            replies: ["用轮廓系数等内部指标外，还需要抽样人工校验簇语义是否可运营。"],
          },
        ],
      },
      {
        title: "过拟合验证集与测试集",
        html: paras(
          "过拟合表现为训练误差很低但验证/测试误差升高，模型对训练分布的细节过度记忆。",
          "常用缓解手段包括更多代表性数据、正则化（L2/L1）、早停（early stopping）、dropout（深度学习）、简化模型容量等。",
          "验证集用于调参与模型选择，测试集仅用于最终客观评估，避免信息泄漏导致乐观偏差。",
        ),
        comments: [
          {
            body: "数据增强算正则化吗？",
            replies: ["广义上通过扩大有效训练分布减轻过拟合；与传统权重正则互补。"],
          },
        ],
      },
      {
        title: "Transformer 注意力直觉",
        html: paras(
          "对每个位置，模型学习一组查询（Q）去和其它位置的键（K）匹配得到权重，再对值（V）加权求和，形成上下文相关的表示。",
          "多头注意力并行多个子空间匹配，提升表达能力；缩放因子 √d_k 防止点积过大导致 softmax 饱和。",
          "这不是严格意义上的「记忆检索」，而是可学习的相似度加权聚合机制。",
        ),
        comments: [
          {
            body: "自注意力复杂度为什么是序列长度的平方？",
            replies: ["两两位置配对计算权重；长序列场景需要稀疏注意力、分块、线性注意力等改进。"],
          },
        ],
      },
      {
        title: "深层网络梯度与归一化",
        html: paras(
          "深层网络反向传播时梯度连乘，激活与权重尺度不当会导致梯度趋近零（消失）或指数放大（爆炸）。",
          "合适的权重初始化（如 Xavier/He）与归一化层（BatchNorm/LayerNorm）有助于稳定信号尺度。",
          "梯度裁剪（gradient clipping）可抑制爆炸；残差连接也有助于梯度路径更顺畅。",
        ),
        comments: [
          {
            body: "LayerNorm 放在子层前还是后？",
            replies: [
              "常见 Pre-LN 与 Post-LN 两种范式；具体架构（如 Transformer 变体）有论文约定。",
            ],
          },
        ],
      },
      {
        title: "精度召回与不均衡分类",
        html: paras(
          "精确率（Precision）关注预测为正的样本中有多少真阳性；召回率（Recall）关注真实阳性中被找出的比例。",
          "类别极不均衡时，高准确率可能毫无意义；需要结合 PR 曲线、F1、分层抽样与代价敏感学习。",
          "阈值调整可权衡 Precision-Recall；业务上要明确「漏检」与「误报」哪种代价更高。",
        ),
        comments: [
          {
            body: "AUC-ROC 在不均衡下够用吗？",
            replies: ["可辅助，但 PR-AUC 有时更敏感；务必配合业务指标。"],
          },
        ],
      },
      {
        title: "神经网络推理与模型压缩",
        html: paras(
          "量化（INT8/FP16）、剪枝与蒸馏可在精度轻微损失下降低算力与内存占用。",
          "蒸馏让小模型模仿大模型的软标签或中间特征，常用于部署侧替代超大模型。",
          "工程上还需算子融合、批处理与硬件加速器 Runtime 协同优化端到端延迟。",
        ),
        comments: [
          { body: "蒸馏一定能变小吗？", replies: ["不保证；学生容量过小或任务不匹配时差距会大。"] },
        ],
      },
      {
        title: "数据标注质检与主动学习",
        html: paras(
          "错误标签会直接误导监督信号；质检、多人标注与置信度筛选是常见降噪手段。",
          "主动学习优先让人标注模型最不确定的样本，可在固定标注预算下提升效益（概念层面）。",
          "长尾类别更需要分层抽样与硬例挖掘，否则指标会被头部类别平均掩盖。",
        ),
        comments: [
          {
            body: "标注一致性用什么指标？",
            replies: ["Cohen's kappa 等；也要结合业务规则校验边界案例。"],
          },
        ],
      },
      {
        title: "深度学习模型线上监控",
        html: paras(
          "线上需跟踪延迟、错误率与输出分布偏移；概念漂移意味着输入与标签关系随时间变化，离线验证集可能过时。",
          "数据漂移监控可看特征分布与缺失率突变；触发阈值后应回流标注或触发再训练流程。",
          "影子部署与小流量金丝雀有助于在真实负载下比较新旧模型，再放大流量降低风险。",
        ),
        comments: [{ body: "漂移一定要用因果推断吗？" }],
      },
    ],
  },
  {
    categoryName: "数据库",
    keyPrefix: "db",
    posts: [
      {
        title: "InnoDB B+树范围扫描",
        html: paras(
          "聚簇索引叶子节点存放完整行数据（约定俗成说法），二级索引叶子通常存主键指针；B+树叶子链表便于顺序扫描。",
          "范围查询在叶子有序链表上移动比哈希索引更符合磁盘顺序读特性（抽象层面）。",
          "设计复合索引列顺序时，要把高选择性或最常用于等值条件的列靠前，并兼顾排序需求。",
        ),
        comments: [
          {
            body: "主键用 UUID 有什么问题？",
            replies: ["随机插入可能导致页分裂与缓冲池局部性差；可用有序 UUID 方案缓解。"],
          },
        ],
      },
      {
        title: "数据库隔离级别与异常",
        html: paras(
          "读未提交几乎不使用；读已提交避免脏读；可重复读避免不可重复读（MySQL InnoDB 默认级别下配合 MVCC 行为需结合实际引擎）。",
          "串行化最强隔离但并发度最低；绝大多数 OLTP 在 RC 或 RR 之间权衡。",
          "幻读在标准定义中指同一事务两次范围查询记录集合不一致；不同引擎实现细节不同，需要用文档与实验验证。",
        ),
        comments: [{ body: "SELECT FOR UPDATE 能解决所有并发问题吗？" }],
      },
      {
        title: "MySQL 覆盖索引简述",
        html: paras(
          "当查询所需列全部出现在某个二级索引条目中，引擎可能无需回表即可返回结果，这类索引称为覆盖索引。",
          "Extra 中出现 Using index（MySQL EXPLAIN）常提示覆盖扫描路径（仍需对照版本与优化器行为）。",
          "索引列过多会增大写入成本与存储占用，需要权衡查询收益。",
        ),
        comments: [
          {
            body: "回表代价主要在哪？",
            replies: ["随机读主键聚簇页；高选择性范围扫描若大量回表可能成为瓶颈。"],
          },
        ],
      },
      {
        title: "慢查询分析与 EXPLAIN",
        html: paras(
          "先找出耗时与扫描行数异常的 SQL；再用 EXPLAIN（或 ANALYZE）查看访问类型（type）、索引使用（key）、过滤比例（rows 估算）。",
          "关注是否出现全表扫描、filesort、temporary；必要时调整索引或改写查询（避免对索引列做函数包裹）。",
          "统计信息过期会导致优化器选错索引；定期 ANALYZE（按引擎文档）有助于稳定计划。",
        ),
        comments: [
          {
            body: "force index 可以长期使用吗？",
            replies: ["应急可用；长期应回到统计信息与模型修正。"],
          },
        ],
      },
      {
        title: "主从复制延迟与一致性",
        html: paras(
          "异步复制下从库可能滞后；读后立刻读场景若路由到从库，可能读到旧数据造成业务困惑。",
          "可用会话一致性策略：关键读走主库、因果一致性标记、或在写入链路附带版本校验。",
          "监控 Seconds_Behind_Master（概念随版本变化）与复制并行线程状况，提前扩容与拆分热点。",
        ),
        comments: [{ body: "半同步复制能解决延迟吗？" }],
      },
      {
        title: "数据库范式化与反范式",
        html: paras(
          "高范式减少冗余与异常更新，但关联增多；适度反范式（冗余计数、宽表）可降低热点查询的连接成本。",
          "决策应基于访问模式、一致性约束与变更频率；日志型与分析型负载常有不同答案。",
          "变更频繁的冗余字段需要可靠的单写入口或补偿事务，避免多处手工更新出错。",
        ),
        comments: [{ body: "宽表还能叫 OLTP 吗？" }],
      },
      {
        title: "MySQL 读写分离与会话",
        html: paras(
          "中间件或驱动层可把读请求路由到从库，写请求落到主库；会话一致性要求「写后读」时需谨慎路由回主。",
          "延迟监控应绑定到业务 SLA：复制滞后过大时要熔断读副本或提示用户数据可能非最新。",
          "分库分表后读写分离规则更复杂，要避免跨片事务在不具备协调机制时被 silent 破坏。",
        ),
        comments: [
          {
            body: "强制读主会不会压垮主库？",
            replies: ["热点读可考虑缓存层或短暂一致性降级策略，并扩容读链路。"],
          },
        ],
      },
      {
        title: "MySQL 分区表与归档",
        html: paras(
          "RANGE/LIST 分区可把冷热数据在物理上隔离，便于归档与删除分区而非大范围 DELETE。",
          "分区裁剪依赖查询条件命中分区键；写错条件会导致扫描全部子分区失去收益。",
          "DDL 变更（新增分区、合并）要在低峰执行并做好备份；统计信息需跟随分区维护更新。",
        ),
        comments: [{ body: "分区越多越好吗？" }],
      },
    ],
  },
  {
    categoryName: "程序开发",
    keyPrefix: "dev",
    posts: [
      {
        title: "语义化版本 SemVer",
        html: paras(
          "MAJOR：不兼容的 API 变更；MINOR：向后兼容的功能新增；PATCH：向后兼容的问题修复。",
          "0.y.z 常用于不稳定初始阶段；预发布版本可用 -alpha、-rc 等标记。",
          "客户端依赖解析（npm/cargo 等）常与 semver 范围语法结合；发布方应遵守契约避免「破坏性 MINOR」引发供应链事故。",
        ),
        comments: [
          {
            body: "Lockfile 与 semver 范围矛盾吗？",
            replies: ["范围指导兼容边界；lockfile 固化实际解析结果以便可复现构建。"],
          },
        ],
      },
      {
        title: "Git 合并与变基取舍",
        html: paras(
          "merge 保留分叉历史，产生合并提交；适合公共分支保留真实协作痕迹。",
          "rebase 将提交序列「挪到」新的基底之上，历史更线性；适合尚未推送或个人分支整理，但要避免重写他人已基于其上开发的提交。",
          "黄金法则：不要对多人共享且已被依赖的历史做强制改写，除非团队有明确流程与沟通。",
        ),
        comments: [
          {
            body: "rebase 会影响 blame 吗？",
            replies: ["可能改变提交哈希与作者时间戳呈现；团队需统一约定。"],
          },
        ],
      },
      {
        title: "CI 分层测试与缓存",
        html: paras(
          "快速反馈环：lint、单元测试先行；集成/E2E 可后置并行；失败早停节省资源。",
          "依赖安装与构建产物缓存（pnpm store、Docker layer）显著缩短流水线时间，但要校验缓存键包含锁文件版本。",
          "流水线也应版本化（pipeline as code），变更可审计与回滚。",
        ),
        comments: [{ body: "flaky test 在 CI 里怎么处理？" }],
      },
      {
        title: "高效代码评审沟通要点",
        html: paras(
          "先肯定意图与上下文，再指出具体问题；评论绑定到行号并给出可操作建议或示例。",
          "区分阻塞性问题（正确性、安全、性能瓶颈）与风格偏好（交给格式化工具与 lint）。",
          "小批量提交更易评审；巨型 PR 增加遗漏风险与合并冲突概率。",
        ),
        comments: [
          {
            body: "LGTM 可以直接合并吗？",
            replies: ["视分支保护与测试门禁而定；主干开发通常要求绿色流水线。"],
          },
        ],
      },
      {
        title: "渐进式特性开关与配置",
        html: paras(
          "Feature flag 把「部署」与「发布」解耦：新版本可先上线默认关闭，按人群灰度打开。",
          "需要观测指标与自动回滚策略配合；开关长期堆积会变成技术债，应定期清理。",
          "服务端与客户端开关一致性要考虑缓存与同步延迟。",
        ),
        comments: [
          {
            body: "kill switch 算特性开关吗？",
            replies: ["算运营类开关；要确保权限与审计，避免误触全局下线。"],
          },
        ],
      },
      {
        title: "结构化日志与字段设计",
        html: paras(
          "JSON 一行一日志便于日志平台索引字段（trace_id、user_id、status）而非正则解析。",
          "级别（info/warn/error）与错误码字段帮助告警聚合；堆栈应单独字段而非混入消息难以检索。",
          "敏感信息（令牌、证件）必须脱敏或禁止输出。",
        ),
        comments: [
          {
            body: "printf 风格日志可以结构化吗？",
            replies: ["可以封装门面输出 JSON；关键是字段稳定而不是格式花哨。"],
          },
        ],
      },
      {
        title: "契约测试与消费者 CDC",
        html: paras(
          "契约测试验证消费者与提供者对消息/接口形状的共识；消费者驱动契约（CDC）由调用方定义期望，提供者 CI 中验证兼容。",
          "适用于微服务间频繁演进的 API 与事件 schema；可减少集成环境才发现的破坏性变更。",
          "契约仓库应与版本控制联动；废弃字段要有明确的兼容窗口与沟通流程。",
        ),
        comments: [{ body: "契约测试能替代 E2E 吗？" }],
      },
      {
        title: "制品库与依赖漏洞扫描",
        html: paras(
          "私有 npm/Maven 仓库提供可追溯的制品来源与缓存；与 SBOM 生成配合可满足合规审计。",
          "流水线中的漏洞扫描（SCA）应在合并前阻断高危 CVE；同时要评估误报与许可证冲突。",
          "锁定版本与定期升级窗口能降低供应链攻击面；忽略漏洞要有风险评估记录而非口头默契。",
        ),
        comments: [
          {
            body: "扫描很慢怎么办？",
            replies: ["分层缓存结果、增量扫描变更依赖；严重级别阈值分层门禁。"],
          },
        ],
      },
    ],
  },
];

export const SYNTHETIC_IT_STATIC_BUNDLES: SyntheticBundle[] = SYNTHETIC_IT_STATIC_BUNDLES_RAW.map(
  (b) => ({
    categoryName: b.categoryName,
    keyPrefix: b.keyPrefix,
    posts: [
      ...b.posts.map((p) => ({ ...p, comments: commentsDoubled(p.comments) })),
      ...(STATIC_EXTRA_POSTS_BY_PREFIX[b.keyPrefix] ?? []),
    ],
  }),
);
