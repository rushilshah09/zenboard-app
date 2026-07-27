-- Event color — Google-Calendar-style, in Zenboard's palette. NULL = the brand
-- default (accent). Stored as a palette color name ('accent','blue','green',…).
-- The app selects/writes `color` defensively, so it keeps working before this
-- runs; apply it so a chosen color persists across reloads.
alter table calendar_events add column if not exists color text;
