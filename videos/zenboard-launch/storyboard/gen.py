import html, json
M = [
 ("a","Orbit","0:00–0:09","build → accelerate","petal",['2.3 “Your work lives in eight apps.”','6.2 “And you live in all of them.”'],[
  (1.3,"A hairline draws in from the top right. A Berry bead rides its tip.","Tiny pull-back before the shot, then eased travel"),
  (1.8,"The bead lands and opens into the portrait. The line draws off behind it.","Hero spring, about 1.5% overshoot, follow-through"),
  (3.2,"“Your work lives in eight apps.” Apps are thrown into orbit one by one.","Spin starts from rest and builds"),
  (5.3,"Badges climb. The diagonal passes through the rings; each ring answers with a ripple.","Rings tilt into 3D depth"),
  (8.6,"“And you live in all of them.” Two rings counter-rotate faster and faster.","Camera leans in and rolls 4°"),
 ]),
 ("b","One","0:09–0:15","reveal → breathe","butter",['11.2 “Meet, Zenboard.”','13.0 “Everything you juggle.”','14.6 “In one place.”'],[
  (9.9,"The spin coasts, then every app spirals into the portrait.","Accelerates inward"),
  (10.7,"The portrait squeezes, then one Berry circle swells out of it.","Anticipation squeeze, hero spring"),
  (11.9,"“Meet Zenboard.”","Word-by-word blur-in"),
  (13.9,"“Everything you juggle.” The same eight apps return on one calm, even orbit.","Slow continuous rotation"),
  (14.8,"“In one place.” The circle stretches into a rounded window; the apps head for the sidebar.","Circle → rounded rect, tilts 9° and settles"),
  (15.3,"Each app lands on its sidebar row.","Staggered by 35 ms"),
 ]),
 ("c","Product","0:15–0:21","breathe → build","sage",['17.2 “Your whole day. One view.”'],[
  (16.4,"The Berry drains away and the real dashboard surfaces, sidebar first.","UI builds itself"),
  (18.3,"“Your whole day. One view.” Greeting, highlight, plan and widgets build in reading order.","Staggered rise"),
  (19.8,"The camera zooms to today’s plan. The cursor arrives on an arc.","Zoom-to-target, 1.75×"),
  (20.7,"Click. The first task is checked and struck through.","Press and release, ripple"),
 ]),
 ("d","Features","0:21–0:34","build, clock ticks","sky",['22.2 Tasks · 23.7 Projects · 25.2 Docs · 26.7 Calendar','28.2 Clients · 29.7 Money · 31.2 Habits · 32.7 Focus'],[
  (21.8,"The camera pulls back. The window slides right and becomes the feature panel; the list slides in.","One element becomes the next"),
  (22.9,"Tasks","Tick lands on the voice-over word"),
  (24.4,"Projects","Active pill takes the feature colour"),
  (25.9,"Docs","Card slides through vertically"),
  (27.4,"Calendar","White card lands on the corner"),
  (28.9,"Clients","Clock-tick spring"),
  (30.4,"Money","Clock-tick spring"),
  (31.9,"Habits","Clock-tick spring"),
  (33.4,"Focus","Clock-tick spring"),
 ]),
 ("e","Automation","0:34–0:41","build → hero","peri",['34.6 “Effortless automation.”','36.6 “Describe it once. Zenboard does the work.”'],[
  (34.4,"The Focus panel opens to full frame and deepens into the Berry field.","Panel clip opens to the edges"),
  (35.9,"The prompt card rises and types the request.","Type-on"),
  (37.7,"“Describe it once. Zenboard does the work.” The cursor presses Create.","Press, spring release, ripple"),
  (39.2,"The steps card slides out of the prompt. Each step checks off in rhythm.","0.4 s per step"),
  (40.3,"The toast lands: “Reminder sent to Fernwood Hotels.”","Settle spring"),
 ]),
 ("f","Everything","0:41–0:48","accelerate","apricot",['42.3 “Everything you need.”'],[
  (41.6,"The toast becomes the Automations pill; the pill wall slides in around it.","Toast → pill"),
  (43.5,"“Everything you need.” Rows scroll in alternating directions.","Scroll builds speed"),
  (46.0,"The wall keeps accelerating.","Ease-in, no linear moves"),
  (47.2,"Everything gathers into the centre while the field sinks to ink.","Accelerates inward"),
 ]),
 ("g","Made","0:48–0:54","hero","mist",['49.3 “Beautifully made.”'],[
  (48.4,"Eight 3D module tiles burst out of the centre onto a ring.","Ring unfolds from the core"),
  (50.5,"“Beautifully made.” The carousel turns with inertia; every tile faces the camera.","Continuous circular motion"),
  (53.0,"The spin keeps coasting down.","Velocity eases, never switches"),
 ]),
 ("h","Resolve","0:54–1:10","resolve","sand",['54.6 “Work, life, and business. One workspace.”','59.8 “Zenboard.” · 61.0 tagline · 66.6 “Available today.”'],[
  (55.0,"“Work, life, and business. One workspace.” The ring tips to face the camera; ink blooms back to paper.","Same spin, now head-on"),
  (56.8,"Tiles shed their icons and become circles. Eight merge into four.","Circles"),
  (57.7,"The four circles come to rest on the diagonals.","Spin stops on 45°"),
  (58.4,"The diagonal returns from the top right; the circles snap together.","Segments align"),
  (59.0,"The mark forms from the four circles, finishing the spin with a small overshoot.","Mark forms"),
  (60.6,"“Zenboard.” The mark glides left and the wordmark writes itself.","Letter by letter"),
  (62.8,"“The single platform to manage work, life, and business.”","Breathe"),
  (66.3,"The words step away, night falls, the mark becomes the Berry app icon.","Hero spring"),
  (67.8,"“Available today.” Hold, then fade to black at 1:09.4.","End"),
 ]),
]
dur = {"a":9.4,"b":6.2,"c":5.9,"d":12.5,"e":7.5,"f":6.5,"g":6.0,"h":16.0}
e = html.escape
def tc(t):
    return f"{int(t//60)}:{t%60:04.1f}"
idx = 0
secs = []
strip = []
for k,(sid,name,rng,rh,col,vo,frames) in enumerate(M):
    strip.append(f'<a class="seg" href="#{sid}" style="flex:{dur[sid]};--f:var(--{col})"><span class="segn">{e(name)}</span><span class="segt">{rng}</span></a>')
    cards = []
    for t,what,how in frames:
        cards.append(f'''<figure class="fr"><div class="shot"><img src="frames/f{idx:02d}.jpg" alt="{e(what)}" loading="lazy" width="1280" height="720"><span class="tc">{tc(t)}</span></div>
<figcaption><p class="what">{e(what)}</p><p class="how">{e(how)}</p></figcaption></figure>''')
        idx += 1
    vol = "".join(f"<li>{e(v)}</li>" for v in vo)
    secs.append(f'''<section class="mv" id="{sid}" style="--f:var(--{col})">
<header class="mvh"><div class="mvk"><span class="letter">{chr(65+k)}</span><h2>{e(name)}</h2><span class="rng">{rng}</span><span class="rh">{e(rh)}</span></div><ul class="vo">{vol}</ul></header>
<div class="grid">{"".join(cards)}</div></section>''')
assert idx == 45, idx
tpl = open("tpl.html").read()
out = tpl.replace("%%STRIP%%","".join(strip)).replace("%%SECTIONS%%","\n".join(secs))
open("index.html","w").write(out)
print("frames", idx, "bytes", len(out))
