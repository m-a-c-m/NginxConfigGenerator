"use client";

import { useState, useCallback, useMemo } from "react";
import { FiCopy, FiCheck } from "react-icons/fi";

interface Props { locale?: string; }

type Mode = "static" | "spa" | "proxy";

export default function NginxConfigGenerator({ locale = "es" }: Props) {
  const isEs = locale === "es";

  const [mode, setMode] = useState<Mode>("static");
  const [serverName, setServerName] = useState("midominio.com");
  const [listenPort, setListenPort] = useState(80);
  const [proxyTarget, setProxyTarget] = useState("http://127.0.0.1:3000");
  const [rootPath, setRootPath] = useState("/var/www/midominio");
  const [ssl, setSsl] = useState(false);
  const [gzip, setGzip] = useState(true);
  const [assetsCache, setAssetsCache] = useState(true);
  const [securityHeaders, setSecurityHeaders] = useState(true);
  const [maxBodySize, setMaxBodySize] = useState(10);
  const [copied, setCopied] = useState(false);

  const conf = useMemo(() => {
    const sn = serverName || "_";
    const port = ssl ? 443 : listenPort;
    const headers: string[] = [];
    if (securityHeaders) {
      headers.push(`    add_header X-Frame-Options "DENY" always;`, `    add_header X-Content-Type-Options "nosniff" always;`);
      if (ssl) headers.push(`    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;`);
    }

    const blocks: string[] = [];

    if (ssl) {
      blocks.push(`server {
    listen ${listenPort};
    server_name ${sn};
    return 301 https://$host$request_uri;
}`);
    }

    const mainLines: string[] = [];
    mainLines.push(`    listen ${port}${ssl ? " ssl" : ""};`);
    mainLines.push(`    http2 ${ssl ? "on" : "off"};`);
    mainLines.push(`    server_name ${sn};`);
    if (ssl) {
      mainLines.push(`    ssl_certificate /etc/letsencrypt/live/${sn}/fullchain.pem;`);
      mainLines.push(`    ssl_certificate_key /etc/letsencrypt/live/${sn}/privkey.pem;`);
    }
    mainLines.push(`    client_max_body_size ${maxBodySize}M;`);

    if (mode === "static" || mode === "spa") {
      mainLines.push(`    root ${rootPath || "/var/www/html"};`);
      mainLines.push(`    index index.html index.htm;`);
    }

    if (mode === "proxy") {
      mainLines.push(...headers);
      mainLines.push("");
      mainLines.push(`    location / {`);
      mainLines.push(`        proxy_pass ${proxyTarget || "http://127.0.0.1:3000"};`);
      mainLines.push(`        proxy_http_version 1.1;`);
      mainLines.push(`        proxy_set_header Upgrade $http_upgrade;`);
      mainLines.push(`        proxy_set_header Connection "upgrade";`);
      mainLines.push(`        proxy_set_header Host $host;`);
      mainLines.push(`        proxy_set_header X-Real-IP $remote_addr;`);
      mainLines.push(`        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
      mainLines.push(`        proxy_set_header X-Forwarded-Proto $scheme;`);
      mainLines.push(`        proxy_read_timeout 60s;`);
      mainLines.push(`    }`);
    } else if (mode === "spa") {
      mainLines.push(...headers);
      mainLines.push("");
      mainLines.push(`    location / {`);
      mainLines.push(`        try_files $uri $uri/ /index.html;`);
      mainLines.push(`    }`);
    } else {
      mainLines.push(...headers);
      mainLines.push("");
      mainLines.push(`    location / {`);
      mainLines.push(`        try_files $uri $uri/ =404;`);
      mainLines.push(`    }`);
    }

    if (assetsCache && mode !== "proxy") {
      mainLines.push("");
      mainLines.push(`    location ~* \\.(css|js|jpg|jpeg|png|gif|svg|webp|avif|woff2?)$ {`);
      mainLines.push(`        expires 30d;`);
      mainLines.push(`        add_header Cache-Control "public, immutable";`);
      mainLines.push(`    }`);
    }
    if (assetsCache && mode === "proxy") {
      mainLines.push("");
      mainLines.push(`    location ~* \\.(css|js|jpg|jpeg|png|gif|svg|webp|avif|woff2?)$ {`);
      mainLines.push(`        expires 30d;`);
      mainLines.push(`        add_header Cache-Control "public, immutable";`);
      mainLines.push(`        proxy_pass ${proxyTarget || "http://127.0.0.1:3000"};`);
      mainLines.push(`        proxy_set_header Host $host;`);
      mainLines.push(`    }`);
    }

    mainLines.unshift("", "");
    blocks.push(`server {\n${mainLines.join("\n").replace(/^\n\n/, "")}\n}`);

    let out = blocks.join("\n\n");

    if (gzip) {
      out += `

# En el bloque http {} de /etc/nginx/nginx.conf:
# gzip on;
# gzip_types text/plain text/css application/json application/javascript image/svg+xml;
# gzip_min_length 1024;
# gzip_comp_level 6;`;
    }
    return out + "\n";
  }, [mode, serverName, listenPort, ssl, gzip, assetsCache, securityHeaders, maxBodySize, rootPath, proxyTarget]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(conf);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [conf]);

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border border-border/20 bg-surface/30 p-4">
        <div>
          <label className="mb-2 block text-xs text-text-muted/70">{isEs ? "Tipo de sitio" : "Site type"}</label>
          <div className="flex flex-wrap gap-2">
            {([
              ["static", isEs ? "Estático" : "Static"],
              ["spa", isEs ? "SPA (React/Vue)" : "SPA (React/Vue)"],
              ["proxy", isEs ? "Proxy inverso" : "Reverse proxy"],
            ] as const).map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${mode === id ? "border-primary/50 bg-primary/10 text-primary" : "border-border/30 bg-surface/60 text-text-muted hover:text-text"}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-text-muted/70">server_name</label>
            <input value={serverName} onChange={(e) => setServerName(e.target.value)} placeholder="midominio.com" className="w-full rounded-lg border border-border/30 bg-surface/60 px-3 py-2 font-mono text-sm text-text" />
          </div>
          <div>
            <label className="mb-1 flex justify-between text-xs text-text-muted/70"><span>{isEs ? "Puerto HTTP" : "HTTP port"}</span><span>:{listenPort}</span></label>
            <input type="number" min={1} max={65535} value={listenPort} onChange={(e) => setListenPort(Number(e.target.value))} disabled={ssl} className="w-full rounded-lg border border-border/30 bg-surface/60 px-3 py-2 text-sm text-text disabled:opacity-50" />
          </div>
          {(mode === "static" || mode === "spa") && (
            <div>
              <label className="mb-1 block text-xs text-text-muted/70">root</label>
              <input value={rootPath} onChange={(e) => setRootPath(e.target.value)} placeholder="/var/www/midominio" className="w-full rounded-lg border border-border/30 bg-surface/60 px-3 py-2 font-mono text-sm text-text" />
            </div>
          )}
          {mode === "proxy" && (
            <div>
              <label className="mb-1 block text-xs text-text-muted/70">proxy_pass</label>
              <input value={proxyTarget} onChange={(e) => setProxyTarget(e.target.value)} placeholder="http://127.0.0.1:3000" className="w-full rounded-lg border border-border/30 bg-surface/60 px-3 py-2 font-mono text-sm text-text" />
            </div>
          )}
          <div>
            <label className="mb-1 flex justify-between text-xs text-text-muted/70"><span>client_max_body_size</span><span>{maxBodySize}M</span></label>
            <input type="range" min={1} max={100} value={maxBodySize} onChange={(e) => setMaxBodySize(Number(e.target.value))} className="mt-3 w-full accent-primary" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([
            ["ssl", ssl, setSsl, "HTTPS con Let's Encrypt", "HTTPS with Let's Encrypt"],
            ["gzip", gzip, setGzip, "Gzip", "Gzip"],
            ["cache", assetsCache, setAssetsCache, "Caché de assets (30 días)", "Asset cache (30 days)"],
            ["sec", securityHeaders, setSecurityHeaders, "Cabeceras de seguridad", "Security headers"],
          ] as const).map(([key, value, setter, labelEs, labelEn]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-border/20 px-3 py-2 text-sm">
              <span className="text-text-muted">{isEs ? labelEs : labelEn}</span>
              <button onClick={() => setter(!value)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-primary" : "bg-white/20"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-muted">{isEs ? "Configuración Nginx" : "Nginx configuration"}</label>
          <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
            {copied ? <><FiCheck className="text-xs" /> {isEs ? "Copiado" : "Copied"}</> : <><FiCopy className="text-xs" /> {isEs ? "Copiar" : "Copy"}</>}
          </button>
        </div>
        <pre className="max-h-[460px] overflow-auto rounded-xl border border-border/30 bg-surface/40 px-4 py-3 font-mono text-xs leading-relaxed text-text">{conf}</pre>
      </div>
    </div>
  );
}
