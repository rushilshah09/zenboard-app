"""Builds storyboard/index.html (the v4 storyboard) from the frame definitions below."""
import base64, math, re, pathlib, html as H

ROOT = pathlib.Path(__file__).resolve().parent
LOGO = (ROOT.parent / "src/brand/logo.generated.ts").read_text()
MARK = re.search(r'LOCKUP_MARK = "([^"]+)"', LOGO).group(1)
LETTERS = re.findall(r'"(M[^"]+)"', LOGO.split("LOCKUP_LETTERS")[1])[:8]
PEOPLE = {k: "data:image/jpeg;base64," + base64.b64encode((ROOT / "people" / f"{k}.jpg").read_bytes()).decode() for k in ("p1", "p2", "p3", "p4", "p5")}
FACE = {"SC": "p3", "MO": "p4", "PR": "p2", "Mara": "p4", "Sarah": "p3", "David": "p1", "James": "p2", "Fernwood": "p5"}
PORTRAIT = "data:image/jpeg;base64," + base64.b64encode((ROOT / "portrait.jpg").read_bytes()).decode()

BERRY, INK, PAPER = "#C41C72", "#191919", "#FBFAF6"
FIELD = dict(petal="#EAB9CB", apricot="#ECBF9B", butter="#E5D494", sage="#B7CEAB",
             sky="#A6D1E0", peri="#B8BDEE", sand="#EEE7D9", mist="#E7EAEC")
H_ = 56.25  # frame height in cqw

def mark(size, color=BERRY, extra=""):
    return f'<svg viewBox="-1 -1 34 34" style="width:{size}cqw;height:{size}cqw;{extra}"><path d="{MARK}" fill="{color}"/></svg>'

def lockup(width, color=INK, mark_color=BERRY, letters=8):
    ps = "".join(f'<path d="{d}" fill="{color}"/>' for d in LETTERS[:letters])
    return f'<svg viewBox="0 0 152 32" style="width:{width}cqw"><path d="{MARK}" fill="{mark_color}"/>{ps}</svg>'

def at(x, y, inner, cls="", style=""):
    return f'<div class="a {cls}" style="left:{x}cqw;top:{y}cqw;{style}">{inner}</div>'

PH_DIR = ROOT.parents[1] / "node_modules/@phosphor-icons/react/dist/defs"
_ph_cache = {}
def ph(name, weight="duotone", color="currentColor", size="55%"):
    key = (name, weight)
    if key not in _ph_cache:
        src = (PH_DIR / f"{name}.es.js").read_text()
        block = re.search(r'\[\s*"' + weight + r'",(.*?)\n  \]', src, re.S).group(1)
        els = ""
        for tag, attrs in re.findall(r'createElement\("(\w+)", \{([^}]*)\}', block):
            a = " ".join(f'{re.sub("([A-Z])", lambda m: "-" + m.group(1).lower(), k)}="{v}"' for k, v in re.findall(r'(\w+): "([^"]*)"', attrs))
            els += f"<{tag} {a}/>"
        _ph_cache[key] = els
    return f'<svg viewBox="0 0 256 256" fill="{color}" style="width:{size};height:{size}">{_ph_cache[key]}</svg>'

# app stand-ins: Phosphor duotone glyph on a soft tinted squircle (competitor logos stay an open decision)
KIND = {
 "mail":   ("Envelope",             "#F6E4D6", "#8A4A1E", "Mail"),
 "chat":   ("ChatCircleDots",       "#E6E7FA", "#3A3F8F", "Chat"),
 "tasks":  ("CheckSquare",          "#E3EEDD", "#2F5A27", "Tasks"),
 "docs":   ("FileText",             "#DDEFF5", "#1C5A70", "Docs"),
 "crm":    ("UsersThree",           "#F6E1EA", "#8A2E57", "CRM"),
 "cal":    ("CalendarBlank",        "#F5EFD2", "#6B5A12", "Calendar"),
 "money":  ("CurrencyCircleDollar", "#E3EEDD", "#2F5A27", "Invoices"),
 "notes":  ("NotePencil",           "#F1ECE1", "#6B5B3E", "Notes"),
 "kanban": ("Kanban",               "#E3EEDD", "#2F5A27", "Projects"),
 "plant":  ("Plant",                "#F6E1EA", "#8A2E57", "Habits"),
 "timer":  ("Timer",                "#E7EAEC", "#46505A", "Focus"),
}
def tile(kind, size=6.2, blur=0, badge=None, label=None):
    icon, bg, fg, _ = KIND[kind]
    b = f'<span class="badge">{badge}</span>' if badge else ""
    lb = f'<span class="tlabel">{label}</span>' if label else ""
    f = f"filter:blur({blur}cqw);opacity:.7;" if blur else ""
    return (f'<div class="tile" style="width:{size}cqw;height:{size}cqw;--bg:{bg};color:{fg};{f}">'
            f'{ph(icon, "duotone", size="46%")}{b}{lb}</div>')
def pico(kind, size=2.8):
    icon, bg, fg, _ = KIND[kind]
    return f'<span class="pico" style="width:{size}cqw;height:{size}cqw;background:{bg};color:{fg}">{ph(icon, "duotone", size="58%")}</span>'

def ring_positions(n, r, cx=50, cy=H_/2, start=-90, squash=1.0):
    return [(cx + r*math.cos(math.radians(start+i*360/n)), cy + r*squash*math.sin(math.radians(start+i*360/n))) for i in range(n)]

def rings(rs, dashed_inner=True):
    out = ""
    for i, r in enumerate(rs):
        st = "dashed" if (dashed_inner and i == 0) else "solid"
        out += at(50, H_/2, "", "ring", f"width:{2*r}cqw;height:{2*r}cqw;border-style:{st}")
    return out

def portrait(size=15, extra=""):
    return at(50, H_/2, f'<div class="lobe-halo"></div><div class="lobe"><img src="{PORTRAIT}" alt=""></div>', "portrait", f"width:{size}cqw;height:{size}cqw;{extra}")

def paper_stage(glow=1.0):
    return f'<div class="stage paper"><div class="dots"></div><div class="glow" style="opacity:{glow}"></div></div>'

def chip(t, n=None, dot="#C41C72"):
    c = f'<em>{n}</em>' if n else ""
    return f'<span class="chip"><i style="background:{dot}"></i>{H.escape(t)}{c}</span>'
AV = {"M": "#EAB9CB", "S": "#B7CEAB", "D": "#B8BDEE", "J": "#A6D1E0", "F": "#ECBF9B"}
def msg(name, t, w=17, when="2m"):
    ini = "".join(x[0] for x in name.replace("To: ", "").split()[:2]).upper()
    first = name.replace("To: ", "").split()[0]
    av = (f'<span class="mav face"><img src="{PEOPLE[FACE[first]]}" alt=""></span>' if first in FACE
          else f'<span class="mav" style="background:{AV.get(ini[0], "#E5D494")}">{ini}</span>')
    return (f'<div class="msg" style="width:{w}cqw">{av}'
            f'<div><b>{H.escape(name)}<small>{when}</small></b><span>{H.escape(t)}</span></div></div>')
def caption(t, y=48.5, size=2.6, color=INK, dim=None):
    words = t.split(" ")
    if dim is not None:
        words = [f'<span style="opacity:{1 if i < dim else .18};filter:blur({0 if i < dim else .35}cqw)">{w}</span>' for i, w in enumerate(words)]
    return at(50, y, " ".join(words), "cap", f"font-size:{size}cqw;color:{color}")

KINDS = ["mail", "chat", "tasks", "docs", "crm", "cal", "money", "notes"]

# ---------- frames ----------
def f_1_1():
    return paper_stage(.55) + rings([11, 17]) + portrait(14, "transform:translate(-50%,-50%) scale(.92)") + \
        at(50, H_/2, "", "sparkle")

def f_1_2():
    s = paper_stage(.8) + rings([11, 17, 24])
    for i, (x, y) in enumerate(ring_positions(8, 19.5, squash=.95)):
        if i < 6: s += at(x, y, tile(KINDS[i], badge=[None, 3, None, 1, None, 2][i], label=KIND[KINDS[i]][3]))
    s += portrait(14) + caption("Your work lives in eight apps.", y=53.2, dim=5)
    return s

def f_1_3():
    s = paper_stage(1) + rings([11, 17, 24, 31])
    badges = [15, 7, None, 19, 4, 20, None, 9]
    for i, (x, y) in enumerate(ring_positions(8, 22, start=-70, squash=.86)):
        s += at(x, y, tile(KINDS[i], 5.8 if i % 3 else 6.6, blur=.25 if i in (1, 6) else 0, badge=badges[i]))
    s += at(24, 11, chip("Email", "12", "#ECBF9B") + msg("To: Mara · Acme", "Following up on the proposal…", 16, "now"), "stack")
    s += at(77, 14, chip("Pending follow-ups", "3", "#B8BDEE") + msg("Sarah", "Any update on the invoice?", 16, "4m") + msg("David", "Where's the latest file?", 16, "9m"), "stack")
    s += at(76, 44, chip("Client chats", "19", "#A6D1E0") + msg("James", "Quick check-in, any news?", 16, "1m"), "stack")
    s += at(21, 42, chip("Invoice overdue", "6d", "#C41C72") + msg("Fernwood Hotels", "INV-019 · $1,500 · 6 days late", 17, "6d"), "stack")
    s += portrait(13.5) + caption("And you live in all of them.", y=53.2, size=2.4)
    return s

def f_2_1():
    s = paper_stage(1)
    for i, (x, y) in enumerate(ring_positions(8, 22, start=-70)):
        s += at(x, y, tile(KINDS[i], 6, blur=.9))
    # ring breaks into hairline bundles (same line language as 2.2 and 3.1)
    cols = [BERRY, "#E0703F", "#2F86A8", "#3F8F55", "#6E63D9", "#C9A21F"]
    seg = ""
    for i, c in enumerate(cols):
        for j in range(9):
            r = 36 + j * 1.3
            seg += (f'<circle r="{r}" cx="50" cy="50" fill="none" stroke="{c}" stroke-width=".35" stroke-linecap="round" '
                    f'stroke-dasharray="{r * .62} {r * 6.283 - r * .62}" stroke-dashoffset="{-i * r * 1.047 - j * 1.1}" '
                    f'opacity="{.35 + .65 * (1 - abs(j - 4) / 4)}"/>')
    s += at(50, H_/2, f'<svg viewBox="0 0 100 100" style="width:36cqw;transform:rotate(-20deg)">{seg}</svg>')
    s += portrait(13, "filter:blur(.15cqw)")
    return s

def f_2_2():
    """The ring breaks and sweeps off: hairline bundles (same language as the 3.1 fans), not thick strokes."""
    s = paper_stage(.4)
    cols = [BERRY, "#E0703F", "#6E63D9"]
    defs = "".join(f'<linearGradient id="sw{i}" gradientUnits="userSpaceOnUse" x1="10" y1="56" x2="100" y2="0">'
                   f'<stop offset="0" stop-color="{c}" stop-opacity="0"/><stop offset=".35" stop-color="{c}" stop-opacity=".85"/>'
                   f'<stop offset="1" stop-color="{c}" stop-opacity=".35"/></linearGradient>' for i, c in enumerate(cols))
    arcs = ""
    for i in range(len(cols)):
        for j in range(18):
            o = (j - 8.5) / 8.5
            base = i * 3.2 + o * 1.4
            arcs += (f'<path d="M 12 {60 + base} C 40 {44 + base * 1.1}, 70 {26 + base * .9}, 104 {-2 + base * .6}" fill="none" '
                     f'stroke="url(#sw{i})" stroke-width=".07" opacity="{.35 + .65 * (1 - abs(o))}"/>')
    s += f'<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none"><defs>{defs}</defs>{arcs}</svg>'
    ring = ""
    for k, c in enumerate([BERRY, "#2F86A8", "#E0703F", "#3F8F55"]):
        for j in range(7):
            r = 13.5 + j * .8
            ring += (f'<circle r="{r}" cx="50" cy="50" fill="none" stroke="{c}" stroke-width=".35" stroke-linecap="round" '
                     f'stroke-dasharray="{r * 1.05} {r * 6.283 - r * 1.05}" stroke-dashoffset="{-k * r * 1.57 - j * .9}" opacity="{.4 + .6 * (1 - abs(j - 3) / 3)}"/>')
    s += at(42, 27, f'<svg viewBox="0 0 100 100" style="width:22cqw">{ring}</svg>')
    s += at(42, 27, '<span class="spark"></span>')
    return s

def f_2_3():
    return paper_stage(.35) + at(50, 25, lockup(36)) + caption("Meet Zenboard.", y=36, size=2.4, color="#37352F", dim=1)

STRAND = {"mail": "#E0703F", "chat": "#6E63D9", "tasks": "#3F8F55", "docs": "#2F86A8", "crm": "#C41C72", "cal": "#C9A21F"}
def fan(sources, focus, n=16, spread=2.6):
    """Hairline fans: each source sends n fine curves that converge on one point (Google 'Bringing together' ref)."""
    fx, fy = focus
    out = '<defs>' + "".join(
        f'<linearGradient id="g{k}" gradientUnits="userSpaceOnUse" x1="{x}" y1="{y}" x2="{fx}" y2="{fy}">'
        f'<stop offset="0" stop-color="{c}" stop-opacity=".0"/><stop offset=".25" stop-color="{c}" stop-opacity=".75"/>'
        f'<stop offset="1" stop-color="#C41C72" stop-opacity=".95"/></linearGradient>' for k, (x, y, c) in enumerate(sources)) + '</defs>'
    for k, (x, y, c) in enumerate(sources):
        for j in range(n):
            o = (j - (n - 1) / 2) / ((n - 1) / 2)  # -1..1
            c1x, c1y = x + 16 + o * 3, y + o * spread
            c2x, c2y = fx - 16 - abs(o) * 4, fy + (y - fy) * .12 + o * spread * .6
            out += (f'<path d="M{x + 3.6} {y + o * spread * .35} C{c1x} {c1y},{c2x} {c2y},{fx} {fy}" fill="none" '
                    f'stroke="url(#g{k})" stroke-width=".07" opacity="{.35 + .65 * (1 - abs(o))}"/>')
    return out

def f_3_1():
    s = paper_stage(.55)
    ys = [9, 16.5, 24, 31.5, 39, 46.5]
    src = [(12 + (2.5 if i % 2 else 0), y, STRAND[KINDS[i]]) for i, y in enumerate(ys)]
    fx, fy = 58, 28.1
    s += f'<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none">{fan(src, (fx, fy))}</svg>'
    for i, (x, y, _) in enumerate(src):
        s += at(x, y, tile(KINDS[i], 5.2))
    s += at(fx, fy, '<span class="spark"></span>') + at(fx + 4.5, fy, '<span class="dot2"></span>') + at(fx + 8.5, fy, '<span class="dot2 lit"></span>') + at(fx + 12, fy, '<span class="dot2"></span>')
    s += at(82, 28.1, f'<div class="node">{mark(6.5)}<span>Zenboard</span></div>')
    s += caption("Everything you juggle.", y=52, size=2.4)
    return s

def waves():
    cols = ["#EAB9CB", "#ECBF9B", "#B8BDEE", "#A6D1E0"]
    out = ""
    for k, c in enumerate(cols):
        amp = [5.5, -3.5, 4.2, -2.6][k]; cx = [20, 28, 34, 24][k]
        d = f"M-2 28.1 C{cx - 12} 28.1,{cx - 8} {28.1 - amp},{cx} {28.1 - amp} S{cx + 10} 28.1,{cx + 18} 28.1 L 46 28.1"
        out += f'<path d="{d}" fill="none" stroke="{c}" stroke-width=".55" stroke-linecap="round"/>'
    out += '<path d="M 40 28.1 L 60 28.1" stroke="#C41C72" stroke-width=".55" stroke-linecap="round"/>'
    return out

def f_3_2():
    s = paper_stage(.55)
    s += f'<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none">{waves()}</svg>'
    s += at(46, 28.1, f'<div class="node sm">{mark(4.2)}</div>')
    s += at(79, 28.1, '<div class="wipe"><div class="wipe-in">' + today_card(mini=True) + '</div></div>')
    s += caption("In one place.", y=52, size=2.4)
    return s

def today_card(mini=False):
    return f'''<div class="today{' mini' if mini else ''}">
      <div class="t-h">{mark(1.6)}<b>Good evening, Darshil.</b></div>
      <div class="t-s">You've committed to <b>2 tasks</b>. Highlight: <b>Send invoice for July to TechSpark</b>.</div>
      <div class="t-sec">Today's plan · 2</div>
      <div class="row"><i></i>Send invoice for July to TechSpark<em class="tag r">High</em></div>
      <div class="row"><i></i>Prepare weekly report<em class="tag y">Medium</em></div>
      <div class="row done"><i class="on"></i>Review design feedback</div>
      <div class="t-sec">Schedule</div>
      <div class="ev"><s></s>Standup <em>9:00–9:30</em></div>
      <div class="ev"><s></s>Design review <em>16:00–18:00</em></div>
    </div>'''

def berry_field():
    return (f'<div class="stage field"></div>'
            + at(18, 40, mark(62, "#ffffff", "opacity:.07"), "", "mix-blend-mode:soft-light")
            + at(92, 6, mark(34, "#ffffff", "opacity:.06"), "", "mix-blend-mode:soft-light"))

def f_4_1():
    s = berry_field() + at(50, 5, lockup(12, "#fff", "#fff"))
    s += at(45, 31, f'<div class="frost tilt">{today_card()}</div>')
    s += at(66, 17, '<div class="float"><div class="hl-l">Today\'s highlight</div><div class="hl-t">Send invoice for July to TechSpark</div>'
                    '<div class="hl-b"><span class="btn">' + ph("Play", "fill", size="1em") + ' Start focus</span><span class="btn g">' + ph("Check", "bold", size="1em") + ' Mark done</span></div></div>')
    s += caption("Your whole day. One view.", y=52, size=2.2, color="#fff")
    return s

def f_4_2():
    s = berry_field() + at(50, 5, lockup(12, "#fff", "#fff"))
    s += at(46, 34, f'<div class="frost tilt close">{today_card()}</div>')
    s += at(64, 30, '<div class="float"><div class="hl-l">Today\'s highlight</div><div class="hl-t"><s>Send invoice for July to TechSpark</s></div>'
                    '<div class="hl-b"><span class="btn g on">' + ph("Check", "bold", size="1em") + ' Done</span></div></div><div class="cursor"></div>')
    return s



# ---------- scene 5: feature split (left list, right UI in the tinted-field card style) ----------
FEATS = [  # name, icon, (dark, mid, light), card text tone
 ("Tasks",    "tasks", ("#3E0825", "#9E1458", "#E48AB7"), "#4A0A2C"),
 ("Projects", "kanban",   ("#16300F", "#3C6A2E", "#9DC08A"), "#1C3A14"),
 ("Docs",     "docs",  ("#171A4A", "#3F48A0", "#AEB3EE"), "#1E2257"),
 ("Calendar", "cal",   ("#0B3140", "#23708A", "#9BD0E1"), "#0F3A4A"),
 ("Clients",  "crm",   ("#40190A", "#A0542A", "#EDBB93"), "#4A220C"),
 ("Money",    "money", ("#2E2806", "#7E6F1A", "#E0CF84"), "#3A3208"),
 ("Habits",   "plant", ("#3F1128", "#96406B", "#E6ADC6"), "#4A1530"),
 ("Focus",    "timer", ("#15181C", "#46505A", "#BCC3CA"), "#1B1E22"),
]
def avatar(txt, bg):
    if txt in FACE: return f'<span class="avc face" style="background:{bg}"><img src="{PEOPLE[FACE[txt]]}" alt=""></span>'
    return f'<span class="avc" style="background:{bg}">{txt}</span>'
def feat_ui(name, tone, light):
    t = tone
    if name == "Tasks":
        card = (f'<h4>Today\'s plan</h4><div class="fl"><i></i>Send invoice for July to TechSpark<em>High</em></div>'
                f'<div class="fl"><i></i>Prepare weekly report<em>Medium</em></div><div class="fl dn"><i class="on"></i>Review design feedback</div>'
                f'<div class="bars"><span>3 planned</span><span>6h focus</span><span>2h45 meetings</span></div>'
                f'<div class="track"><b style="width:62%"></b></div>')
        flt = ('<small>Today\'s highlight</small><b>Send invoice for July to TechSpark</b>'
               '<div class="fb"><span class="btn">' + ph("Play", "fill", size="1em") + ' Start focus</span><span class="btn g">' + ph("Check", "bold", size="1em") + ' Mark done</span></div>')
    elif name == "Projects":
        card = ('<h4>Brand identity</h4><p>Acme Studio · 5 open · 12 done</p>'
                '<div class="cols"><span>In progress</span><span>In review</span><span>Revisions</span><span>Done</span></div>'
                f'<div class="segs"><b style="background:{light}"></b><b style="background:{t};opacity:.55"></b><b class="knob" style="background:{t}"></b><b style="background:#fff"></b></div>')
        flt = ('<div class="avs">' + avatar("SC", "#C41C72") + avatar("MO", "#3C6A2E") + avatar("PR", "#A0542A") +
               '<span class="srch">' + ph("MagnifyingGlass", "regular", size="48%") + '</span></div>')
    elif name == "Docs":
        card = ('<h4>Rebrand proposal · Acme</h4><p class="doc">Acme Studio wants a calmer, warmer identity that works from '
                'shop window to invoice. We propose three routes, one workshop and a two-week sprint.</p>'
                '<div class="chips"><span>Proposal</span><span>Client: Acme</span><span>Due Thu</span></div>')
        flt = ('<div class="cm">' + avatar("MO", "#C41C72") + '<div><small>Mara Okafor</small><b>Love route two. Approved.</b></div></div>')
    elif name == "Calendar":
        card = ('<h4>Friday, Sep 25</h4>'
                f'<div class="evr"><s style="background:{t}"></s>Standup<em>9:00–9:30</em></div>'
                f'<div class="evr"><s style="background:{light}"></s>Coffee with Mira<em>15:00–15:45</em></div>'
                f'<div class="evr"><s style="background:{t}"></s>Design review<em>16:00–18:00</em></div>'
                f'<div class="evr"><s style="background:{light}"></s>Book club<em>19:00–20:00</em></div>')
        flt = '<small>Next · in 20 min</small><b>Design review</b><div class="fb"><span class="btn">Join</span><span class="btn g">16:00–18:00</span></div>'
    elif name == "Clients":
        card = ('<h4>Meridian Studio</h4><div class="kvs"><span>Contact</span>Sarah Chen · Head of Brand</div>'
                '<div class="kvs"><span>Billed</span>$7,000 · $2,800 outstanding</div><div class="kvs"><span>Next step</span>Send the Q3 retainer proposal</div>'
                '<div class="kvs"><span>Health</span>Healthy</div>')
        flt = ('<div class="cm">' + avatar("SC", "#A0542A") + '<div><small>Client portal · Sarah Chen</small><b>Proposal approved</b></div></div>')
    elif name == "Money":
        card = ('<h4>Money</h4><div class="st2"><div><span>Outstanding</span><b>$4,300</b></div><div><span>Paid this month</span><b>$6,000</b></div></div>'
                '<div class="ir"><span>INV-021</span>Meridian Studio<b>$3,200</b></div><div class="ir"><span>INV-019</span>Meridian Studio<b>$1,500</b></div>')
        flt = '<small>INV-018 · Atlas Coffee</small><b class="bigp">$4,200</b><div class="fb"><span class="btn ok">' + ph("CheckCircle", "fill", size="1em") + ' Paid</span></div>'
    elif name == "Habits":
        dots = "".join(f'<i class="{"on" if k not in (3, 9) else ""}"></i>' for k in range(14))
        card = (f'<h4>Morning</h4><div class="fl"><i class="on"></i>Morning walk<em>12 days</em></div><div class="fl"><i></i>Meditate<em>12 days</em></div>'
                f'<div class="fl"><i></i>Read 20 minutes<em>0</em></div><div class="dots">{dots}</div>')
        flt = '<small>Morning walk</small><b class="bigp">12-day streak</b>'
    else:  # Focus
        card = ('<h4>Focus session</h4><div class="timer"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="3"/>'
                f'<circle cx="20" cy="20" r="16" fill="none" stroke="{t}" stroke-width="3" stroke-linecap="round" stroke-dasharray="70 101" transform="rotate(-90 20 20)"/></svg><b>18:42</b></div>'
                '<p>Send invoice for July to TechSpark</p>')
        flt = '<small>Blocking</small><b>Slack, Mail, X</b><div class="fb"><span class="btn">' + ph("Pause", "fill", size="1em") + ' Pause</span></div>'
    return card, flt

def feat_frame(idx):
    name, icon, (d, m, l), tone = FEATS[idx]
    s = f'<div class="stage" style="background:{PAPER}"></div>'
    for k in range(-3, 5):
        n2, ic2, _, _ = FEATS[(idx + k) % len(FEATS)]
        cls = "fp on" if k == 0 else "fp"
        op = 1 if k == 0 else max(.22, 1 - abs(k) * .2)
        s += at(4.5, H_/2 - 1.5 + k*5.3, f'<div class="{cls}" style="opacity:{op}">{pico(ic2, 2.5)}{n2.upper()}</div>', "", "transform:translate(0,-50%)")
    s += at(4.5, 3.6, lockup(8, INK), "", "transform:translate(0,-50%)")
    field = f'radial-gradient(130% 120% at 100% 100%,{l} 0%,{m} 38%,{d} 100%)'
    lobes = at(84, 45, mark(46, "#ffffff", ""), "lobes") + at(58, 4, mark(30, "#ffffff", ""), "lobes")
    card, flt = feat_ui(name, tone, l)
    s += (f'<div class="rpanel" style="background:{field}">{lobes}'
          f'<div class="tcard" style="color:{tone};--tone:{tone};--light:{l}">{card}</div>'
          f'<div class="fcard" style="--tone:{tone}">{flt}</div></div>')
    return s

FEAT_NOTES = {
 "Tasks": "Today's plan in the frosted card; the highlight task floats above with Start focus.",
 "Projects": "Brand identity with status lanes (In progress → Done) and the team floating above.",
 "Docs": "The Acme proposal doc; Mara's approval comment floats above.",
 "Calendar": "Friday's schedule; the next event with a Join button floats above.",
 "Clients": "Meridian Studio's client record; the portal approval floats above.",
 "Money": "Outstanding and paid totals; a Paid invoice floats above.",
 "Habits": "Morning habits and a streak grid; the 12-day streak floats above.",
 "Focus": "A running focus timer; the blocked apps float above.",
}

PILLS = [("Tasks", "sky"), ("Projects", "sand"), ("Invoices", "apricot"), ("Calendar", "berry"), ("Notes", "butter"),
         ("Habits", "petal"), ("Focus", "sky"), ("Clients", "peri"), ("Docs", "peri"), ("Goals", "sand"),
         ("Payments", "berry"), ("Time tracking", "sage"), ("Proposals", "sand"), ("Life", "sage"), ("Files", "petal"),
         ("Automations", "petal"), ("Insights", "sand"), ("Messages", "sky"), ("Reminders", "peri")]
PILL_ICON = {"Tasks": "CheckSquare", "Projects": "Kanban", "Invoices": "Receipt", "Calendar": "CalendarBlank", "Notes": "NotePencil",
             "Habits": "Plant", "Focus": "Timer", "Clients": "UsersThree", "Docs": "FileText", "Goals": "Target",
             "Payments": "CreditCard", "Time tracking": "Clock", "Proposals": "PaperPlaneTilt", "Life": "Sun", "Files": "Folder",
             "Automations": "Lightning", "Insights": "ChartLine", "Messages": "ChatCircle", "Reminders": "Bell"}
def f_6_1():
    """Pill wall: plain brand field, glass-bordered pills, a Phosphor icon in every pill."""
    s = '<div class="stage" style="background:radial-gradient(130% 120% at 100% 100%,#B5226C 0%,#8E1253 40%,#4A0A2C 100%)"></div><div class="stage grain"></div>'
    for r in range(6):
        row = ""
        for t, c in (PILLS[(r * 5 + k) % len(PILLS)] for k in range(8)):
            glass = c == "berry"
            bg = "rgba(255,255,255,.14)" if glass else FIELD[c]
            fg = "#FBFAF6" if glass else INK
            row += (f'<span class="wp{" glass" if glass else ""}" style="background:{bg};color:{fg}">'
                    f'<i class="wpi">{ph(PILL_ICON[t], "fill", size="58%")}</i>{t}</span>')
        s += at(50 + (-6 if r % 2 else 4), 6 + r * 9, f'<div class="wrow">{row}</div>')
    return s

def icon3d(color, glyph_color, size, icon="CheckSquare"):
    """Chunky 3D module tile with the real Phosphor icon for that module, embossed."""
    return (f'<div class="i3" style="width:{size}cqw;height:{size}cqw;--c:{color};color:{glyph_color}">'
            f'<span class="i3g">{ph(icon, "fill", size="100%")}</span></div>')

def carousel(order, label):
    s = '<div class="stage" style="background:#16060F"></div><div class="stage floorglow"></div>'
    s += at(50, 5, lockup(11, "#F7F1E8", "#F7F1E8"))
    xs, sz = [2, 24, 50, 76, 98], [11, 13, 18, 13, 11]
    for x, (c, g, ic), z in zip(xs, order, sz):
        s += at(x, 25, icon3d(c, g, z, ic))
    s += at(50, 40.5, f'<span class="lbl">{label}</span>')
    return s

def f_7_1():
    return carousel([(FIELD["apricot"], "#fff", "Receipt"), (FIELD["sky"], "#fff", "CalendarBlank"), ("#F5F1EA", BERRY, "CheckSquare"),
                     (BERRY, "#fff", "Kanban"), (FIELD["sage"], "#fff", "Plant")], "Tasks")

def f_7_2():
    return carousel([(FIELD["sky"], "#fff", "CalendarBlank"), ("#F5F1EA", BERRY, "CheckSquare"), (BERRY, "#fff", "Plant"),
                     (FIELD["sage"], "#fff", "Timer"), (FIELD["peri"], "#fff", "FileText")], "Habits")

SNIP = {n: "data:image/jpeg;base64," + base64.b64encode((ROOT / "snips" / f"{n}.jpg").read_bytes()).decode()
        for n in ("highlight", "stats", "invoices", "client", "habits", "calendar", "inbox", "docs")}
def snip(name, w, blur=0):
    f = f"filter:blur({blur}cqw);" if blur else ""
    return f'<div class="snip" style="width:{w}cqw;{f}"><img src="{SNIP[name]}" alt=""></div>'

def f_8_1():
    """Ring of real Zenboard UI snippets (cropped from the running app) around the headline."""
    s = paper_stage(.35)
    for name, x, y, w, blur in [("calendar", 14, 14, 22, 0), ("highlight", 43, 6.5, 24, 0), ("stats", 74, 6, 26, .06),
                                ("client", 88, 22, 18, 0), ("habits", 86, 41, 19, 0), ("invoices", 64, 49, 22, 0),
                                ("inbox", 36, 48, 19, .06), ("docs", 12, 40, 18, 0)]:
        s += at(x, y, snip(name, w, blur))
    s += at(22, 26.5, f'<div class="cc" style="width:7cqw;height:7cqw;background:{BERRY}"><div class="grid"></div>{mark(3.6, "#fff")}</div>')
    s += at(80, 32, f'<div class="cc white" style="width:10cqw;height:5.6cqw"><small>STREAK</small><b>12 days</b></div>')
    s += at(50, 24.5, "Work, life and business.", "head", "font-size:3.6cqw")
    s += at(50, 30.5, "One workspace.", "head", "font-size:3.6cqw;color:" + BERRY)
    return s

def blueprint(strength=1.0, tagline=False):
    """Outro: berry field + grain, blueprint hairlines, construction of the mark, type + component specimens."""
    W = "rgba(255,255,255,{})"
    a = lambda o: W.format(round(o * strength, 3))
    hl = f'stroke="{a(.28)}" stroke-width=".06" fill="none"'
    dl = f'stroke="{a(.3)}" stroke-width=".06" fill="none" stroke-dasharray=".35 .35"'
    def t(x, y, txt, anchor="start", o=.45, sz=.75, rot=0):
        tr = f' transform="rotate({rot} {x} {y})"' if rot else ""
        return (f'<text x="{x}" y="{y}" fill="{a(o)}" font-family="Geist Mono, monospace" font-size="{sz}" letter-spacing=".08" '
                f'text-anchor="{anchor}"{tr}>{txt}</text>')
    g = ""
    # fine grid (right-hand block and left-hand block, like the Fiverr banner)
    for i in range(9):
        g += f'<line x1="{2 + i * 2.2}" y1="2" x2="{2 + i * 2.2}" y2="20" {hl} opacity=".55"/>'
        g += f'<line x1="2" y1="{2 + i * 2.2}" x2="19.6" y2="{2 + i * 2.2}" {hl} opacity=".55"/>'
        g += f'<line x1="{80 + i * 2.2}" y1="36" x2="{80 + i * 2.2}" y2="54" {hl} opacity=".55"/>'
        g += f'<line x1="80" y1="{36 + i * 2.2}" x2="97.6" y2="{36 + i * 2.2}" {hl} opacity=".55"/>'
    # frame rails
    g += f'<line x1="22" y1="0" x2="22" y2="56.25" {hl}/><line x1="78" y1="0" x2="78" y2="56.25" {hl}/>'
    g += f'<line x1="0" y1="24.4" x2="100" y2="24.4" {hl}/><line x1="0" y1="31.8" x2="100" y2="31.8" {hl}/>'
    g += f'<line x1="24" y1="6" x2="76" y2="6" {dl}/><line x1="24" y1="50" x2="76" y2="50" {dl}/>'
    # construction of the mark, large and centred: 32-unit box, four lobe circles, diagonals, star
    cx, cy, S = 50, 28.1, 1.25  # 1 mark unit = 1.25 frame units (40 wide)
    ox, oy = cx - 16 * S, cy - 16 * S
    P = lambda u, v: (ox + u * S, oy + v * S)
    x0, y0 = P(0, 0); x1, y1 = P(32, 32)
    g += f'<rect x="{x0}" y="{y0}" width="{32 * S}" height="{32 * S}" {dl}/>'
    for u, v in ((7.4, 7.4), (24.6, 7.4), (7.4, 24.6), (24.6, 24.6)):
        px, py = P(u, v)
        g += f'<circle cx="{px}" cy="{py}" r="{7.4 * S}" {dl}/><circle cx="{px}" cy="{py}" r=".25" fill="{a(.55)}"/>'
    g += f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y1}" {hl}/><line x1="{x1}" y1="{y0}" x2="{x0}" y2="{y1}" {hl}/>'
    g += f'<g transform="translate({ox} {oy}) scale({S})"><path d="{MARK}" fill="none" stroke="{a(.5)}" stroke-width="{.08 / S}"/></g>'
    # dimension line + labels on the mark
    g += f'<line x1="{x0}" y1="{y0 - 1.6}" x2="{x1}" y2="{y0 - 1.6}" {hl}/><line x1="{x0}" y1="{y0 - 2.2}" x2="{x0}" y2="{y0 - 1}" {hl}/><line x1="{x1}" y1="{y0 - 2.2}" x2="{x1}" y2="{y0 - 1}" {hl}/>'
    g += t(50, y0 - 2.1, "32 U", "middle")
    px, py = P(7.4, 7.4); g += t(px, py - 7.4 * S - .6, "LOBE  R 7.4", "middle", .4, .65)
    px, py = P(16, 16); g += t(px + 3.2, py - 5.2, "STAR 90°", "start", .4, .65)
    g += f'<path d="M {px + 2.2} {py - 3.2} A 3.2 3.2 0 0 1 {px + 3.2} {py - 1.8}" {hl}/>'
    # left: vertical fig label + type specimen
    g += t(24.6, 10, "fig. 01", "start", .5, 1.1, 90) + t(24.6, 46, "2026", "start", .45, 1.1, 90)
    g += f'<text x="4" y="30" fill="{a(.18)}" font-family="Geist, sans-serif" font-weight="600" font-size="7" letter-spacing="-.3">Aa</text>'
    g += t(4, 33, "GEIST SEMIBOLD", "start", .45, .7) + t(4, 34.3, "TRACKING -3%", "start", .35, .7)
    g += t(4, 37.5, "GEIST MONO / LABELS", "start", .35, .7)
    g += f'<line x1="4" y1="24.6" x2="17" y2="24.6" {dl}/>'
    # right: component specimens (card, pill, checkbox) in outline
    g += f'<rect x="81" y="6" width="15" height="11" rx="1.1" {hl}/>' + t(81, 5.2, "CARD / RADIUS 12", "start", .4, .6)
    g += f'<rect x="82.2" y="8.2" width="1.1" height="1.1" rx=".25" {hl}/><line x1="84.2" y1="8.75" x2="93" y2="8.75" {dl}/>'
    g += f'<rect x="82.2" y="10.7" width="1.1" height="1.1" rx=".25" fill="{a(.4)}"/><line x1="84.2" y1="11.25" x2="91" y2="11.25" {dl}/>'
    g += f'<rect x="82.2" y="13.6" width="7" height="2" rx="1" {hl}/>' + t(85.7, 14.95, "START FOCUS", "middle", .45, .5)
    g += f'<rect x="81" y="20" width="9" height="2.6" rx="1.3" {dl}/>' + t(81, 24.3, "PILL / FULL", "start", .35, .6)
    # reformr-style mono paragraphs
    g += t(4, 46, "ONE WORKSPACE FOR", "start", .35, .6) + t(4, 47.1, "WORK, LIFE AND", "start", .35, .6) + t(4, 48.2, "BUSINESS.", "start", .35, .6)
    g += t(96, 30, "ZENBOARD®", "end", .35, .6) + t(96, 31.1, "EST. 2026", "end", .35, .6)
    # handles on the wordmark box
    for hx, hy in ((29, 24.4), (71, 24.4), (29, 31.8), (71, 31.8)):
        g += f'<rect x="{hx - .3}" y="{hy - .3}" width=".6" height=".6" fill="{a(.8)}"/>'
    svg = f'<svg class="stage" viewBox="0 0 100 56.25">{g}</svg>'
    s = ('<div class="stage bp-field"></div><div class="stage bp-cloud"></div><div class="stage bp-paper"></div>'
         '<div class="stage bp-fibre"></div><div class="stage grain bp-grain"></div>'
         f'<div class="bp-ink">{svg}</div><div class="stage bp-vignette"></div>')
    s += at(50, 28.1, lockup(42, "#FBFAF6", "#FBFAF6"), "", "filter:drop-shadow(0 0 2.4cqw rgba(255,255,255,.18))")
    if tagline:
        s += at(50, 38, "The single platform to manage work, life, and business.", "cap", "font-size:1.7cqw;color:#FBFAF6;font-weight:500;letter-spacing:-.01em")
        s += at(50, 43.5, '<span class="avail light">Available today</span>')
    return s

def f_8_2(): return blueprint(1.0)
def f_8_3(): return blueprint(.55, tagline=True)

CAMERA = {
 "1.1": "Locked off, slow 2% push-in from 0:00.",
 "1.2": "Slow orbit drift, 3° of roll across the beat; tiles parallax at different depths.",
 "1.3": "Push-in 108%, rack focus: portrait sharp, outer tiles fall into bokeh.",
 "2.1": "Hard hold (freeze), then the camera alone keeps drifting 1%.",
 "2.2": "Whip pan right along the arc, heavy motion blur for 8 frames.",
 "2.3": "Settle: ease out from the whip, dead still for the wordmark.",
 "3.1": "Truck left to right following the hairlines to the bright point.",
 "3.2": "Keep trucking along the line; at the panel, light flash whip (overexposed white bloom, 10 frames) into scene 4.",
 "4.1": "Out of the flash: the window floats in 3D, tilted 14° back and 8° yaw, slow dolly-in and rise; shallow depth of field, far edge soft.",
 "4.2": "Close-up push on the tilted window along the plan rows (ref: macro dolly over the sidebar), then rotate flat to camera for the click.",
 "5.1": "Flat to camera (readable). Left list moves, right panel steps with a 2% scale pulse per feature.",
 "6.1": "Slow 4° tilt up across the wall, rows at two depths.",
 "7.1": "Low angle on the tiles, slight dolly left with each step.",
 "8.1": "Slow pull-back revealing the full ring; cards at three depths with DOF.",
 "8.2": "Slow 3% push-in while the lines draw; the lockup is locked centre.",
 "8.3": "Dead still. Nothing moves in the last 2 seconds.",
}
# ---------- storyboard ----------
SCENES = [
 dict(n=1, name="Juggling", t="0:00–0:10", purpose="Show the person at the centre of too many apps before anything is explained.",
  frames=[("1.1", "0:00", f_1_1, "Paper stage. A soft berry glow blooms, two thin rings draw on around the centre. The portrait pops in with a spring overshoot (0.92 → 1.03 → 1).",
            "—", "Air tone, soft pop"),
          ("1.2", "0:03", f_1_2, "App tiles pop onto the rings one at a time, each on the beat, and start orbiting slowly. Small badges appear (1, 2, 3).",
            "“Your work lives in eight apps.” (word-by-word blur-in)", "Pop per tile, notification pings"),
          ("1.3", "0:06", f_1_3, "Overload. More rings, badges count up to 15 / 19 / 20. Message cards and berry chips (Pending follow-ups, Client chats, Invoice overdue) spawn around him. The camera pushes in; far tiles go soft.",
            "“And you live in all of them.”", "Pings stacking, typing, a rising pulse")],
  out="Hard freeze on the peak ping. Focus pulls to the rings; tiles and cards blur out behind."),
 dict(n=2, name="The resolve", t="0:10–0:15", purpose="Everything scattered becomes one thing: the Zenboard mark.",
  frames=[("2.1", "0:10", f_2_1, "The rings break into bundles of fine hairlines in the brand colours and Berry, spinning around the portrait. Tiles behind are blurred.",
            "—", "Silence, then a reversed swell"),
          ("2.2", "0:12", f_2_2, "The portrait shrinks away. The segments sweep off in one big arc across the frame and the stage clears to Paper. A small ring of segments keeps spinning.",
            "—", "Big whoosh"),
          ("2.3", "0:14", f_2_3, "The small ring snaps into the Zenboard mark in Berry. The wordmark types in letter by letter to the right.",
            "“Meet Zenboard.”", "The Zenboard chime")],
  out="The mark slides to the right and becomes the hub node of the next scene (shape match)."),
 dict(n=3, name="All in one", t="0:15–0:22", purpose="Every app you juggle flows into one place.",
  frames=[("3.1", "0:16", f_3_1, "The app tiles line up on the left. From each one a fan of fine hairlines in that app's colour sweeps right; all the fans converge on one bright point, which pulses out as three dots into the Zenboard node.",
            "“Everything you juggle.”", "Cable hum, soft tick as each line lands"),
          ("3.2", "0:19", f_3_2, "Four soft colour waves ripple along the line, then settle into one flat Berry line as they pass through the Zenboard node. The line hits a panel that wipes open to the real Today screen.",
            "“In one place.”", "Swish on the wipe")],
  out="Light flash whip: the panel overexposes to a white bloom for 10 frames and we come out on the tilted window over the Berry field."),
 dict(n=4, name="Product hero", t="0:22–0:28", purpose="The first real look at the product, in the D6 card style.",
  frames=[("4.1", "0:22", f_4_1, "Berry field from dark to light, with the Zenboard mark large and subtly blended in. The logo sits above. The frosted Today card floats in the centre with a crisp white highlight card overlapping its corner.",
            "“Your whole day. One view.”", "Music enters"),
          ("4.2", "0:26", f_4_2, "A push-in on the highlight card. The cursor clicks Mark done: the title strikes through and the button turns to Done.",
            "—", "One tactile click")],
  out="The Done button morphs into the first pill of the split screen (shape match)."),
 dict(n=5, name="Features", t="0:28–0:40", purpose="Every feature, one after another, without one-feature screens. The list on the left steps; the UI on the right changes to match.",
  frames=[(f"5.{i+1}", f"0:{28 + round(i*1.5):02d}", (lambda i=i: feat_frame(i)),
           ("Left: Paper panel with the feature list scrolling up; the active feature snaps into a solid ink pill. Right: its own dark-to-light field with the Zenboard mark's lobes blended in, a frosted tinted card and a white card floating over its corner. " if i == 0 else "The list springs up one step; the field recolours and the cards swap (tinted card slides up, white card pops in 4 frames later). ")
           + FEAT_NOTES[FEATS[i][0]],
           FEATS[i][0].upper(), "Tick on the step, soft pop on the white card" if i else "Music enters the groove; tick, pop")
          for i in range(len(FEATS))],
  out="The field of the last feature expands to fill the frame and the pills multiply into the wall."),
 dict(n=6, name="Pill wall", t="0:40–0:45", purpose="The breadth of Zenboard at a glance.",
  frames=[("6.1", "0:40", f_6_1, "Rows of module pills scroll in alternating directions on a plain Berry field with fine grain. Every pill has a glass border and a Phosphor icon in a round chip; the Berry pills are frosted glass. No UI cards behind the pills.",
            "—", "Rhythmic ticks on the beat")],
  out="One pill (Tasks) zooms to camera and turns into a 3D tile; the background drops to ink."),
 dict(n=7, name="Icon carousel", t="0:45–0:52", purpose="Each module as a physical, premium object. Semantical-style carousel.",
  frames=[("7.1", "0:45", f_7_1, "Dark stage with a warm berry glow rising from the floor. Chunky 3D module tiles in a row; the centre tile is large and forward, and the sides crop off the frame. A label chip sits under the centre tile.",
            "Tasks", "Low hum, soft clack"),
          ("7.2", "0:48", f_7_2, "The row steps sideways with a spring snap, holds, and steps again: Tasks → Projects → Money → Habits.",
            "Habits", "Clack per step, on the beat")],
  out="The glow blooms to Paper and the tiles scatter outward into a ring of cards."),
 dict(n=8, name="The one", t="0:52–1:04", purpose="A calm resolution: everything around one workspace, then the logo.",
  frames=[("8.1", "0:52", f_8_1, "A ring of real Zenboard UI snippets cropped from the running app (calendar week, today's highlight, money stats, invoices, Meridian Studio client, habits, inbox, docs) plus one Berry mark card, around a centred headline. The ring drifts slowly at three depths.",
            "“Work, life and business. One workspace.”", "Music opens up"),
          ("8.2", "0:58", f_8_2, "Light flash into the outro. On the Berry field (dark to light, fine grain) a blueprint draws on in hairlines and dotted lines: the construction of the Zenboard mark (32-unit box, four lobe circles, diagonals, star angle), a Geist type specimen, outline component cards, grid blocks and mono notes. The lockup lands in the centre, crisp white, framed by rails with corner handles.",
            "Zenboard", "Pen-scratch ticks as lines draw, the chime on the lockup"),
          ("8.3", "1:00", f_8_3, "The blueprint dims to about half so the lockup owns the frame. The tagline rises word by word, then Available today. Nothing moves in the last two seconds.",
            "The single platform to manage work, life, and business. · Available today", "The chime resolves, held chord")],
  out=None),
]

def frame_html(fid, tc, fn, action, onscreen, sfx):
    return f'''<figure class="card" id="f{fid.replace('.', '-')}">
  <div class="fr">{fn()}</div>
  <figcaption>
    <div class="fh"><span class="fid">{fid}</span><span class="tc">{tc}</span></div>
    <p>{H.escape(action)}</p>
    <dl><dt>On screen</dt><dd>{H.escape(onscreen)}</dd><dt>Camera</dt><dd>{H.escape(CAMERA.get(fid, CAMERA.get(fid[:2] + "1", "")))}</dd><dt>Sound</dt><dd>{H.escape(sfx)}</dd></dl>
  </figcaption>
</figure>'''

body = ""
for sc in SCENES:
    frames = "".join(frame_html(*f) for f in sc["frames"])
    out = f'<div class="trans"><span>Transition to scene {sc["n"]+1}</span>{H.escape(sc["out"])}</div>' if sc["out"] else ""
    body += f'''<section class="scene">
  <header><span class="sn">Scene {sc["n"]}</span><h2>{sc["name"]}</h2><span class="st">{sc["t"]}</span></header>
  <p class="purpose">{H.escape(sc["purpose"])}</p>
  <div class="grid">{frames}</div>{out}
</section>'''

page = (ROOT / "template.html").read_text().replace("{{BODY}}", body).replace("{{LOCKUP}}", lockup(100)).replace("{{LOBE}}", MARK.split("ZM")[0] + "Z")
(ROOT / "index.html").write_text(page)
print("wrote", ROOT / "index.html", len(page) // 1024, "KB")
