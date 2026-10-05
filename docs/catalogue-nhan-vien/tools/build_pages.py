#!/usr/bin/env python3
"""Sinh các trang P11+ của catalogue theo cùng khung với P02–P10."""
import json, pathlib, sys

OUT = pathlib.Path(__file__).parent.parent / "pages"
TOTAL = 18
LOGO = "/_blob/dcbbfdd90e3d4f4acd3dc70b28ef4ae6"
B = {
    "kpi": "99b0b11fb5cb5a1c32cd87b47f577abc", "kpi_dd": "07e42a41ed8cf537a60fa63f6f3e7d26",
    "bell": "8cb0c2a5f87f444e98d19cf61f8de05d", "account": "7720768ae657e2dc281234e0ffa85475",
    "dd_pt": "2d9aa658f759f4ffef77a2cf3863c158", "dd_hp": "040c0d743ac77d3be6e60272cd4bd2ee",
    "sale_appt": "bc63afcb3a2ce8ec75b16261b0e08f4e", "sale_tv": "6880df41d6b0fabeca89c125c4421b47",
    "tele_data": "ed8d2932124e8d11fb4c1ccc8932498f", "mkt_video": "8ad79767e5df9daaef9476cc40f17b76",
    "community": "6e80fd5260fcf7f93e89146d7f184897", "meetings": "9eb439fa4da12ff58e14ffb346690243",
}

BASE_CSS = """body{margin:0}
.pg{width:794px;height:1123px;box-sizing:border-box;padding:48px 56px 36px;background:#F7FBFB;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:#1B2020;display:flex;flex-direction:column;gap:%(gap)spx;overflow:hidden}
.top{display:flex;align-items:center;gap:12px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#4A5A59}
.top img{width:30px;height:30px;border-radius:50%%;background:#0F1A1A;object-fit:contain}
.sp{flex:1;height:1px;background:#C3D3D2}
.hd{display:flex;align-items:flex-end;gap:18px}
.no{font-size:84px;line-height:.78;font-weight:800;color:#067B7F;letter-spacing:-.04em}
h1{margin:0;font-size:32px;line-height:1.15;font-weight:800;text-wrap:balance}
.lead{margin:6px 0 0;font-size:14.5px;line-height:1.55;color:#3D4D4C}
h2{margin:0 0 8px;font-size:15px;font-weight:800;color:#06686C}
.phone{position:relative;width:200px;border:7px solid #1B2020;border-radius:30px;overflow:hidden;box-shadow:0 16px 36px rgba(6,95,99,.18);background:#fff;flex-shrink:0}
.phone img{display:block;width:100%%}
.pin{position:absolute;width:26px;height:26px;border-radius:50%%;background:#067B7F;color:#fff;font-size:13px;font-weight:800;display:grid;place-items:center;box-shadow:0 0 0 3px #fff}
.cap{font-size:12px;color:#4A5A59;text-align:center;margin-top:8px;font-weight:600}
.steps{display:flex;flex-direction:column;gap:%(sgap)spx;margin:0;padding:0;list-style:none}
.steps li{display:flex;gap:10px;font-size:13.5px;line-height:1.45}
.n{flex-shrink:0;width:24px;height:24px;border-radius:50%%;background:#067B7F;color:#fff;font-size:12.5px;font-weight:800;display:grid;place-items:center;margin-top:1px}
.box{background:#fff;border:1px solid #DCEEED;border-radius:16px;padding:12px 15px;font-size:13px;line-height:1.5}
.box p{margin:0 0 5px}.box p:last-child{margin:0}
.tip{background:#FFF4EA;border:1px solid #F2D2B4;border-radius:16px;padding:11px 16px;font-size:13.5px;line-height:1.5}
.warn{background:#FDECEC;border:1px solid #F4C4BF;border-radius:16px;padding:12px 15px;font-size:13px;line-height:1.5;color:#7A1C14}
.warn h2{color:#B42318}
.g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips span{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#EEF5F5;color:#33504F}
.ft{margin-top:auto;display:flex;justify-content:space-between;font-size:12px;color:#5B6B6A;border-top:1px solid #DCEEED;padding-top:10px}
"""

DOC = """<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&amp;display=swap">
<style>
{css}</style>
</helmet>
<div class="pg">
  <div class="top"><img src="{logo}" alt=""><span>Cẩm nang nhân viên · App Dr Tuấn Hùng</span><span class="sp"></span><span>Phần {no}</span></div>
  <div class="hd"><span class="no">{no}</span><div><h1>{h1}</h1><p class="lead">{lead}</p></div></div>
{body}
  <div class="ft"><span>Dr Tuấn Hùng · Lưu hành nội bộ</span><span>Trang {page}/{total}</span></div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":794,"height":1123}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""


def phone(key, alt, cap, pins):
    ps = "\n".join(
        f'        <span class="pin" style="left: {x}px; top: {y}px">{n}</span>' for n, x, y in pins
    )
    return f"""    <div>
      <div class="phone">
        <img src="/_blob/{B[key]}" alt="{alt}">
{ps}
      </div>
      <div class="cap">{cap}</div>
    </div>"""


def steps(items):
    lis = "\n".join(
        f'      <li><span class="n">{i}</span><span>{t}</span></li>' for i, t in items
    )
    return f"""    <ol class="steps" style="flex: 1; min-width: 0">
{lis}
    </ol>"""


def row(*parts):
    inner = "\n".join(parts)
    return f"""  <div style="display: flex; gap: 18px; align-items: flex-start">
{inner}
  </div>"""


def write(fname, no, title, h1, lead, body, gap=18, sgap=9, extra_css=""):
    css = BASE_CSS % {"gap": gap, "sgap": sgap} + extra_css
    html = DOC.format(title=title, css=css, logo=LOGO, no=f"{no:02d}", h1=h1, lead=lead,
                      body=body, page=no, total=TOTAL)
    (OUT / fname).write_text(html, encoding="utf-8")
    print("wrote", fname)


exec(open(pathlib.Path(__file__).parent / "pages_content.py", encoding="utf-8").read())
