// THE GLYPH FOR EACH KIND OF QUESTION — one map, read by the insert menu, the
// type switch, the builder's outline and the response drawer, so a "Linear scale"
// looks like the same thing everywhere it is named. `BLOCK_META` (lib/form-schema)
// owns the words; this owns the picture. It lives apart because the schema is a
// plain module the SERVER imports, and a glyph is a React component.
import {
  AlignLeft, Calendar, CircleChevronDown, Clock, EyeOff, Hash, Heading2, Link, ListChecks, ListOrdered,
  Mail, Minus, Paperclip, Phone, RadioButton, Rows3, SlidersHorizontal, SquareCheck, Star,
  TextCursorInput, ToggleLeft, Type,
} from '@/components/ds/icons';
import type { FormBlockType } from '@/lib/form-schema';

type Glyph = typeof Star;

export const BLOCK_ICON: Record<FormBlockType, Glyph> = {
  short_text: TextCursorInput,
  long_text: AlignLeft,
  number: Hash,
  email: Mail,
  phone: Phone,
  url: Link,
  select: RadioButton,
  multi_select: ListChecks,
  dropdown: CircleChevronDown,
  yes_no: ToggleLeft,
  checkbox: SquareCheck,
  rating: Star,
  scale: SlidersHorizontal,
  ranking: ListOrdered,
  date: Calendar,
  time: Clock,
  file: Paperclip,
  hidden: EyeOff,
  heading: Heading2,
  statement: Type,
  divider: Minus,
  page_break: Rows3,
};
