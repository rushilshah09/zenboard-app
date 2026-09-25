import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT } from "../../brand/fonts";
import { EASE, clamp } from "../../brand/motion";
import { CURVE, respond } from "../../brand/physics";
import { energy, stage } from "../../brand/tokens";
import { voAt } from "../../timeline/film";
import { ClientCard, DocCard, EventCard, InvoiceCard, ProjectCard, TaskCard } from "../../ui/app/Cards";
import { Stage } from "../../ui/Stage";
import { rnd } from "../shared3";

/**
 * Scene 4 · The Graph (0:30–0:46). One task grows a live graph of everything it
 * touches. Each line draws, and where it arrives a real Zenboard object unfolds
 * from that point, with its statement beside it, on the spoken word. The camera
 * follows the newest line. On "and gets paid" the invoice flips to Paid and a
 * pulse runs back through every line to the task; then the camera pulls far
 * back: this graph is one of hundreds. "Everything connects."
 */
export const GRAPH_FRAMES = 960;

type N = { id: string; x: number; y: number; w: number; h: number; vo: string; say: string; card: React.FC<{ f: number }> };
const PAID = voAt("g-paid", "graph") + 24;
const NODES: N[] = [
  { id: "task", x: 0, y: 0, w: 460, h: 330, vo: "g-task", say: "A task", card: ({ f }) => <TaskCard check={clamp(f, [PAID, PAID + 14], [0, 1])} /> },
  { id: "project", x: 720, y: -390, w: 560, h: 290, vo: "g-project", say: "becomes a project", card: () => <ProjectCard /> },
  { id: "cal", x: 720, y: 400, w: 420, h: 260, vo: "g-calendar", say: "lands on your calendar", card: () => <EventCard /> },
  { id: "doc", x: 1480, y: 0, w: 500, h: 360, vo: "g-doc", say: "opens a doc", card: () => <DocCard /> },
  { id: "client", x: 2200, y: -380, w: 460, h: 300, vo: "g-client", say: "updates your client", card: () => <ClientCard /> },
  { id: "invoice", x: 2250, y: 400, w: 480, h: 300, vo: "g-paid", say: "and gets paid.", card: ({ f }) => <InvoiceCard paid={clamp(f, [PAID - 8, PAID + 6], [0, 1])} /> },
];
const byId = (id: string) => NODES.find((n) => n.id === id)!;
const EDGES: [string, string][] = [
  ["task", "project"],
  ["task", "cal"],
  ["project", "doc"],
  ["cal", "doc"],
  ["doc", "client"],
  ["doc", "invoice"],
];
const born = (n: N) => voAt(n.vo, "graph");
const edgeStart = (to: N) => born(to) - 22;

const path = (a: N, b: N) => {
  const x1 = a.x + a.w / 2;
  const x2 = b.x - b.w / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1} ${a.y} C${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`;
};
const bez = (a: N, b: N, u: number) => {
  const x1 = a.x + a.w / 2;
  const x2 = b.x - b.w / 2;
  const mx = (x1 + x2) / 2;
  const p = [
    [x1, a.y],
    [mx, a.y],
    [mx, b.y],
    [x2, b.y],
  ];
  const k = 1 - u;
  const x = k * k * k * p[0][0] + 3 * k * k * u * p[1][0] + 3 * k * u * u * p[2][0] + u * u * u * p[3][0];
  const y = k * k * k * p[0][1] + 3 * k * k * u * p[1][1] + 3 * k * u * u * p[2][1] + u * u * u * p[3][1];
  return { x, y };
};

/** Camera keys: [frame, focus x, focus y, zoom]. */
const CAM: [number, number, number, number][] = [
  [0, 0, 0, 1.2],
  [150, 150, -60, 1.05],
  [200, 560, -300, 1.0],
  [330, 560, 180, 0.95],
  [460, 1250, 0, 0.95],
  [590, 1900, -300, 0.95],
  [720, 1950, 300, 0.92],
  [800, 1120, 0, 0.52],
  [850, 1120, 0, 0.46],
  [930, 1120, 0, 0.09],
];
const camAt = (f: number) => {
  let i = 0;
  while (i < CAM.length - 2 && f > CAM[i + 1][0]) i++;
  const [f0, x0, y0, z0] = CAM[i];
  const [f1, x1, y1, z1] = CAM[i + 1];
  const u = clamp(f, [f0, f1], [0, 1], CURVE.glide);
  return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, z: Math.exp(Math.log(z0) + (Math.log(z1) - Math.log(z0)) * u) };
};

/* The network: hundreds of other graphs, seeded, around this one. */
const NET = Array.from({ length: 420 }, (_, i) => {
  const a = rnd(`net-a-${i}`, 0, Math.PI * 2);
  const r = 2600 + Math.pow(rnd(`net-r-${i}`), 0.7) * 11000;
  return { x: 1120 + Math.cos(a) * r, y: Math.sin(a) * r * 0.62, s: rnd(`net-s-${i}`, 0.6, 1.4), hot: rnd(`net-h-${i}`) < 0.2 };
});
const NET_EDGES: [number, number][] = [];
NET.forEach((p, i) => {
  const near = NET.map((q, j) => ({ j, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
    .filter((q) => q.j !== i)
    .sort((a, b) => a.d - b.d)
    .slice(0, 2);
  near.forEach((q) => i < q.j && NET_EDGES.push([i, q.j]));
});

export const Graph: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camAt(f);
  const lift = clamp(f, [0, 40], [0, 1], EASE.settle);
  const pulse = clamp(f, [PAID + 10, PAID + 40], [0, 1], EASE.settle);
  const net = clamp(f, [820, 900], [0, 1], EASE.settle);
  const connects = voAt("connects", "graph");
  const slam = clamp(f, [connects - 4, connects + 6], [0, 1], EASE.settle);
  const newest = [...NODES].reverse().find((n) => f >= born(n) - 10) ?? NODES[0];
  return (
    <Stage kind="ink">
      <div style={{ position: "absolute", left: 960, top: 540, transformOrigin: "0 0", transform: `scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)` }}>
        {/* The wider network, faint until the pull-back. */}
        <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: net }}>
          {NET_EDGES.map(([a, b], i) => (
            <line key={i} x1={NET[a].x} y1={NET[a].y} x2={NET[b].x} y2={NET[b].y} stroke={i % 5 === 0 ? energy.pink : energy.rose} strokeOpacity={0.45} strokeWidth={12} />
          ))}
          {NET.map((p, i) => (
            <g key={i}>
              <rect x={p.x - 90 * p.s} y={p.y - 55 * p.s} width={180 * p.s} height={110 * p.s} rx={16} fill="#1C1016" stroke={p.hot ? energy.pink : "rgba(247,241,232,.25)"} strokeWidth={6} />
              <circle cx={p.x} cy={p.y} r={16 * p.s} fill={p.hot ? energy.rose : "rgba(247,241,232,.55)"} />
            </g>
          ))}
        </svg>
        {/* The graph's lines. */}
        <svg width={1} height={1} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={energy.pink} />
              <stop offset="0.6" stopColor={energy.rose} />
              <stop offset="1" stopColor={energy.apricot} />
            </linearGradient>
          </defs>
          {EDGES.map(([a, b]) => {
            const A = byId(a);
            const B = byId(b);
            const s = edgeStart(B);
            const p = clamp(f, [s, s + 18], [0, 1], EASE.settle);
            if (p <= 0) return null;
            const d = path(A, B);
            return (
              <g key={a + b}>
                <path d={d} fill="none" stroke={energy.pink} strokeWidth={12} opacity={0.3} style={{ filter: "blur(8px)" }} pathLength={1} strokeDasharray={`${p} 2`} />
                <path d={d} fill="none" stroke={energy.rose} strokeWidth={2.6} strokeLinecap="round" pathLength={1} strokeDasharray={`${p} 2`} />
                {/* A travelling point while the line draws, then the paid pulse running home. */}
                {p < 1 ? <circle cx={bez(A, B, p).x} cy={bez(A, B, p).y} r={7} fill="#fff" style={{ filter: `drop-shadow(0 0 10px ${energy.pink})` }} /> : null}
                {pulse > 0 && pulse < 1 ? <circle cx={bez(A, B, 1 - pulse).x} cy={bez(A, B, 1 - pulse).y} r={10} fill="#fff" style={{ filter: `drop-shadow(0 0 14px ${energy.pink}) drop-shadow(0 0 24px ${energy.rose})` }} /> : null}
              </g>
            );
          })}
        </svg>
        {NODES.map((n) => {
          const t0 = born(n);
          const open = n.id === "task" ? lift : respond(f, t0);
          if (open <= 0.001) return null;
          const focus = n === newest || f > PAID;
          const C = n.card;
          const glow = n.id === "task" ? clamp(f, [PAID + 36, PAID + 44], [0, 1]) * clamp(f, [PAID + 44, PAID + 80], [1, 0]) : 0;
          const say = clamp(f, [t0 - 4, t0 + 18], [0, 1], EASE.settle);
          return (
            <React.Fragment key={n.id}>
              <div
                style={{
                  position: "absolute",
                  left: n.x - n.w / 2,
                  top: n.y - n.h / 2,
                  transformOrigin: "0% 50%",
                  transform: n.id === "task" ? `translateY(${(1 - lift) * 40}px) scale(${0.9 + 0.1 * lift})` : `scaleX(${0.3 + 0.7 * open}) scaleY(${0.6 + 0.4 * open})`,
                  opacity: Math.min(1, open * 1.4),
                  filter: `brightness(${focus ? 1 : 0.8}) drop-shadow(0 0 ${40 * glow}px ${energy.pink})`,
                }}
              >
                <div style={{ borderRadius: 14, boxShadow: `0 -1.5px 0 rgba(232,168,197,${focus ? 0.7 : 0.25}), 0 0 60px rgba(196,28,114,${focus ? 0.25 : 0.08})` }}>
                  <C f={f} />
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: n.x - n.w / 2,
                  top: n.y - n.h / 2 - 96,
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: 60,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  color: stage.inkText,
                  opacity: say * (n === newest && f < PAID ? 1 : 0.4) * (1 - net),
                  translate: `0 ${(1 - say) * 14}px`,
                  filter: `blur(${(1 - say) * 8}px)`,
                }}
              >
                {n.say}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {/* "Everything connects." over the network. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${1.25 - 0.25 * slam})`,
          opacity: slam,
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 190,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          color: stage.inkText,
          textShadow: "0 0 90px rgba(196, 28, 114, 0.55)",
        }}
      >
        Everything connects.
      </div>
    </Stage>
  );
};
