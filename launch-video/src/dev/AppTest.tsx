import React from "react";
import { AbsoluteFill } from "remotion";
import { AW, AW_CHECK, AppWorkspace } from "../ui/app/AppWorkspace";

/** Dev: the product workspace at 1×, with the pull-out origin marked. */
export const AppTest: React.FC = () => (
  <AbsoluteFill style={{ background: "#280417" }}>
    <div style={{ position: "absolute", left: (1920 - AW.w) / 2, top: (1080 - AW.h) / 2 }}>
      <AppWorkspace check={0} />
      <div style={{ position: "absolute", left: AW_CHECK.x - 3, top: AW_CHECK.y - 3, width: 6, height: 6, background: "lime" }} />
    </div>
  </AbsoluteFill>
);
