/** 与 db.ts 默认种子「IT技术」下叶子分类 name 完全一致；topics 供大模型扩写成正文与评论 */
export type CategoryOutline = {
  categoryName: string;
  /** externalKey 前缀：字母数字 */
  keyPrefix: string;
  topics: string[];
};

export const SYNTHETIC_IT_OUTLINES: CategoryOutline[] = [
  {
    categoryName: "后端",
    keyPrefix: "be",
    topics: [
      "REST 接口设计：PUT/PATCH 语义、幂等与客户端重试",
      "JWT：签名校验、过期与吊销难点；Cookie 存令牌与 XSS 关系简述",
      "服务端数据库连接池容量与尾延迟、云数据库连接数配额",
      "Redis：缓存穿透、击穿、雪崩的含义与常见对策",
      "分布式 tracing：trace id / span 在跨服务排障中的作用",
      "gRPC 与 REST 的典型选型场景与契约演进注意点",
    ],
  },
  {
    categoryName: "前端",
    keyPrefix: "fe",
    topics: [
      "Vue 3 Composition API 与 composable 复用思路",
      "浏览器事件循环：宏任务、微任务与渲染调度（概念）",
      "内容安全策略 CSP 如何减轻 XSS 风险（概念）",
      "Web Vitals：LCP、INP、CLS 含义（面向体验指标）",
      "TypeScript strictNullChecks / noImplicitAny 的工程收益",
      "无障碍：语义化控件与 aria 的常见误区",
    ],
  },
  {
    categoryName: "Android",
    keyPrefix: "and",
    topics: [
      "Activity 生命周期与屏幕旋转时的状态保存思路",
      "Kotlin 协程 Dispatcher 选择与结构化并发简介",
      "Jetpack Compose 重组（recomposition）直觉解释",
      "R8/ProGuard：混淆、裁剪与反射/序列化的注意点",
      "Android 运行时权限：请求时机与 rationale",
      "RecyclerView ViewHolder 与 DiffUtil 的目的",
    ],
  },
  {
    categoryName: "iOS",
    keyPrefix: "ios",
    topics: [
      "Swift async/await 与主线程/Actor 的基本心智模型",
      "UIViewController 生命周期钩子在何时做事更合适",
      "ARC：循环引用与 weak/unowned 的选择",
      "URLSession：取消请求与 ATS（HTTPS）注意点",
      "SwiftUI：@State、@StateObject、@ObservedObject 易混点",
      "隐私清单与敏感权限说明文案的重要性（合规视角）",
    ],
  },
  {
    categoryName: "人工智能",
    keyPrefix: "ai",
    topics: [
      "监督学习 / 无监督学习 / 半监督与自监督的概念分界",
      "过拟合、验证集与测试集的角色；常见缓解手段",
      "Transformer 自注意力机制的直观解释（不写臆造公式推导）",
      "梯度消失/爆炸与初始化、归一化的关系（概念）",
      "精度、召回率与不均衡分类的阅读方式",
      "推理延迟与量化、蒸馏等压缩路径（概念）",
    ],
  },
  {
    categoryName: "数据库",
    keyPrefix: "db",
    topics: [
      "InnoDB B+树索引为什么常用范围扫描（直觉）",
      "事务隔离级别与脏读、不可重复读、幻读（教材定义层面）",
      "覆盖索引（covering index）是什么",
      "慢查询与 EXPLAIN：从哪里下手排查",
      "主从复制延迟带来的「读后读」一致性风险",
      "范式化与反范式化的工程权衡",
    ],
  },
  {
    categoryName: "程序开发",
    keyPrefix: "dev",
    topics: [
      "语义化版本 SemVer：MAJOR.MINOR.PATCH",
      "Git merge 与 rebase 的典型适用场景",
      "CI：分层测试与缓存制品缩短反馈环",
      "代码评审：区分阻塞问题与风格偏好",
      "特性开关（feature flag）与渐进发布",
      "结构化日志相对纯文本排障的优势",
    ],
  },
];
