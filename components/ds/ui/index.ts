// design-system.md §4 Group A — Primitives (§4.1–4.11). Public surface of ui/.
export { Button, button, type ButtonProps } from "./button";
export { ButtonGroup, SplitButton, DoubleActionButton, type SplitButtonProps, type DoubleActionButtonProps } from "./button-group";
export { IconButton, type IconButtonProps } from "./icon-button";
export { InlineConfirm, type InlineConfirmProps } from "./inline-confirm";
export { Icon, Mark, Logo, type IconProps } from "./icon";
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
export { TextInput, useValidation, type TextInputProps } from "./input";
export { Textarea, type TextareaProps } from "./textarea";
export { Select, type SelectProps, type SelectGroup, type SelectOption } from "./select";
export { Combobox, type ComboboxProps, type MultiComboboxProps, type ComboOption } from "./combobox";
export { Checkbox, type CheckboxProps } from "./checkbox";
export { RadioGroup, Radio, RadioCard, type RadioProps } from "./radio";
export { Switch, type SwitchProps } from "./switch";
export { SegmentedControl, type SegmentedControlProps } from "./segmented";
export { Slider, type SliderProps } from "./slider";
export { Rating, type RatingProps } from "./rating";
export { ColorPalette, ColorPicker, type ColorPaletteProps } from "./color";
export { DatePicker, type DatePickerProps } from "./date-picker";
export { TimePicker, parseDuration, type TimePickerProps, type TimeValue } from "./time-picker";
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
export { Breadcrumbs, type Crumb } from "./breadcrumbs";
export { Tabs, TabPanel, type TabsProps, type TabItem } from "./tabs";
export { LoadMore, Pagination, type LoadMoreProps, type PaginationProps } from "./pagination";
export { StepIndicator, type Step, type StepState } from "./steps";
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
export { Toolbar, ToolbarButton, ToolbarSeparator, type ToolbarProps, type ToolbarButtonProps } from "./toolbar";
export { MenuPanel, MenuItem, MenuLabel, MenuSeparator, MenuGlyph, MENU_PANEL_CLASS, type MenuItemProps } from "./menu";
export { Modal, ConfirmModal, type ModalProps, type ConfirmModalProps } from "./modal";
export { Drawer, BottomSheet, type DrawerProps, type BottomSheetProps } from "./drawer";
export { CommandMenu, useCommandMenu, type CommandItem, type CommandMenuProps } from "./command-menu";

// GROUP E — Feedback (§4.39–4.46)
export { Alert, Banner, type AlertProps, type AlertVariant, type BannerProps } from "./alert";
export { Toaster, toast, dismissToast, type ToastData } from "./toast";
export { Progress, SegmentedProgress, CircularProgress, type ProgressProps } from "./progress";
export { Skeleton, SkeletonText, SkeletonRow } from "./skeleton";
export { EmptyState, ErrorState, SuccessState, type EmptyStateProps, type ErrorStateProps } from "./states";
export { NotificationsBell, type Notification, type NotificationsBellProps } from "./notifications";
export { ActivityFeed, type ActivityEntry } from "./activity-feed";

// GROUP F — Data & display (§4.47–4.58)
export { Card, CardGrid, type CardProps } from "./card";
export { Panel, PanelHeader, PanelBody, type PanelProps } from "./panel";
export { ListRow, List, type ListRowProps } from "./list-row";
export { SettingsPaneHeader, SettingsSection, SettingsRow, type SettingsSectionProps, type SettingsRowProps } from "./settings";
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion";
export { Stat, type StatProps } from "./stat";
export { Chart, type ChartProps, type ChartSeries } from "./chart";
export { SelectionBar, type SelectionBarProps } from "./selection-bar";
export { DataTable, type Column, type DataTableProps } from "./data-table";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from "./table";
export { Toggle, toggleVariants } from "./toggle";
export { ToggleGroup, ToggleGroupItem } from "./toggle-group";
export { Board, type BoardProps, type BoardColumnData, type BoardCardData } from "./board";
