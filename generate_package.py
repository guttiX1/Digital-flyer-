#!/usr/bin/env python3
"""
Pista Noir · Event Package Generator
=====================================
Usage:
  python3 generate_package.py events/<slug>/event.json

Reads event.json and writes 4 HTML files into the same folder:
  site.html        — Main event website
  duel.html        — Head-to-head matchup page
  infographic.html — Stats + countdown + hype meters
  video-ad.html    — Animated 30-second video ad

Design system: Pista Noir (black bg, #F5C518 gold, -apple-system font)
"""

import json
import os
import sys
import re


# ── helpers ─────────────────────────────────────────────────────────────────

def slugify(s):
    s = s.lower()
    s = re.sub(r'[áà]', 'a', s); s = re.sub(r'[éè]', 'e', s)
    s = re.sub(r'[íì]', 'i', s); s = re.sub(r'[óò]', 'o', s)
    s = re.sub(r'[úù]', 'u', s); s = re.sub(r'[ñ]', 'n', s)
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    return re.sub(r'\s+', '-', s.strip())

PN_CSS = """
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#000;--s1:rgba(255,255,255,.04);--bd:rgba(255,255,255,.07);
  --bd2:rgba(255,255,255,.13);--text:#fff;--dim:rgba(255,255,255,.5);
  --muted:rgba(255,255,255,.25);--gold:#F5C518;
  --font:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif;
  --ease:cubic-bezier(.22,1,.36,1);
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--font);-webkit-font-smoothing:antialiased;overflow-x:hidden}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes slideL{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
@keyframes slideR{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
@keyframes boltFlash{0%,100%{opacity:.2}45%{opacity:1;filter:drop-shadow(0 0 10px var(--gold))}60%{opacity:.4}}
@keyframes vsPulse{0%,100%{filter:none}50%{filter:drop-shadow(0 0 20px rgba(245,197,24,.8))}}
@keyframes fillBar{from{width:0}to{width:var(--w)}}
@keyframes cdGlow{0%,100%{box-shadow:none}50%{box-shadow:0 0 28px rgba(245,197,24,.18)}}
@keyframes chipPulse{0%,100%{box-shadow:none}50%{box-shadow:0 0 16px rgba(245,197,24,.2)}}
@keyframes ctaAura{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}50%{box-shadow:0 0 40px 0 rgba(255,255,255,.1)}}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;height:50px;padding:0 24px;
  display:flex;align-items:center;justify-content:space-between;
  background:rgba(0,0,0,.8);backdrop-filter:blur(20px) saturate(180%);
  -webkit-backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--bd)}
.nav-l,.nav-r{font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.nav-chip{padding:4px 14px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;background:rgba(245,197,24,.1);border:1px solid rgba(245,197,24,.25);
  color:var(--gold);animation:chipPulse 3s ease infinite}
main{position:relative;z-index:10;padding-top:50px;max-width:940px;margin:0 auto;padding-left:24px;padding-right:24px}
.rule{height:1px;background:linear-gradient(90deg,transparent,var(--bd2),transparent);margin:clamp(24px,4vh,44px) 0}
.eye{font-size:11px;font-weight:600;letter-spacing:.25em;text-transform:uppercase;color:var(--muted);margin-bottom:20px;text-align:center}
.card{background:var(--s1);border:1px solid var(--bd);border-radius:20px;padding:22px 20px;
  transition:all .4s var(--ease)}
.card:hover{background:rgba(255,255,255,.07);transform:translateY(-3px);box-shadow:0 20px 40px -10px rgba(0,0,0,.6)}
.pill{display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:100px;
  font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.pill-gold{background:rgba(245,197,24,.08);border:1px solid rgba(245,197,24,.2);color:var(--gold)}
.pill-dim{background:var(--s1);border:1px solid var(--bd);color:var(--dim)}
.cta-btn{display:inline-block;padding:17px 52px;background:#fff;color:#000;border-radius:100px;
  font-size:15px;font-weight:700;letter-spacing:-.01em;font-family:var(--font);
  border:none;cursor:pointer;text-decoration:none;transition:all .25s var(--ease);
  animation:ctaAura 3s ease infinite}
.cta-btn:hover{transform:scale(1.04);background:rgba(255,255,255,.92)}
footer{padding:20px 24px;border-top:1px solid var(--bd);text-align:center;
  font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
"""

CD_JS = """
(function tick(){
  var ms=EVENT_DATE-Date.now();
  var v={d:ms>0?Math.floor(ms/86400000):0,h:ms>0?Math.floor(ms%86400000/3600000):0,
         m:ms>0?Math.floor(ms%3600000/60000):0,s:ms>0?Math.floor(ms%60000/1000):0};
  ['d','h','m','s'].forEach(function(k){
    var el=document.getElementById('cd-'+k);
    var val=String(v[k]).padStart(2,'0');
    if(el&&el.textContent!==val){
      el.textContent=val;
      if(k==='s'){el.classList.remove('lit');void el.offsetWidth;el.classList.add('lit');
        setTimeout(function(){el.classList.remove('lit')},350);}
    }
  });
  setTimeout(tick,1000);
})();
"""

def cd_html():
    return """
<div style="text-align:center;padding:clamp(36px,5vh,60px) 0">
  <p class="eye">Cuenta Regresiva al Evento</p>
  <div style="display:inline-flex;align-items:flex-start;gap:6px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <div id="cd-d" style="font-size:clamp(36px,8vw,68px);font-weight:700;letter-spacing:-.05em;
        font-variant-numeric:tabular-nums;min-width:clamp(70px,11vw,104px);text-align:center;padding:10px 6px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
        border-top-color:rgba(255,255,255,.12);border-radius:16px;color:#fff;
        transition:box-shadow .35s,border-color .35s">00</div>
      <span style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Días</span>
    </div>
    <span style="font-size:clamp(28px,6vw,52px);font-weight:300;color:rgba(255,255,255,.15);padding-top:10px">:</span>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <div id="cd-h" style="font-size:clamp(36px,8vw,68px);font-weight:700;letter-spacing:-.05em;
        font-variant-numeric:tabular-nums;min-width:clamp(70px,11vw,104px);text-align:center;padding:10px 6px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
        border-top-color:rgba(255,255,255,.12);border-radius:16px;color:#fff;
        transition:box-shadow .35s,border-color .35s">00</div>
      <span style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Horas</span>
    </div>
    <span style="font-size:clamp(28px,6vw,52px);font-weight:300;color:rgba(255,255,255,.15);padding-top:10px">:</span>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <div id="cd-m" style="font-size:clamp(36px,8vw,68px);font-weight:700;letter-spacing:-.05em;
        font-variant-numeric:tabular-nums;min-width:clamp(70px,11vw,104px);text-align:center;padding:10px 6px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
        border-top-color:rgba(255,255,255,.12);border-radius:16px;color:#fff;
        transition:box-shadow .35s,border-color .35s">00</div>
      <span style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Min</span>
    </div>
    <span style="font-size:clamp(28px,6vw,52px);font-weight:300;color:rgba(255,255,255,.15);padding-top:10px">:</span>
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
      <div id="cd-s" style="font-size:clamp(36px,8vw,68px);font-weight:700;letter-spacing:-.05em;
        font-variant-numeric:tabular-nums;min-width:clamp(70px,11vw,104px);text-align:center;padding:10px 6px;
        background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
        border-top-color:rgba(255,255,255,.12);border-radius:16px;color:#fff;
        transition:box-shadow .35s,border-color .35s">00</div>
      <span style="font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Seg</span>
    </div>
  </div>
  <style>.lit{border-color:rgba(245,197,24,.35)!important;box-shadow:0 0 28px rgba(245,197,24,.18)!important}</style>
</div>"""


# ── PAGE GENERATORS ──────────────────────────────────────────────────────────

def gen_site(d, out_dir):
    hl = d['horse_left']
    hr = d['horse_right']
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{d['event_name']} · {d['venue']}</title>
<style>{PN_CSS}
.hero{{text-align:center;padding:clamp(48px,7vh,88px) 0 clamp(28px,4vh,48px);animation:fadeUp .8s var(--ease) .1s both}}
.hero-tag{{font-size:11px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}}
.hero-h1{{font-size:clamp(2.2rem,6vw,5.5rem);font-weight:700;letter-spacing:-.035em;line-height:1.02;
  background:linear-gradient(160deg,#fff 25%,rgba(255,255,255,.6) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}}
.hero-p{{margin-top:14px;font-size:clamp(14px,2vw,17px);font-weight:400;color:var(--dim);letter-spacing:.01em}}
.info-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));
  border:1px solid var(--bd);border-radius:20px;overflow:hidden}}
.ic{{padding:18px 20px;border-right:1px solid var(--bd);border-bottom:1px solid var(--bd);transition:background .2s}}
.ic:nth-child(2n){{border-right:none}}.ic:hover{{background:rgba(255,255,255,.03)}}
.ic:nth-last-child(-n+2){{border-bottom:none}}
.ic-k{{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}}
.ic-v{{font-size:clamp(13px,1.9vw,17px);font-weight:600;letter-spacing:-.01em;color:#fff}}
.ic-v.g{{color:var(--gold)}}
.horses{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}}
@media(max-width:480px){{.horses{{grid-template-columns:1fr}}}}
</style>
</head>
<body>
<nav class="nav">
  <span class="nav-l">{d['venue']} · {d['city']}</span>
  <span class="nav-chip">{d['event_type']}</span>
  <span class="nav-r">{d.get('date_display','2026')}</span>
</nav>
<main>
  <div class="hero">
    <p class="hero-tag">{d['event_type']} · {d['city']}</p>
    <h1 class="hero-h1">{d['event_name'].replace(' vs ', '<br>vs<br>')}</h1>
    <p class="hero-p">{d['date_display']} · {d['venue']}</p>
  </div>

  <div style="text-align:center;margin-bottom:clamp(28px,4vh,44px);animation:fadeUp .8s var(--ease) .3s both">
    <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:100px;
      font-size:12px;font-weight:600;color:var(--gold);background:rgba(245,197,24,.07);
      border:1px solid rgba(245,197,24,.18)">
      🔥 <span id="fan-count">1,247</span> personas siguiendo este evento
    </div>
  </div>

  <div class="info-grid" style="animation:fadeUp .8s var(--ease) .2s both;margin-bottom:clamp(28px,4vh,44px)">
    <div class="ic"><div class="ic-k">Venue</div><div class="ic-v">{d['venue']}</div></div>
    <div class="ic"><div class="ic-k">Ciudad</div><div class="ic-v">{d['city']}</div></div>
    <div class="ic"><div class="ic-k">Fecha</div><div class="ic-v">{d['date_display']}</div></div>
    <div class="ic"><div class="ic-k">Formato</div><div class="ic-v g">{d['format']}</div></div>
    <div class="ic"><div class="ic-k">Distancia</div><div class="ic-v g">{d['distance']}</div></div>
    <div class="ic"><div class="ic-k">Premio</div><div class="ic-v g">{d['prize']}</div></div>
  </div>

  <div class="rule"></div>

  <div style="animation:fadeUp .8s var(--ease) .3s both;margin-bottom:clamp(28px,4vh,44px)">
    <p class="eye">Los Competidores</p>
    <div class="horses">
      <div class="card" style="text-align:center">
        {"<img src='"+hl['image']+"' style='width:100%;height:auto;border-radius:12px;margin-bottom:14px' alt='"+hl['name']+"'>" if hl.get('image') else ""}
        <div style="font-size:clamp(1.3rem,3vw,2rem);font-weight:700;letter-spacing:-.02em;margin-bottom:8px">{hl['name']}</div>
        <div class="pill pill-dim" style="margin-bottom:8px">{hl['cuadra']}</div><br>
        <div class="pill pill-gold">{hl.get('tag','')}</div>
        <div style="margin-top:12px;font-size:clamp(1.1rem,2.5vw,1.6rem);font-weight:700;color:var(--gold)">{hl.get('record','')}</div>
      </div>
      <div class="card" style="text-align:center">
        {"<img src='"+hr['image']+"' style='width:100%;height:auto;border-radius:12px;margin-bottom:14px;transform:scaleX(-1)' alt='"+hr['name']+"'>" if hr.get('image') else ""}
        <div style="font-size:clamp(1.3rem,3vw,2rem);font-weight:700;letter-spacing:-.02em;margin-bottom:8px">{hr['name']}</div>
        <div class="pill pill-dim" style="margin-bottom:8px">{hr['cuadra']}</div><br>
        <div class="pill pill-gold">{hr.get('tag','')}</div>
        <div style="margin-top:12px;font-size:clamp(1.1rem,2.5vw,1.6rem);font-weight:700;color:var(--gold)">{hr.get('record','')}</div>
      </div>
    </div>
  </div>

  <div class="rule"></div>
  {cd_html()}
  <div class="rule"></div>

  <div style="text-align:center;padding:clamp(32px,5vh,60px) 0 clamp(60px,10vh,100px);animation:fadeUp .8s var(--ease) .2s both">
    <div style="font-size:clamp(1.8rem,5vw,4rem);font-weight:700;letter-spacing:-.04em;line-height:1.05;margin-bottom:12px">
      No te pierdas<br><span style="color:var(--gold)">{d['event_name']}</span>
    </div>
    <p style="font-size:14px;color:var(--dim);margin-bottom:32px">{d['date_display']} · {d['venue']} · {d['city']}</p>
    <a class="cta-btn">Confirma Tu Lugar</a>
  </div>
</main>
<footer>{d['event_name']} · {d['venue']} · {d['city']} · Evento privado · Solo mayores de edad</footer>
<script>
var EVENT_DATE=new Date('{d['date_iso']}');
{CD_JS}
var c=1247;setInterval(function(){{c+=Math.floor(Math.random()*3);var el=document.getElementById('fan-count');if(el)el.textContent=c.toLocaleString('en-US');}},4000);
</script>
</body></html>"""
    path = os.path.join(out_dir, 'site.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    return path


def gen_duel(d, out_dir):
    hl = d['horse_left']
    hr = d['horse_right']
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{hl['name']} vs {hr['name']} · Mano a Mano</title>
<style>{PN_CSS}
#sparks{{position:fixed;inset:0;z-index:0;pointer-events:none}}
#flash{{position:fixed;inset:0;background:#fff;z-index:999;animation:pnFlash .5s ease .05s forwards}}
@keyframes pnFlash{{to{{opacity:0;pointer-events:none;visibility:hidden}}}}
.amb{{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden}}
.amb-l,.amb-r{{position:absolute;width:50%;height:60%;top:15%;
  background:radial-gradient(ellipse,rgba(255,255,255,.05) 0%,transparent 65%);filter:blur(90px)}}
.amb-l{{left:-5%}}.amb-r{{right:-5%;background:radial-gradient(ellipse,rgba(245,197,24,.06) 0%,transparent 65%)}}
.hero{{text-align:center;padding:clamp(48px,7vh,88px) 0 clamp(24px,4vh,40px);animation:fadeUp .8s var(--ease) .1s both}}
.hero-tag{{font-size:11px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}}
.hero-h1{{font-size:clamp(2.2rem,6vw,5.5rem);font-weight:700;letter-spacing:-.035em;line-height:1.02;
  background:linear-gradient(160deg,#fff 25%,rgba(255,255,255,.6) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}}
.hero-p{{margin-top:14px;font-size:clamp(14px,2vw,17px);font-weight:400;color:var(--dim)}}
.duel{{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;
  max-width:1000px;margin:0 auto;padding:0 clamp(12px,3vw,36px)}}
.hc{{display:flex;flex-direction:column;align-items:center;gap:clamp(12px,2vh,20px)}}
.hc.hl{{animation:slideL .9s var(--ease) .3s both}}.hc.hr{{animation:slideR .9s var(--ease) .45s both}}
.h-img{{width:100%;height:auto;display:block;border-radius:18px;
  box-shadow:0 40px 80px -20px rgba(0,0,0,.85),0 1px 0 rgba(255,255,255,.05) inset;
  transition:transform .5s var(--ease),box-shadow .5s}}
.h-img:hover{{transform:translateY(-5px) scale(1.008);
  box-shadow:0 56px 100px -20px rgba(0,0,0,.9),0 0 60px -10px rgba(245,197,24,.15),0 1px 0 rgba(255,255,255,.06) inset}}
.h-img.flip{{transform:scaleX(-1)}}.h-img.flip:hover{{transform:scaleX(-1) translateY(-5px) scale(1.008)}}
.h-name{{font-size:clamp(1.2rem,3vw,2rem);font-weight:700;letter-spacing:-.02em;text-align:center}}
.vs-col{{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;flex-shrink:0;padding:clamp(36px,7vh,70px) clamp(10px,2vw,22px) 0;
  animation:fadeUp .8s var(--ease) .5s both}}
.vs-bolt{{font-size:clamp(18px,3vw,28px);animation:boltFlash 1.5s ease infinite}}
.vs-txt{{font-size:clamp(2.2rem,5vw,4.2rem);font-weight:800;letter-spacing:-.04em;line-height:1;
  background:linear-gradient(180deg,#fff 0%,var(--gold) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  animation:vsPulse 2.8s ease infinite}}
.vs-sub{{font-size:9px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;
  color:var(--muted);text-align:center;line-height:1.55}}
.vs-dist{{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  padding:5px 12px;border-radius:100px;background:rgba(245,197,24,.07);
  border:1px solid rgba(245,197,24,.18);color:var(--gold)}}
.vote-wrap{{max-width:520px;margin:0 auto;text-align:center;padding:clamp(28px,4vh,48px) 0}}
.vote-h{{font-size:clamp(1.4rem,3.5vw,2.4rem);font-weight:700;letter-spacing:-.025em;margin-bottom:8px}}
.vote-h em{{color:var(--gold);font-style:normal}}
.vote-btns{{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0 12px}}
.vbtn{{padding:14px 16px;border-radius:14px;background:var(--s1);border:1px solid var(--bd2);
  cursor:pointer;font-family:var(--font);font-size:13px;font-weight:600;color:#fff;
  transition:all .25s var(--ease)}}
.vbtn:hover{{background:rgba(255,255,255,.08);transform:scale(1.02);border-color:rgba(245,197,24,.4)}}
.vbtn:active{{transform:scale(.97)}}
.vote-r{{font-size:12px;color:var(--dim);min-height:18px;letter-spacing:.06em;text-transform:uppercase}}
@media(max-width:520px){{.vs-sub{{display:none}}.duel{{padding:0 8px}}.vote-btns{{grid-template-columns:1fr}}}}
</style>
</head>
<body>
<div id="flash"></div>
<canvas id="sparks"></canvas>
<div class="amb"><div class="amb-l"></div><div class="amb-r"></div></div>
<nav class="nav">
  <span class="nav-l">{d['venue']} · {d['city']}</span>
  <span class="nav-chip">Mano a Mano</span>
  <span class="nav-r">{d.get('date_display','2026')}</span>
</nav>
<main>
  <div class="hero">
    <p class="hero-tag">{d.get('tagline', d['event_type'] + ' · ' + d['city'])}</p>
    <h1 class="hero-h1">El Choque<br>de Campeonas</h1>
    <p class="hero-p">{d['date_display']} · {d['venue']}</p>
  </div>

  <div style="text-align:center;margin-bottom:clamp(20px,3vh,36px)">
    <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:100px;
      font-size:12px;font-weight:600;color:var(--gold);background:rgba(245,197,24,.07);
      border:1px solid rgba(245,197,24,.18)">
      🔥 <span id="fan-count">1,247</span> personas ya están hablando de este duelo
    </div>
  </div>

  <section class="duel">
    <div class="hc hl">
      {"<img src='"+hl['image']+"' alt='"+hl['name']+"' class='h-img' loading='eager'>" if hl.get('image') else "<div style='width:100%;aspect-ratio:4/5;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:3rem'>🐎</div>"}
      <div class="h-name">{hl['name']}</div>
      <div class="pill pill-dim">{hl['cuadra']}</div>
      <div class="pill pill-gold">{hl.get('tag','')}</div>
    </div>
    <div class="vs-col">
      <span class="vs-bolt">⚡</span>
      <div class="vs-txt">VS</div>
      <div class="vs-sub">{d['format'].replace(' ',chr(10))}</div>
      <div class="vs-dist">{d['distance']}</div>
    </div>
    <div class="hc hr">
      {"<img src='"+hr['image']+"' alt='"+hr['name']+"' class='h-img flip' loading='eager'>" if hr.get('image') else "<div style='width:100%;aspect-ratio:4/5;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:3rem'>🐎</div>"}
      <div class="h-name">{hr['name']}</div>
      <div class="pill pill-dim">{hr['cuadra']}</div>
      <div class="pill pill-gold">{hr.get('tag','')}</div>
    </div>
  </section>

  <div class="rule"></div>
  {cd_html()}
  <div class="rule"></div>

  <div class="vote-wrap">
    <div class="vote-h">¿Con quién <em>vas</em>?</div>
    <p style="font-size:14px;color:var(--dim);font-weight:400">Tu voto cuenta — que gane la mejor</p>
    <div class="vote-btns">
      <button class="vbtn" onclick="doVote('left')">⚡ {hl['name']}</button>
      <button class="vbtn" onclick="doVote('right')">🌑 {hr['name']}</button>
    </div>
    <div class="vote-r" id="vote-result"></div>
  </div>

  <div style="text-align:center;padding:clamp(20px,3vh,40px) 0 clamp(60px,10vh,100px)">
    <div style="font-size:clamp(1.8rem,5vw,4rem);font-weight:700;letter-spacing:-.04em;line-height:1.05;margin-bottom:12px">
      No te quedes<br><span style="color:var(--gold)">sin verlo</span>
    </div>
    <p style="font-size:14px;color:var(--dim);margin-bottom:32px">Cupo limitado · {d['date_display']} · {d['venue']}</p>
    <a class="cta-btn">Confirma Tu Lugar</a>
  </div>
</main>
<footer>{hl['name']} vs {hr['name']} · {d['venue']} · {d['city']} · Solo mayores de edad</footer>
<script>
var EVENT_DATE=new Date('{d['date_iso']}');
{CD_JS}
var c=1247;setInterval(function(){{c+=Math.floor(Math.random()*3);var el=document.getElementById('fan-count');if(el)el.textContent=c.toLocaleString('en-US');}},4000);
var votes={{left:0,right:0}};
function doVote(s){{votes[s]++;var t=votes.left+votes.right;var p=Math.round(votes.left/t*100);
  var el=document.getElementById('vote-result');
  if(el){{el.textContent='⚡ {hl['name']} '+p+'%  ·  {hr['name']} '+(100-p)+'% 🌑';
    el.style.color=s==='left'?'#F5C518':'rgba(255,255,255,.6)';}}}}
(function(){{var cv=document.getElementById('sparks'),c=cv.getContext('2d'),pts=[];
  function rsz(){{cv.width=innerWidth;cv.height=innerHeight}}rsz();addEventListener('resize',rsz);
  function P(x,y){{this.x=x;this.y=y;this.vx=(Math.random()-.5)*3;this.vy=-Math.random()*2.2-.4;
    this.a=1;this.r=Math.random()*2+.6;var cols=[[245,197,24],[255,255,220],[255,160,40]];
    this.col=cols[Math.floor(Math.random()*cols.length)];}}
  P.prototype.step=function(){{this.x+=this.vx;this.y+=this.vy;this.vy+=.032;this.a-=.013+Math.random()*.009;}};
  P.prototype.draw=function(){{c.save();c.globalAlpha=Math.max(0,this.a);c.shadowBlur=7;
    c.shadowColor='rgba('+this.col+','+this.a+')';c.fillStyle='rgba('+this.col+',1)';
    c.beginPath();c.arc(this.x,this.y,this.r,0,Math.PI*2);c.fill();c.restore();}};
  setInterval(function(){{var cx=innerWidth/2;for(var i=0;i<3;i++)pts.push(new P(cx+(Math.random()-.5)*50,innerHeight*.5+(Math.random()-.5)*80));}},100);
  (function loop(){{requestAnimationFrame(loop);c.clearRect(0,0,cv.width,cv.height);
    pts=pts.filter(function(p){{p.step();p.draw();return p.a>0;}});}})();
  setTimeout(function(){{var s=[3,-3,2,-2,1,0];s.forEach(function(v,i){{setTimeout(function(){{document.body.style.transform='translateX('+v+'px)';}},i*42);}});setTimeout(function(){{document.body.style.transform='';}},s.length*42);}},700);
}})();
</script>
</body></html>"""
    path = os.path.join(out_dir, 'duel.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    return path


def gen_infographic(d, out_dir):
    hl = d['horse_left']
    hr = d['horse_right']
    wl = hl.get('win_pct', 75)
    wr = hr.get('win_pct', 60)
    sl = hl.get('speed_rating', 85)
    sr = hr.get('speed_rating', 78)
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{d['event_name']} · Infographic</title>
<style>{PN_CSS}
@keyframes countUp{{from{{opacity:0;transform:translateY(8px)}}to{{opacity:1;transform:none}}}}
.hero{{text-align:center;padding:clamp(44px,7vh,80px) 0 clamp(24px,4vh,40px);animation:fadeUp .8s var(--ease) .1s both}}
.hero-tag{{font-size:11px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}}
.hero-h1{{font-size:clamp(2rem,5.5vw,5rem);font-weight:700;letter-spacing:-.035em;line-height:1.02;
  background:linear-gradient(160deg,#fff 25%,rgba(255,255,255,.6) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}}
.hero-p{{margin-top:14px;font-size:clamp(14px,2vw,17px);font-weight:400;color:var(--dim)}}
.matchup{{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
  padding:clamp(20px,3vh,36px) 0;animation:fadeUp .8s var(--ease) .3s both}}
.ms{{display:flex;flex-direction:column;align-items:center;gap:8px}}
.ms.ml{{animation:slideL .8s var(--ease) .3s both}}.ms.mr{{animation:slideR .8s var(--ease) .45s both}}
.mn{{font-size:clamp(1.2rem,3vw,2.4rem);font-weight:800;letter-spacing:-.03em;line-height:1;text-align:center}}
.mr-rec{{font-size:clamp(1rem,2.2vw,1.6rem);font-weight:700;letter-spacing:-.02em;color:var(--gold)}}
.vs-m{{display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 clamp(12px,2.5vw,28px);flex-shrink:0}}
.vs-bolt{{font-size:clamp(16px,3vw,26px);animation:boltFlash 1.5s ease infinite}}
.vs-t{{font-size:clamp(1.8rem,4.5vw,3.6rem);font-weight:800;letter-spacing:-.04em;line-height:1;
  background:linear-gradient(180deg,#fff 0%,var(--gold) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  animation:vsPulse 2.8s ease infinite}}
.stat-row{{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-bottom:14px}}
.stat-n{{font-size:clamp(20px,3.2vw,30px);font-weight:700;letter-spacing:-.03em}}
.stat-n.l{{color:var(--gold);text-align:right}}.stat-n.r{{color:rgba(255,255,255,.7);text-align:left}}
.stat-label{{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);text-align:center;padding:0 4px;min-width:80px}}
.bar-wrap{{height:6px;border-radius:100px;background:rgba(255,255,255,.07);overflow:hidden}}
.bar-l{{height:100%;border-radius:100px;background:linear-gradient(90deg,rgba(245,197,24,.3),var(--gold));margin-left:auto;animation:fillBar .9s var(--ease) .5s both}}
.bar-r{{height:100%;border-radius:100px;background:linear-gradient(90deg,rgba(255,255,255,.3),rgba(255,255,255,.6));animation:fillBar .9s var(--ease) .5s both}}
.kn-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;
  padding:clamp(24px,4vh,44px) 0;animation:fadeUp .8s var(--ease) .2s both}}
.info-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  border:1px solid var(--bd);border-radius:20px;overflow:hidden;animation:fadeUp .8s var(--ease) .2s both}}
.ic{{padding:16px 20px;border-right:1px solid var(--bd);border-bottom:1px solid var(--bd);transition:background .2s}}
.ic:nth-child(2n){{border-right:none}}.ic:nth-last-child(-n+2){{border-bottom:none}}.ic:hover{{background:rgba(255,255,255,.03)}}
.ic-k{{font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}}
.ic-v{{font-size:clamp(13px,1.9vw,16px);font-weight:600;letter-spacing:-.01em;color:#fff}}
.ic-v.g{{color:var(--gold)}}
.hype-row{{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}}
.hype-top{{display:flex;justify-content:space-between;align-items:center}}
.hype-lbl{{font-size:12px;font-weight:600;letter-spacing:.06em;color:var(--dim)}}
.hype-pct{{font-size:13px;font-weight:700;color:var(--gold)}}
.hype-track{{height:8px;border-radius:100px;background:rgba(255,255,255,.07);overflow:hidden}}
.hype-fill{{height:100%;border-radius:100px;background:linear-gradient(90deg,rgba(245,197,24,.4),var(--gold))}}
.fomo{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;animation:fadeUp .8s var(--ease) .2s both}}
</style>
</head>
<body>
<nav class="nav">
  <span class="nav-l">{d['venue']} · {d['city']}</span>
  <span class="nav-chip">Infographic</span>
  <span class="nav-r">{d.get('date_display','2026')}</span>
</nav>
<main>
  <div class="hero">
    <p class="hero-tag">{d['event_type']} · {d['city']}</p>
    <h1 class="hero-h1">{d['event_name']}</h1>
    <p class="hero-p">{d['date_display']} · {d['venue']}</p>
  </div>

  <div class="matchup">
    <div class="ms ml">
      <div class="mn">{hl['name']}</div>
      <div class="pill pill-dim">{hl['cuadra']}</div>
      <div class="mr-rec">{hl.get('record','—')}</div>
      <div class="pill pill-gold">{hl.get('tag','')}</div>
    </div>
    <div class="vs-m">
      <span class="vs-bolt">⚡</span>
      <div class="vs-t">VS</div>
    </div>
    <div class="ms mr">
      <div class="mn">{hr['name']}</div>
      <div class="pill pill-dim">{hr['cuadra']}</div>
      <div class="mr-rec">{hr.get('record','—')}</div>
      <div class="pill pill-gold">{hr.get('tag','')}</div>
    </div>
  </div>

  <div class="rule"></div>

  <div style="animation:fadeUp .8s var(--ease) .2s both;padding:clamp(24px,4vh,44px) 0">
    <p class="eye">Comparativa de Estadísticas</p>
    <div class="stat-row">
      <div><div style="text-align:right;margin-bottom:6px"><span class="stat-n l">{wl}%</span></div>
        <div class="bar-wrap"><div class="bar-l" style="--w:{wl}%"></div></div></div>
      <div class="stat-label">Win %</div>
      <div><div style="text-align:left;margin-bottom:6px"><span class="stat-n r">{wr}%</span></div>
        <div class="bar-wrap"><div class="bar-r" style="--w:{wr}%"></div></div></div>
    </div>
    <div class="stat-row">
      <div><div style="text-align:right;margin-bottom:6px"><span class="stat-n l">{sl}</span></div>
        <div class="bar-wrap"><div class="bar-l" style="--w:{sl}%"></div></div></div>
      <div class="stat-label">Speed Rating</div>
      <div><div style="text-align:left;margin-bottom:6px"><span class="stat-n r">{sr}</span></div>
        <div class="bar-wrap"><div class="bar-r" style="--w:{sr}%"></div></div></div>
    </div>
  </div>

  <div class="kn-grid">
    <div class="card" style="text-align:center">
      <div style="font-size:24px;margin-bottom:10px">⚡</div>
      <div style="font-size:clamp(1.6rem,4vw,2.6rem);font-weight:700;letter-spacing:-.04em;color:var(--gold);margin-bottom:4px" id="kn-wins">0</div>
      <div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Victorias {hl['name']}</div>
    </div>
    <div class="card" style="text-align:center">
      <div style="font-size:24px;margin-bottom:10px">💰</div>
      <div style="font-size:clamp(1.6rem,4vw,2.6rem);font-weight:700;letter-spacing:-.04em;color:var(--gold);margin-bottom:4px" id="kn-prize">$0</div>
      <div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Premio Total</div>
    </div>
    <div class="card" style="text-align:center">
      <div style="font-size:24px;margin-bottom:10px">📍</div>
      <div style="font-size:clamp(1.6rem,4vw,2.6rem);font-weight:700;letter-spacing:-.04em;color:var(--gold);margin-bottom:4px" id="kn-dist">0</div>
      <div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Metros</div>
    </div>
    <div class="card" style="text-align:center">
      <div style="font-size:24px;margin-bottom:10px">👁</div>
      <div style="font-size:clamp(1.6rem,4vw,2.6rem);font-weight:700;letter-spacing:-.04em;color:var(--gold);margin-bottom:4px" id="kn-fans">0</div>
      <div style="font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)">Siguiendo</div>
    </div>
  </div>

  <div class="rule"></div>
  {cd_html()}
  <div class="rule"></div>

  <div style="margin-bottom:clamp(28px,4vh,44px)">
    <p class="eye">Datos del Evento</p>
    <div class="info-grid">
      <div class="ic"><div class="ic-k">Venue</div><div class="ic-v">{d['venue']}</div></div>
      <div class="ic"><div class="ic-k">Ciudad</div><div class="ic-v">{d['city']}</div></div>
      <div class="ic"><div class="ic-k">Fecha</div><div class="ic-v">{d['date_display']}</div></div>
      <div class="ic"><div class="ic-k">Formato</div><div class="ic-v g">{d['format']}</div></div>
      <div class="ic"><div class="ic-k">Distancia</div><div class="ic-v g">{d['distance']}</div></div>
      <div class="ic"><div class="ic-k">Premio</div><div class="ic-v g">{d['prize']}</div></div>
    </div>
  </div>

  <div style="animation:fadeUp .8s var(--ease) .2s both;margin-bottom:clamp(28px,4vh,44px)">
    <p class="eye">Oracle Pulse — Hype</p>
    <div class="hype-row">
      <div class="hype-top"><span class="hype-lbl">Expectativa del Público</span><span class="hype-pct">94%</span></div>
      <div class="hype-track"><div class="hype-fill" style="width:94%;animation:fillBar .9s var(--ease) .3s both"></div></div>
    </div>
    <div class="hype-row">
      <div class="hype-top"><span class="hype-lbl">Rivalidad Histórica</span><span class="hype-pct">88%</span></div>
      <div class="hype-track"><div class="hype-fill" style="width:88%;animation:fillBar .9s var(--ease) .4s both"></div></div>
    </div>
    <div class="hype-row">
      <div class="hype-top"><span class="hype-lbl">Interacción en Redes</span><span class="hype-pct">76%</span></div>
      <div class="hype-track"><div class="hype-fill" style="width:76%;animation:fillBar .9s var(--ease) .5s both"></div></div>
    </div>
  </div>

  <div class="fomo">
    <div class="card"><span style="font-size:24px;display:block;margin-bottom:10px">🔥</span>
      <div style="font-size:clamp(14px,2vw,17px);font-weight:600;letter-spacing:-.01em;margin-bottom:8px">{hl['name']} — {hl.get('record','')}</div>
      <p style="font-size:13px;color:var(--dim);line-height:1.65">Llega con {wl}% de efectividad y un speed rating de {sl}. El rival más difícil de la temporada.</p>
    </div>
    <div class="card"><span style="font-size:24px;display:block;margin-bottom:10px">🌑</span>
      <div style="font-size:clamp(14px,2vw,17px);font-weight:600;letter-spacing:-.01em;margin-bottom:8px">{hr['name']} — {hr.get('record','')}</div>
      <p style="font-size:13px;color:var(--dim);line-height:1.65">Con {wr}% y speed {sr}. Nadie la descarta — viene de su mejor época y tiene hambre de revancha.</p>
    </div>
    <div class="card"><span style="font-size:24px;display:block;margin-bottom:10px">🏆</span>
      <div style="font-size:clamp(14px,2vw,17px);font-weight:600;letter-spacing:-.01em;margin-bottom:8px">{d['prize']} en Juego</div>
      <p style="font-size:13px;color:var(--dim);line-height:1.65">{d['distance']} de pura adrenalina. Una carrera que decide quién se lleva el premio más grande de la temporada.</p>
    </div>
  </div>

  <div style="text-align:center;padding:clamp(28px,4vh,48px) 0 clamp(60px,10vh,100px)">
    <div style="font-size:clamp(1.8rem,5vw,4rem);font-weight:700;letter-spacing:-.04em;line-height:1.05;margin-bottom:12px">
      No te pierdas<br><span style="color:var(--gold)">{d['event_name']}</span>
    </div>
    <p style="font-size:14px;color:var(--dim);margin-bottom:32px">{d['date_display']} · {d['venue']} · {d['city']}</p>
    <a class="cta-btn">Confirma Tu Lugar</a>
  </div>
</main>
<footer>{d['event_name']} · {d['venue']} · {d['city']} · Solo mayores de edad</footer>
<script>
var EVENT_DATE=new Date('{d['date_iso']}');
{CD_JS}
(function(){{
  var winsTarget={hl.get('record','0-0-0').split('-')[0]};
  var prizeTarget=parseInt('{d['prize']}'.replace(/[^0-9]/g,''))||5000;
  var distTarget=parseInt('{d['distance']}'.replace(/[^0-9]/g,''))||300;
  function ac(id,target,prefix,suffix,dur){{
    var el=document.getElementById(id);if(!el)return;var start=null;
    (function step(ts){{if(!start)start=ts;var pct=Math.min((ts-start)/dur,1);
      var e=1-Math.pow(1-pct,3);el.textContent=(prefix||'')+Math.floor(e*target).toLocaleString('en-US')+(suffix||'');
      if(pct<1)requestAnimationFrame(step);else el.textContent=(prefix||'')+target.toLocaleString('en-US')+(suffix||'');
    }})(0);
  }}
  setTimeout(function(){{
    ac('kn-wins',winsTarget,'','',1200);
    ac('kn-prize',prizeTarget,'$','',1400);
    ac('kn-dist',distTarget,'','',1000);
    ac('kn-fans',1247,'','',1600);
  }},300);
}})();
</script>
</body></html>"""
    path = os.path.join(out_dir, 'infographic.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    return path


def gen_video_ad(d, out_dir):
    hl = d['horse_left']
    hr = d['horse_right']
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{d['event_name']} · Video Ad</title>
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
:root{{--gold:#F5C518;--font:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',Arial,sans-serif}}
body{{background:#000;color:#fff;font-family:var(--font);-webkit-font-smoothing:antialiased;overflow:hidden;height:100svh;display:flex;align-items:center;justify-content:center}}
.ad{{position:relative;width:100%;max-width:420px;aspect-ratio:9/16;background:#000;overflow:hidden;border-radius:24px;box-shadow:0 40px 100px -20px rgba(0,0,0,.9)}}
@media(min-width:600px){{.ad{{max-width:380px}}}}
.scene{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:32px;text-align:center;opacity:0;transition:opacity .6s ease;pointer-events:none}}
.scene.active{{opacity:1;pointer-events:auto}}
.s-eye{{font-size:11px;font-weight:600;letter-spacing:.25em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:16px}}
.s-h1{{font-size:clamp(2rem,8vw,3.2rem);font-weight:700;letter-spacing:-.035em;line-height:1;
  background:linear-gradient(160deg,#fff 20%,rgba(255,255,255,.65) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}}
.s-h1 .gold{{background:linear-gradient(160deg,var(--gold),#FF8C00);-webkit-background-clip:text;background-clip:text}}
.s-p{{margin-top:14px;font-size:14px;font-weight:400;color:rgba(255,255,255,.55);line-height:1.55}}
.s-big{{font-size:clamp(3rem,14vw,6rem);font-weight:800;letter-spacing:-.05em;line-height:.9}}
.vs-badge{{font-size:clamp(2rem,9vw,4rem);font-weight:800;letter-spacing:-.04em;
  background:linear-gradient(180deg,#fff 0%,var(--gold) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}}
.stat-row{{display:flex;gap:24px;justify-content:center;margin-top:20px}}
.stat{{text-align:center}}.stat-n{{font-size:2.2rem;font-weight:700;color:var(--gold);letter-spacing:-.04em}}
.stat-l{{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-top:4px}}
.play-btn{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:50;cursor:pointer;transition:opacity .3s}}
.play-btn:hover{{background:rgba(0,0,0,.4)}}
.play-circle{{width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);
  display:flex;align-items:center;justify-content:center;font-size:28px;backdrop-filter:blur(10px)}}
.prog{{position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,.1)}}
.prog-fill{{height:100%;background:var(--gold);width:0;transition:width .1s linear}}
.scene-bg{{position:absolute;inset:0;z-index:0}}
.scene-content{{position:relative;z-index:1}}
.bg-glow-l{{position:absolute;left:-20%;top:10%;width:60%;height:70%;
  background:radial-gradient(ellipse,rgba(255,255,255,.08) 0%,transparent 65%);filter:blur(60px)}}
.bg-glow-r{{position:absolute;right:-20%;bottom:10%;width:60%;height:70%;
  background:radial-gradient(ellipse,rgba(245,197,24,.1) 0%,transparent 65%);filter:blur(60px)}}
</style>
</head>
<body>
<div class="ad" id="ad">
  <div id="play-overlay" class="play-btn">
    <div class="play-circle">▶</div>
  </div>
  <div class="prog"><div class="prog-fill" id="prog"></div></div>

  <!-- Scene 1 -->
  <div class="scene" id="s1">
    <div class="scene-bg"><div class="bg-glow-l"></div><div class="bg-glow-r"></div></div>
    <div class="scene-content">
      <p class="s-eye">{d['event_type']}</p>
      <h1 class="s-big">⚡</h1>
      <h2 class="s-h1" style="margin-top:12px">{d['event_name'].split(' vs ')[0] if ' vs ' in d['event_name'] else d['event_name']}</h2>
      <p class="s-p">{hl['cuadra']}</p>
    </div>
  </div>

  <!-- Scene 2 -->
  <div class="scene" id="s2">
    <div class="scene-bg"><div class="bg-glow-r"></div></div>
    <div class="scene-content">
      <p class="s-eye">El Rival</p>
      <h1 class="s-big">🌑</h1>
      <h2 class="s-h1" style="margin-top:12px">{hr['name']}</h2>
      <p class="s-p">{hr['cuadra']} · {hr.get('record','')}</p>
    </div>
  </div>

  <!-- Scene 3 - VS -->
  <div class="scene" id="s3">
    <div class="scene-bg"><div class="bg-glow-l"></div><div class="bg-glow-r"></div></div>
    <div class="scene-content">
      <h2 class="s-h1">{hl['name'].split()[0] if hl['name'] else ''}</h2>
      <div class="vs-badge" style="margin:12px 0">VS</div>
      <h2 class="s-h1">{hr['name'].split()[0] if hr['name'] else ''}</h2>
      <p class="s-p" style="margin-top:20px">{d['format']} · {d['distance']}</p>
    </div>
  </div>

  <!-- Scene 4 - Stats -->
  <div class="scene" id="s4">
    <div class="scene-content">
      <p class="s-eye">Las Cifras</p>
      <div class="stat-row">
        <div class="stat"><div class="stat-n">{hl.get('win_pct',75)}%</div><div class="stat-l">Win %</div></div>
        <div class="stat"><div class="stat-n">{hl.get('speed_rating',85)}</div><div class="stat-l">Speed</div></div>
        <div class="stat"><div class="stat-n">{d['prize']}</div><div class="stat-l">Premio</div></div>
      </div>
    </div>
  </div>

  <!-- Scene 5 - Event details -->
  <div class="scene" id="s5">
    <div class="scene-bg"><div class="bg-glow-l"></div></div>
    <div class="scene-content">
      <p class="s-eye">El Evento</p>
      <h2 class="s-h1">{d['venue']}</h2>
      <p class="s-p" style="margin-top:12px;font-size:16px;color:rgba(255,255,255,.75)">{d['city']}</p>
      <p class="s-p">{d['date_display']}</p>
    </div>
  </div>

  <!-- Scene 6 - CTA -->
  <div class="scene" id="s6">
    <div class="scene-bg"><div class="bg-glow-l"></div><div class="bg-glow-r"></div></div>
    <div class="scene-content">
      <p class="s-eye">No Te Pierdas</p>
      <h2 class="s-h1"><span class="gold">{d['event_name']}</span></h2>
      <p class="s-p" style="margin-top:16px">{d['date_display']}</p>
      <div style="margin-top:24px;padding:14px 36px;background:#fff;color:#000;border-radius:100px;
        font-size:14px;font-weight:700;letter-spacing:-.01em;display:inline-block">
        Confirma Tu Lugar
      </div>
    </div>
  </div>
</div>

<script>
var scenes=[null,'s1','s2','s3','s4','s5','s6'];
var durations=[0,5000,5000,5000,5000,5000,5000];
var current=0,timer=null,elapsed=0,total=30000,running=false;

document.getElementById('play-overlay').onclick=function(){{
  this.style.display='none';
  showScene(1);running=true;
  var last=Date.now();
  (function tick(){{
    if(!running)return;
    var now=Date.now();elapsed+=now-last;last=now;
    document.getElementById('prog').style.width=(elapsed/total*100)+'%';
    requestAnimationFrame(tick);
  }})();
  advance();
}};

function showScene(n){{
  document.querySelectorAll('.scene').forEach(function(s){{s.classList.remove('active')}});
  var el=document.getElementById('s'+n);
  if(el)el.classList.add('active');
  current=n;
  clearTimeout(timer);
  if(n<scenes.length-1)timer=setTimeout(function(){{showScene(n+1)}},durations[n]||5000);
  else timer=setTimeout(function(){{
    elapsed=0;current=0;running=false;
    document.querySelectorAll('.scene').forEach(function(s){{s.classList.remove('active')}});
    document.getElementById('prog').style.width='0';
    document.getElementById('play-overlay').style.display='flex';
  }},durations[n]||5000);
}}
function advance(){{showScene(current<6?current+1:1)}}
</script>
</body></html>"""
    path = os.path.join(out_dir, 'video-ad.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    return path


# ── MAIN ────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate_package.py events/<slug>/event.json")
        sys.exit(1)

    json_path = sys.argv[1]
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)

    out_dir = os.path.dirname(json_path)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n🐎  Pista Noir · Generating event package...")
    print(f"    Event : {data['event_name']}")
    print(f"    Venue : {data['venue']} · {data['city']}")
    print(f"    Date  : {data.get('date_display','')}")
    print(f"    Output: {out_dir}/\n")

    files = []
    files.append(gen_site(data, out_dir));         print(f"  ✓  site.html")
    files.append(gen_duel(data, out_dir));          print(f"  ✓  duel.html")
    files.append(gen_infographic(data, out_dir));   print(f"  ✓  infographic.html")
    files.append(gen_video_ad(data, out_dir));      print(f"  ✓  video-ad.html")

    slug = os.path.basename(out_dir)
    base = "https://guttix1.github.io/Digital-flyer-"
    print(f"\n✅  Package complete! Live URLs after push:\n")
    for name in ['site.html','duel.html','infographic.html','video-ad.html']:
        print(f"    {base}/events/{slug}/{name}")
    print()

if __name__ == '__main__':
    main()
