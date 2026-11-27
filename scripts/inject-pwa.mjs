// Post-build: add PWA tags (manifest, icons, service worker) to dist/index.html.
import fs from 'node:fs';
const file = new URL('../dist/index.html', import.meta.url);
let html = fs.readFileSync(file, 'utf8');
if (!html.includes('rel="manifest"')) {
  const tags = `<meta name="theme-color" content="#E90076" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/icon-192.png" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}</script>
  </head>`;
  html = html.replace('</head>', tags);
  fs.writeFileSync(file, html);
}
