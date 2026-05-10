import {
  assertSyntheticPostLengths,
  htmlPlainExcerpt,
  SYNTHETIC_COMMENT_REPLIES_MAX_PER_THREAD,
  SYNTHETIC_COMMENTS_TOPLEVEL_MAX,
  SYNTHETIC_COMMENTS_TOPLEVEL_MIN,
  SYNTHETIC_HTML_MAX_LEN,
  SYNTHETIC_HTML_MIN_LEN,
  SYNTHETIC_TITLE_MAX_LEN,
  SYNTHETIC_TITLE_MIN_LEN,
} from "./synthetic-it-constraints.js";

export type GeneratedPost = {
  title: string;
  html: string;
  comments: { body: string; replies?: string[] }[];
  /** 英文 stock 检索短语，须与正文主题一致 */
  imageSearchQuery: string;
};

function stripCodeFence(raw: string) {
  const s = raw.trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m?.[1]?.trim() ?? s;
}

function stripUnsafeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/<img\b[\s\S]*?>/gi, "");
}

const IMAGE_QUERY_MIN = 8;
const IMAGE_QUERY_MAX = 160;

function normalizeImageSearchQuery(raw: unknown, fallbackPlainExcerpt: string): string {
  const q =
    typeof raw === "string" ? raw.trim() : fallbackPlainExcerpt.slice(0, IMAGE_QUERY_MAX).trim();
  const asciiish = /^[\x20-\x7e]+$/.test(q);
  if (!asciiish || q.length < IMAGE_QUERY_MIN || q.length > IMAGE_QUERY_MAX) {
    const fb = fallbackPlainExcerpt
      .replace(/[^\x20-\x7ea-zA-Z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, IMAGE_QUERY_MAX);
    const padded =
      fb.length >= IMAGE_QUERY_MIN
        ? fb
        : `software developer technology ${fb}`.trim().slice(0, IMAGE_QUERY_MAX);
    if (padded.length < IMAGE_QUERY_MIN) {
      throw new Error("无法构造合规 imageSearchQuery，请检查正文或过短摘要");
    }
    return padded;
  }
  return q.slice(0, IMAGE_QUERY_MAX);
}

function normalizeGenerated(raw: unknown): GeneratedPost {
  if (!raw || typeof raw !== "object") {
    throw new Error("模型输出不是 JSON 对象");
  }
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const htmlRaw = typeof o.html === "string" ? o.html.trim() : "";
  const html = stripUnsafeHtml(htmlRaw);

  assertSyntheticPostLengths(title, html);

  const commentsIn = o.comments;
  if (!Array.isArray(commentsIn)) {
    throw new Error("comments 须为数组");
  }
  if (
    commentsIn.length < SYNTHETIC_COMMENTS_TOPLEVEL_MIN ||
    commentsIn.length > SYNTHETIC_COMMENTS_TOPLEVEL_MAX
  ) {
    throw new Error(
      `comments 数量须在 ${SYNTHETIC_COMMENTS_TOPLEVEL_MIN}～${SYNTHETIC_COMMENTS_TOPLEVEL_MAX} 条之间`,
    );
  }

  const comments: GeneratedPost["comments"] = [];
  for (const c of commentsIn) {
    if (!c || typeof c !== "object") throw new Error("评论项格式错误");
    const row = c as Record<string, unknown>;
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!body || body.length > 5000) throw new Error("评论 body 非法");
    let replies: string[] | undefined;
    if (row.replies !== undefined) {
      if (!Array.isArray(row.replies)) throw new Error("replies 须为数组");
      replies = row.replies.map((x) => String(x).trim()).filter(Boolean);
      if (replies.length > SYNTHETIC_COMMENT_REPLIES_MAX_PER_THREAD)
        throw new Error("单条评论回复过多");
      for (const r of replies) {
        if (r.length > 5000) throw new Error("回复过长");
      }
      if (replies.length === 0) replies = undefined;
    }
    comments.push({ body, replies });
  }

  const excerpt = htmlPlainExcerpt(html, 400);
  const imageSearchQuery = normalizeImageSearchQuery(o.imageSearchQuery, excerpt);

  return { title, html, comments, imageSearchQuery };
}

async function chatCompletionJson(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  useJsonObjectMode: boolean;
  maxTokens: number;
  temperature?: number;
}): Promise<string> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.42,
    max_tokens: opts.maxTokens,
  };
  if (opts.useJsonObjectMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${JSON.stringify(j)}`);
  }
  const choices = j.choices as { message?: { content?: string } }[] | undefined;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`LLM 响应缺少 content: ${JSON.stringify(j)}`);
  }
  return content;
}

/**
 * 调用 OpenAI 兼容 Chat Completions，生成一篇帖子与嵌套评论（JSON）。
 */
export async function generateTechPost(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  categoryName: string;
  topicHint: string;
  useJsonObjectMode: boolean;
  maxTokens: number;
  /** 采样温度；默认约 0.42，兼顾准确与自然。可通过环境变量 SYNTHETIC_LLM_TEMPERATURE 覆盖（仅 Node 进程内读取）。 */
  temperature?: number;
}): Promise<GeneratedPost> {
  const temperature =
    params.temperature ??
    (() => {
      const raw =
        typeof process !== "undefined" ? process.env.SYNTHETIC_LLM_TEMPERATURE : undefined;
      if (raw === undefined || raw === "") return 0.42;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : 0.42;
    })();

  const system = [
    "你是经验丰富的中文开发者兼社区作者：帖子标题与正文全部由你即时撰写；目标是「事实可靠 + 行文像真人随手写的技术笔记」，而不是百科条目或营销软文。",
    "",
    "【准确性 — 必须遵守】",
    "- 只陈述教材级、RFC/官方文档常见表述或业界共识；禁止编造论文标题、法规条文、虚构产品发布、虚构版本与日期、虚构 benchmark 或精确统计数据。",
    "- 具体行为若依语言/框架/数据库版本或厂商而异，须用「通常」「多数情况下」「视版本与配置而定」「建议查当前官方文档」等留白，勿写成单一绝对结论。",
    "- 不要为了凑字数捏造「某公司曾遇到」类案例细节；可写抽象场景但不捏造实体名称与情节。",
    "",
    "【文风 — 像真人】",
    "- 简体中文，标点与长短句错落有致；可适当用「其实」「说白了」「我一般会」「顺带一提」等自然衔接，避免全文堆砌四字成语与排比。",
    "- 少用 AI 套话与空话：避免滥用「综上所述」「值得注意的是」「在当今数字化时代」「总而言之」以及机械的「首先…其次…最后…」骨架文。",
    "- 正文以连贯 <p> 段落展开论述为主，必要时用 <ul><li> 列要点；避免整篇只剩短句清单像幻灯片。",
    "- 标题要像开发者真会起的：简洁、准确、略带切入点，禁止标题党或与正文不符。",
    "",
    "【评论互动 — 像真实读者】",
    "- comments 里顶层回复要像论坛读者：口语一点，可有追问、补充或温和质疑；不要过于工整对仗、不要太像同一模板复制。",
    "",
    "【输出格式】",
    "1）单个 JSON 对象，不要 Markdown，不要额外解释。",
    "2）字段：title（简体中文）；html（富文本：<p>、<ul><li>、<strong>、<em>、<code>、<pre>、<blockquote>、<h2>/<h3>；禁止 script/iframe/on*；禁止 <img>）；comments（数组）；imageSearchQuery（仅英文与空格，供配图检索）。",
    `3）comments：每条 body；可选 replies（对该条的回复，每条至多 ${SYNTHETIC_COMMENT_REPLIES_MAX_PER_THREAD} 条）。顶层评论至少 ${SYNTHETIC_COMMENTS_TOPLEVEL_MIN} 条、至多 ${SYNTHETIC_COMMENTS_TOPLEVEL_MAX} 条。`,
    `4）title 长度 ${SYNTHETIC_TITLE_MIN_LEN}～${SYNTHETIC_TITLE_MAX_LEN}（trim 后）；html ${SYNTHETIC_HTML_MIN_LEN}～${SYNTHETIC_HTML_MAX_LEN}（trim 后，含标签）。`,
    `5）imageSearchQuery：${IMAGE_QUERY_MIN}～${IMAGE_QUERY_MAX} 字符英文短语，紧扣正文真实主题；抽象概念转成可拍摄场景（如 developer reviewing logs）；禁止泛泛的 “technology computer”。`,
  ].join("\n");

  const user = [
    `分类（叶子）：${params.categoryName}`,
    `请你围绕下面主题写一篇完整帖子（标题 + 正文 + 楼下几条评论）。主题提示（可自拟小节角度，但不要偏离事实）：${params.topicHint}`,
    "",
    "写作时请牢记：宁可写得克制、写上「视实现而定」，也不要编造你不确定的细节。读起来要像真人写完愿意自己再看一遍的那种顺畅。",
    "",
    "输出 JSON，示例结构：",
    '{"title":"……","html":"<p>……</p>","comments":[{"body":"……","replies":["……"]}],"imageSearchQuery":"software developer reviewing api documentation"}',
  ].join("\n");

  const attemptParse = async (useRepair: boolean) => {
    const repairHint = useRepair
      ? `\n\n上一次解析失败。请输出合法 JSON：键名 title、html、comments、imageSearchQuery。长度：title ${SYNTHETIC_TITLE_MIN_LEN}～${SYNTHETIC_TITLE_MAX_LEN}；html ${SYNTHETIC_HTML_MIN_LEN}～${SYNTHETIC_HTML_MAX_LEN}；comments 顶层 ${SYNTHETIC_COMMENTS_TOPLEVEL_MIN}～${SYNTHETIC_COMMENTS_TOPLEVEL_MAX} 条；imageSearchQuery 英文紧扣正文；html 无 img。内容仍须事实可靠、行文自然像真人。`
      : "";
    const userPrompt = `${user}${repairHint}`;

    const raw = await chatCompletionJson({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: params.model,
      system,
      user: userPrompt,
      useJsonObjectMode: params.useJsonObjectMode,
      maxTokens: params.maxTokens,
      temperature,
    });

    const stripped = stripCodeFence(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped) as unknown;
    } catch {
      throw new Error(`JSON.parse 失败，原始片段：${stripped.slice(0, 280)}`);
    }
    return normalizeGenerated(parsed);
  };

  try {
    return await attemptParse(false);
  } catch (first) {
    try {
      return await attemptParse(true);
    } catch {
      throw first;
    }
  }
}
