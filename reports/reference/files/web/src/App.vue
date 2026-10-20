<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useTheme } from 'vuetify';

const theme = useTheme();
const images = ref([]);
const loading = ref(true);
const error = ref('');
const lightbox = ref(null);
const visible = ref(48);
const PAGE = 48;
const cols = ref(4);
const menu = ref(false);
const copied = ref('');
const navVisible = ref(false);
const zoneRef = ref(null);

function navIn() { navVisible.value = true; }
function navOut() { navVisible.value = false; menu.value = false; }

const shown = computed(() => images.value.slice(0, visible.value));
const hasMore = computed(() => shown.value.length < images.value.length);
const total = computed(() => images.value.length);

const apiBase = computed(() => window.location.origin);
const apiLinks = computed(() => [
  { label: '自动适配（按访问端 UA）', url: `${apiBase.value}/api` },
  { label: '强制横图 pc', url: `${apiBase.value}/api?type=pc` },
  { label: '强制竖图 phone', url: `${apiBase.value}/api?type=phone` },
  { label: 'JSON 元数据', url: `${apiBase.value}/api?json=1` },
]);
const embedHtml = computed(() => `<img src="${apiBase.value}/api" alt="random">`);

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    copied.value = t;
    setTimeout(() => { if (copied.value === t) copied.value = ''; }, 1500);
  } catch (e) {
    // 剪贴板不可用时提示用户手动复制
    copied.value = t;
    setTimeout(() => { if (copied.value === t) copied.value = ''; }, 1500);
  }
}
function previewApi(u) {
  window.open(u, '_blank', 'noopener');
}
async function copyEmbed() {
  try {
    await navigator.clipboard.writeText(embedHtml.value);
    copied.value = 'embed';
    setTimeout(() => { if (copied.value === 'embed') copied.value = ''; }, 1500);
  } catch (e) {
    copied.value = 'embed';
    setTimeout(() => { if (copied.value === 'embed') copied.value = ''; }, 1500);
  }
}

function aspectStyle(img) {
  if (!img.width || !img.height) return '';
  return `aspect-ratio:${img.width}/${img.height}`;
}

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
function fmtAperture(v) {
  return v ? `f/${Number(v).toFixed(1).replace(/\.0$/, '')}` : '';
}
function fmtShutter(v) {
  if (!v) return '';
  return v < 1 ? `1/${Math.round(1 / v)}s` : `${v}s`;
}
function fmtIso(v) {
  return v ? `ISO ${v}` : '';
}
function cardDate(img) {
  return fmtDate(img.exif?.datetime) || fmtDate(img.createdAt);
}
function cardDevice(img) {
  const e = img.exif || {};
  return [e.make, e.model].filter(Boolean).join(' ').trim();
}
function cardTech(img) {
  const e = img.exif || {};
  return [e.lens && String(e.lens).includes('mm') ? e.lens : '', fmtAperture(e.aperture), fmtShutter(e.shutter), fmtIso(e.iso)]
    .filter(Boolean)
    .join(' · ');
}
function exifLines(img) {
  const lines = [];
  const d = cardDate(img);
  if (d) lines.push(d);
  if (img.width && img.height) lines.push(`${img.width}×${img.height}`);
  const dev = cardDevice(img);
  if (dev) lines.push(dev);
  const tech = cardTech(img);
  if (tech) lines.push(tech);
  if (img.id) lines.push(img.id);
  return lines;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    // 运行时索引（上传即生效，无需重新部署）；失败回退上次构建的静态索引
    let r = await fetch('/api/index', { cache: 'no-store' });
    if (!r.ok) r = await fetch('/data/gallery-index.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    images.value = shuffle(j.images || []);
    visible.value = PAGE;
  } catch (e) {
    error.value = e.message.includes('404')
      ? '未找到图片索引，请先上传图片，或在本地运行 npm run build:index'
      : '加载索引失败：' + e.message;
  } finally {
    loading.value = false;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomBrowse() {
  images.value = shuffle(images.value);
  visible.value = PAGE;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setMode(m) {
  theme.global.name.value = m;
  try { localStorage.setItem('zmm-theme', m); } catch (e) { /* 忽略 */ }
}

let observer = null;
const sentinel = ref(null);
onMounted(() => {
  // 宽屏默认多列，占满全宽且卡片不过大
  const w = window.innerWidth;
  cols.value = w > 1900 ? 6 : w > 1500 ? 5 : 4;
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && hasMore.value && !loading.value) {
      visible.value += PAGE;
    }
  }, { rootMargin: '800px 0px' });
  load();
});
// sentinel 是 v-if 渲染的，图片加载后才出现，需监听元素出现后再观察
watch(sentinel, (el) => {
  if (!observer) return;
  if (el) observer.observe(el);
});
onBeforeUnmount(() => observer && observer.disconnect());
</script>

<template>
  <v-app>
    <div ref="zoneRef" class="topbar-zone" @mouseenter="navIn" @mouseleave="navOut">
      <div class="topbar-trigger" aria-hidden="true"></div>
      <header class="topbar" :class="{ visible: navVisible }">
        <div class="topbar-inner">
        <div class="brand">
          <h1 class="site-name">时光脚印</h1>
          <span class="site-meta">{{ total ? total + ' works' : 'loading…' }}</span>
        </div>
        <div class="topbar-actions">
          <v-btn
            :icon="theme.global.name.value === 'dark' ? 'mdi-white-balance-sunny' : 'mdi-weather-night'"
            variant="text"
            :title="theme.global.name.value === 'dark' ? '切换到浅色' : '切换到深色'"
            @click="setMode(theme.global.name.value === 'dark' ? 'light' : 'dark')"
          />
          <v-menu v-model="menu" :close-on-content-click="false" :attach="zoneRef" location="bottom end" offset="8">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-cog-outline" variant="text" title="显示设置" />
            </template>
            <v-card min-width="320" class="settings-card">
              <v-list density="compact" nav>
                <v-list-item>
                  <div class="d-flex align-center ga-4 pa-1">
                    <span class="text-body-2 settings-label">列数</span>
                    <v-slider
                      v-model="cols"
                      min="3"
                      max="8"
                      step="1"
                      hide-details
                      thumb-label="always"
                      color="primary"
                      class="flex-grow-1"
                    />
                    <span class="text-body-2 settings-val">{{ cols }} 列</span>
                  </div>
                </v-list-item>
              </v-list>
              <v-divider class="my-1" />
              <v-list density="compact" nav>
                <v-list-subheader class="settings-sub">随机图 API 链接</v-list-subheader>
                <v-list-item v-for="l in apiLinks" :key="l.url" :title="l.label" density="compact">
                  <template #append>
                    <div class="d-flex align-center ga-1">
                      <v-btn
                        size="x-small"
                        variant="tonal"
                        :icon="copied === l.url ? 'mdi-check' : 'mdi-content-copy'"
                        :color="copied === l.url ? 'success' : 'default'"
                        :title="copied === l.url ? '已复制' : '复制链接'"
                        @click="copyText(l.url)"
                      />
                      <v-btn
                        size="x-small"
                        variant="tonal"
                        icon="mdi-open-in-new"
                        title="预览随机图"
                        @click="previewApi(l.url)"
                      />
                    </div>
                  </template>
                </v-list-item>
                <v-list-item title="HTML 嵌入（复制即用）" density="compact">
                  <template #append>
                    <div class="d-flex align-center ga-1 embed-wrap">
                      <code class="embed-code">{{ embedHtml }}</code>
                      <v-btn
                        size="x-small"
                        variant="tonal"
                        :icon="copied === 'embed' ? 'mdi-check' : 'mdi-content-copy'"
                        :color="copied === 'embed' ? 'success' : 'default'"
                        :title="copied === 'embed' ? '已复制' : '复制代码'"
                        @click="copyEmbed()"
                      />
                    </div>
                  </template>
                </v-list-item>
              </v-list>
            </v-card>
          </v-menu>
          <v-btn icon="mdi-refresh" variant="text" title="刷新" @click="load" />
        </div>
        </div>
      </header>
    </div>

    <v-main>
      <v-container fluid class="page">
        <v-alert v-if="error" type="error" class="mb-4" closable>{{ error }}</v-alert>
        <v-alert v-else-if="!loading && !images.length" type="info" class="mb-4">
          图库为空，请先用上传工具导入图片。
        </v-alert>

        <v-progress-circular
          v-if="loading"
          indeterminate
          color="primary"
          class="d-block mx-auto my-12"
        />

        <div v-else-if="images.length" class="wall" :style="{ '--cols': cols }">
          <figure
            v-for="img in shown"
            :key="img.id"
            class="card"
            @click="lightbox = img"
          >
            <div class="card-media" :style="aspectStyle(img)">
              <img
                :src="img.thumb"
                :alt="img.id"
                loading="lazy"
                decoding="async"
                @load="(e) => e.target.classList.add('loaded')"
              />
            </div>
            <figcaption class="card-info">
              <div class="ci-date">{{ cardDate(img) || '—' }}</div>
              <div v-if="cardDevice(img)" class="ci-device">{{ cardDevice(img) }}</div>
              <div v-if="cardTech(img)" class="ci-tech">{{ cardTech(img) }}</div>
              <div class="ci-size">{{ img.width }}×{{ img.height }}</div>
            </figcaption>
          </figure>
        </div>

        <div v-if="hasMore" ref="sentinel" class="sentinel">
          <v-progress-circular indeterminate color="primary" size="22" class="mr-2" />
          继续加载…
        </div>
        <div v-else-if="images.length" class="sentinel done">— 已全部加载 {{ images.length }} 张 —</div>

        <v-fab
          v-if="images.length"
          app
          bottom
          end
          color="primary"
          icon="mdi-shuffle-variant"
          title="随机浏览"
          @click="randomBrowse"
        />
      </v-container>
    </v-main>

    <v-dialog v-model="lightbox" max-width="1080" scrollable>
      <v-card v-if="lightbox" class="lb-card">
        <v-card-text class="pa-0 lb-click" @click="lightbox = null" title="点击关闭">
          <img :src="lightbox.url" :alt="lightbox.id" class="lightbox-img" />
        </v-card-text>
        <v-card-actions class="px-4 pb-3">
          <div class="flex-grow-1">
            <div v-for="(line, i) in exifLines(lightbox)" :key="i" class="text-body-2 text-medium-emphasis">
              {{ line }}
            </div>
          </div>
          <v-btn variant="text" color="primary" @click="lightbox = null">关闭</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style>
body { margin: 0; background: var(--v-theme-background); }

/* 顶栏：桌面自动隐藏，悬停顶部滑出；手机端固定 */
.topbar-zone {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
}
.topbar-trigger { height: 20px; }
.topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  transform: translateY(-100%);
  transition: transform .25s ease;
  border-bottom: 1px solid rgba(128, 128, 128, .14);
  backdrop-filter: blur(14px);
  background: color-mix(in srgb, var(--v-theme-background) 94%, transparent);
}
.topbar.visible { transform: translateY(0); }
.topbar-zone:focus-within .topbar { transform: translateY(0); }
.topbar-inner {
  margin: 0 auto;
  padding: 12px 24px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand { display: flex; align-items: baseline; gap: 14px; }
.site-name { font-size: 26px; font-weight: 800; letter-spacing: .5px; margin: 0; opacity: .85; }
.site-meta { font-size: 13px; opacity: .6; }
.topbar-actions { display: flex; align-items: center; gap: 2px; }

.page { margin: 0 auto; }

.wall {
  columns: var(--cols, 4);
  column-gap: 18px;
  padding: 22px 8px 96px;
}
.card {
  break-inside: avoid;
  margin: 0 0 26px;
  border-radius: 12px;
  overflow: hidden;
  cursor: zoom-in;
  background: var(--v-theme-surface);
  border: 1px solid rgba(128, 128, 128, .12);
  box-shadow: 0 1px 2px rgba(15, 23, 42, .05);
  transition: transform .25s ease, box-shadow .3s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 32px rgba(15, 23, 42, .13);
}
.card-media {
  position: relative;
  overflow: hidden;
  background: rgba(128, 128, 128, .08);
  line-height: 0;
}
.card-media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity .45s ease, transform .4s ease;
}
.card-media img.loaded { opacity: 1; }
.card:hover .card-media img { transform: scale(1.035); }

.card-info { padding: 12px 14px 14px; line-height: 1.5; }
.ci-date { font-size: 13px; font-weight: 600; }
.ci-device { font-size: 12px; opacity: .75; margin-top: 2px; }
.ci-tech { font-size: 12px; opacity: .55; margin-top: 1px; }
.ci-size { font-size: 12px; opacity: .4; margin-top: 2px; }

.settings-card { background: var(--v-theme-surface); }
.settings-label { opacity: .8; }
.settings-val { opacity: .7; min-width: 34px; text-align: right; }
.settings-sub { font-size: 12px !important; opacity: .6; min-height: 28px !important; }
.embed-code { font-size: 11px; opacity: .85; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }

.sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 0 40px;
  color: var(--v-theme-on-surface-variant);
  opacity: .7;
  font-size: 13px;
}
.sentinel.done { opacity: .45; }

.lightbox-img { width: 100%; max-height: 78vh; object-fit: contain; display: block; }
.lb-click { cursor: zoom-out; }

@media (max-width: 1200px) { .wall { columns: 3; } }
@media (max-width: 640px) {
  /* 手机端导航固定常驻 */
  .topbar-zone { position: static; }
  .topbar-trigger { display: none; }
  .topbar { position: sticky; top: 0; transform: none; }
  .wall { columns: 2; column-gap: 10px; padding: 14px 4px 96px; }
  .card { margin-bottom: 16px; border-radius: 10px; }
  .site-name { font-size: 20px; }
  .topbar-inner { padding: 12px 16px 8px; }
  .card-info { padding: 9px 11px 11px; }
  .ci-tech { display: none; }
}
</style>
