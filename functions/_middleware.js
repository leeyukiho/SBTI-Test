export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const host = request.headers.get("host") || "";

  // 子域名匹配逻辑 (支持 match.sbti-ai.com 或 cp.sbti-ai.com)
  const isMatchSubdomain = host.startsWith("match.") || host.startsWith("cp.");

  // 如果访问子域名的根路径，则内网重写到 compare.html
  if (isMatchSubdomain && (url.pathname === "/" || url.pathname === "/index.html")) {
    url.pathname = "/compare.html";
    return context.env.ASSETS.fetch(url);
  }

  // 正常处理其他请求
  return next();
}
