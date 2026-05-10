export type GeneratedPost = {
  title: string;
  html: string;
  comments: { body: string; replies?: string[] }[];
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
    .replace(/\son\w+='[^']*'/gi, "");
}

function normalizeGenerated(raw: unknown): GeneratedPost {
  if (!raw || typeof raw !== "object") {
    throw new Error("模型输出不是 JSON 对象");
  }
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const htmlRaw = typeof o.html === "string" ? o.html.trim() : "";
  const html = stripUnsafeHtml(htmlRaw);

  if (!title || title.length > 200) {
    throw new Error("title 须为非空且不超过 200 字符");
  }
  if (!html || html.length < 80) {
    throw new Error("html 过短或为空");
  }
  if (html.length > 60000) {
    throw new Error("html 过长");
  }

  const commentsIn = o.comments;
  if (!Array.isArray(commentsIn)) {
    throw new Error("comments 须为数组");
  }
  if (commentsIn.length < 2 || commentsIn.length > 8) {
    throw new Error("comments 数量须在 2～8 条之间");
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
      if (replies.length > 4) throw new Error("单条评论回复过多");
      for (const r of replies) {
        if (r.length > 5000) throw new Error("回复过长");
      }
      if (replies.length === 0) replies = undefined;
    }
    comments.push({ body, replies });
  }

  return { title, html, comments };
}

async function chatCompletionJson(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  useJsonObjectMode: boolean;
  maxTokens: number;
}): Promise<string> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: 0.55,
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
}): Promise<GeneratedPost> {
  const system = [
    "你是资深中文技术编辑兼工程师，负责为开发者社区撰写短文与评论互动。",
    "硬性要求：",
    "1）内容基于业界公认概念与教材级表述，条理清晰；不要编造论文标题、法律条文、虚构产品发布或虚构版本号。",
    "2）不确定的细节用「通常」「常见」「视实现而定」等措辞，避免捏造精确数字。",
    "3）全文使用简体中文。",
    "4）输出必须是单个 JSON 对象，不要 Markdown，不要多余解释。",
    "5）字段：title（字符串）、html（字符串，使用 <p> 分段，可选 <strong>、<ul><li>，禁止 script/iframe/onclick）、comments（数组）。",
    "6）comments：每条含 body（字符串）；可选 replies（字符串数组，代表对该评论的回复，不超过 3 条）。至少 2 条顶层评论，总计顶层评论不超过 8 条。",
    "7）正文 html 总长度建议 400～2500 汉字相当的内容量；标题不超过 80 字。",
  ].join("\n");

  const user = [
    `二级分类（叶子）：${params.categoryName}`,
    `写作主题提示（请围绕其展开，可自拟具体角度）：${params.topicHint}`,
    "",
    "请输出 JSON，结构示例：",
    '{"title":"…","html":"<p>…</p>","comments":[{"body":"…","replies":["…"]}]}',
  ].join("\n");

  const attemptParse = async (useRepair: boolean) => {
    const userPrompt = useRepair
      ? `${user}\n\n上一次解析失败，请严格输出合法 JSON，键名必须是 title、html、comments。`
      : user;

    const raw = await chatCompletionJson({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: params.model,
      system,
      user: userPrompt,
      useJsonObjectMode: params.useJsonObjectMode,
      maxTokens: params.maxTokens,
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
