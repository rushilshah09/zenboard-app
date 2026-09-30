"use client";

// Client component: the icon seam (components/ds/icons) is client-only, like
// every other icon call site in the app. It still server-renders as HTML.
import { TileApprovals, TileInvoices, TileLink, TileRequests, TileTeam, TileVisibility } from "../site-tiles";
import { FeatureCard, FeatureGrid, SectionHeader, SiteSection, type SiteTheme } from "../section";
import { ApprovalsIllustration } from "./approvals-illustration";
import { InvoicesIllustration } from "./invoices-illustration";
import { RequestsIllustration } from "./requests-illustration";
import { ShareLinkIllustration } from "./share-link-illustration";
import { VisibilityIllustration } from "./visibility-illustration";

/**
 * zenboard.app/#portal — the client portal, told through one everyday project.
 * Drop into the marketing page as-is; it carries its own tokens and anchor.
 */
export function PortalSection({ theme = "light" }: { theme?: SiteTheme }) {
  return (
    <SiteSection id="portal" labelledBy="portal-title" theme={theme}>
      <FeatureGrid>
        <SectionHeader
          id="portal-title"
          eyebrow="Client portal"
          eyebrowIcon={TileTeam}
          title={
            <>
              Your client sees the work, <br />
              not the workspace.
            </>
          }
          lead="Share a project with one link. Your client follows progress, sends requests and signs off on work, without an account. You decide what they see."
        />

        <FeatureCard
          span="wide"
          icon={TileLink}
          title="One link, no login"
          description="Send your client a link. They open it and see the project: progress, recent work and what needs them. No account, no password."
        >
          <ShareLinkIllustration />
        </FeatureCard>

        <FeatureCard
          span="narrow"
          icon={TileVisibility}
          title="You choose what they see"
          description="Turn on progress, finished work, documents or invoices. Notes, time and costs stay inside Zenboard."
          hint="Preview as client shows you their exact view."
        >
          <VisibilityIllustration />
        </FeatureCard>

        <FeatureCard
          span="third"
          icon={TileRequests}
          title="Requests become tasks"
          description="Your client asks in the portal. Approve it and it lands in your tasks, and they watch it move to done."
        >
          <RequestsIllustration />
        </FeatureCard>

        <FeatureCard
          span="third"
          icon={TileApprovals}
          title="Approvals, on the record"
          description="Send a plan, a quote or a design for sign-off. Your client approves or asks for changes, and the answer stays with the file."
        >
          <ApprovalsIllustration />
        </FeatureCard>

        <FeatureCard
          span="third"
          icon={TileInvoices}
          title="Invoices, next to the work"
          description="Your client sees what is due and what is paid, on the same page as the work it pays for."
        >
          <InvoicesIllustration />
        </FeatureCard>
      </FeatureGrid>
    </SiteSection>
  );
}
