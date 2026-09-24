// The ONE glyph per property type.
//
// Split from lib/properties.ts only by layer: that module is pure vocabulary and
// must stay importable from a server component, and icons are React components.
// Each fact still lives once — this map is `Record<PropType, IconType>`, so
// adding a type to the union without a glyph is a type error, not a fallback.
//
// It replaces two maps that disagreed. Where they did, the choice and the reason:
//
//   text            TextT, not TextAlignLeft — a text FIELD, not paragraph
//                   alignment, which is a formatting control.
//   title           TextAa — deliberately distinct from text: a title is not
//                   just another text column (Notion draws them differently too).
//   multi_select    Tag, not List — these values render as tag chips everywhere
//                   in the app, and List is already the bullet-block glyph.
//   status          CircleDashed, not CircleHalf — a half-filled circle reads as
//                   a contrast/theme control; the dashed ring is Notion's status.
//   email           At, not Envelope — the value IS an @-address; an envelope
//                   means "send a message", which is an action, not a field.
//   created_time    ClockCounterClockwise, and last_edited_time a plain Clock.
//                   The page registry gave both the SAME clock, so its own
//                   Advanced list showed two indistinguishable rows.
import {
  Type, CaseSensitive, Hash, CircleChevronDown, Tag, CircleDashed, Calendar, Users,
  Paperclip, SquareCheck, Link2, AtSign, Phone, SquareFunction, ArrowUpRight, Search,
  History, Clock, CircleUser, MousePointerClick, MapPin, Fingerprint, type IconType,
} from '@/components/ds/icons';
import { normalizePropType, type PropType } from '@/lib/properties';

const ICONS: Record<PropType, IconType> = {
  title: CaseSensitive,
  text: Type,
  number: Hash,
  select: CircleChevronDown,
  multi_select: Tag,
  status: CircleDashed,
  date: Calendar,
  person: Users,
  files: Paperclip,
  checkbox: SquareCheck,
  url: Link2,
  email: AtSign,
  phone: Phone,
  formula: SquareFunction,
  relation: ArrowUpRight,
  rollup: Search,
  created_time: History,
  created_by: CircleUser,
  last_edited_time: Clock,
  last_edited_by: CircleUser,
  button: MousePointerClick,
  place: MapPin,
  id: Fingerprint,
};

/** Tolerates legacy type spellings and junk, like everything else that reads a
 *  persisted property type. */
export const propIcon = (t: string | null | undefined): IconType => ICONS[normalizePropType(t)];
