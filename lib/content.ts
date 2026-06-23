export const moduleCopy: Record<string, { title: string; description: string; emptyTitle: string; emptyDescription: string }> = {
  "seo-index": {
    title: "SEO 索引",
    description: "监控站点地图覆盖、Google 收录、规范链接和抓取状态。",
    emptyTitle: "暂无索引数据",
    emptyDescription: "连接 Google Search Console 或抓取站点地图后开始监控索引。",
  },
  keywords: {
    title: "关键词表现",
    description: "从 Search Console 发现排名变化和高曝光优化机会。",
    emptyTitle: "暂无关键词数据",
    emptyDescription: "连接 Google Search Console 后导入真实查询、页面、CTR 和排名数据。",
  },
  pages: {
    title: "页面表现",
    description: "按 URL 汇总搜索、流量、技术 SEO、速度和 GEO 信号。",
    emptyTitle: "暂无页面记录",
    emptyDescription: "抓取站点地图或添加核心 URL 后开始页面级监控。",
  },
  "technical-seo": {
    title: "技术 SEO",
    description: "抓取页面、排序问题优先级，并通过重复审计验证修复效果。",
    emptyTitle: "暂无抓取结果",
    emptyDescription: "添加站点和站点地图 URL 后运行技术抓取。",
  },
  traffic: {
    title: "流量分析",
    description: "查看 GA4 来源、国家/地区、事件和 AI 引荐流量。",
    emptyTitle: "暂无流量数据",
    emptyDescription: "连接 GA4 后导入实时和历史流量指标。",
  },
  pagespeed: {
    title: "PageSpeed",
    description: "跟踪核心页面的 Core Web Vitals 和 Lighthouse 分数。",
    emptyTitle: "暂无 PageSpeed 检测",
    emptyDescription: "配置 PageSpeed API 或对核心 URL 运行手动检测。",
  },
  "geo-visibility": {
    title: "AI 可见度 / GEO",
    description: "衡量品牌提及、引用链接、AI 引荐和内容准备度。",
    emptyTitle: "暂无 GEO 测试",
    emptyDescription: "配置 AI 搜索服务商，或记录手动 AI 可见度测试结果。",
  },
  "ai-bot-logs": {
    title: "AI 爬虫日志",
    description: "解析访问日志，监控已验证和未验证的 AI 爬虫访问。",
    emptyTitle: "暂无爬虫日志",
    emptyDescription: "上传访问日志或配置挂载日志目录后解析爬虫访问。",
  },
  reports: {
    title: "报告",
    description: "生成可交付客户的 SEO 和 GEO 报告，并支持受保护分享。",
    emptyTitle: "暂无报告",
    emptyDescription: "连接数据源或运行扫描后生成报告。",
  },
  settings: {
    title: "站点设置",
    description: "管理站点发现、品牌词、集成、告警和分享。",
    emptyTitle: "暂无站点设置",
    emptyDescription: "创建站点并保存域名、站点地图和集成设置。",
  },
};

export const overviewMetrics = [
  { label: "SEO 健康分", description: "需要索引、关键词、技术 SEO 和速度数据。" },
  { label: "GEO 可见度分", description: "需要 AI 服务商、爬虫日志和内容评分数据。" },
  { label: "Google 已收录 URL", description: "需要 Google Search Console 或 URL Inspection 数据。" },
  { label: "自然搜索点击", description: "需要 Google Search Console 搜索分析数据。" },
  { label: "活跃用户", description: "需要 GA4 实时连接。" },
  { label: "AI 爬虫访问", description: "需要解析访问日志。" },
  { label: "技术 SEO 问题", description: "需要技术抓取结果。" },
  { label: "PageSpeed 移动端分数", description: "需要 PageSpeed 检测。" },
];
