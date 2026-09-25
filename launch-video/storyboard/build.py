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
            f'{ph(icon, "fill", size="46%")}{b}{lb}</div>')
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
    return paper_stage(.55) + halftone(50, 28.1, 44, "#C41C72", .07) + rings([11, 17]) + portrait(14, "transform:translate(-50%,-50%) scale(.92)") + \
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

# ---------- scene 2 reveal (ref: Google Workspace with Gemini logo sequence) ----------
def gmark(size, extra=""):
    return f'<svg viewBox="-1 -1 34 34" style="width:{size}cqw;height:{size}cqw;{extra}"><path d="{MARK}" fill="url(#zgrad)"/></svg>'

RING = [("CheckSquare", "#2F9E6B"), ("EnvelopeSimple", "#E0523F"), ("CalendarBlank", "#3C6FD8"), ("FileText", "#1C5A70"),
        ("Kanban", "#C41C72"), ("UsersThree", "#E08A2E"), ("CurrencyCircleDollar", "#2F9E6B"), ("Plant", "#C9A21F"),
        ("Timer", "#6E63D9"), ("Lightning", "#C41C72")]
def icon_ring(spread=15):
    # square ring like the reference: 3 across top/bottom, 2 down each side
    pos = [(-1, -1), (0, -1), (1, -1), (1, -.35), (1, .35), (1, 1), (0, 1), (-1, 1), (-1, .35), (-1, -.35)]
    s = ""
    for (ic, c), (u, v) in zip(RING, pos):
        shape = "sheet" if ic in ("FileText", "CheckSquare", "Plant") else "circ" if ic in ("Timer", "UsersThree") else "sq"
        s += at(50 + u * spread, 28.1 + v * spread * .92, f'<span class="ricon {shape}" style="--c:{c}">{ph(ic, "fill", size="54%")}</span>',
                "", f"transform:translate(-50%,-50%) scale({min(1, spread / 13):.2f})")
    return s

def f_2_3r():
    """Icon ring with detailing: orbit guide, hairline spokes to every icon, halo rings behind the mark,
    sparkle dust and small labels, all faint so the icons and mark stay the heroes."""
    import random
    sp = 15
    pos = [(-1, -1), (0, -1), (1, -1), (1, -.35), (1, .35), (1, 1), (0, 1), (-1, 1), (-1, .35), (-1, -.35)]
    g = (f'<rect x="{50 - sp - 1}" y="{28.1 - sp * .92 - 1}" width="{2 * sp + 2}" height="{2 * sp * .92 + 2}" rx="7" fill="none" '
         f'stroke="rgba(196,28,114,.22)" stroke-width=".08" stroke-dasharray=".5 .6"/>')
    for (ic, c), (u, v) in zip(RING, pos):
        x, y = 50 + u * sp, 28.1 + v * sp * .92
        g += (f'<line x1="50" y1="28.1" x2="{x:.2f}" y2="{y:.2f}" stroke="{c}" stroke-width=".06" opacity=".35" stroke-dasharray=".25 .5"/>'
              f'<circle cx="{(50 + x) / 2:.2f}" cy="{(28.1 + y) / 2:.2f}" r=".22" fill="{c}" opacity=".6"/>')
    for r, o in ((6, .5), (9, .3), (12.5, .16)):
        g += f'<circle cx="50" cy="28.1" r="{r}" fill="none" stroke="rgba(196,28,114,{o})" stroke-width=".06"/>'
    rnd = random.Random(11)
    for _ in range(22):
        x, y = rnd.uniform(25, 75), rnd.uniform(6, 50)
        g += f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{rnd.uniform(.08, .22):.2f}" fill="#C41C72" opacity="{rnd.uniform(.12, .35):.2f}"/>'
    s = paper_stage(.25) + f'<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none">{g}</svg>'
    s += at(50, 28.1, '<div class="markhalo"></div>')
    s += icon_ring(sp)
    labels = ["Tasks", "Mail", "Calendar", "Docs", "Projects", "Clients", "Money", "Habits", "Focus", "Automations"]
    for (u, v), t in zip(pos, labels):
        s += at(50 + u * sp, 28.1 + v * sp * .92 + 3.75, f'<span class="rlab">{t}</span>')
    s += at(50, 28.1, gmark(7))
    return s

def f_2_4r():
    return paper_stage(.2) + at(50, 28.1, gmark(3.2, "transform:rotate(18deg)"))

def f_2_5r():
    s = paper_stage(.25) + at(50, 24.5, lockup(40))
    s += at(50, 33.5, f'<span class="withask">with {gmark(2.6)} <b>Ask</b></span>')
    return s

def f_3_1():
    s = paper_stage(.55)
    ys = [9, 16.5, 24, 31.5, 39, 46.5]
    src = [(12 + (2.5 if i % 2 else 0), y, STRAND[KINDS[i]]) for i, y in enumerate(ys)]
    fx, fy = 58, 28.1
    s += f'<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none">{fan(src, (fx, fy))}</svg>'
    for i, (x, y, _) in enumerate(src):
        s += at(x, y, tile(KINDS[i], 5.2))
    s += at(fx, fy, '<span class="spark"></span>') + at(fx + 4.5, fy, '<span class="dot2"></span>') + at(fx + 8.5, fy, '<span class="dot2 lit"></span>') + at(fx + 12, fy, '<span class="dot2"></span>')
    s += at(82, 28.1, f'<div class="node">{mark(7.5)}</div>')
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
    s += at(76, 28.1, '<div class="wipe desk"><div class="wipe-in"><div class="deskfit">' + dashboard() + '</div></div></div>')
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


HALFTONE = (ROOT / "halftone.svgfrag").read_text()
def halftone(x, y, size, color, opacity, rot=0):
    """The Zenboard mark as a halftone dot field (dot size follows the mark, with a soft falloff halo)."""
    return at(x, y, f'<svg viewBox="0 0 100 100" style="width:{size}cqw;height:{size}cqw;opacity:{opacity};transform:rotate({rot}deg)" fill="{color}">{HALFTONE}</svg>', "", "pointer-events:none")

def berry_field():
    return (f'<div class="stage field"></div>'
            + at(18, 40, mark(62, "#ffffff", "opacity:.07"), "", "mix-blend-mode:soft-light")
            + at(92, 6, mark(34, "#ffffff", "opacity:.06"), "", "mix-blend-mode:soft-light")
            + halftone(86, 44, 46, "#ffffff", .09, -8))

NAV = [("Sun", "Today", None), ("Tray", "Inbox", "3"), ("CheckSquare", "Tasks", "12"), ("Kanban", "Projects", None),
       ("FileText", "Docs", None), ("CalendarBlank", "Calendar", None), ("UsersThree", "Clients", None),
       ("CurrencyCircleDollar", "Money", None), ("Plant", "Habits", None), ("Timer", "Focus", None),
       ("ClipboardText", "Forms", None), ("Lightning", "Automations", None)]
def dashboard():
    """Full Zenboard dashboard (dark design system): sidebar with every feature, Today in the middle,
    schedule, money, habits and clients on the right. Content from the running app's demo data."""
    nav = "".join(f'<div class="dn{" on" if i == 0 else ""}">{ph(ic, "regular", size="1.05cqw")}<span>{t}</span>{f"<em>{n}</em>" if n else ""}</div>'
                  for i, (ic, t, n) in enumerate(NAV))
    side = (f'<aside class="ds"><div class="dlogo">{lockup(7.4, "#EDE9E1", BERRY)}</div>'
            f'<div class="dsearch">{ph("MagnifyingGlass", "regular", size=".9cqw")}Search<kbd>⌘K</kbd></div>{nav}'
            '<div class="dsec">Projects</div><div class="dn"><i style="background:#C41C72"></i><span>Brand identity</span></div>'
            '<div class="dn"><i style="background:#3C6FD8"></i><span>Website rebuild</span></div>'
            '<div class="dn"><i style="background:#3F8F55"></i><span>Life</span></div></aside>')
    main = ('<section class="dm"><div class="dg">Good evening, Darshil.</div>'
            '<div class="dsub">You\'ve committed to <b>2 tasks</b>. Highlight: <b>Send invoice for July to TechSpark</b>.</div>'
            f'<div class="dhl"><small>{ph("Star", "fill", size=".8cqw")} Today\'s highlight</small><b>Send invoice for July to TechSpark</b>'
            f'<div class="drw"><span class="dtag">TechSpark</span><span class="dtag r">High</span><span class="dbtn2">{ph("Play", "fill", size=".8cqw")} Start focus</span></div></div>'
            '<div class="dsec2">Today\'s plan · 3</div>'
            '<div class="dr"><i></i>Send invoice for July to TechSpark<em class="dtag r">High</em></div>'
            '<div class="dr"><i></i>Prepare weekly report<em class="dtag y">Medium</em></div>'
            '<div class="dr"><i></i>Send the Q3 retainer proposal<em class="dtag">Meridian</em></div>'
            '<div class="dr dn2"><i class="on"></i>Review design feedback</div></section>')
    right = ('<section class="dx">'
             '<div class="dw"><div class="dwh">Schedule</div>'
             '<div class="de"><s style="background:#3C6FD8"></s>Standup<em>9:00</em></div>'
             '<div class="de"><s style="background:#E08A2E"></s>Coffee with Mira<em>15:00</em></div>'
             '<div class="de"><s style="background:#C41C72"></s>Design review<em>16:00</em></div></div>'
             '<div class="dw"><div class="dwh">Money</div><div class="dms"><div><small>Outstanding</small><b>$4,300</b></div><div><small>Paid</small><b>$6,000</b></div></div></div>'
             '<div class="dw"><div class="dwh">Habits <em>1/3</em></div>'
             '<div class="dh2"><i class="on"></i>Morning walk<em>12</em></div><div class="dh2"><i></i>Inbox to zero<em>4</em></div><div class="dh2"><i></i>Read 20 minutes<em>0</em></div></div>'
             f'<div class="dw"><div class="dwh">Clients</div><div class="dcl"><span class="dface2"><img src="{PEOPLE["p3"]}" alt=""></span>Meridian Studio<em class="dtag g">Active</em></div>'
             f'<div class="dcl"><span class="dface2"><img src="{PEOPLE["p5"]}" alt=""></span>Fernwood Hotels<em class="dtag r">Overdue</em></div></div>'
             '</section>')
    return f'<div class="dash">{side}{main}{right}</div>'

def f_4_1():
    s = berry_field() + at(50, 5, lockup(12, "#fff", "#fff"))
    s += at(49, 29.3, f'<div class="frost tilt wide">{dashboard()}</div>')
    s += at(74, 13, '<div class="float"><div class="hl-l">Today\'s highlight</div><div class="hl-t">Send invoice for July to TechSpark</div>'
                    '<div class="hl-b"><span class="btn">' + ph("Play", "fill", size="1em") + ' Start focus</span><span class="btn g">' + ph("Check", "bold", size="1em") + ' Mark done</span></div></div>')
    s += caption("Your whole day. One view.", y=53.3, size=2.1, color="#fff")
    return s

def f_4_2():
    s = berry_field() + at(50, 5, lockup(12, "#fff", "#fff"))
    s += at(46, 32, f'<div class="frost tilt close wide">{dashboard()}</div>')
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
    """Richer UI per feature (review: more details), still one tinted frosted card + one white floating card."""
    t = tone
    face = lambda k: f'<span class="fface"><img src="{PEOPLE[k]}" alt=""></span>'
    hd = lambda title, right="": f'<div class="fh2"><h4>{title}</h4>{right}</div>'
    chip = lambda x, cls="": f'<span class="fchip {cls}">{x}</span>'
    if name == "Tasks":
        card = (hd("Today's plan", chip("Fri, Sep 25")) +
                '<div class="ftabs"><b>Today 3</b><span>Upcoming 8</span><span>Done 1</span></div>'
                f'<div class="fl"><i></i>Send invoice for July to TechSpark{chip("TechSpark")}<em class="hi">High</em><code>5h</code></div>'
                f'<div class="fl"><i></i>Prepare weekly report{chip("Ops")}<em>Medium</em><code>1h</code></div>'
                f'<div class="fl"><i></i>Send the Q3 retainer proposal{chip("Meridian")}<em>Medium</em><code>45m</code></div>'
                '<div class="fl dn"><i class="on"></i>Review design feedback<code>30m</code></div>'
                '<div class="bars"><span>3 planned</span><span>6h focus</span><span>2h45 meetings</span></div><div class="track"><b style="width:62%"></b></div>')
        flt = ('<small>Today\'s highlight</small><b>Send invoice for July to TechSpark</b>'
               '<div class="fb"><span class="btn">' + ph("Play", "fill", size="1em") + ' Start focus</span><span class="btn g">' + ph("Check", "bold", size="1em") + ' Mark done</span></div>')
    elif name == "Projects":
        card = (hd("Brand identity", f'<span class="fstack">{face("p3")}{face("p4")}{face("p2")}</span>') +
                f'<p>{chip("Acme Studio")} {chip("Due Oct 2")} 5 open · 12 done</p>'
                '<div class="cols"><span>In progress 3</span><span>In review 2</span><span>Revisions 1</span><span>Done 12</span></div>'
                f'<div class="segs"><b style="background:{light}"></b><b style="background:{t};opacity:.55"></b><b class="knob" style="background:{t}"></b><b style="background:#fff"></b></div>'
                '<div class="fl dn"><i class="on"></i>Moodboard and references<code>Sep 12</code></div>'
                f'<div class="fl"><i></i>Logo routes · three directions{chip("In review")}<code>Sep 29</code></div>'
                '<div class="fl"><i></i>Brand guidelines v1<code>Oct 2</code></div>'
                '<div class="bars"><span>Progress</span><span>71%</span></div><div class="track"><b style="width:71%"></b></div>')
        flt = ('<div class="avs">' + avatar("SC", "#C41C72") + avatar("MO", "#3C6A2E") + avatar("PR", "#A0542A") +
               '<span class="srch">' + ph("MagnifyingGlass", "regular", size="48%") + '</span></div>')
    elif name == "Docs":
        card = ('<div class="crumb">Acme Studio / Proposals</div>' + hd("Rebrand proposal · Acme") +
                f'<div class="fmeta">{face("p4")} Mara Okafor · edited 2m ago · 6 min read</div>'
                '<div class="sub">Scope</div>'
                '<p class="dtext">Acme wants a calmer, warmer identity that works from shop window to invoice.</p>'
                '<ul class="blt"><li>Route one · quiet serif-free wordmark</li><li>Route two · warm burgundy and cream system</li><li>Route three · playful mark with motion</li></ul>'
                f'<div class="lnk">{ph("CheckSquare", "fill", size="1em")} Send the proposal <span>Task · Thu</span></div>'
                f'<div class="chips">{chip("Proposal")}{chip("Client: Acme")}{chip("Due Thu")}<span class="cm2">{ph("ChatCircle", "fill", size="1em")} 3</span></div>')
        flt = ('<div class="cm">' + avatar("MO", "#C41C72") + '<div><small>Mara Okafor · comment</small><b>Love route two. Approved.</b></div></div>')
    elif name == "Calendar":
        wk = "".join(f'<span class="{"on" if d == "Fri" else ""}"><small>{d}</small>{n}{"<i></i>" if d in ("Tue", "Fri") else ""}</span>'
                     for d, n in (("Mon", 21), ("Tue", 22), ("Wed", 23), ("Thu", 24), ("Fri", 25), ("Sat", 26), ("Sun", 27)))
        card = (hd("Friday, Sep 25", chip("Week 39")) + f'<div class="wkstrip">{wk}</div>' +
                f'<div class="evr"><s style="background:{t}"></s><div><b>Standup</b><small>Team · Zoom</small></div><em>9:00–9:30</em></div>'
                f'<div class="evr"><s style="background:{light}"></s><div><b>Focus block · proposal</b><small>Zenboard Focus</small></div><em>10:00–12:00</em></div>'
                f'<div class="evr"><s style="background:{light}"></s><div><b>Coffee with Mira</b><small>Fieldhouse café</small></div><em>15:00–15:45</em></div>'
                f'<div class="evr"><s style="background:{t}"></s><div><b>Design review</b><small>{face("p3")}{face("p4")} Meridian Studio</small></div><em>16:00–18:00</em></div>')
        flt = '<small>Next · in 20 min</small><b>Design review</b><div class="fb"><span class="btn">Join</span><span class="btn g">16:00–18:00</span></div>'
    elif name == "Clients":
        card = (f'<div class="fh2"><span class="clogo">MS</span><h4>Meridian Studio</h4>{chip("Active", "ok")}{chip("Healthy", "ok")}</div>'
                f'<div class="fmeta">{face("p3")} Sarah Chen · Head of Brand · sarah@meridian.co</div>'
                '<div class="st3"><div><span>Billed</span><b>$7,000</b></div><div><span>Outstanding</span><b>$2,800</b></div><div><span>Client since</span><b>Mar 2025</b></div></div>'
                '<div class="sub">Projects</div>'
                '<div class="prj"><i style="background:#C41C72"></i>Brand identity<span class="pbar"><b style="width:71%"></b></span><code>5 open</code></div>'
                '<div class="prj"><i style="background:#3C6FD8"></i>Website rebuild<span class="pbar"><b style="width:38%"></b></span><code>3 open</code></div>'
                f'<div class="nstep"><span>Next step · Send the Q3 retainer proposal</span><span class="btn g">Make it a task</span></div>')
        flt = ('<div class="cm">' + avatar("SC", "#A0542A") + '<div><small>Client portal · Sarah Chen</small><b>Proposal approved</b></div></div>')
    elif name == "Money":
        bars = "".join(f'<b style="height:{h}%"></b>' for h in (38, 52, 44, 61, 58, 73, 66, 84, 92))
        card = (hd("Money", chip("Sep 2026")) +
                '<div class="st3"><div><span>Unbilled</span><b>$650</b></div><div><span>Outstanding</span><b>$4,300</b></div><div><span>Paid</span><b>$6,000</b></div></div>'
                f'<div class="mchart">{bars}</div>'
                f'<div class="ir"><span>INV-021</span>Meridian Studio{chip("Draft")}<b>$3,200</b></div>'
                f'<div class="ir"><span>INV-019</span>Fernwood Hotels{chip("Overdue", "bad")}<b>$1,500</b></div>'
                f'<div class="ir"><span>INV-018</span>Atlas Coffee{chip("Paid", "ok")}<b>$4,200</b></div>')
        flt = '<small>INV-018 · Atlas Coffee</small><b class="bigp">$4,200</b><div class="fb"><span class="btn ok">' + ph("CheckCircle", "fill", size="1em") + ' Paid</span></div>'
    elif name == "Habits":
        dots = "".join(f'<i class="{"on" if k not in (3, 9) else ""}"></i>' for k in range(14))
        card = (hd("Habits", chip("1 of 3 today")) +
                '<div class="sub">Morning</div>'
                f'<div class="fl"><i class="on"></i>Morning walk<em>{ph("Fire", "fill", size="1em")} 12</em></div>'
                f'<div class="fl"><i></i>Meditate<em>{ph("Fire", "fill", size="1em")} 12</em></div>'
                '<div class="sub">Evening</div>'
                f'<div class="fl"><i></i>Read 20 minutes<em>{ph("Fire", "fill", size="1em")} 0</em></div>'
                f'<div class="fl"><i></i>No screens after 10pm{chip("Skipped")}</div>'
                f'<div class="hgrid">{dots}</div><div class="bars"><span>Last 14 days</span><span>86% kept</span></div>')
        flt = '<small>Morning walk</small><b class="bigp">12-day streak</b>'
    else:  # Focus
        card = (hd("Focus session", chip("Session 2 of 4")) +
                '<div class="fcols"><div class="timer"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="3"/>'
                f'<circle cx="20" cy="20" r="16" fill="none" stroke="{t}" stroke-width="3" stroke-linecap="round" stroke-dasharray="70 101" transform="rotate(-90 20 20)"/></svg><b>18:42</b></div>'
                '<div class="fside"><small>Working on</small><b>Send invoice for July to TechSpark</b>'
                f'<div class="chips">{chip("TechSpark")}{chip("High")}</div>'
                f'<small>Sound</small><span class="snd">{ph("SpeakerHigh", "fill", size="1em")} Rain on glass</span></div></div>'
                '<div class="sdots"><i class="on"></i><i class="on"></i><i></i><i></i><span>25 min focus · 5 min break</span></div>')
        flt = '<small>Blocking</small><b>Slack, Mail, X</b><div class="fb"><span class="btn">' + ph("Pause", "fill", size="1em") + ' Pause</span></div>'
    return card, flt


LIST_SCALE = [1.45, 1.08, 1.0, 0.95, 0.92]
LIST_OPACITY = [1, .92, .62, .38, 0]
def _lerp_table(t, a):
    i = min(int(a), len(t) - 2); f = min(1, a - i)
    return t[i] + (t[i + 1] - t[i]) * f
def list_scale(a): return _lerp_table(LIST_SCALE, a)
def list_opacity(a): return _lerp_table(LIST_OPACITY, a)
def dial_x(a): return 11.5 - 6.2 * a ** 0.85
def dial_y(rel): return (1 if rel >= 0 else -1) * (7.6 * abs(rel) - .25 * abs(rel) ** 2)
def list_y(rel, h=3.1, gap=2.4):
    """Centre offset (cqw) of a pill `rel` steps from the active one, stacking the scaled pill heights."""
    a = abs(rel); y = 0.0; j = 0.0
    while j < a:
        d = min(1.0, a - j)
        y += d * (h * (list_scale(j) + list_scale(j + d)) / 2 + gap * list_scale(j + d))
        j += d
    return y if rel >= 0 else -y

def feat_frame(idx):
    name, icon, (d, m, l), tone = FEATS[idx]
    s = f'<div class="stage" style="background:{PAPER}"></div>'
    # clock-dial arc (review): pills sit on a curve, the active one sits furthest right in its feature colour
    for k in range(-3, 4):
        n2, ic2, (_, m2, l2), t2 = FEATS[(idx + k) % len(FEATS)]
        a = abs(k)
        sc, op = list_scale(a), list_opacity(a)
        x, y = dial_x(a), dial_y(k)
        if k == 0:
            pill = (f'<div class="fp on" style="background:{m2};border-color:{m2};box-shadow:0 .8cqw 2cqw {m2}55;transform:scale({sc});transform-origin:0 50%">'
                    f'<span class="pico" style="width:2.5cqw;height:2.5cqw;background:color-mix(in srgb,{m2} 12%,#fff);color:{t2}">{ph(KIND[ic2][0], "duotone", size="58%")}</span>{n2}</div>')
        else:
            pill = (f'<div class="fp" style="opacity:{op};transform:scale({sc});transform-origin:0 50%">'
                    f'<span class="pico" style="width:2.5cqw;height:2.5cqw;background:color-mix(in srgb,{l2} 30%,#fff);color:{m2}">{ph(KIND[ic2][0], "duotone", size="58%")}</span>{n2}</div>')
        s += at(x, H_/2 + y, pill, "", "transform:translate(0,-50%)")
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

# ---------- scene 6: automation (ref: "Effortless automation") ----------
def auto_stage():
    """One cohesive brand light: a single soft Berry/petal wash behind the centre, on Paper with the dot grid."""
    return ('<div class="stage paper"><div class="dots"></div></div>'
            '<div class="stage" style="background:radial-gradient(46% 58% at 50% 50%,rgba(234,185,203,.55),rgba(250,237,244,.35) 45%,transparent 75%)"></div>')

def feat_logo(size=8):
    """The Zenboard logo as the centre badge: white mark on a Berry circle with a glass ring."""
    return f'<div class="flogo" style="width:{size}cqw;height:{size}cqw">{mark(size * .5, "#fff")}</div>'

STEPS = [("Lightning", "Trigger", "Invoice is 7 days overdue"), ("EnvelopeSimple", "Step 2", "Draft a friendly reminder"),
         ("Sun", "Step 3", "Move the task to Today"), ("UsersThree", "Step 4", "Post to the client portal")]
def steps_card(state=None):
    rows = ""
    for i, (ic, k, t) in enumerate(STEPS):
        st = "" if state is None else (' <b class="ok">' + ph("CheckCircle", "fill", size="1.1cqw") + '</b>' if i < state
                                      else ' <b class="run"></b>' if i == state else ' <b class="wait"></b>')
        rows += f'<div class="stp{" done" if state is not None and i < state else ""}"><span class="sico">{ph(ic, "fill", size="60%")}</span><span class="stx"><span class="sk">{k}</span>{t}</span>{st}</div>'
        if i == 0: rows += '<div class="sdiv">Actions</div>'
    return f'<div class="acard steps"><div class="ah">{ph("Lightning", "fill", size="1cqw")} Overdue invoice follow-up</div>{rows}<div class="addstep">+ Add step</div></div>'

def prompt_card(typed, pressed=False):
    return (f'<div class="acard prompt"><small>Describe a task for Zenboard</small><p>{typed}<span class="caret"></span></p>'
            f'<span class="cbtn{" pressed" if pressed else ""}">{ph("Sparkle", "fill", size="1em")} Create</span></div>')

def f_auto_1():
    s = auto_stage()
    # symmetric composition: four cards in the corners at matched sizes, two small accents mid-left / mid-right
    s += at(21, 12.5, steps_card(), "", "transform:translate(-50%,-50%) scale(.82)")
    s += at(79, 12.5, '<div class="acard doc"><div class="dl"></div><div class="dl"></div><div class="dl s"></div><div class="dl"></div><div class="dl s"></div></div>'
                      f'<div class="chipx">{ph("FileText", "fill", size="1.1cqw")} Add to a doc</div>', "", "transform:translate(-50%,-50%) scale(.82)")
    s += at(21, 44, prompt_card("When an invoice is 7 days overdue, send a friendly reminder and move it to Today"), "", "transform:translate(-50%,-50%) scale(.82)")
    s += at(79, 44, '<div class="acard chart"><small>Q3 revenue</small><div class="semi"></div><div class="pct"><b>$18.4k</b><span>paid</span><b>$4.3k</b><span>open</span></div></div>', "", "transform:translate(-50%,-50%) scale(.82)")
    s += at(7, 28.1, gmark(5, "filter:blur(.25cqw);opacity:.85"))
    s += at(93, 28.1, gmark(5, "filter:blur(.25cqw);opacity:.85;transform:rotate(45deg)"))
    s += at(50, 15, feat_logo(8.5))
    s += at(50, 27.3, "Effortless automation", "head", "font-size:5.4cqw;letter-spacing:-.045em")
    s += at(50, 34.6, "Describe it once. Zenboard does the work.", "cap", "font-size:2.1cqw;color:#5E5A52;font-weight:400;letter-spacing:-.01em")
    return s

def f_auto_zoom():
    """Macro zoom on Create that continues 6.1 exactly: the same Paper stage and white prompt card,
    the same Berry Create button, only 12x closer, with glassy macro detail and a zoom-blur on the way in."""
    s = '<div class="stage paper"><div class="dots" style="background-size:4cqw 4cqw"></div></div>'
    s += '<div class="stage" style="background:radial-gradient(60% 70% at 40% 45%,rgba(234,185,203,.5),transparent 75%)"></div>'
    s += '<div class="zcard2"><p>due, send a friendly<br>reminder and move it to Today<span class="caret big"></span></p></div>'
    s += at(62, 32, f'<div class="gbtn berry"><span class="gtxt">{ph("Sparkle", "fill", size="1em")} Create</span></div>')
    s += '<div class="cursor zc2"></div>'
    s += '<div class="stage zoomblur"></div>'
    return s

def f_auto_2():
    s = auto_stage()
    s += at(25, 22, prompt_card("When an invoice is 7 days overdue, send a friendly reminder and move it to Today", pressed=True), "", "transform:translate(-50%,-50%) scale(1.15)")
    s += '<div class="cursor" style="left:38.6%;top:45%"></div>'
    s += at(66, 25, steps_card(state=2), "", "transform:translate(-50%,-50%) scale(1.25)")
    s += at(40, 45, '<div class="acard mail"><small>Draft · to Fernwood Hotels</small><b>INV-019 is a week overdue</b>'
                    '<p>Hi Marco, a friendly nudge on INV-019 ($1,500). Happy to resend it if that helps.</p></div>', "", "filter:blur(.05cqw)")
    s += at(84, 49, f'<div class="toast">{ph("CheckCircle", "fill", size="1.2cqw")} Reminder sent to Fernwood Hotels</div>')
    s += at(8, 50, feat_logo(4.2), "", "opacity:.95")
    s += caption("Zenboard does the work.", y=52.5, size=2.3)
    return s


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

def carousel(order, label, step=1):
    """Dark stage with detailing:
    dust bokeh, grain, mono labels under every tile and a step indicator."""
    s = '<div class="stage" style="background:#16060F"></div><div class="stage floorglow"></div>'
    g = ''
    # dust bokeh (seeded, deterministic)
    import random
    rnd = random.Random(7)
    for _ in range(26):
        x, y, r = rnd.uniform(2, 98), rnd.uniform(4, 34), rnd.uniform(.08, .45)
        g += f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="rgba(255,220,235,{rnd.uniform(.05, .22):.2f})"/>'
    s += f'<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none">{g}</svg>'
    s += '<div class="stage rays"></div>'
    s += at(50, 6.5, lockup(17, "#F7F1E8", "#F7F1E8"))
    xs, sz = [2, 24, 50, 76, 98], [11, 13, 18, 13, 11]
    names = {"Receipt": "Invoices", "CalendarBlank": "Calendar", "CheckSquare": "Tasks", "Kanban": "Projects",
             "Plant": "Habits", "Timer": "Focus", "FileText": "Docs"}
    for i, (x, (c, gc, ic), z) in enumerate(zip(xs, order, sz)):
        s += at(x, 25, icon3d(c, gc, z, ic))
        if i != 2:
            s += at(x, 25 + z / 2 + 2.4, f'<span class="i3lab">{names[ic]}</span>')
    s += at(50, 40.5, f'<span class="lbl">{label}</span>')
    dots = "".join(f'<i class="{"on" if k == step else ""}"></i>' for k in range(8))
    s += at(50, 51.5, f'<span class="steps">{dots}<em>0{step + 1} / 08</em></span>')
    s += '<div class="stage grain" style="opacity:.12"></div>'
    return s

def f_7_1():
    return carousel([(FIELD["apricot"], "#fff", "Receipt"), (FIELD["sky"], "#fff", "CalendarBlank"), ("#F5F1EA", BERRY, "CheckSquare"),
                     (BERRY, "#fff", "Kanban"), (FIELD["sage"], "#fff", "Plant")], "Tasks", 0)

def f_7_2():
    return carousel([(FIELD["sky"], "#fff", "CalendarBlank"), ("#F5F1EA", BERRY, "CheckSquare"), (BERRY, "#fff", "Plant"),
                     (FIELD["sage"], "#fff", "Timer"), (FIELD["peri"], "#fff", "FileText")], "Habits", 6)

SNIP = {n: "data:image/jpeg;base64," + base64.b64encode((ROOT / "snips" / f"{n}.jpg").read_bytes()).decode()
        for n in ("highlight", "stats", "invoices", "client", "habits", "calendar", "inbox", "docs")}
def snip(name, w, blur=0):
    f = f"filter:blur({blur}cqw);" if blur else ""
    return f'<div class="snip" style="width:{w}cqw;{f}"><img src="{SNIP[name]}" alt=""></div>'

def f_8_1():
    """Ring of designed UI cards: real Zenboard content, rebuilt in the premium card language (not screenshots)."""
    s = paper_stage(.35)
    face = lambda k: f'<span class="dface"><img src="{PEOPLE[k]}" alt=""></span>'
    dots = "".join(f'<i class="{"" if k in (3, 9) else "on"}"></i>' for k in range(14))
    cards = [
     (14, 14, 21, f'<div class="dc cream"><div class="dh"><span class="dico" style="background:#DDEFF5;color:#1C5A70">{ph("CalendarBlank", "fill", size="60%")}</span>Friday, Sep 25</div>'
        '<div class="ev2" style="--c:#A6D1E0"><b>Standup</b><em>9:00</em></div><div class="ev2" style="--c:#EAB9CB"><b>Coffee with Mira</b><em>15:00</em></div>'
        '<div class="ev2" style="--c:#B8BDEE"><b>Design review</b><em>16:00</em></div></div>'),
     (43, 7.5, 22, '<div class="dc white"><small>Today&#39;s highlight</small><b class="dt">Send invoice for July to TechSpark</b>'
        f'<div class="drow"><span class="dbtn dark">{ph("Play", "fill", size="1em")} Start focus</span><span class="dchip">High</span><span class="dchip">5h</span></div></div>'),
     (72, 11, 24, '<div class="dc cream"><small>Outstanding</small><b class="dbig">$4,300</b>'
        '<div class="bars2"><div><span style="width:92%">Meridian Studio</span><em>$3,200</em></div><div><span style="width:70%">Fernwood Hotels</span><em>$2,800</em></div>'
        '<div><span style="width:44%">Atlas Coffee</span><em>$900</em></div></div></div>'),
     (89, 31, 17, f'<div class="dc" style="background:#DCE8D4"><div class="dh">{face("p3")}<div><b>Meridian Studio</b><small>Sarah Chen · Head of Brand</small></div></div>'
        '<div class="drow"><span class="dchip g">Active</span><span class="dchip">$7,000 billed</span></div></div>'),
     (84, 46.5, 20, f'<div class="spills"><div class="spill"><span class="dico" style="background:#E3EEDD;color:#2F5A27">{ph("CheckCircle", "fill", size="60%")}</span><b>$6,000</b> paid this month</div>'
        f'<div class="spill"><span class="dico" style="background:#F6E1EA;color:#8A2E57">{ph("Clock", "fill", size="60%")}</span><b>6h 30m</b> unbilled</div></div>'),
     (60, 47.5, 15, f'<div class="dc" style="background:#F3DCE6"><small>Morning walk</small><b class="dbig">12<span> days</span></b><div class="hdots">{dots}</div></div>'),
     (37, 47, 19, f'<div class="dc white"><div class="dh"><span class="dico" style="background:#E6E7FA;color:#3A3F8F">{ph("Tray", "fill", size="60%")}</span>Inbox <em>9</em></div>'
        '<div class="chk"><i></i>Renew the domain before it lapses</div><div class="chk"><i></i>Book the Q3 tax call</div><div class="chk"><i class="on"></i>Sketch the pricing page hero</div></div>'),
     (13, 40, 18, f'<div class="dc" style="background:#F4EDCF"><div class="dh"><span class="dico" style="background:#fff;color:#6B5A12">{ph("FileText", "fill", size="60%")}</span>Rebrand proposal</div>'
        f'<p>Acme wants a calmer, warmer identity that works from shop window to invoice.</p><div class="drow">{face("p4")}<small>Mara commented · Approved</small></div></div>'),
     (23, 27.5, 8.5, '<div class="dc" style="background:#DDEFF5;align-items:center"><small>Focus</small><b class="dbig" style="font-size:1.7cqw">18:42</b></div>'),
    ]
    for x, y, w, c in cards:
        s += at(x, y, c, "", f"width:{w}cqw")
    s += at(50, 25.6, "Work, life and business.", "head", "font-size:3.4cqw")
    s += at(50, 29.6, "One workspace.", "head", "font-size:3.4cqw;color:" + BERRY)
    return s

def blueprint(strength=1.0, tagline=False, show_lockup=True):
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
    g += t(50, y0 - 2.1, "32 u", "middle")
    px, py = P(7.4, 7.4); g += t(px, py - 7.4 * S - .6, "Lobe  r 7.4", "middle", .4, .65)
    px, py = P(16, 16); g += t(px + 3.2, py - 5.2, "Star 90°", "start", .4, .65)
    g += f'<path d="M {px + 2.2} {py - 3.2} A 3.2 3.2 0 0 1 {px + 3.2} {py - 1.8}" {hl}/>'
    # left: vertical fig label + type specimen
    g += t(24.6, 10, "fig. 01", "start", .5, 1.1, 90) + t(24.6, 46, "2026", "start", .45, 1.1, 90)
    g += f'<text x="4" y="30" fill="{a(.18)}" font-family="Geist, sans-serif" font-weight="600" font-size="7" letter-spacing="-.3">Aa</text>'
    g += t(4, 33, "Geist Semibold", "start", .45, .7) + t(4, 34.3, "Tracking -3%", "start", .35, .7)
    g += t(4, 37.5, "Geist Mono / labels", "start", .35, .7)
    g += f'<line x1="4" y1="24.6" x2="17" y2="24.6" {dl}/>'
    # right: component specimens (card, pill, checkbox) in outline
    g += f'<rect x="81" y="6" width="15" height="11" rx="1.1" {hl}/>' + t(81, 5.2, "Card / radius 12", "start", .4, .6)
    g += f'<rect x="82.2" y="9.2" width="1.1" height="1.1" rx=".25" {hl}/><line x1="84.2" y1="8.75" x2="93" y2="8.75" {dl}/>'
    g += f'<rect x="82.2" y="10.7" width="1.1" height="1.1" rx=".25" fill="{a(.4)}"/><line x1="84.2" y1="11.25" x2="91" y2="11.25" {dl}/>'
    g += f'<rect x="82.2" y="13.6" width="7" height="2" rx="1" {hl}/>' + t(85.7, 14.95, "Start focus", "middle", .45, .5)
    g += f'<rect x="81" y="20" width="9" height="2.6" rx="1.3" {dl}/>' + t(81, 24.3, "Pill / full", "start", .35, .6)
    # reformr-style mono paragraphs
    g += t(4, 46, "One workspace for", "start", .35, .6) + t(4, 47.1, "work, life and", "start", .35, .6) + t(4, 48.2, "business.", "start", .35, .6)
    g += t(96, 30, "Zenboard®", "end", .35, .6) + t(96, 31.1, "Est. 2026", "end", .35, .6)
    # handles on the wordmark box
    for hx, hy in ((29, 24.4), (71, 24.4), (29, 31.8), (71, 31.8)):
        g += f'<rect x="{hx - .3}" y="{hy - .3}" width=".6" height=".6" fill="{a(.8)}"/>'
    svg = f'<svg class="stage" viewBox="0 0 100 56.25">{g}</svg>'
    s = ('<div class="stage bp-field"></div><div class="stage bp-cloud"></div><div class="stage bp-paper"></div>'
         '<div class="stage bp-fibre"></div><div class="stage grain bp-grain"></div>'
         f'<div class="bp-ink">{svg}</div><div class="stage bp-vignette"></div>')
    if show_lockup:
        s += at(50, 28.1, lockup(42, "#FBFAF6", "#FBFAF6"), "", "filter:drop-shadow(0 0 2.4cqw rgba(255,255,255,.18))")
    if tagline:
        s += at(50, 38, "The single platform to manage work, life, and business.", "cap", "font-size:1.7cqw;color:#FBFAF6;font-weight:500;letter-spacing:-.01em")
        s += at(50, 43.5, '<span class="avail light">Available today</span>')
    return s


def f_logo_anim():
    """End logo animation shown as onion-skin keyframes on the dimmed blueprint:
    four lobes gather from the corners, the star cut-out turns 90°, the wordmark rises letter by letter."""
    s = blueprint(.4, show_lockup=False)
    W = "#FBFAF6"
    cx, cy = 29.5, 28.1           # mark centre in the final lockup (lockup 42 wide, mark = 32/152 of it)
    g = ""
    for sx, sy, ex, ey in ((8, 6, cx - 2.2, cy - 2.2), (51, 6, cx + 2.2, cy - 2.2), (8, 50, cx - 2.2, cy + 2.2), (51, 50, cx + 2.2, cy + 2.2)):
        g += f'<path d="M{sx} {sy} Q{(sx + ex) / 2 + (4 if sx < cx else -4)} {(sy + ey) / 2} {ex} {ey}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".08" stroke-dasharray=".4 .5"/>'
        for k, t in enumerate((0, .35, .65)):
            x, y = sx + (ex - sx) * t, sy + (ey - sy) * t
            g += f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{1.6 + t}" fill="{W}" opacity="{.12 + k * .12:.2f}"/>'
    g += f'<path d="M {cx + 5.2} {cy - 6.5} A 7 7 0 0 1 {cx + 7} {cy - 1.5}" fill="none" stroke="rgba(255,255,255,.6)" stroke-width=".1" marker-end="url(#arr)"/>'
    g = ('<defs><marker id="arr" viewBox="0 0 4 4" refX="2" refY="2" markerWidth="3" markerHeight="3" orient="auto">'
         '<path d="M0 0 L4 2 L0 4 z" fill="rgba(255,255,255,.7)"/></marker></defs>') + g
    s += f'<svg class="stage" viewBox="0 0 100 56.25">{g}</svg>'
    s += at(cx, cy, mark(8.8, W, "transform:rotate(-12deg);filter:drop-shadow(0 0 1.2cqw rgba(255,255,255,.25))"))
    letters = "".join(f'<path d="{d}" fill="{W}"/>' for d in LETTERS)
    for k, (dy, o) in enumerate(((3.2, .12), (1.6, .3), (0, 1))):
        s += at(58.5, cy + dy, f'<svg viewBox="38 0 114 32" style="width:31.5cqw;opacity:{o}">{letters}</svg>')
    for x, y, t in ((12, 12.5, "1  lobes gather"), (40, 17.5, "2  star turns 90°"), (74, 38, "3  wordmark rises")):
        s += at(x, y, f'<span class="anote">{t}</span>')
    return s


def f_end_icon():
    """Last screen: black, white/graphite only. The Zenboard mark as a chunky graphite app icon
    (ref: terminal icon), engraved in an inset pill like a keycap."""
    s = '<div class="stage" style="background:#000"></div>'
    s += halftone(50, 28.1, 58, "#C41C72", .16)
    s += at(50, 28.1, '<div class="bglow"></div>')
    s += at(50, 28.1, f'<div class="bicon brand"><span class="bspec"></span><span class="bgrain"></span>{mark(13, "#FFF7FB")}<span class="bspark"></span></div>')
    s += at(50, 47, '<div class="bfloor"></div>')
    return s

def f_8_2(): return blueprint(1.0)
def f_8_3(): return blueprint(.55, tagline=True) + halftone(90, 48, 34, "#ffffff", .08, 12)

CAMERA = {
 "9.3": "Locked off on the lockup; a 1% push-in across the build.",
 "9.4": "Dead still for the tagline.",
 "9.5": "Locked off, centred. Fade up from black, a 2% scale settle, a 1.5s hold, then fade to black.",
 "6.2": "Zoom-through from 6.1: a 12× push into the Create button, motion blur on the way in, then a locked macro with shallow depth of field. On the press the camera pulls back out into 6.3 (reverse zoom).",
 "6.3": "Rack focus from the prompt card to the steps card as it runs; slight push-in on each tick.",
 "2.4": "Locked off; the only motion is the mark's spin.",
 "2.5": "Locked off, dead still for the lockup.",
 "6.1": "Slow push-in on the headline; the floating cards drift outward at three depths with DOF (far cards soft).",
 "6.2": "Rack focus from the prompt card to the steps card as it runs; slight push-in on each tick.",
 "1.1": "Locked off, slow 2% push-in from 0:00.",
 "1.2": "Slow orbit drift, 3° of roll across the beat; tiles parallax at different depths.",
 "1.3": "Push-in 108%, rack focus: portrait sharp, outer tiles fall into bokeh.",
 "2.1": "Hard hold (freeze), then the camera alone keeps drifting 1%.",
 "2.2": "Whip pan right along the arc, heavy motion blur for 8 frames.",
 "2.3": "Settle out of the whip; a slow 2% push-in while the icons pop.",
 "3.1": "Truck left to right following the hairlines to the bright point.",
 "3.2": "Keep trucking along the line; at the panel, light flash whip (overexposed white bloom, 10 frames) into scene 4.",
 "4.1": "Out of the flash: the window floats in 3D, tilted 14° back and 8° yaw, slow dolly-in and rise; shallow depth of field, far edge soft.",
 "4.2": "Close-up push on the tilted window along the plan rows (ref: macro dolly over the sidebar), then rotate flat to camera for the click.",
 "5.1": "Flat to camera (readable). Left list moves, right panel steps with a 2% scale pulse per feature.",
 "7.1": "Slow 4° tilt up across the wall, rows at two depths.",
 "8.1": "Low angle on the tiles, slight dolly left with each step.",
 "9.1": "Slow pull-back revealing the full ring; cards at three depths with DOF.",
 "9.2": "Slow 3% push-in while the lines draw; the lockup is locked centre.",
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
          ("2.3", "0:12.5", f_2_3r, "Zenboard's module icons (Tasks, Mail, Calendar, Docs, Projects, Clients, Money, Habits, Focus, Automations) pop in one by one in a square ring around the Zenboard mark, each as a product icon on its own coloured shape (squircle, folded sheet or circle) with a second-tone corner, like the reference, which is filled with the brand gradient (Berry, petal, apricot, lavender edge).",
            "—", "A soft pop per icon, on the beat"),
          ("2.4", "0:13.5", f_2_4r, "The ring pulls tight and every icon is absorbed into the mark. The mark alone shrinks and spins once, small in the centre of a clean Paper frame.",
            "—", "An inward swoosh, then silence"),
          ("2.5", "0:14.5", f_2_5r, "The mark springs to full size and settles into the lockup; the wordmark types in beside it. A second line rises: with, the gradient mark, Ask.",
            "Zenboard with ✦ Ask", "The Zenboard chime")],
  out="The mark slides to the right and becomes the hub node of the next scene (shape match)."),
 dict(n=3, name="All in one", t="0:15–0:22", purpose="Every app you juggle flows into one place.",
  frames=[("3.1", "0:16", f_3_1, "The app tiles line up on the left. From each one a fan of fine hairlines in that app's colour sweeps right; all the fans converge on one bright point, which pulses out as three dots into the Zenboard node.",
            "“Everything you juggle.”", "Cable hum, soft tick as each line lands"),
          ("3.2", "0:19", f_3_2, "Four soft colour waves ripple along the line, then settle into one flat Berry line as they pass through the Zenboard node. The line hits a panel that wipes open to the full Zenboard desktop dashboard.",
            "“In one place.”", "Swish on the wipe")],
  out="Light flash whip: the panel overexposes to a white bloom for 10 frames and we come out on the tilted window over the Berry field."),
 dict(n=4, name="Product hero", t="0:22–0:28", purpose="The first real look at the product, in the D6 card style.",
  frames=[("4.1", "0:22", f_4_1, "Berry field from dark to light, with the Zenboard mark large and subtly blended in. The logo sits above. The full Zenboard dashboard floats in the centre in a frosted frame, with every feature visible: the sidebar (Today, Inbox, Tasks, Projects, Docs, Calendar, Clients, Money, Habits, Focus, Forms, Automations), Today in the middle, and schedule, money, habits and clients on the right. A crisp white highlight card overlaps its corner.",
            "“Your whole day. One view.”", "Music enters"),
          ("4.2", "0:26", f_4_2, "A push-in on the highlight card. The cursor clicks Mark done: the title strikes through and the button turns to Done.",
            "—", "One tactile click")],
  out="The Done button morphs into the first pill of the split screen (shape match)."),
 dict(n=5, name="Features", t="0:28–0:40", purpose="Every feature, one after another, without one-feature screens. The list on the left steps; the UI on the right changes to match.",
  frames=[(f"5.{i+1}", f"0:{28 + round(i*1.5):02d}", (lambda i=i: feat_frame(i)),
           ("Left: Paper panel with the feature list set on a curved dial like a clock face: the active feature sits furthest right as a larger pill in that feature's own colour (icon colours match), and the neighbours curve away, smaller and fainter. Each step is a crisp clock tick. Right: its own dark-to-light field with the Zenboard mark's lobes blended in, a frosted tinted card and a white card floating over its corner. " if i == 0 else "The list springs up one step; the field recolours and the cards swap (tinted card slides up, white card pops in 4 frames later). ")
           + FEAT_NOTES[FEATS[i][0]],
           FEATS[i][0], "Tick on the step, soft pop on the white card" if i else "Music enters the groove; tick, pop")
          for i in range(len(FEATS))],
  out="The Berry panel folds away to Paper; the Automations logo pops into the centre."),
 dict(n=6, name="Zenboard does the work", t="0:40–0:46", purpose="Automation: describe a job once and watch Zenboard do it (ref: Effortless automation).",
  frames=[("6.1", "0:40", f_auto_1, "Paper stage with soft coloured light. The Zenboard logo (white mark on a Berry circle) pops in at the centre, the headline rises word by word, and real Zenboard pieces float around it at different depths: the automation steps card, a doc with Add to a doc, the prompt card, a Q3 revenue chart, the Zenboard mark as a soft glowing sparkle and a Money tile.",
            "Effortless automation · Describe it once. Zenboard does the work.", "Soft whoosh as the cards drift in, a chime on the logo"),
          ("6.2", "0:42", f_auto_zoom, "Zoom transition: the camera dives into the Create button until it fills the frame. It continues 6.1 exactly: the same Paper stage and dot grid, the white prompt card with its text cropped huge at the edge, and the same Berry Create button, only 12× closer, with glassy macro detail (top highlight, soft inner glow, iridescent rim). A radial zoom blur streaks the edges on the way in. The cursor tip presses it: the pill squashes 4% and a Berry glow ring pulses out.",
            "Create", "Deep glassy click, a short rising shimmer"),
          ("6.3", "0:43.5", f_auto_2, "Zenboard opens the work: the prompt card comes forward, the cursor presses Create, and the steps card runs by itself. Trigger and draft tick green, Move to Today spins, the client portal step waits. A drafted reminder to Fernwood Hotels slides in and a toast confirms it was sent.",
            "Zenboard does the work.", "Click on Create, a tick per step, a soft send whoosh")],
  out="The toast pill multiplies into rows of pills: the pill wall."),
 dict(n=7, name="Pill wall", t="0:46–0:51", purpose="The breadth of Zenboard at a glance.",
  frames=[("7.1", "0:46", f_6_1, "Rows of module pills scroll in alternating directions on a plain Berry field with fine grain. Every pill has a glass border and a Phosphor icon in a round chip; the Berry pills are frosted glass. No UI cards behind the pills.",
            "—", "Rhythmic ticks on the beat")],
  out="One pill (Tasks) zooms to camera and turns into a 3D tile; the background drops to ink."),
 dict(n=8, name="Icon carousel", t="0:51–0:58", purpose="Each module as a physical, premium object. Semantical-style carousel.",
  frames=[("8.1", "0:51", f_7_1, "Dark stage with a warm berry glow rising from the floor. Chunky 3D module tiles in a row; the centre tile is large and forward, and the sides crop off the frame. A label chip sits under the centre tile.",
            "Tasks", "Low hum, soft clack"),
          ("8.2", "0:54", f_7_2, "The row steps sideways with a spring snap, holds, and steps again: Tasks → Projects → Money → Habits.",
            "Habits", "Clack per step, on the beat")],
  out="The glow blooms to Paper and the tiles scatter outward into a ring of cards."),
 dict(n=9, name="The one", t="0:58–1:12", purpose="A calm resolution: everything around one workspace, then the logo.",
  frames=[("9.1", "0:58", f_8_1, "A ring of designed UI cards built from the real app's content in the premium card language: calendar day, today's highlight, outstanding $4,300 with client bars, Meridian Studio with Sarah's face, paid and unbilled stat pills, a 12-day habit streak, inbox, the Acme proposal with Mara's approval and a focus timer. They sit around a centred headline and drift slowly at three depths.",
            "“Work, life and business. One workspace.”", "Music opens up"),
          ("9.2", "1:04", f_8_2, "Light flash into the outro. On the Berry field (dark to light, fine grain) a blueprint draws on in hairlines and dotted lines: the construction of the Zenboard mark (32-unit box, four lobe circles, diagonals, star angle), a Geist type specimen, outline component cards, grid blocks and mono notes. The lockup lands in the centre, crisp white, framed by rails with corner handles.",
            "Zenboard", "Pen-scratch ticks as lines draw, the chime on the lockup"),
          ("9.3", "1:05", f_logo_anim, "End logo animation, shown as onion-skin keyframes. First the four lobes of the mark fly in from the corners on soft curves and fuse, with a spring overshoot. Then the star cut-out opens and turns 90°. Finally the wordmark rises letter by letter, staggered 2 frames apart, and the lockup settles with a soft white glow.",
            "Zenboard", "Four soft taps as the lobes land, a glassy swirl on the turn, the chime on the settle"),
          ("9.4", "1:07", f_8_3, "The blueprint dims to about half so the lockup owns the frame. The tagline rises word by word, then Available today. Nothing moves in the last two seconds.",
            "The single platform to manage work, life, and business. · Available today", "The chime resolves, held chord")
          ,("9.5", "1:09", f_end_icon, "Last screen. Hard cut to pure black. The Zenboard mark returns as a chunky 3D app icon in the brand colours, in the style of the terminal icon reference. It is a Berry squircle glowing from dark to light with a bevelled edge catching a thin highlight, lit from the top left, and a white mark embossed in the centre. Details: a curved specular sheen, fine grain on the surface, a tiny glint on the mark, a soft Berry bloom and floor glow, and a subtle halftone of the mark radiating behind it. It fades up from black with a slow 2% scale settle, holds, and fades out.",
            "—", "Silence, then one low soft tap as the icon settles")],
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

page = ((ROOT / "template.html").read_text() + (ROOT / "fonts.css.html").read_text()).replace("<title>Zenboard Launch Storyboard</title>\n", "")
page = "<title>Zenboard Launch Storyboard</title>\n" + page
page = page.replace("{{BODY}}", body).replace("{{LOCKUP}}", lockup(100)).replace("{{LOBE}}", MARK.split("ZM")[0] + "Z")
(ROOT / "index.html").write_text(page)
print("wrote", ROOT / "index.html", len(page) // 1024, "KB")
