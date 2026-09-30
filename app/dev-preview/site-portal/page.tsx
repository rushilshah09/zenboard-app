// Dev-only harness for the zenboard.app client portal section (the marketing
// site's #portal). ?theme=dark previews the dark tokens. 404s in prod.
import { notFound } from "next/navigation";
import { PortalSection } from "@/components/site/portal/portal-section";
import tokens from "@/components/site/site-tokens.module.css";

export default async function SitePortalPreview({
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
      <PortalSection theme={theme} />
    </div>
  );
}
