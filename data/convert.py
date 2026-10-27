#!/usr/bin/env python3
# 将 d3-celestial 的 stars.6.json（真实坐标/星等/色指数）
# 与 starnames.json（HD/HIP/星座/拜耳/专名）合并为紧凑 stars.json
import json, math

with open('stars.6.json') as f:
    stars_fc = json.load(f)
with open('starnames.json') as f:
    names = json.load(f)

# 已知亮星真实距离（光年）——用于证书/星图精确展示；其余用主序估计
CURATED = {
    "Sirius":8.6,"Canopus":310,"Rigil Kentaurus":4.37,"Alpha Centauri":4.37,
    "Arcturus":36.7,"Vega":25.0,"Capella":42.9,"Rigel":860,"Procyon":11.5,
    "Betelgeuse":548,"Achernar":139,"Hadar":390,"Altair":16.7,"Acrux":320,
    "Aldebaran":65.3,"Antares":550,"Spica":250,"Pollux":33.8,"Fomalhaut":25.1,
    "Deneb":2615,"Regulus":79.3,"Castor":51,"Bellatrix":250,"Algol":92.8,
    "Mizar":78,"Dubhe":123,"Alkaid":101,"Mirfak":510,"Alphecca":75,
    "Polaris":433,"Alnilam":2000,"Alnitak":1260,"Mintaka":1200,"Saiph":650,
    "Wezen":1600,"Adhara":430,"Mirzam":500,"Naos":1080,"Avior":630,
    "Miaplacidus":34,"Aludra":1970,"Gacrux":88,"Shaula":570,"Bellatrix":250,
    "Elnath":134,"Alhena":105,"Meissa":1100,"Hatile":1400,"Phact":340,
    "Wazn":320,"Diphda":310,"Alpheratz":97,"Hamal":66,"Menkar":220,
    "Algorel":130,"Baten Kaitos":96,"Caph":54,"Schedar":228,"Navi":600,
    "Ruchbah":99,"Segin":440,"Almach":355,"Mirach":200,"Hamal":66,
    "Sheratan":60,"Mesarthim":160,"Menkent":185,"Alphard":177,"Denebola":36,
    "Zosma":58,"Chort":165,"Coxa":280,"Algieba":130,"Adhafera":260,
    "Rasalas":170,"Chertan":240,"Acubens":520,"Talitha":97,"Tania Borealis":180,
    "Tania Australis":210,"Muscida":180,"Alphard":177,"Subra":270,
    "Unukalhai":74,"Sabik":69,"Rasalhague":48,"Celbalrai":120,"Kelb":120,
    "Rastaban":780,"Eltanin":154,"Alwaid":430,"Kuma":310,"Thuban":300,
    "Alphekka":75,"Nekkar":219,"Izar":210,"Muphrid":37,"Seginus":85,
    "Merga":120,"Arcturus":36.7,"Alcor":81,"Sulafat":325,"Sheliak":960,
    "Nashira":140,"Dabih":420,"Algedi":350,"Sadalsuud":540,"Sadalmelik":760,
    "Skat":320,"Ankaa":85,"Kaus Australis":145,"Kaus Media":306,"Kaus Borealis":120,
    "Ascella":140,"Nunki":220,"Alnasl":140,"Polis":730,"Kaus Media":306,
    "Rukbat":430,"Arkab":520,"Albaldah":180,"Sadr":1800,"Gienah":72,
    "Delta Cygni":165,"Albireo":430,"Sadr":1800,"Azelfafage":490,"Ruchba":170,
    "Garnet Star":6000,"Alderamin":49,"Errai":45,"Alfirk":600,"Aljanah":490,
    "Cebalrai":260,"Barnard's Star":5.96,"Kochab":126,"Pherkad":480,
    "Yildun":180,"Zubeneschamali":185,"Zubenelgenubi":77,"Brachium":330,
    "Zubenelakrab":300,"Acrab":520,"Dschubba":470,"Fang":470,"Pi Scorpii":590,
    "Alniyat":1900,"Shaula":570,"Sargas":300,"Kaus":145,"Nash":127,
    "Vindemiatrix":102,"Heze":110,"Zaniah":260,"Porrima":38,"Auva":220,
    "Minelava":210,"Syrma":520,"Khambalia":220,"Algorab":87,"Gienah":72,
    "Minkar":220,"Alchiba":190,"Kraz":110,"Algorab":87,"Acrab":520,
    "Mizar":78,"Alcor":81,"Alioth":81,"Cor Caroli":110,"La Superba":700,
}

out = []
for feat in stars_fc['features']:
    p = feat.get('properties', {})
    g = feat.get('geometry', {})
    if not g or 'coordinates' not in g:
        continue
    ra, dec = g['coordinates'][0], g['coordinates'][1]
    mag = p.get('mag')
    bv = p.get('bv')
    if mag is None:
        continue
    sid = feat.get('id')
    nm = names.get(str(sid), {}) if sid is not None else {}
    name = (nm.get('name') or '').strip()
    hd = (nm.get('hd') or '').replace('HD','').strip()
    hip = (nm.get('hip') or '').replace('HIP','').strip()
    con = (nm.get('c') or '').strip()
    bayer = (nm.get('bayer') or '').strip()
    flam = (nm.get('flam') or '').strip()
    var = (nm.get('var') or '').strip()
    # 距离：已知亮星精确，否则主序估计
    real = False
    dist = None
    if name and name in CURATED:
        dist = CURATED[name]; real = True
    if dist is None and bv is not None:
        try:
            bvf = float(bv)
            Mv = 2.89*bvf + 3.47
            Mv = max(-5.0, min(15.0, Mv))
            d_pc = 10**((float(mag) - Mv + 5)/5.0)
            dist = round(d_pc*3.262, 1)
            if dist > 30000: dist = 30000
        except: dist = None
    rec = {
        'ra': round(float(ra),4),
        'dec': round(float(dec),4),
        'mag': round(float(mag),2),
        'bv': (round(float(bv),3) if bv not in (None,'') else None),
        'hd': int(hd) if hd.isdigit() else None,
        'hip': int(hip) if hip.isdigit() else None,
        'c': con,
        'b': bayer,        # 拜耳希腊字母
        'f': flam,         # 佛兰斯蒂德编号
        'v': var,          # 变星名
        'n': name,         # 专名（英文）
    }
    if dist is not None:
        rec['d'] = dist
        rec['dr'] = 1 if real else 0
    out.append(rec)

# 按星等排序（亮星在前），便于 LOD 与抽样
out.sort(key=lambda r: r['mag'])
with open('stars.json','w') as f:
    json.dump(out, f, separators=(',',':'), ensure_ascii=False)

print('total stars:', len(out))
print('with real dist:', sum(1 for r in out if r.get('dr')==1))
print('with name:', sum(1 for r in out if r.get('n')))
print('with hd:', sum(1 for r in out if r.get('hd')))
print('sample:', out[0])
print('bytes:', len(json.dumps(out, separators=(',',':'))))
