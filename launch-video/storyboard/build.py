"""Builds storyboard/index.html (the v4 storyboard) from the frame definitions below."""
import base64, math, re, pathlib, html as H

ROOT = pathlib.Path(__file__).resolve().parent
LOGO = (ROOT.parent / "src/brand/logo.generated.ts").read_text()
MARK = re.search(r'LOCKUP_MARK = "([^"]+)"', LOGO).group(1)
LETTERS = re.findall(r'"(M[^"]+)"', LOGO.split("LOCKUP_LETTERS")[1])[:8]
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

# generic app glyphs (competitor stand-ins; real logos are an open decision)
GLY = {
 "mail":  ('#E0523F', '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 8l9 6 9-6"/>'),
 "chat":  ('#7B5CD6', '<path d="M4 5h16v10H10l-5 4v-4H4z"/>'),
 "tasks": ('#2F9E6B', '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12l3 3 5-6"/>'),
 "docs":  ('#3C6FD8', '<path d="M6 3h8l4 4v14H6z"/><path d="M9 12h6M9 16h6"/>'),
 "crm":   ('#E08A2E', '<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M3 20c1-4 4-6 6-6s5 2 6 6M14 15c3 0 5 2 6 5"/>'),
 "cal":   ('#D8425B', '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
 "money": ('#1E8C8C', '<circle cx="12" cy="12" r="8"/><path d="M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5 1-2.5 2s1 1.6 2.5 2 2.5 1 2.5 2.2-1 2-2.5 2-2.3-.6-2.7-1.6M12 6v12"/>'),
 "notes": ('#C9A21F', '<path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>'),
}
def tile(kind, size=6.2, blur=0, badge=None):
    c, g = GLY[kind]
    b = f'<span class="badge">{badge}</span>' if badge else ""
    f = f"filter:blur({blur}cqw);opacity:.75;" if blur else ""
    return (f'<div class="tile" style="width:{size}cqw;height:{size}cqw;{f}">'
            f'<svg viewBox="0 0 24 24" style="width:55%;height:55%" fill="none" stroke="{c}" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round">{g}</svg>{b}</div>')

def ring_positions(n, r, cx=50, cy=H_/2, start=-90, squash=1.0):
    return [(cx + r*math.cos(math.radians(start+i*360/n)), cy + r*squash*math.sin(math.radians(start+i*360/n))) for i in range(n)]

def rings(rs, dashed_inner=True):
    out = ""
    for i, r in enumerate(rs):
        st = "dashed" if (dashed_inner and i == 0) else "solid"
        out += at(50, H_/2, "", "ring", f"width:{2*r}cqw;height:{2*r}cqw;border-style:{st}")
    return out

def portrait(size=15, extra=""):
    return at(50, H_/2, f'<img src="{PORTRAIT}" alt="">', "portrait", f"width:{size}cqw;height:{size}cqw;{extra}")

def paper_stage(glow=1.0):
    return f'<div class="stage paper"><div class="glow" style="opacity:{glow}"></div></div>'

def chip(t): return f'<span class="chip">{H.escape(t)}</span>'
def msg(name, t, w=17): return f'<div class="msg" style="width:{w}cqw"><b>{H.escape(name)}</b><span>{H.escape(t)}</span></div>'
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
        if i < 6: s += at(x, y, tile(KINDS[i], badge=[None, 3, None, 1, None, 2][i]))
    s += portrait(14) + caption("Your work lives in eight apps.", y=53.2, dim=5)
    return s

def f_1_3():
    s = paper_stage(1) + rings([11, 17, 24, 31])
    badges = [15, 7, None, 19, 4, 20, None, 9]
    for i, (x, y) in enumerate(ring_positions(8, 22, start=-70, squash=.86)):
        s += at(x, y, tile(KINDS[i], 5.8 if i % 3 else 6.6, blur=.25 if i in (1, 6) else 0, badge=badges[i]))
    s += at(27, 10, chip("Email") + msg("To: Mara · Acme", "Following up on the proposal…", 15), "stack")
    s += at(74, 13, chip("Pending follow-ups") + msg("Sarah", "Any update on the invoice?", 15) + msg("David", "Where's the latest file?", 15), "stack")
    s += at(71, 43, chip("Client chats") + msg("James", "Quick check-in, any news?", 15), "stack")
    s += at(21, 41, chip("Invoice overdue") + msg("Fernwood Hotels", "INV-019 · $1,500 · 6 days late", 16), "stack")
    s += portrait(13.5) + caption("And you live in all of them.", y=53.2, size=2.4)
    return s

def f_2_1():
    s = paper_stage(1)
    for i, (x, y) in enumerate(ring_positions(8, 22, start=-70)):
        s += at(x, y, tile(KINDS[i], 6, blur=.9))
    cols = [FIELD["petal"], BERRY, FIELD["apricot"], FIELD["sky"], FIELD["sage"], FIELD["butter"], FIELD["peri"]]
    seg = "".join(f'<circle r="42" cx="50" cy="50" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round" '
                  f'stroke-dasharray="28 236" stroke-dashoffset="{-i*38}"/>' for i, c in enumerate(cols))
    s += at(50, H_/2, f'<svg viewBox="0 0 100 100" style="width:34cqw;transform:rotate(-20deg)">{seg}</svg>')
    s += portrait(13, "filter:blur(.15cqw)")
    return s

def f_2_2():
    s = paper_stage(.4)
    cols = [BERRY, FIELD["petal"], FIELD["apricot"]]
    arcs = "".join(f'<path d="M -10 {95+i*5} C 30 {70+i*5}, 70 {40+i*4}, 115 {-5+i*6}" fill="none" stroke="{c}" '
                   f'stroke-width="{7-i*1.5}" stroke-linecap="round"/>' for i, c in enumerate(cols))
    s += f'<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none">{arcs}</svg>'
    small = "".join(f'<circle r="16" cx="50" cy="50" fill="none" stroke="{c}" stroke-width="5" stroke-linecap="round" '
                    f'stroke-dasharray="17 84" stroke-dashoffset="{-i*25}"/>' for i, c in enumerate([BERRY, FIELD["sky"], FIELD["apricot"], FIELD["sage"]]))
    s += at(42, 27, f'<svg viewBox="0 0 100 100" style="width:22cqw">{small}</svg>')
    return s

def f_2_3():
    return paper_stage(.35) + at(50, 25, lockup(36)) + caption("Meet Zenboard.", y=36, size=2.4, color="#37352F", dim=1)

def f_3_1():
    s = paper_stage(.8)
    ys = [10, 17, 24, 31, 38, 45]
    paths = ""
    for i, y in enumerate(ys):
        paths += f'<path d="M 22 {y} C 45 {y}, 48 28.1, 66 28.1" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".95"/>'
    paths += '<path d="M 66 28.1 L 100 28.1" stroke="#fff" stroke-width="2" />'
    s += f'<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none" style="filter:drop-shadow(0 .3cqw .8cqw rgba(196,28,114,.18))">{paths}</svg>'
    for i, y in enumerate(ys):
        s += at(18 + (3 if i % 2 else 0), y, tile(KINDS[i], 5.4))
    s += at(75, 28.1, f'<div class="node">{mark(7)}<span>Zenboard</span></div>')
    s += caption("Everything you juggle.", y=51, size=2.4)
    return s

def f_3_2():
    s = paper_stage(.8)
    s += '<svg class="stage" viewBox="0 0 100 56.25" preserveAspectRatio="none"><path d="M 0 28.1 L 60 28.1" stroke="#fff" stroke-width="2"/><path d="M 0 28.1 L 38 28.1" stroke="'+BERRY+'" stroke-width=".5" stroke-dasharray="1 1.2" opacity=".5"/></svg>'
    s += at(36, 28.1, f'<div class="node sm">{mark(5)}</div>')
    s += at(79, 28.1, '<div class="wipe"><div class="wipe-in">' + today_card(mini=True) + '</div></div>')
    s += caption("In one place.", y=51, size=2.4)
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
    s += at(45, 31, f'<div class="frost">{today_card()}</div>')
    s += at(66, 17, '<div class="float"><div class="hl-l">Today\'s highlight</div><div class="hl-t">Send invoice for July to TechSpark</div>'
                    '<div class="hl-b"><span class="btn">▶ Start focus</span><span class="btn g">✓ Mark done</span></div></div>')
    s += caption("Your whole day. One view.", y=52, size=2.2, color="#fff")
    return s

def f_4_2():
    s = berry_field() + at(50, 5, lockup(12, "#fff", "#fff"))
    s += at(50, 30, f'<div class="frost" style="transform:scale(1.35)">{today_card()}</div>', "", "filter:blur(.12cqw)")
    s += at(64, 30, '<div class="float"><div class="hl-l">Today\'s highlight</div><div class="hl-t"><s>Send invoice for July to TechSpark</s></div>'
                    '<div class="hl-b"><span class="btn g on">✓ Done</span></div></div><div class="cursor"></div>')
    return s

MODULES = ["Tasks", "Projects", "Docs", "Calendar", "Clients", "Money", "Habits", "Focus"]
ICON = {"Tasks": "tasks", "Projects": "crm", "Docs": "docs", "Calendar": "cal", "Clients": "crm", "Money": "money", "Habits": "notes", "Focus": "tasks"}
def split(active, card):
    i = MODULES.index(active)
    pills = ""
    for k in range(-3, 4):
        m = MODULES[(i + k) % len(MODULES)]
        pills += at(21, H_/2 + k*8.2, f'<div class="pill{" on" if k == 0 else ""}">{tile(ICON[m], 3, 0).replace("tile", "pico")}{m.upper()}</div>')
    return (f'<div class="stage" style="background:{PAPER}"></div><div class="half"></div>' + pills
            + at(74, H_/2, card) + at(93, 52, mark(2.4)) + at(56, 52.5, lockup(9, INK), "", "transform:translate(0,-50%)"))

def stack(front, back1, back2):
    return (f'<div class="stk"><div class="bk b2" style="background:{back2}"></div><div class="bk b1" style="background:{back1}"></div>'
            f'<div class="fr-card">{front}</div></div>')

def f_5_1():
    front = ('<div class="mc-h">Inbox <em>3</em></div><div class="row"><i></i>Review the launch checklist<em class="tag r">High</em></div>'
             '<div class="row"><i></i>Draft the weekly update</div><div class="row"><i></i>Chase the contract signature<em class="tag y">Waiting</em></div>'
             '<div class="row done"><i class="on"></i>Book the Q3 tax call</div>')
    return split("Tasks", stack(front, FIELD["petal"], FIELD["sky"]))

def f_5_2():
    front = ('<div class="mc-h"><span class="av">MS</span>Meridian Studio</div>'
             '<div class="kv"><span>Status</span><em class="tag g">Active</em></div><div class="kv"><span>Contact</span>Sarah Chen · Head of Brand</div>'
             '<div class="kv"><span>Billed</span>$7,000 · $2,800 outstanding</div><div class="kv"><span>Next step</span>Send the Q3 retainer proposal</div>')
    return split("Clients", stack(front, FIELD["sage"], FIELD["petal"]))

def f_5_3():
    front = ('<div class="mc-h">Money</div><div class="stats"><div><span>Outstanding</span><b>$4,300</b></div><div><span>Paid this month</span><b>$6,000</b></div></div>'
             '<div class="inv"><span>INV-021</span>Meridian Studio<em class="tag">Draft</em><b>$3,200</b></div>'
             '<div class="inv"><span>INV-019</span>Meridian Studio<em class="tag r">Overdue</em><b>$1,500</b></div>'
             '<div class="inv"><span>INV-018</span>Atlas Coffee<em class="tag g">Paid</em><b>$4,200</b></div>')
    return split("Money", stack(front, FIELD["apricot"], FIELD["sage"]))

PILLS = [("Tasks", "sky"), ("Projects", "sand"), ("Invoices", "apricot"), ("Calendar", "berry"), ("Notes", "butter"),
         ("Habits", "petal"), ("Focus", "sky"), ("Clients", "peri"), ("Docs", "peri"), ("Goals", "sand"),
         ("Payments", "berry"), ("Time tracking", "sage"), ("Proposals", "sand"), ("Life", "sage"), ("Files", "petal"),
         ("Automations", "petal"), ("Insights", "sand"), ("Messages", "sky"), ("Reminders", "peri")]
def f_6_1():
    s = '<div class="stage" style="background:#8E1253"></div>'
    for r in range(6):
        row = "".join(f'<span class="wp" style="background:{BERRY if c == "berry" else FIELD[c]};color:{"#fff" if c == "berry" else INK};'
                      f'{"box-shadow:0 0 0 .25cqw #fff" if c == "berry" else ""}">{t}</span>'
                      for t, c in (PILLS[(r*5 + k) % len(PILLS)] for k in range(8)))
        s += at(50 + (-6 if r % 2 else 4), 6 + r*9, f'<div class="wrow">{row}</div>')
    return s

def icon3d(color, glyph_color, size, label=None):
    return (f'<div class="i3" style="width:{size}cqw;height:{size}cqw;--c:{color}">'
            f'{mark(size*.42, glyph_color, "filter:drop-shadow(0 .2cqw .2cqw rgba(0,0,0,.25))")}</div>')

def carousel(order, label):
    s = '<div class="stage" style="background:#16060F"></div><div class="stage floorglow"></div>'
    s += at(50, 5, lockup(11, "#F7F1E8", "#F7F1E8"))
    xs, sz = [2, 24, 50, 76, 98], [11, 13, 18, 13, 11]
    for x, (c, g), z in zip(xs, order, sz):
        s += at(x, 25, icon3d(c, g, z))
    s += at(50, 40.5, f'<span class="lbl">{label}</span>')
    return s

def f_7_1():
    return carousel([(FIELD["apricot"], "#fff"), (FIELD["sky"], "#fff"), ("#F5F1EA", BERRY), (BERRY, "#fff"), (FIELD["sage"], "#fff")], "Tasks")

def f_7_2():
    return carousel([(FIELD["sky"], "#fff"), ("#F5F1EA", BERRY), (BERRY, "#fff"), (FIELD["sage"], "#fff"), (FIELD["peri"], "#fff")], "Habits")

def f_8_1():
    s = paper_stage(.35)
    cards = [
        (15, 17, 12, 15, f'<div class="cc" style="background:{FIELD["sage"]}"><small>HABITS</small><b>12-day streak</b><em>Morning walk</em></div>'),
        (29, 8, 12, 12, f'<div class="cc" style="background:{BERRY};color:#fff"><div class="grid"></div>{mark(5, "#fff")}</div>'),
        (43, 6, 13, 10, '<div class="cc white"><small>OUTSTANDING</small><b class="big">$4,300</b></div>'),
        (58, 7, 12, 12, f'<div class="cc" style="background:{FIELD["peri"]}"><small>CALENDAR</small><b>Design review</b><em>16:00–18:00</em></div>'),
        (72, 9, 12, 14, '<div class="cc white q">“I stopped juggling tabs. Everything for Acme is in one place.”<em>Mara · Acme Studio</em></div>'),
        (85, 19, 12, 13, f'<div class="cc" style="background:{FIELD["apricot"]}"><small>INVOICE</small><b>INV-018 · Paid</b><em>Atlas Coffee · $4,200</em></div>'),
        (86, 38, 12, 12, f'<div class="cc" style="background:{FIELD["sky"]}"><small>FOCUS</small><b class="big">25:00</b></div>'),
        (72, 46, 13, 10, '<div class="cc white"><small>TODAY</small><b>Send invoice for July</b><em>High · TechSpark</em></div>'),
        (57, 47, 12, 11, f'<div class="cc" style="background:{FIELD["butter"]}"><small>DOCS</small><b>Rebrand proposal</b></div>'),
        (43, 47, 12, 11, f'<div class="cc" style="background:{FIELD["petal"]}"><small>CLIENTS</small><b>Meridian Studio</b><em>Active</em></div>'),
        (29, 45, 12, 12, '<div class="cc white"><small>PROJECTS</small><b>Brand identity</b><em>5 open · 12 done</em></div>'),
        (14, 37, 11, 12, f'<div class="cc" style="background:{FIELD["sand"]}"><small>NOTES</small><b>Kickoff agenda</b></div>'),
    ]
    for x, y, w, h, c in cards:
        s += at(x, y, c, "", f"width:{w}cqw;height:{h}cqw")
    s += at(50, 24.5, "Work, life and business.", "head", "font-size:3.6cqw")
    s += at(50, 30.5, "One workspace.", "head", "font-size:3.6cqw;color:" + BERRY)
    return s

def f_8_2():
    s = paper_stage(.45) + at(50, 23, lockup(34))
    s += caption("The single platform to manage work, life, and business.", y=33, size=1.9, color="#37352F")
    s += at(50, 40, '<span class="avail">Available today</span>')
    return s

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
  frames=[("2.1", "0:10", f_2_1, "The rings break into thick segments in the brand field colours and Berry, spinning around the portrait. Tiles behind are blurred.",
            "—", "Silence, then a reversed swell"),
          ("2.2", "0:12", f_2_2, "The portrait shrinks away. The segments sweep off in one big arc across the frame and the stage clears to Paper. A small ring of segments keeps spinning.",
            "—", "Big whoosh"),
          ("2.3", "0:14", f_2_3, "The small ring snaps into the Zenboard mark in Berry. The wordmark types in letter by letter to the right.",
            "“Meet Zenboard.”", "The Zenboard chime")],
  out="The mark slides to the right and becomes the hub node of the next scene (shape match)."),
 dict(n=3, name="All in one", t="0:15–0:22", purpose="Every app you juggle flows into one place.",
  frames=[("3.1", "0:16", f_3_1, "The app tiles line up on the left. Soft white cables grow from each tile and merge into a single line that flows into the Zenboard node.",
            "“Everything you juggle.”", "Cable hum, soft tick as each line lands"),
          ("3.2", "0:19", f_3_2, "The camera tracks along the merged line through a small Zenboard node. The line hits a panel on the right that wipes open to reveal the real Today screen.",
            "“In one place.”", "Swish on the wipe")],
  out="The Today panel grows to fill the frame while the background floods to the Berry field (colour wipe)."),
 dict(n=4, name="Product hero", t="0:22–0:28", purpose="The first real look at the product, in the D6 card style.",
  frames=[("4.1", "0:22", f_4_1, "Berry field from dark to light, with the Zenboard mark large and subtly blended in. The logo sits above. The frosted Today card floats in the centre with a crisp white highlight card overlapping its corner.",
            "“Your whole day. One view.”", "Music enters"),
          ("4.2", "0:26", f_4_2, "A push-in on the highlight card. The cursor clicks Mark done: the title strikes through and the button turns to Done.",
            "—", "One tactile click")],
  out="The Done button morphs into the first pill of the split screen (shape match)."),
 dict(n=5, name="Modules", t="0:28–0:40", purpose="Walk through the modules without one-feature screens. Equator-style split screen.",
  frames=[("5.1", "0:28", f_5_1, "Left: Berry panel with a column of big pills scrolling up. The pill crossing the centre line turns white (active). Right: a stack of real Zenboard cards on Paper; the front card matches the active pill.",
            "TASKS", "Tick per pill, soft card slide"),
          ("5.2", "0:32", f_5_2, "Step to CLIENTS. The pill column springs up one slot; the front card slides in and the previous one tucks behind, offset and tinted.",
            "CLIENTS", "Tick, card slide"),
          ("5.3", "0:36", f_5_3, "Step to MONEY, then two faster steps (HABITS, FOCUS) as the music builds.",
            "MONEY", "Ticks speeding up")],
  out="The Berry panel expands to fill the frame and the pills multiply into the wall."),
 dict(n=6, name="Pill wall", t="0:40–0:45", purpose="The breadth of Zenboard at a glance.",
  frames=[("6.1", "0:40", f_6_1, "Rows of module pills in the field colours scroll in alternating directions on a plain, flat deep-berry background. No UI cards behind the pills.",
            "—", "Rhythmic ticks on the beat")],
  out="One pill (Tasks) zooms to camera and turns into a 3D tile; the background drops to ink."),
 dict(n=7, name="Icon carousel", t="0:45–0:52", purpose="Each module as a physical, premium object. Semantical-style carousel.",
  frames=[("7.1", "0:45", f_7_1, "Dark stage with a warm berry glow rising from the floor. Chunky 3D module tiles in a row; the centre tile is large and forward, and the sides crop off the frame. A label chip sits under the centre tile.",
            "Tasks", "Low hum, soft clack"),
          ("7.2", "0:48", f_7_2, "The row steps sideways with a spring snap, holds, and steps again: Tasks → Projects → Money → Habits.",
            "Habits", "Clack per step, on the beat")],
  out="The glow blooms to Paper and the tiles scatter outward into a ring of cards."),
 dict(n=8, name="The one", t="0:52–1:04", purpose="A calm resolution: everything around one workspace, then the logo.",
  frames=[("8.1", "0:52", f_8_1, "A ring of mixed cards (real UI crops, stats, a quote, Berry cards with fine grid lines, field-colour cards) around a centred headline. The ring drifts slowly.",
            "“Work, life and business. One workspace.”", "Music opens up"),
          ("8.2", "0:58", f_8_2, "The cards glide inward and collapse into the mark. The lockup settles and the tagline rises word by word, then Available today. Nothing moves for the last two seconds.",
            "The single platform to manage work, life, and business. · Available today", "The chime resolves, held chord")],
  out=None),
]

def frame_html(fid, tc, fn, action, onscreen, sfx):
    return f'''<figure class="card" id="f{fid.replace('.', '-')}">
  <div class="fr">{fn()}</div>
  <figcaption>
    <div class="fh"><span class="fid">{fid}</span><span class="tc">{tc}</span></div>
    <p>{H.escape(action)}</p>
    <dl><dt>On screen</dt><dd>{H.escape(onscreen)}</dd><dt>Sound</dt><dd>{H.escape(sfx)}</dd></dl>
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

page = (ROOT / "template.html").read_text().replace("{{BODY}}", body).replace("{{LOCKUP}}", lockup(100))
(ROOT / "index.html").write_text(page)
print("wrote", ROOT / "index.html", len(page) // 1024, "KB")
