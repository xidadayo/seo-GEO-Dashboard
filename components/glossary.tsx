import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";

const glossary: Record<string, string> = {
  SEO: "搜索引擎优化。这里指让页面更容易被 Google 等搜索引擎抓取、理解并获得自然排名。",
  GEO: "生成式引擎优化。这里指让品牌和内容更容易被 ChatGPT、Perplexity、Google AI Overview 等 AI 搜索/回答系统提及和引用。",
  AI: "人工智能。这里主要指 AI 搜索服务、AI 爬虫和 AI 生成答案。",
  URL: "网页地址，例如 https://example.com/products/。",
  GSC: "Google Search Console，用来查看 Google 搜索点击、曝光、排名和索引状态。",
  "Google Search Console": "Google 官方站长工具，用来查看搜索表现、索引和抓取相关数据。",
  GA4: "Google Analytics 4，用来统计网站访问用户、会话、浏览量和转化事件。",
  PageSpeed: "Google PageSpeed Insights，基于 Lighthouse 检测页面速度和体验指标。",
  Lighthouse: "Google 的网页质量检测工具，会给出性能、SEO、可访问性和最佳实践分数。",
  "Core Web Vitals": "Google 核心网页体验指标，主要看加载速度、交互响应和布局稳定性。",
  LCP: "Largest Contentful Paint，最大内容绘制时间。衡量页面主要内容加载到可见所需时间，越低越好。",
  INP: "Interaction to Next Paint，交互响应延迟。衡量用户点击/输入后页面响应速度，越低越好。",
  CLS: "Cumulative Layout Shift，累计布局偏移。衡量页面元素是否突然跳动，越低越好。",
  CTR: "Click Through Rate，点击率。计算方式是点击数 ÷ 曝光数。",
  曝光: "用户在搜索结果中看到你的网站一次，就记为一次曝光。",
  点击: "用户从搜索结果点击进入你的网站一次，就记为一次点击。",
  排名: "网页在搜索结果中的平均位置，数字越小通常越靠前。",
  索引: "搜索引擎把页面收录进数据库，页面才有机会出现在搜索结果中。",
  "URL Inspection": "Google Search Console 的 URL 检查工具，用来确认某个页面是否被 Google 收录、抓取和索引。",
  Canonical: "规范链接。告诉搜索引擎多个相似页面中哪一个是首选版本。",
  canonical: "规范链接。告诉搜索引擎多个相似页面中哪一个是首选版本。",
  Robots: "robots 指令。告诉搜索引擎哪些页面可以抓取或索引。",
  "Robots.txt": "网站根目录下的抓取规则文件，用来告诉搜索引擎哪些路径可以访问。",
  "Meta": "页面 HTML 里的元信息，例如页面描述、robots 指令等，通常不会直接显示在页面正文中。",
  H1: "页面主标题。通常一个页面建议只有一个清晰的 H1。",
  Alt: "图片替代文本。图片无法显示或被搜索引擎/读屏软件读取时使用。",
  结构化数据: "用 Schema.org/JSON-LD 等格式标注页面实体、产品、FAQ 等信息，帮助搜索和 AI 理解内容。",
  Schema: "结构化数据的一种常见标准，用来帮助搜索引擎理解页面实体和内容类型。",
  FAQ: "常见问题。结构清晰的问答内容有助于搜索和 AI 摘要理解页面。",
  实体: "明确的人、品牌、公司、产品或地点等对象。AI 和搜索系统会围绕实体建立理解。",
  引用: "AI 或搜索结果中提到并链接到你的网页。",
  会话: "一次访问过程。用户进入网站到离开之间的一段互动通常记为一个会话。",
  用户: "访问网站的人或设备。GA4 中常见为活跃用户。",
  转化: "你希望用户完成的目标行为，例如提交表单、点击邮箱、发起 WhatsApp 等。",
  Webhook: "一个自动通知地址。外部系统有事件发生时，会把数据推送到这个 URL。",
  "API Key": "接口密钥。用于让平台调用第三方服务，类似服务访问密码，应妥善保管。",
  OAuth: "一种授权方式，允许应用在不直接保存账号密码的情况下访问服务数据。",
  "Service Account": "Google 服务账号。常用于服务器自动访问 GSC、GA4 等 API。",
};

function findExplanation(label: string) {
  if (glossary[label]) return glossary[label];
  const key = Object.keys(glossary).find((item) => label.includes(item));
  return key ? glossary[key] : null;
}

export function GlossaryLabel({ children, className }: { children: ReactNode; className?: string }) {
  const text = typeof children === "string" ? children : "";
  const explanation = text ? findExplanation(text) : null;
  if (!explanation) return <>{children}</>;

  return <span className={className}>
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span>{children}</span>
      <span className="group relative inline-flex cursor-help" tabIndex={0} title={explanation}>
        <HelpCircle className="size-3.5 text-slate-400" aria-label={`${text} 名词解释`} />
        <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-600 shadow-lg group-hover:block group-focus-within:block">
          {explanation}
        </span>
      </span>
    </span>
  </span>;
}
