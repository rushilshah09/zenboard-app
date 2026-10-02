'use client';
// PageIcon — the one way to render a page's icon anywhere in the app.
// A page icon value is one of:
//   · an emoji string           → rendered as text at `size`
//   · "ph:IconName"             → a curated icon (outline, ink-3)
//   · a data-URL / http image   → an <img>, cover-cropped, rounded
// Keeping this resolution in one component means cards, breadcrumbs, the
// document sheet, and pickers all agree on what an icon looks like.
//
// The "ph:" prefix is legacy (the set was originally legacy). The stored keys
// stay stable for back-compat, but each now maps to a Tabler glyph and flows
// through the app icon seam (@/components/ds/icons), so page icons swap to
// Central Icons with the rest of the app. See components/ds/icons.ts.
import {
  FileText, Notebook, Book, BookOpen, Bookmark, Files, Folder, Archive, Calendar, Clock,
  Star, Heart, Flag, Tag, Target, Trophy, Medal, Lightbulb, Rocket, Flame, Sparkles,
  Leaf, Flower, Flower2, Trees, Sun, Moon, CloudSun, Umbrella, Mountain, Waves,
  Coffee, Utensils, Music, Camera, Palette, PenTool, Code, Terminal, Database, Globe,
  MapPin, Plane, Car, House, Building2, Briefcase, ChartBar, ChartPie, Wallet, CreditCard,
  ShoppingCart, Gift, GraduationCap, Brain, MessageCircle, Mail, Phone, Users, User,
  Gamepad2, Dumbbell, Bike, Cross, Shield, Key, Settings, Wrench, FlaskConical, Atom, Orbit,
  PICKER_ICONS,
  type IconType,
} from '@/components/ds/icons';
import { Icon } from '@/components/ds/ui/icon';

// ── THE ICONS TAB ───────────────────────────────────────────────────────────
// Two sets, merged, and the order of the merge is the whole point.
//
// LEGACY_ICONS are the ~70 keys that shipped first. They are STORED on rows
// (`ph:BookmarkSimple`, `ph:RocketLaunch`, `ph:Fire`), and several of them are
// Phosphor's old names or outright aliases — `Fire` is Flame, `Planet` is
// Orbit. They must keep resolving forever, so they are listed explicitly and
// they WIN on a key collision: a row that chose `ph:Tree` years ago must not
// silently become a different glyph because the catalogue also has a `Tree`.
//
// PICKER_ICONS is the seam's catalogue — 260 object glyphs, one family, added
// because 70 was not a set you could find yourself in. The user's words:
// "we have limited emoji and icons right now".
//
// Merging rather than replacing means nothing stored can break, and the picker
// still shows everything.
const LEGACY_ICONS: Record<string, IconType> = {
  FileText, Notebook, Book, BookOpen, BookmarkSimple: Bookmark, Files, Folder, Archive, Calendar, Clock,
  Star, Heart, Flag, Tag, Target, Trophy, Medal, Lightbulb, RocketLaunch: Rocket, Fire: Flame, Sparkle: Sparkles,
  Leaf, Flower, FlowerLotus: Flower2, Tree: Trees, Sun, Moon, CloudSun, Umbrella, Mountains: Mountain, Waves,
  Coffee, ForkKnife: Utensils, MusicNotes: Music, Camera, Palette, PenNib: PenTool, Code, Terminal, Database, Globe,
  MapPin, Airplane: Plane, Car, House, Buildings: Building2, Briefcase, ChartBar, ChartPie, Wallet, CreditCard,
  ShoppingCart, Gift, GraduationCap, Brain, ChatCircle: MessageCircle, EnvelopeSimple: Mail, Phone, Users, User,
  GameController: Gamepad2, Barbell: Dumbbell, Bicycle: Bike, FirstAid: Cross, Shield, Key, Gear: Settings, Wrench, Flask: FlaskConical, Atom, Planet: Orbit,
};

export const PAGE_ICONS: Record<string, IconType> = { ...PICKER_ICONS, ...LEGACY_ICONS };


export function PageIcon({ icon, size = 16, style }: { icon?: string | null; size?: number; style?: React.CSSProperties }) {
  if (!icon) return null;
  if (icon.startsWith('data:') || icon.startsWith('http')) {
    // eslint-disable-next-line @next/next/no-img-element -- inline data-URL icon, next/image adds nothing
    return <img src={icon} alt="" width={size} height={size} style={{ display: 'inline-block', width: size, height: size, borderRadius: Math.max(3, Math.round(size * 0.14)), objectFit: 'cover', verticalAlign: '-0.15em', flexShrink: 0, ...style }} />;
  }
  if (icon.startsWith('ph:')) {
    const C = PAGE_ICONS[icon.slice(3)];
    if (!C) return null;
    return <Icon icon={C} size={size} style={{ color: 'var(--text-secondary)', verticalAlign: '-0.125em', flexShrink: 0, ...style }} />;
  }
  return <span aria-hidden style={{ fontSize: size, lineHeight: 1, flexShrink: 0, ...style }}>{icon}</span>;
}
