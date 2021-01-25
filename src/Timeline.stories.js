import React from "react";
import moment from "moment";

import { Timeline } from "./index";

const COLOR_MAP = {
  accepted: "#02BA86",
  cancelled: "#6894ad",
  declined: "#6894ad",
  negotiationInProgress: "#6894ad",
  requiresUserIntervention: "#2BAEF9",
  userIntervened: "#9b9696",
  waitFirstResponse: "#b0d4e8",
};

const LABEL_MAP = {
  accepted: "Accepted",
  cancelled: "Cancelled",
  declined: "Declined",
  negotiationInProgress: "Negotiation In Progress",
  requiresUserIntervention: "Requires User Intervention",
  userIntervened: "User Intervened",
  waitFirstResponse: "Wait For Response",
};

export const DefaultTimeline = () => {
  const FAKE_DATA = (function () {
    // If you want an inclusive end date (fully-closed interval)
    var a = moment().add(-70, "days");
    var b = moment().add(30, "days");
    const data = [];
    for (var m = moment(a); m.diff(b, "days") <= 0; m.add(1, "days")) {
      data.push({
        date: m.toISOString(),
        requiresUserIntervention: Math.ceil(Math.random() * 100),
        negotiationInProgress: Math.ceil(Math.random() * 100),
        userIntervened: Math.ceil(Math.random() * 100),
        declined: Math.ceil(Math.random() * 100),
        cancelled: Math.ceil(Math.random() * 100),
        accepted: Math.ceil(Math.random() * 100),
        waitFirstResponse: Math.ceil(Math.random() * 100),
      });
    }
    return data;
  })();
  return (
    <div style={{ height: 600, paddingTop: 150 }}>
      <Timeline
        colorMap={COLOR_MAP}
        labelMap={LABEL_MAP}
        resources={{
          data: FAKE_DATA,
          earliestDate: FAKE_DATA[0].date,
          total: FAKE_DATA.length,
        }}
      />
    </div>
  );
};

export default {
  title: "Timeline",
  component: DefaultTimeline,
};
