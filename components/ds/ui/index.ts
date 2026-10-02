// design-system.md §4 Group A — Primitives (§4.1–4.11). Public surface of ui/.
export { Button, button, type ButtonProps } from "./button";
export { ButtonGroup, SplitButton, DoubleActionButton, type SplitButtonProps, type DoubleActionButtonProps } from "./button-group";
export { IconButton, type IconButtonProps } from "./icon-button";
export { Count } from "./count";
export { InlineConfirm, type InlineConfirmProps } from "./inline-confirm";
export { Icon, Mark, MarkThinking, Logo, type IconProps } from "./icon";
export { Wordmark, type WordmarkProps } from "./wordmark";
export { Link, type LinkProps } from "./link";
export { Kbd } from "./kbd";
export { Avatar, AvatarGroup, type AvatarProps, type AvatarSize, type AvatarStatus } from "./avatar";
export { Badge, type BadgeProps, type BadgeStatus } from "./badge";
export { Tag, type TagProps } from "./tag";
export { PriorityBadge, PriorityBars, type PriorityBadgeProps, type PriorityLevel } from "./priority";
export { Tooltip, TooltipProvider, type TooltipProps } from "./tooltip";
export { Divider, type DividerProps } from "./divider";
export { ScrollArea, type ScrollAreaProps } from "./scroll-area";

// GROUP B — Forms (§4.12–4.26)
export { Field, useField, useFieldProps, type FieldProps } from "./field";
export { TextInput, useValidation, inlineEdit, inlineEditProps, GrowText, type TextInputProps, type GrowTextProps } from "./input";
export { AddLine, addLine, type AddLineProps } from "./add-line";
export { Textarea, type TextareaProps } from "./textarea";
export { MessageComposer, type MessageComposerProps, type ComposerCheck } from "./message-composer";
export { Select, type SelectProps, type SelectGroup, type SelectOption } from "./select";
export { Combobox, type ComboboxProps, type MultiComboboxProps, type ComboOption } from "./combobox";
export { RailToggle } from "./rail-toggle";
export { LayerToggle, type LayerToggleProps } from "./layer-toggle";
export { Checkbox, type CheckboxProps } from "./checkbox";
export { copyText } from "./clipboard";
export { RadioGroup, Radio, RadioCard, type RadioProps } from "./radio";
export { Switch, type SwitchProps } from "./switch";
export { SegmentedControl, type SegmentedControlProps } from "./segmented";
export { Slider, type SliderProps } from "./slider";
export { Rating, type RatingProps } from "./rating";
export { ColorPalette, ColorPicker, type ColorPaletteProps } from "./color";
export { DatePicker, type DatePickerProps } from "./date-picker";
export { TimePicker, parseTime, parseDuration, type TimePickerProps } from './time-picker';
export { FileUpload, type FileUploadProps, type UploadFile } from "./file-upload";
export {
  FilterBar,
  serializeFilters,
  parseFilters,
  type FilterBarProps,
  type FilterProperty,
  type ActiveFilter,
} from "./filter";

// GROUP C/D — Navigation + overlays (§4.29–4.38)
export {
  Breadcrumbs,
  type Crumb, type CrumbMenuItem, type CrumbMenuSection, type CrumbMenuSource,
} from "./breadcrumbs";
export { Tabs, TabPanel, type TabsProps, type TabItem } from "./tabs";
export { LoadMore, Pagination, type LoadMoreProps, type PaginationProps } from "./pagination";
export { StepIndicator, StepDots, type Step, type StepState } from "./steps";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./dropdown-menu";
export { Popover, PopoverTrigger, PopoverAnchor, PopoverClose, PopoverContent } from "./popover";
export { HoverCard, HoverCardTrigger, HoverCardContent } from "./hover-card";
export { Toolbar, ToolbarButton, ToolbarSeparator, type ToolbarProps, type ToolbarButtonProps } from "./toolbar";
export { MenuPanel, MenuItem, MenuLabel, MenuSeparator, MenuGlyph, MenuField, OVERLAY_CLASS, MENU_PANEL_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SEPARATOR_CLASS, MENU_FIELD_CLASS, type MenuItemProps } from "./menu";
export { Modal, ConfirmModal, type ModalProps, type ConfirmModalProps } from "./modal";
export { FullScreenLayer, type FullScreenLayerProps } from "./full-screen-layer";
export { useConfirm, type ConfirmOptions } from "./use-confirm";
export { Drawer, BottomSheet, type DrawerProps, type BottomSheetProps } from "./drawer";
// THE opening system — every record opens through this, never a module-specific
// panel. <Drawer> above stays for non-record panels (share sheets, pickers).
export {
  PageView, CONTENT_PANE_SURFACE,
  MODE_ICON as PAGE_VIEW_MODE_ICON, MODE_HINT as PAGE_VIEW_MODE_HINT,
  type PageViewProps, type PageViewMode, type PageViewHistory, type ContentType,
} from "./page-view";
export { CommandMenu, useCommandMenu, type CommandItem, type CommandMenuProps } from "./command-menu";

// GROUP E — Feedback (§4.39–4.46)
export { Alert, Banner, type AlertProps, type AlertVariant, type BannerProps } from "./alert";
export { Toaster, toast, toastReverted, dismissToast, type ToastData } from "./toast";
export { Spinner, type SpinnerProps } from "./spinner";
export { Progress, SegmentedProgress, CircularProgress, type ProgressProps, type SegmentedProgressProps, type SegmentColor } from "./progress";
export { Skeleton, SkeletonText, SkeletonRow } from "./skeleton";
export { EmptyState, EmptyLine, ErrorState, SuccessState, type EmptyStateProps, type ErrorStateProps } from "./states";
export { Illustration, ILLUSTRATIONS, type IllustrationName, type IllustrationField } from "./illustration";
export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from "./navigation-menu";
export { NotificationsBell, type Notification, type NotificationsBellProps } from "./notifications";
export { ActivityFeed, type ActivityEntry } from "./activity-feed";

// GROUP F — Data & display (§4.47–4.58)
export { Card, CardGrid, cardClass, cardInteractiveClass, CARD_CLASS, CARD_INTERACTIVE_CLASS, type CardProps } from "./card";
export { Panel, PanelHeader, PanelBody, type PanelProps } from "./panel";
export { ListRow, List, type ListRowProps } from "./list-row";
export { SuggestionRow, type SuggestionRowProps } from "./suggestion";
export { QuoteRow, type QuoteRowProps } from "./quote-row";
export { AnchorRow, type AnchorRowProps } from "./anchor-row";
export { SettingsPaneHeader, SettingsSection, SettingsRow, type SettingsSectionProps, type SettingsRowProps } from "./settings";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion";
export { Stat, type StatProps } from "./stat";
export { Chart, type ChartProps, type ChartSeries } from "./chart";
export { SelectionBar, type SelectionBarProps } from "./selection-bar";
export { DataTable, type Column, type DataTableProps } from "./data-table";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "./table";
export { Toggle, toggleVariants } from "./toggle";
export { ToggleGroup, ToggleGroupItem } from "./toggle-group";
export { Board, BOARD_COLUMN, type BoardProps, type BoardColumnData, type BoardCardData,
  type BoardColumnShell, type BoardCardShell } from "./board";
export { DropLine, DragGhost, type DropLineProps, type DragGhostProps } from "./drop-indicator";
export { MenuSelect, type MenuSelectProps, type MenuSelectOption } from "./menu-select";
export { PropertyRow, RecordHeader, RecordColorMark, PROPERTY_ROW } from './record-header';
export { LinkCard, type LinkCardProps } from './link-card';
export { LinkMark, ChannelMark, markFor, type LinkMarkProps, type MarkSize } from './link-mark';
export { Appear, Presence, Move, IconSwap, ViewSwap, MOTION, EXIT_ROW } from './motion';
