import{o as Za,a as ti,i as ei,b as S,s as L,e as $e}from"./lifecycle.BBgBnnVJ.js";import{ak as ai,af as ii,b4 as ri,b5 as ni,i as li,u as oi,b6 as si,b7 as ci,q as ui,b8 as wt,b9 as Ye,ba as Ue,j as He,w as c,f as Be,t as kt,g as t,a as lt,p as di,b as vi,bb as We,h as ot,e as l,m as E,s as u,aF as Pt,d as n,r,z as fi}from"./utils.RvbYD59J.js";import{a as mi,s as H}from"./render.BM3BONhX.js";import{i as K}from"./if.BuygR1yQ.js";import{e as pi,i as bi}from"./each.DzSzcbUF.js";import{b as oe}from"./this.DGsQ1rEY.js";import{s as Oe}from"./event-modifiers.gvea_hMH.js";import{I as v}from"./Icon.BgzaQGEE.js";import{m as $t}from"./config.BhYguTAU.js";import{I as C}from"./zh_TW.Dg7IgQ5f.js";import{i as T}from"./translation.f9Izjn50.js";import"./props.CogTXn3b.js";const hi=()=>performance.now(),X={tick:o=>requestAnimationFrame(o),now:()=>hi(),tasks:new Set};function Ke(){const o=X.now();X.tasks.forEach(i=>{i.c(o)||(X.tasks.delete(i),i.f())}),X.tasks.size!==0&&X.tick(Ke)}function gi(o){let i;return X.tasks.size===0&&X.tick(Ke),{promise:new Promise(y=>{X.tasks.add(i={c:o,f:y})}),abort(){X.tasks.delete(i)}}}function Bt(o,i){Ye(()=>{o.dispatchEvent(new CustomEvent(i))})}function yi(o){if(o==="float")return"cssFloat";if(o==="offset")return"cssOffset";if(o.startsWith("--"))return o;const i=o.split("-");return i.length===1?i[0]:i[0]+i.slice(1).map(y=>y[0].toUpperCase()+y.slice(1)).join("")}function qe(o){const i={},y=o.split(";");for(const h of y){const[x,w]=h.split(":");if(!x||w===void 0)break;const d=yi(x.trim());i[d]=w.trim()}return i}const xi=o=>o;function _i(o,i,y,h){var x=(o&si)!==0,w="both",d,k=i.inert,j=i.style.overflow,m,g;function F(){return Ye(()=>d??=y()(i,h?.()??{},{direction:w}))}var q={is_global:x,in(){i.inert=k,m=se(i,F(),g,1,()=>{Bt(i,"introend"),m?.abort(),m=d=void 0,i.style.overflow=j})},out(M){i.inert=!0,g=se(i,F(),m,0,()=>{Bt(i,"outroend"),M?.()})},stop:()=>{m?.abort(),g?.abort()}},I=ai;if((I.nodes.t??=[]).push(q),mi){var A=x;if(!A){for(var s=I.parent;s&&(s.f&ii)!==0;)for(;(s=s.parent)&&(s.f&ri)===0;);A=!s||(s.f&ni)!==0}A&&li(()=>{oi(()=>q.in())})}}function se(o,i,y,h,x){var w=h===1;if(ci(i)){var d,k=!1;return ui(()=>{if(!k){var M=i({direction:w?"in":"out"});d=se(o,M,y,h,x)}}),{abort:()=>{k=!0,d?.abort()},deactivate:()=>d.deactivate(),reset:()=>d.reset(),t:()=>d.t()}}if(y?.deactivate(),!i?.duration&&!i?.delay)return Bt(o,w?"introstart":"outrostart"),x(),{abort:wt,deactivate:wt,reset:wt,t:()=>h};const{delay:j=0,css:m,tick:g,easing:F=xi}=i;var q=[];if(w&&y===void 0&&(g&&g(0,1),m)){var I=qe(m(0,1));q.push(I,I)}var A=()=>1-h,s=o.animate(q,{duration:j,fill:"forwards"});return s.onfinish=()=>{s.cancel(),Bt(o,w?"introstart":"outrostart");var M=y?.t()??1-h;y?.abort();var f=h-M,Z=i.duration*Math.abs(f),tt=[];if(Z>0){var D=!1;if(m)for(var _=Math.ceil(Z/16.666666666666668),P=0;P<=_;P+=1){var p=M+f*F(P/_),et=qe(m(p,1-p));tt.push(et),D||=et.overflow==="hidden"}D&&(o.style.overflow="hidden"),A=()=>{var R=s.currentTime;return M+f*F(R/Z)},g&&gi(()=>{if(s.playState!=="running")return!1;var R=A();return g(R,1-R),!0})}s=o.animate(tt,{duration:Z,fill:"forwards"}),s.onfinish=()=>{A=()=>h,g?.(h,1-h),x()}},{abort:()=>{s&&(s.cancel(),s.effect=null,s.onfinish=wt)},deactivate:()=>{x=wt},reset:()=>{h===0&&g?.(1,0)},t:()=>A()}}function wi(o,i,y=i){var h=()=>{y(o.volume)};i()==null&&h(),Ue(o,["volumechange"],h,!1),He(()=>{var x=Number(i());x!==o.volume&&!isNaN(x)&&(o.volume=x)})}function ki(o,i,y=i){var h=()=>{y(o.muted)};i()==null&&h(),Ue(o,["volumechange"],h,!1),He(()=>{var x=!!i();o.muted!==x&&(o.muted=x)})}function Pi(o){const i=o-1;return i*i*i+1}function Ei(o,{delay:i=0,duration:y=400,easing:h=Pi,axis:x="y"}={}){const w=getComputedStyle(o),d=+w.opacity,k=x==="y"?"height":"width",j=parseFloat(w[k]),m=x==="y"?["top","bottom"]:["left","right"],g=m.map(f=>`${f[0].toUpperCase()}${f.slice(1)}`),F=parseFloat(w[`padding${g[0]}`]),q=parseFloat(w[`padding${g[1]}`]),I=parseFloat(w[`margin${g[0]}`]),A=parseFloat(w[`margin${g[1]}`]),s=parseFloat(w[`border${g[0]}Width`]),M=parseFloat(w[`border${g[1]}Width`]);return{delay:i,duration:y,easing:h,css:f=>`overflow: hidden;opacity: ${Math.min(f*20,1)*d};${k}: ${f*j}px;padding-${m[0]}: ${f*F}px;padding-${m[1]}: ${f*q}px;margin-${m[0]}: ${f*I}px;margin-${m[1]}: ${f*A}px;border-${m[0]}-width: ${f*s}px;border-${m[1]}-width: ${f*M}px;min-${k}: 0`}}var Si=ot('<div class="fixed bottom-20 right-4 z-60 max-w-sm"><div class="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-up"><!> <span class="text-sm flex-1"> </span> <button class="text-white/[80%] hover:text-white transition-colors"><!></button></div></div>'),Fi=ot('<div class="flex space-x-0.5"><div class="w-0.5 h-3 bg-white rounded-full animate-pulse"></div> <div class="w-0.5 h-4 bg-white rounded-full animate-pulse" style="animation-delay: 150ms;"></div> <div class="w-0.5 h-2 bg-white rounded-full animate-pulse" style="animation-delay: 300ms;"></div></div>'),Mi=ot('<span class="text-sm text-(--content-meta)"></span>'),Ci=ot('<div role="button" tabindex="0"><div class="w-6 h-6 flex items-center justify-center"><!></div> <div class="w-10 h-10 rounded-lg overflow-hidden bg-(--btn-regular-bg) shrink-0"><img loading="lazy" class="w-full h-full object-cover"/></div> <div class="flex-1 min-w-0"><div> </div> <div> </div></div></div>'),Ti=ot('<div class="playlist-panel float-panel fixed bottom-20 right-4 w-80 max-h-96 overflow-hidden z-50"><div class="playlist-header flex items-center justify-between p-4 border-b border-(--line-divider)"><h3 class="text-lg font-semibold text-90"> </h3> <button class="btn-plain w-8 h-8 rounded-lg"><!></button></div> <div class="playlist-content overflow-y-auto max-h-80 hide-scrollbar"></div></div>'),ji=ot(`<!> <div><div role="button" tabindex="0"><!></div> <div><div class="flex items-center gap-3"><div class="cover-container relative w-12 h-12 rounded-full overflow-hidden cursor-pointer" role="button" tabindex="0"><img/> <div class="absolute inset-0 bg-black/[20%] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><!></div></div> <div class="flex-1 min-w-0 cursor-pointer" role="button" tabindex="0"><div class="text-sm font-medium text-90 truncate"> </div> <div class="text-xs text-50 truncate"> </div></div> <div class="flex items-center gap-1"><button class="btn-plain w-8 h-8 rounded-lg flex items-center justify-center"><!></button> <button class="btn-plain w-8 h-8 rounded-lg flex items-center justify-center"><!></button></div></div></div> <div><div class="flex items-center gap-4 mb-4"><div class="cover-container relative w-16 h-16 rounded-full overflow-hidden shrink-0"><img/></div> <div class="flex-1 min-w-0"><div class="song-title text-lg font-bold text-90 truncate mb-1"> </div> <div class="song-artist text-sm text-50 truncate"> </div> <div class="text-xs text-30 mt-1"> </div></div> <div class="flex items-center gap-1"><button class="btn-plain w-8 h-8 rounded-lg flex items-center justify-center"><!></button> <button><!></button></div></div> <div class="progress-section mb-4"><div class="progress-bar flex-1 h-2 bg-(--btn-regular-bg) rounded-full cursor-pointer" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100"><div class="h-full bg-(--primary) rounded-full transition-all duration-100"></div></div></div> <div class="controls flex items-center justify-center gap-2 mb-4"><button><!></button> <button class="btn-plain w-10 h-10 rounded-lg"><!></button> <button><!></button> <button class="btn-plain w-10 h-10 rounded-lg"><!></button> <button><!></button></div> <div class="bottom-controls flex items-center gap-2"><button class="btn-plain w-8 h-8 rounded-lg"><!></button> <div class="flex-1 h-2 bg-(--btn-regular-bg) rounded-full cursor-pointer touch-none" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100"><div></div></div> <button class="btn-plain w-8 h-8 rounded-lg flex items-center justify-center"><!></button></div></div> <!></div> <style>.orb-player {
	position: relative;
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
}
.orb-player::before {
	content: '';
	position: absolute;
	inset: -0.125rem;
	background: linear-gradient(45deg, var(--primary), transparent, var(--primary));
	border-radius: 50%;
	z-index: -1;
	opacity: 0;
	transition: opacity 0.3s ease;
}
.orb-player:hover::before {
	opacity: 0.3;
	animation: rotate 2s linear infinite;
}
.orb-player .animate-pulse {
	animation: musicWave 1.5s ease-in-out infinite;
}
@keyframes rotate {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
@keyframes musicWave {
	0%, 100% { transform: scaleY(0.5); }
	50% { transform: scaleY(1); }
}
.music-player.hidden-mode {
	width: 3rem;
	height: 3rem;
}
.music-player {
    max-width: 20rem;
    user-select: none;
}
.mini-player {
    width: 17.5rem;
    position: absolute;
    bottom: 0;
    right: 0;
    /*left: 0;*/
}
.expanded-player {
    width: 20rem;
    position: absolute;
    bottom: 0;
    right: 0;
}
.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
    0%, 100% {
        opacity: 1;
	}
    50% {
        opacity: 0.5;
	}
}
.progress-section div:hover,
.bottom-controls > div:hover {
    transform: scaleY(1.2);
    transition: transform 0.2s ease;
}
@media (max-width: 768px) {
    .music-player {
        max-width: 280px !important;
        /*left: 0.5rem !important;*/
        bottom: 0.5rem !important;
        right: 0.5rem !important;
	}
    .mini-player {
        width: 280px;
    }
    .music-player.expanded {
        width: calc(100vw - 16px);
        max-width: none;
        /*left: 0.5rem !important;*/
        right: 0.5rem !important;
	}
    .playlist-panel {
        width: calc(100vw - 16px) !important;
        /*left: 0.5rem !important;*/
        right: 0.5rem !important;
        max-width: none;
	}
    .controls {
        gap: 8px;
	}
    .controls button {
        width: 36px;
        height: 36px;
	}
    .controls button:nth-child(3) {
        width: 44px;
        height: 44px;
	}
}
@media (max-width: 480px) {
    .music-player {
        max-width: 260px;
	}
    .song-title {
        font-size: 14px;
	}
    .song-artist {
        font-size: 12px;
	}
    .controls {
        gap: 6px;
        margin-bottom: 12px;
	}
    .controls button {
        width: 32px;
        height: 32px;
	}
    .controls button:nth-child(3) {
        width: 40px;
        height: 40px;
	}
    .playlist-item {
        padding: 8px 12px;
	}
    .playlist-item .w-10 {
        width: 32px;
        height: 32px;
	}
}
@keyframes slide-up {
    from {
        transform: translateY(100%);
        opacity: 0;
	}
    to {
        transform: translateY(0);
        opacity: 1;
	}
}
.animate-slide-up {
    animation: slide-up 0.3s ease-out;
}
@media (hover: none) and (pointer: coarse) {
    .music-player button,
    .playlist-item {
        min-height: 44px;
	}
    .progress-section > div,
    .bottom-controls > div:nth-child(2) {
        height: 12px;
	}
}
/* 自定义旋转动画，停止时保持当前位置 */
@keyframes spin-continuous {
    from {
        transform: rotate(0deg);
	}
    to {
        transform: rotate(360deg);
	}
}
.cover-container img {
    animation: spin-continuous 3s linear infinite;
    animation-play-state: paused;
}
.cover-container img.spinning {
    animation-play-state: running;
}
/* 让主题色按钮更有视觉反馈 */
button.bg-\\[var\\(--primary\\)\\] {
    box-shadow: 0 0 0 2px var(--primary);
	border: none;
}</style>`,1),Ii=ot('<audio preload="auto"></audio> <!>',1);function Yi(o,i){vi(i,!1);let y=$t.meting_api,h=$t.id,x=$t.server,w=$t.type,d=E(!1),k=E(!1),j=E(!1),m=E(!1),g=E(0),F=E(0);const q="music-player-volume";let I=E(.7),A=E(!1),s=E(!1),M=E(!1),f=E(0),Z=E(""),tt=E(!1),D=E({title:"Sample Song",artist:"Sample Artist",cover:"/favicon/favicon.ico",url:"",duration:0}),_=E([]),P=E(0),p=E(),et=E(),R=E();function Xe(){try{if(typeof localStorage<"u"){const a=localStorage.getItem(q);a!==null&&!isNaN(parseFloat(a))&&l(I,parseFloat(a))}}catch(a){console.warn("Failed to load volume settings from localStorage:",a)}}function Ge(){try{typeof localStorage<"u"&&localStorage.setItem(q,t(I).toString())}catch(a){console.warn("Failed to save volume settings to localStorage:",a)}}async function Je(){l(s,!0);const a=y.replace(":server",x).replace(":type",w).replace(":id",h).replace(":auth","").replace(":r",Date.now().toString());try{const b=await fetch(a);if(!b.ok)throw new Error("meting api error");const Y=await b.json();l(_,Y.map(V=>{let mt=V.name??V.title??T(C.unknownSong),jt=V.artist??V.author??T(C.unknownArtist),N=V.duration??0;return N>1e4&&(N=Math.floor(N/1e3)),(!Number.isFinite(N)||N<=0)&&(N=0),{id:V.id,title:mt,artist:jt,cover:V.pic??"",url:V.url??"",duration:N}})),t(_).length>0&&ue(t(_)[0]),l(s,!1)}catch{Ut(T(C.musicPlayerErrorPlaylist)),l(s,!1)}}function Wt(){!t(p)||!t(D).url||(t(d)?t(p).pause():t(p).play().catch(()=>{}))}function Et(){l(k,!t(k)),t(k)&&(l(m,!1),l(j,!1))}function St(){l(j,!t(j)),t(j)&&(l(k,!1),l(m,!1))}function ce(){l(m,!t(m))}function Qe(){l(M,!t(M)),t(M)&&l(f,0)}function Ze(){l(f,(t(f)+1)%3),t(f)!==0&&l(M,!1)}function ta(){if(t(_).length<=1)return;const a=t(P)>0?t(P)-1:t(_).length-1;Ft(a)}function Ot(a=!0){if(t(_).length<=1)return;let b;if(t(M))do b=Math.floor(Math.random()*t(_).length);while(b===t(P)&&t(_).length>1);else b=t(P)<t(_).length-1?t(P)+1:0;Ft(b,a)}let qt=!1;function Ft(a,b=!0){a<0||a>=t(_).length||(qt=b,l(P,a),ue(t(_)[t(P)]))}function Mt(a){return a.startsWith("http://")||a.startsWith("https://")||a.startsWith("/")?a:`/${a}`}function ue(a){a&&a.url!==t(D).url&&(l(D,{...a}),a.url?l(s,!0):l(s,!1))}let Yt=!1;function ea(){if(l(s,!1),t(p)?.duration&&t(p).duration>1&&(l(F,Math.floor(t(p).duration)),t(_)[t(P)]&&Pt(_,t(_)[t(P)].duration=t(F)),Pt(D,t(D).duration=t(F))),qt||t(d)){const a=t(p).play();a!==void 0&&a.catch(b=>{console.warn("自动播放被拦截，等待用户交互:",b),Yt=!0,l(d,!1)})}}function de(){if(Yt&&t(p)){const a=t(p).play();a!==void 0&&a.then(()=>{Yt=!1}).catch(()=>{})}}function aa(a){if(!t(D).url)return;l(s,!1),Ut(T(C.musicPlayerErrorSong));const b=t(d)||qt;t(_).length>1?setTimeout(()=>Ot(b),1e3):Ut(T(C.musicPlayerErrorEmpty))}function ia(){}function ra(){t(f)===1?(Pt(p,t(p).currentTime=0),t(p).play().catch(()=>{})):t(f)===2||t(M)?Ot(!0):l(d,!1)}function Ut(a){l(Z,a),l(tt,!0),setTimeout(()=>{l(tt,!1)},3e3)}function na(){l(tt,!1)}function la(a){if(!t(p)||!t(et))return;const b=t(et).getBoundingClientRect(),V=(a.clientX-b.left)/b.width*t(F);Pt(p,t(p).currentTime=V),l(g,V)}let Ct=E(!1),Tt=!1,Ht=null,st=null;function oa(a){t(R)&&(a.preventDefault(),Tt=!0,t(R).setPointerCapture(a.pointerId),Ht=t(R).getBoundingClientRect(),ve(a.clientX))}function sa(a){Tt&&(a.preventDefault(),l(Ct,!0),!st&&(st=requestAnimationFrame(()=>{ve(a.clientX),st=null})))}function ca(a){Tt&&(Tt=!1,l(Ct,!1),Ht=null,t(R)&&t(R).releasePointerCapture(a.pointerId),st&&(cancelAnimationFrame(st),st=null),Ge())}function ve(a){if(!t(p)||!t(R))return;const b=Ht||t(R).getBoundingClientRect(),Y=Math.max(0,Math.min(1,(a-b.left)/b.width));l(I,Y)}function fe(){l(A,!t(A))}function me(a){if(!Number.isFinite(a)||a<0)return"0:00";const b=Math.floor(a/60),Y=Math.floor(a%60);return`${b}:${Y.toString().padStart(2,"0")}`}const pe=["click","keydown","touchstart"];Za(()=>{Xe(),pe.forEach(a=>{document.addEventListener(a,de,{capture:!0})}),Je()}),ti(()=>{typeof document<"u"&&pe.forEach(a=>{document.removeEventListener(a,de,{capture:!0})})}),ei();var be=Ii();c("pointermove",We,sa),c("pointerup",We,ca);var B=Be(be);oe(B,a=>l(p,a),()=>t(p));var ua=u(B,2);{var da=a=>{var b=ji(),Y=Be(b);{var V=e=>{var $=Si(),O=n($),J=n(O);v(J,{icon:"material-symbols:error",class:"text-xl shrink-0"});var it=u(J,2),rt=n(it,!0);r(it);var nt=u(it,2),ft=n(nt);v(ft,{icon:"material-symbols:close",class:"text-lg"}),r(nt),r(O),r($),kt(()=>H(rt,t(Z))),c("click",nt,na),lt(e,$)};K(Y,e=>{t(tt)&&e(V)})}var mt=u(Y,2);let jt;var N=n(mt);let he;var va=n(N);{var fa=e=>{v(e,{icon:"eos-icons:loading",class:"text-white text-lg"})},ma=e=>{var $=Fi();lt(e,$)},pa=e=>{v(e,{icon:"material-symbols:music-note",class:"text-white text-lg"})};K(va,e=>{t(s)?e(fa):t(d)?e(ma,1):e(pa,!1)})}r(N);var It=u(N,2);let ge;var ye=n(It),ct=n(ye),At=n(ct);let xe;var _e=u(At,2),ba=n(_e);{var ha=e=>{v(e,{icon:"eos-icons:loading",class:"text-white text-xl"})},ga=e=>{v(e,{icon:"material-symbols:pause",class:"text-white text-xl"})},ya=e=>{v(e,{icon:"material-symbols:play-arrow",class:"text-white text-xl"})};K(ba,e=>{t(s)?e(ha):t(d)?e(ga,1):e(ya,!1)})}r(_e),r(ct);var ut=u(ct,2),Kt=n(ut),xa=n(Kt,!0);r(Kt);var we=u(Kt,2),_a=n(we,!0);r(we),r(ut);var ke=u(ut,2),pt=n(ke),wa=n(pt);v(wa,{icon:"material-symbols:visibility-off",class:"text-lg"}),r(pt);var Xt=u(pt,2),ka=n(Xt);v(ka,{icon:"material-symbols:expand-less",class:"text-lg"}),r(Xt),r(ke),r(ye),r(It);var Dt=u(It,2);let Pe;var Gt=n(Dt),Jt=n(Gt),Qt=n(Jt);let Ee;r(Jt);var Zt=u(Jt,2),te=n(Zt),Pa=n(te,!0);r(te);var ee=u(te,2),Ea=n(ee,!0);r(ee);var Se=u(ee,2),Sa=n(Se);r(Se),r(Zt);var Fe=u(Zt,2),bt=n(Fe),Fa=n(bt);v(Fa,{icon:"material-symbols:visibility-off",class:"text-lg"}),r(bt);var ht=u(bt,2);let Me;var Ma=n(ht);v(Ma,{icon:"material-symbols:queue-music",class:"text-lg"}),r(ht),r(Fe),r(Gt);var ae=u(Gt,2),at=n(ae),Ca=n(at);r(at),oe(at,e=>l(et,e),()=>t(et)),r(ae);var ie=u(ae,2),dt=n(ie);let Ce;var Ta=n(dt);v(Ta,{icon:"material-symbols:shuffle",class:"text-lg"}),r(dt);var gt=u(dt,2),ja=n(gt);v(ja,{icon:"material-symbols:skip-previous",class:"text-xl"}),r(gt);var vt=u(gt,2);let Te;var Ia=n(vt);{var Aa=e=>{v(e,{icon:"eos-icons:loading",class:"text-xl"})},Da=e=>{v(e,{icon:"material-symbols:pause",class:"text-xl"})},Na=e=>{v(e,{icon:"material-symbols:play-arrow",class:"text-xl"})};K(Ia,e=>{t(s)?e(Aa):t(d)?e(Da,1):e(Na,!1)})}r(vt);var yt=u(vt,2),za=n(yt);v(za,{icon:"material-symbols:skip-next",class:"text-xl"}),r(yt);var Nt=u(yt,2);let je;var Ra=n(Nt);{var La=e=>{v(e,{icon:"material-symbols:repeat-one",class:"text-lg"})},Va=e=>{v(e,{icon:"material-symbols:repeat",class:"text-lg"})},$a=e=>{v(e,{icon:"material-symbols:repeat",class:"text-lg opacity-50"})};K(Ra,e=>{t(f)===1?e(La):t(f)===2?e(Va,1):e($a,!1)})}r(Nt),r(ie);var Ie=u(ie,2),zt=n(Ie),Ba=n(zt);{var Wa=e=>{v(e,{icon:"material-symbols:volume-off",class:"text-lg"})},Oa=e=>{v(e,{icon:"material-symbols:volume-down",class:"text-lg"})},qa=e=>{v(e,{icon:"material-symbols:volume-up",class:"text-lg"})};K(Ba,e=>{t(A)||t(I)===0?e(Wa):t(I)<.5?e(Oa,1):e(qa,!1)})}r(zt);var G=u(zt,2),Ae=n(G);let De;r(G),oe(G,e=>l(R,e),()=>t(R));var Rt=u(G,2),Ya=n(Rt);v(Ya,{icon:"material-symbols:expand-more",class:"text-lg"}),r(Rt),r(Ie),r(Dt);var Ua=u(Dt,2);{var Ha=e=>{var $=Ti(),O=n($),J=n(O),it=n(J,!0);r(J);var rt=u(J,2),nt=n(rt);v(nt,{icon:"material-symbols:close",class:"text-lg"}),r(rt),r(O);var ft=u(O,2);pi(ft,5,()=>t(_),bi,(xt,Q,W)=>{var U=Ci();let Lt;var _t=n(U),re=n(_t);{var Ka=z=>{v(z,{icon:"material-symbols:graphic-eq",class:"text-(--primary) animate-pulse"})},Xa=z=>{v(z,{icon:"material-symbols:pause",class:"text-(--primary)"})},Ga=z=>{var Ve=Mi();Ve.textContent=W+1,lt(z,Ve)};K(re,z=>{W===t(P)&&t(d)?z(Ka):W===t(P)?z(Xa,1):z(Ga,!1)})}r(_t);var ne=u(_t,2),Ne=n(ne);r(ne);var ze=u(ne,2),Vt=n(ze);let Re;var Ja=n(Vt,!0);r(Vt);var le=u(Vt,2);let Le;var Qa=n(le,!0);r(le),r(ze),r(U),kt(z=>{Lt=L(U,1,"playlist-item flex items-center gap-3 p-3 hover:bg-(--btn-plain-bg-hover) cursor-pointer transition-colors",null,Lt,{"bg-(--btn-plain-bg)":W===t(P),"text-(--primary)":W===t(P)}),S(U,"aria-label",`播放 ${t(Q).title??""} - ${t(Q).artist??""}`),S(Ne,"src",z),S(Ne,"alt",t(Q).title),Re=L(Vt,1,"font-medium truncate",null,Re,{"text-[var(--primary)]":W===t(P),"text-90":W!==t(P)}),H(Ja,t(Q).title),Le=L(le,1,"text-sm text-[var(--content-meta) truncate",null,Le,{"text-[var(--primary)]":W===t(P)}),H(Qa,t(Q).artist)},[()=>Mt(t(Q).cover)]),c("click",U,()=>Ft(W)),c("keydown",U,z=>{(z.key==="Enter"||z.key===" ")&&(z.preventDefault(),Ft(W))}),lt(xt,U)}),r(ft),r($),kt(xt=>H(it,xt),[()=>T(C.musicPlayerPlaylist)]),c("click",rt,ce),_i(3,$,()=>Ei,()=>({duration:300,axis:"y"})),lt(e,$)};K(Ua,e=>{t(m)&&e(Ha)})}r(mt),fi(2),kt((e,$,O,J,it,rt,nt,ft,xt,Q,W,U,Lt,_t,re)=>{jt=L(mt,1,"music-player fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out",null,jt,{expanded:t(k),"hidden-mode":t(j)}),he=L(N,1,"orb-player w-12 h-12 bg-[var(--primary) rounded-full shadow-lg cursor-pointer transition-all duration-500 ease-in-out flex items-center justify-center hover:scale-110 active:scale-95",null,he,{"opacity-0":!t(j),"scale-0":!t(j),"pointer-events-none":!t(j)}),S(N,"aria-label",e),ge=L(It,1,"mini-player card-base bg-(--float-panel-bg) shadow-xl rounded-2xl p-3 transition-all duration-500 ease-in-out",null,ge,{"opacity-0":t(k)||t(j),"scale-95":t(k)||t(j),"pointer-events-none":t(k)||t(j)}),S(ct,"aria-label",$),S(At,"src",O),S(At,"alt",J),xe=L(At,1,"w-full h-full object-cover transition-transform duration-300",null,xe,{spinning:t(d)&&!t(s),"animate-pulse":t(s)}),S(ut,"aria-label",it),H(xa,t(D).title),H(_a,t(D).artist),S(pt,"title",rt),Pe=L(Dt,1,"expanded-player card-base bg-(--float-panel-bg) shadow-xl rounded-2xl p-4 transition-all duration-500 ease-in-out",null,Pe,{"opacity-0":!t(k),"scale-95":!t(k),"pointer-events-none":!t(k)}),S(Qt,"src",nt),S(Qt,"alt",ft),Ee=L(Qt,1,"w-full h-full object-cover transition-transform duration-300",null,Ee,{spinning:t(d)&&!t(s),"animate-pulse":t(s)}),H(Pa,t(D).title),H(Ea,t(D).artist),H(Sa,`${xt??""} / ${Q??""}`),S(bt,"title",W),Me=L(ht,1,"btn-plain w-8 h-8 rounded-lg flex items-center justify-center",null,Me,{"text-[var(--primary)]":t(m)}),S(ht,"title",U),S(at,"aria-label",Lt),S(at,"aria-valuenow",t(F)>0?t(g)/t(F)*100:0),$e(Ca,`width: ${t(F)>0?t(g)/t(F)*100:0}%`),Ce=L(dt,1,"w-10 h-10 rounded-lg",null,Ce,{"btn-regular":t(M),"btn-plain":!t(M)}),dt.disabled=t(_).length<=1,gt.disabled=t(_).length<=1,Te=L(vt,1,"btn-regular w-12 h-12 rounded-full",null,Te,{"opacity-50":t(s)}),vt.disabled=t(s),yt.disabled=t(_).length<=1,je=L(Nt,1,"w-10 h-10 rounded-lg",null,je,{"btn-regular":t(f)>0,"btn-plain":t(f)===0}),S(G,"aria-label",_t),S(G,"aria-valuenow",t(I)*100),De=L(Ae,1,"h-full bg-(--primary) rounded-full transition-all",null,De,{"duration-100":!t(Ct),"duration-0":t(Ct)}),$e(Ae,`width: ${t(I)*100}%`),S(Rt,"title",re)},[()=>T(C.musicPlayerShow),()=>t(d)?T(C.musicPlayerPause):T(C.musicPlayerPlay),()=>Mt(t(D).cover),()=>T(C.musicPlayerCover),()=>T(C.musicPlayerExpand),()=>T(C.musicPlayerHide),()=>Mt(t(D).cover),()=>T(C.musicPlayerCover),()=>me(t(g)),()=>me(t(F)),()=>T(C.musicPlayerHide),()=>T(C.musicPlayerPlaylist),()=>T(C.musicPlayerProgress),()=>T(C.musicPlayerVolume),()=>T(C.musicPlayerCollapse)]),c("click",N,St),c("keydown",N,e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),St())}),c("click",ct,Wt),c("keydown",ct,e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),Wt())}),c("click",ut,Et),c("keydown",ut,e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),Et())}),c("click",pt,Oe(St)),c("click",Xt,Oe(Et)),c("click",bt,St),c("click",ht,ce),c("click",at,la),c("keydown",at,e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();const O=.5*t(F);t(p)&&(Pt(p,t(p).currentTime=O),l(g,O))}}),c("click",dt,Qe),c("click",gt,ta),c("click",vt,Wt),c("click",yt,()=>Ot()),c("click",Nt,Ze),c("click",zt,fe),c("pointerdown",G,oa),c("keydown",G,e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),e.key==="Enter"&&fe())}),c("click",Rt,Et),lt(a,b)};K(ua,a=>{a(da)})}kt(a=>S(B,"src",a),[()=>Mt(t(D).url)]),wi(B,()=>t(I),a=>l(I,a)),ki(B,()=>t(A),a=>l(A,a)),c("play",B,()=>l(d,!0)),c("pause",B,()=>l(d,!1)),c("timeupdate",B,()=>l(g,t(p).currentTime)),c("ended",B,ra),c("error",B,aa),c("loadeddata",B,ea),c("loadstart",B,ia),lt(o,be),di()}export{Yi as default};
