'use client';
// EmojiPicker — the design-system icon picker, measured from the "emoji upload"
// HiFi frame:
//   panel  · 408px · paper-3 · r-xl · panel shadow (via PickerPanel)
//   tabs   · Emoji | Icons | Upload pills + quiet Remove right
//   search · 28px paper-2 field (r-md, hairline ring, disabled-text placeholder)
//            + bordered 28px shuffle + skin-tone cycle button
//   grid   · 12-up · 32px cells · 24px glyphs · 12/500 ink-5 category labels
//   rail   · 40px bottom category bar (Recent + one glyph per category);
//            clicking scrolls the grid, scrolling highlights the section
// Emits a page-icon value: an emoji, "ph:IconName", or an image data-URL.
import { useEffect, useRef, useState } from 'react';
import {
  Search, Shuffle, History, Smile, Leaf, Coffee,
  Dumbbell, Car, Lightbulb, Hash, Flag, SquarePlus, type IconType,
} from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui/icon';
import { Tooltip } from '@/components/ui/primitives';
import { PAGE_ICONS } from '@/components/ui/page-icon';
import { PickerPanel, PickerTabs, PickerQuietAction } from '@/components/ui/picker-panel';
import { UploadZone } from '@/components/ui/upload-zone';
import { fileToDataUrl } from '@/lib/image';

// Compact emoji data: "<emoji> <search name>" pairs, comma-separated.
const parse = (s: string): [string, string][] =>
  s.split(',').map((p) => { const i = p.indexOf(' '); return [p.slice(0, i), p.slice(i + 1)] as [string, string]; });

const EMOJI_CATS: { name: string; icon: IconType; items: [string, string][] }[] = [
  { name: 'People', icon: Smile, items: parse('😀 grin,😃 smiley,😄 smile,😁 beam,😆 laugh,😅 sweat smile,😂 joy,🙂 slight smile,😉 wink,😊 blush,😍 heart eyes,🥰 love,😘 kiss,😋 yum,🤪 zany,🤓 nerd,😎 cool,🥳 party,😏 smirk,😞 disappointed,😔 pensive,🙁 frown,😫 tired,😩 weary,🥺 pleading,😢 cry,😭 sob,😤 huff,😠 angry,🤯 mind blown,😳 flushed,🥵 hot,🥶 cold,😱 scream,🤗 hug,🤔 thinking,🤫 shush,😐 neutral,🙄 eye roll,😬 grimace,😴 sleep,😷 mask,🤠 cowboy,😈 devil,🤡 clown,💀 skull,👻 ghost,👽 alien,🤖 robot,👋 wave,👍 thumbs up,👎 thumbs down,👏 clap,🙌 raised hands,🙏 pray,💪 strong,🤝 handshake,✌️ peace,🤞 crossed fingers,👀 eyes,🧠 brain') },
  { name: 'Nature', icon: Leaf, items: parse('🐶 dog,🐱 cat,🐭 mouse,🐹 hamster,🐰 rabbit,🦊 fox,🐻 bear,🐼 panda,🐨 koala,🐯 tiger,🦁 lion,🐮 cow,🐷 pig,🐸 frog,🐵 monkey,🐧 penguin,🐦 bird,🦆 duck,🦅 eagle,🦉 owl,🦄 unicorn,🐝 bee,🦋 butterfly,🐢 turtle,🐍 snake,🐙 octopus,🐬 dolphin,🐳 whale,🦈 shark,🌵 cactus,🌲 evergreen,🌴 palm,🌱 sprout,🌿 herb,🍀 clover,🍁 maple,🌸 cherry blossom,🌺 hibiscus,🌻 sunflower,🌷 tulip,🌹 rose,🌞 sun face,🌙 moon,⭐ star,✨ sparkles,⚡ lightning,🔥 fire,🌈 rainbow,☀️ sunny,⛅ partly cloudy,☁️ cloud,❄️ snowflake,🌊 wave,💧 droplet') },
  { name: 'Food', icon: Coffee, items: parse('🍎 apple,🍊 orange,🍋 lemon,🍌 banana,🍉 watermelon,🍇 grapes,🍓 strawberry,🫐 blueberry,🍒 cherry,🍑 peach,🥭 mango,🍍 pineapple,🥥 coconut,🥑 avocado,🥦 broccoli,🥕 carrot,🥐 croissant,🍞 bread,🧀 cheese,🍳 egg,🥞 pancakes,🍔 burger,🍟 fries,🍕 pizza,🌮 taco,🥗 salad,🍜 ramen,🍣 sushi,🍱 bento,🥟 dumpling,🍦 ice cream,🍰 cake,🎂 birthday,🧁 cupcake,🍫 chocolate,🍩 donut,🍪 cookie,☕ coffee,🍵 tea,🧋 boba,🍺 beer,🍷 wine') },
  { name: 'Activity', icon: Dumbbell, items: parse('⚽ soccer,🏀 basketball,🏈 football,⚾ baseball,🎾 tennis,🏐 volleyball,🎱 pool,🏓 ping pong,🏸 badminton,⛳ golf,🏹 archery,🎣 fishing,🥊 boxing,🎿 ski,🏂 snowboard,🏋️ lift,🚴 cycling,🧗 climb,🏊 swim,🏄 surf,🧘 yoga,🎯 target,🎳 bowling,🎮 gaming,🎲 dice,🧩 puzzle,♟️ chess,🎭 theater,🎨 art,🎬 film,🎤 mic,🎧 headphones,🎹 piano,🥁 drums,🎸 guitar,🎻 violin,🏆 trophy,🥇 gold,🏅 medal') },
  { name: 'Travel', icon: Car, items: parse('🚗 car,🚕 taxi,🚌 bus,🚑 ambulance,🚒 fire truck,🚚 truck,🛵 scooter,🚲 bike,🚂 train,🚇 metro,✈️ plane,🚀 rocket,🛸 ufo,🚁 helicopter,⛵ sailboat,🚢 ship,⚓ anchor,🗼 tower,🗽 liberty,🗿 moai,🏰 castle,🏯 japanese castle,🎡 ferris wheel,🎢 coaster,⛲ fountain,🏝 island,🌋 volcano,⛰ mountain,🗻 fuji,🏕 camping,🏠 home,🏢 office,🏥 hospital,⛩ shrine,🌃 night city,🌅 sunrise,🌉 bridge') },
  { name: 'Objects', icon: Lightbulb, items: parse('⌚ watch,📱 phone,💻 laptop,⌨️ keyboard,🖥 desktop,🖨 printer,📷 camera,🎥 video,📺 tv,⏰ alarm,⏳ hourglass,🔋 battery,🔌 plug,💡 bulb,🔦 flashlight,🕯 candle,💸 money,💵 dollar,💰 money bag,💳 card,💎 gem,⚖️ scale,🔧 wrench,🔨 hammer,🛠 tools,⚙️ gear,🧲 magnet,🔮 crystal,🔭 telescope,🔬 microscope,💊 pill,🧬 dna,🧪 test tube,🛎 bell,🔑 key,🚪 door,🛋 sofa,🛏 bed,🖼 frame,🎁 gift,🎈 balloon,🎉 party popper,📦 box,📬 mailbox,📜 scroll,📄 page,📊 chart,📈 up,📉 down,🗒 notepad,📆 calendar,📋 clipboard,📁 folder,🗂 dividers,📰 news,📓 notebook,📕 book red,📗 book green,📘 book blue,📚 books,📖 open book,🔖 bookmark,🔗 link,📎 clip,📐 ruler,📌 pin,📍 location,✂️ scissors,🖊 pen,🖌 brush,📝 memo,✏️ pencil,🔍 search,🔒 lock,🔓 unlock') },
  { name: 'Symbols', icon: Hash, items: parse('❤️ red heart,🧡 orange heart,💛 yellow heart,💚 green heart,💙 blue heart,💜 purple heart,🖤 black heart,🤍 white heart,💔 broken heart,💕 hearts,💖 sparkling heart,💯 hundred,✅ check,❌ cross,❓ question,❗ exclamation,⚠️ warning,♻️ recycle,💠 diamond,🌀 cyclone,➕ plus,➖ minus,🔅 dim,🔆 bright,☮️ peace,☯️ yin yang') },
  { name: 'Flags', icon: Flag, items: parse('🏳️ white flag,🏴 black flag,🏁 checkered,🚩 triangular,🏳️‍🌈 rainbow,🏳️‍⚧️ transgender,🏴‍☠️ pirate,🇺🇸 united states,🇬🇧 united kingdom,🇨🇦 canada,🇦🇺 australia,🇮🇳 india,🇯🇵 japan,🇨🇳 china,🇰🇷 south korea,🇩🇪 germany,🇫🇷 france,🇮🇹 italy,🇪🇸 spain,🇵🇹 portugal,🇳🇱 netherlands,🇧🇪 belgium,🇨🇭 switzerland,🇸🇪 sweden,🇳🇴 norway,🇩🇰 denmark,🇫🇮 finland,🇮🇪 ireland,🇵🇱 poland,🇺🇦 ukraine,🇷🇺 russia,🇹🇷 turkey,🇬🇷 greece,🇧🇷 brazil,🇲🇽 mexico,🇦🇷 argentina,🇨🇱 chile,🇨🇴 colombia,🇿🇦 south africa,🇳🇬 nigeria,🇪🇬 egypt,🇸🇦 saudi arabia,🇦🇪 united arab emirates,🇮🇱 israel,🇸🇬 singapore,🇲🇾 malaysia,🇮🇩 indonesia,🇹🇭 thailand,🇻🇳 vietnam,🇵🇭 philippines,🇳🇿 new zealand') },
];
const ALL_EMOJI = EMOJI_CATS.flatMap((c) => c.items);
const ICON_NAMES = Object.keys(PAGE_ICONS);

// Skin-tone support — the Fitzpatrick modifier cycle, applied on pick to the
// hand/person glyphs that accept it (variation selectors stripped first).
const TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿'];
const TONABLE = new Set(['👋', '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️', '🤞']);
const withTone = (e: string, tone: string) =>
  tone && TONABLE.has(e) ? e.replace(/️/g, '') + tone : e;

const RECENT_KEY = 'zb:emoji-recent';
const TONE_KEY = 'zb:emoji-tone';

type Tab = 'emoji' | 'icons' | 'upload';

// Grid cell — 12-up, 32px, hover wash (shared by emoji + icon tabs).
const cell: React.CSSProperties = { display: 'grid', placeItems: 'center', height: 32, border: 'none', background: 'transparent', borderRadius: 'var(--r-sm)', cursor: 'pointer', padding: 0 };
const catLabel: React.CSSProperties = { fontSize: 'var(--text-caption-size)', fontWeight: 500, lineHeight: '12px', color: 'var(--text-muted)', padding: '10px 0 8px', marginLeft: -4 };

export function EmojiPicker({ onPick, onRemove, onClose, align = 'left' }: {
  onPick: (icon: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const [tab, setTab] = useState<Tab>('emoji');
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [tone, setTone] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeCat, setActiveCat] = useState<string>('People');
  const scrollRef = useRef<HTMLDivElement>(null);
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    try {
      const r = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
      if (Array.isArray(r)) { setRecent(r.filter((x) => typeof x === 'string')); if (r.length) setActiveCat('Recent'); }
      const t = Number(window.localStorage.getItem(TONE_KEY));
      if (t >= 0 && t < TONES.length) setTone(t);
    } catch { /* storage unavailable */ }
  }, []);

  const pickEmoji = (e: string) => {
    const val = withTone(e, TONES[tone]);
    try {
      const next = [val, ...recent.filter((x) => x !== val)].slice(0, 24);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch { /* storage unavailable */ }
    onPick(val);
    onClose();
  };
  const cycleTone = () => {
    const next = (tone + 1) % TONES.length;
    setTone(next);
    try { window.localStorage.setItem(TONE_KEY, String(next)); } catch { /* storage unavailable */ }
  };

  const query = q.trim().toLowerCase();
  const cats = query
    ? [{ name: 'Results', icon: Search, items: ALL_EMOJI.filter(([, n]) => n.includes(query)) }]
    : [
        ...(recent.length ? [{ name: 'Recent', icon: History, items: recent.map((e) => [e, 'recent'] as [string, string]) }] : []),
        ...EMOJI_CATS,
      ];
  const iconResults = query ? ICON_NAMES.filter((n) => n.toLowerCase().includes(query)) : ICON_NAMES;

  // Bottom rail ↔ grid sync: clicking jumps to the section (instant, like the
  // benchmark — smooth scrolling is rAF-driven and dies in occluded tabs);
  // scrolling marks the section whose heading was last crossed. A short quiet
  // window keeps the jump's own scroll events from flickering the highlight.
  const railCats = cats.filter((c) => c.items.length > 0);
  const quietScrolls = useRef(0); // scroll events to ignore after a rail jump
  const scrollToCat = (name: string) => {
    setActiveCat(name);
    quietScrolls.current = 1; // the jump coalesces into one scroll event

    const sc = scrollRef.current, el = catRefs.current[name];
    // Recent may be absent (no history) — its rail button scrolls to the top.
    if (sc) sc.scrollTo({ top: el ? el.offsetTop : 0 });
  };
  const onGridScroll = () => {
    const sc = scrollRef.current;
    if (!sc) return;
    if (quietScrolls.current > 0) { quietScrolls.current -= 1; return; }
    let cur = railCats[0]?.name;
    for (const c of railCats) {
      const el = catRefs.current[c.name];
      if (el && el.offsetTop <= sc.scrollTop + 12) cur = c.name;
    }
    if (cur && cur !== activeCat) setActiveCat(cur);
  };

  async function intake(file: File) {
    setErr(null);
    try { onPick(await fileToDataUrl(file, { max: 180, square: true })); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed'); }
  }

  return (
    <PickerPanel label="Choose an icon" width={408} align={align} onClose={onClose}>
      <PickerTabs<Tab>
        tabs={[{ id: 'emoji', label: 'Emoji' }, { id: 'icons', label: 'Icons' }, { id: 'upload', label: 'Upload' }]}
        active={tab} onTab={(t) => { setTab(t); setErr(null); }}
        right={onRemove ? <PickerQuietAction label="Remove" onClick={() => { onRemove(); onClose(); }} /> : undefined}
      />
      {tab !== 'upload' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 12px' }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, height: 28, background: 'var(--paper-2)', borderRadius: 'var(--r-md)', padding: '0 8px', boxShadow: '0 0 0 1px var(--line)' }}>
            <Icon icon={Search} size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'emoji' ? 'Search Emoji' : 'Search Icons'} autoComplete="off" data-1p-ignore data-lpignore="true"
              className="zb-picker-search"
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 'var(--text-body-size)', lineHeight: '20px', color: 'var(--ink)', padding: 0 }} />
          </span>
          <button onClick={() => { const pick = tab === 'emoji' ? withTone(ALL_EMOJI[Math.floor(Math.random() * ALL_EMOJI.length)][0], TONES[tone]) : 'ph:' + ICON_NAMES[Math.floor(Math.random() * ICON_NAMES.length)]; onPick(pick); onClose(); }}
            title="Random" aria-label="Random icon" className="zb-press"
            style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--r-md)', border: 'none', boxShadow: '0 0 0 1px color-mix(in srgb, var(--ink) 20%, transparent)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Icon icon={Shuffle} size={16} />
          </button>
          {tab === 'emoji' && (
            <button onClick={cycleTone} title="Skin tone" aria-label="Cycle skin tone" className="zb-press"
              style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--r-md)', border: 'none', background: 'transparent', fontSize: 'var(--text-h3-size)', lineHeight: 1, cursor: 'pointer', padding: 0 }}>
              {withTone('✋', TONES[tone])}
            </button>
          )}
        </div>
      )}

      {tab === 'emoji' && (
        <>
          <div ref={scrollRef} onScroll={onGridScroll} style={{ position: 'relative', maxHeight: 262, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 12px 8px' }}>
            {cats.map((c) => c.items.length > 0 && (
              <div key={c.name} ref={(el) => { catRefs.current[c.name] = el; }}>
                <div style={catLabel}>{c.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
                  {c.items.map(([e, n], i) => (
                    <button key={c.name + e + i} title={n === 'recent' ? undefined : n} aria-label={n === 'recent' ? e : n} onClick={() => pickEmoji(e)} className="zb-press"
                      style={{ ...cell, fontSize: 'var(--text-stat-size)', lineHeight: 1 }}>
                      {n === 'recent' ? e : withTone(e, TONES[tone])}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {cats.every((c) => c.items.length === 0) && <div style={{ padding: '20px 4px', fontSize: 'var(--text-body-size)', color: 'var(--text-muted)', textAlign: 'center' }}>No emoji found</div>}
          </div>
          {/* Category rail — fixed set (Recent always leads, custom-upload plus
              trails), per the HiFi: a hairline separates it from the grid, and
              each icon carries a DS tooltip. Hidden while searching. */}
          {!query && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40, padding: '0 12px', flexShrink: 0, borderTop: '1px solid var(--line)' }}>
              {[{ name: 'Recent', icon: History }, ...EMOJI_CATS.map((c) => ({ name: c.name, icon: c.icon }))].map((c) => {
                const on = activeCat === c.name;
                return (
                  <Tooltip key={c.name} label={c.name} side="bottom">
                    <button aria-label={`${c.name} emoji`} aria-pressed={on} onClick={() => scrollToCat(c.name)} className={on ? undefined : 'zb-press'}
                      style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 'var(--r-md)', border: 'none', background: on ? 'var(--hover)' : 'transparent', color: on ? 'var(--ink-2)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)' }}>
                      <Icon icon={c.icon} size={20} />
                    </button>
                  </Tooltip>
                );
              })}
              {/* Trailing custom-emoji upload (per the HiFi's plus-square) */}
              <Tooltip label="Add emoji" side="bottom">
                <button aria-label="Add custom emoji" onClick={() => { setTab('upload'); setErr(null); }} className="zb-press"
                  style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 'var(--r-md)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Icon icon={SquarePlus} size={20} />
                </button>
              </Tooltip>
            </div>
          )}
        </>
      )}

      {tab === 'icons' && (
        <div style={{ maxHeight: 302, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 12px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
            {iconResults.map((n) => (
              <button key={n} title={n} aria-label={n} onClick={() => { onPick('ph:' + n); onClose(); }} className="zb-press"
                style={{ ...cell, color: 'var(--text-secondary)' }}>
                <Icon icon={PAGE_ICONS[n]} size={20} />
              </button>
            ))}
          </div>
          {iconResults.length === 0 && <div style={{ padding: '20px 4px', fontSize: 'var(--text-body-size)', color: 'var(--text-muted)', textAlign: 'center' }}>No icons found</div>}
        </div>
      )}

      {tab === 'upload' && (
        <div style={{ padding: '0 8px 8px' }}>
          <UploadZone hint="Recommended 280 × 280 px · max 8 MB" error={err} onFile={intake} />
        </div>
      )}
      <style>{`.zb-picker-search::placeholder{color:var(--disabled-text)}`}</style>
    </PickerPanel>
  );
}
