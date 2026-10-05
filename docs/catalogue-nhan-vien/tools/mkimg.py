import json, os
from PIL import Image
# Chạy từ thư mục docs/catalogue-nhan-vien: python3 tools/mkimg.py
D=os.path.join(os.path.dirname(__file__),'..','..','..','video','huong-dan-nhan-vien','public','shots')
meta=json.load(open(D+'/../shots.json'))
S=2
HEAD={'home':100}
def box(shot,key):
    return next(b for b in meta[shot]['boxes'] if b['key'].startswith(key))
def make(out, shot, y=0, key=None):
    m=meta[shot]; im=Image.open(f'{D}/{shot}.png').convert('RGB')
    if key is not None:
        b=box(shot,key); y=max(0,min(m['h']-844, b['y']+b['h']/2-844*0.42))
    if m['h']<=844: im.crop((0,0,390*S,844*S)).save(f'img/{out}.png'); return
    y=int(y*S); c=im.crop((0,y,390*S,y+844*S))
    vp=Image.open(f'{D}/{shot}_vp.png').convert('RGB')
    hh=HEAD.get(shot,56)*S
    if y>0: c.paste(vp.crop((0,0,390*S,hh)),(0,0))
    nav=96*S; c.paste(vp.crop((0,844*S-nav,390*S,844*S)),(0,844*S-nav))
    c.save(f'img/{out}.png')
L=[('login','login'),('home','home'),('home_month','home',0,'Tháng này'),('nav','nav'),('all','all'),
 ('att_noface','att_noface'),('att','att'),('att_cal','att',0,'Bảng chấm công'),('att_hist','att',0,'Lịch sử chi tiết'),('leave','leave'),('ot','ot'),
 ('schedule','schedule'),('adv','adv'),('adv_new','adv_new'),('payroll','payroll'),('payroll_detail','payroll',0,'Khấu trừ'),
 ('kpi','kpi'),('kpi_comm','kpi',0,'Doanh thu & Hoa hồng'),('kpi_dd','kpi_dd'),('bell','bell'),('account','account'),
 ('dd_pt','dd_pt'),('dd_hp','dd_hp'),('sale_appt','sale_appt'),('sale_tv','sale_tv'),('sale_coc','sale_coc'),('tele_data','tele_data'),
 ('mkt_video','mkt_video'),('community','community'),('meetings','meetings')]
for t in L: make(*t)
print(len(L),'ảnh')
