// Dev-only harness for the zenboard.app hub section ("everything in one calm
// place"). ?theme=dark previews the dark tokens. 404s in prod.
import { notFound } from "next/navigation";
import { HubSection } from "@/components/site/hub/hub-section";
import tokens from "@/components/site/site-tokens.module.css";

export default async function SiteHubPreview({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const theme = (await searchParams).theme === "dark" ? "dark" : "light";
  return (
    <div
      className={tokens.site}
      data-theme={theme}
      style={{ minHeight: "100dvh", background: "var(--site-bg)" }}
    >
      <HubSection theme={theme} />
    </div>
  );
}
