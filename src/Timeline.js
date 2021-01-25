import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cx from "classnames";
import { FixedSizeList as List } from "react-window";
import { mdiLoading } from "@mdi/js";
import { Icon } from "@mdi/react";
import moment from "moment";
import {
  ElementLeftContext,
  ElementHeightContext,
  ElementRightContext,
  ElementSize,
  ElementWidthContext,
  useSize,
} from "./ElementSize";

import useInterpolateTimeline from "./useInterpolateTimeline";
import style from "./timeline.module.scss";

const SetTimelineCurrentEventContext = createContext(null);
const TimelineDataContext = createContext(null);
const ScaleContext = createContext(null);
const ScaleRangeContext = createContext(null);
const ColorMapContext = createContext(null);
const LabelMapContext = createContext(null);

const ITEM_SIZE = 30;

function isInRange(date, dateRangeStart, dateRangeEnd) {
  let isDateInRange = false;
  if (dateRangeStart || dateRangeEnd) {
    if (dateRangeEnd === null) {
      if (
        dateRangeStart !== null &&
        moment(date).isSameOrAfter(dateRangeStart)
      ) {
        isDateInRange = true;
      }
    } else if (dateRangeStart === null) {
      if (dateRangeEnd !== null && moment(date).isSameOrBefore(dateRangeEnd)) {
        isDateInRange = true;
      }
    } else {
      isDateInRange =
        dateRangeStart.isSameOrBefore(moment(date).endOf("day")) &&
        dateRangeEnd.isSameOrAfter(moment(date).startOf("day"));
    }
  }
  return isDateInRange;
}

function sum(datum) {
  const {
    accepted = 0,
    negotiationInProgress = 0,
    requiresUserIntervention = 0,
    userIntervened = 0,
    waitFirstResponse = 0,
  } = datum;
  return [
    accepted,
    negotiationInProgress,
    requiresUserIntervention,
    userIntervened,
    waitFirstResponse,
  ].reduce((total, c) => total + c, 0);
}

function maxIndex(data) {
  if (data.length < 1) {
    return -1;
  }
  let index = 0;
  let maxValue = sum(data[index]);
  data.slice(1).forEach((datum, i) => {
    if (sum(datum) > maxValue) {
      index = i + 1;
      maxValue = sum(datum);
    }
  });
  return index;
}

function max(data) {
  if (data.length < 1) {
    throw new Error("No data.");
  }
  return sum(data[maxIndex(data)]);
}

function LoadingCard() {
  return <Icon path={mdiLoading} size={1} spin={2} color="gray" />;
}

function Scale({ children, data }) {
  const height = useContext(ElementHeightContext);
  const domain = useMemo(() => [0, max(data)], [data]);
  const range = useMemo(() => [0, height - 30], [height]);
  const buildScale = useCallback(() => {
    return (value) => {
      {
        const [min, maxValue] = domain;
        if (value <= min) {
          return range[0];
        }
        if (value >= maxValue) {
          return range[1];
        }
      }
      let valuePercent = 0;
      {
        const [min, maxValue] = domain;
        valuePercent = (value - min) / (maxValue - min);
      }
      {
        const [min, maxValue] = range;
        return maxValue * valuePercent + min;
      }
    };
  }, [domain, range]);
  const scale = useMemo(() => buildScale(), [buildScale]);
  return (
    <ScaleContext.Provider value={scale}>
      <ScaleRangeContext.Provider value={range}>
        {children}
      </ScaleRangeContext.Provider>
    </ScaleContext.Provider>
  );
}

function toStatus(key) {
  switch (key) {
    case "accepted":
      return ACCEPTED;
    case "negotiationInProgress":
      return NEGOTIATING_IN_PROGRESS;
    case "requiresUserIntervention":
      return REQUIRES_USER_INTERVENTION;
    case "userIntervened":
      return USER_INTERVENED;
    case "waitFirstResponse":
      return WAITING_FOR_FIRST_RESPONSE;
    default:
      throw new Error(`Key not found: ${key}`);
  }
}

function toLabel(labels, key) {
  return labels[key] || key;
}

function toColor(colorMap, key) {
  return colorMap[key] || "gray";
}

const LoadingBar = React.memo(({ load, date, nextOffset }) => {
  const [min, maxRange] = useContext(ScaleRangeContext);
  const addNextPage = useContext(AddTimelinePageContext);
  useEffect(() => {
    addNextPage(nextOffset);
  }, [load, addNextPage, nextOffset]);
  return (
    <div className={style.stackedBar} data-date={date} key={date.toString()}>
      <div className={style.stackedBar__day}>{date.format("dd")}</div>
      <div
        className={style.timelineLoadingBar}
        style={{ height: `${maxRange}px` }}
      />
    </div>
  );
});

function StackedBar({ date, heights }) {
  const colorMap = useContext(ColorMapContext);
  return (
    <div className={style.stackedBar} data-date={date} key={date.toString()}>
      <div className={style.stackedBar__day}>{date.format("dd")}</div>
      {heights.map(({ key, height }) => {
        return (
          <div
            className={style.stackedBar__bar}
            key={key}
            style={{ background: toColor(colorMap, key), height }}
          />
        );
      })}
    </div>
  );
}

function toStackedBar(date, heights, index, datum) {
  return (
    <StackedBar
      datum={datum}
      index={index}
      key={date}
      date={date}
      heights={heights}
    />
  );
}

function Tooltip({ event }) {
  const colorMap = useContext(ColorMapContext);
  const labelMap = useContext(LabelMapContext);
  const [left, setLeft] = useState(0);
  const timeLeft = useContext(ElementLeftContext);
  const timelineRight = useContext(ElementRightContext);
  const ref = React.createRef();
  const { width: tooltipWidth } = useSize(ref);
  useEffect(() => {
    if (event === null) {
      return;
    }
    const { position } = event;
    const { x } = position;
    const halfTooltipWidth = tooltipWidth / 2;
    let newLeft = x - ITEM_SIZE / 2;
    const minimumLeft = halfTooltipWidth;
    const minimumRight = timelineRight - timeLeft - halfTooltipWidth;
    if (newLeft < minimumLeft) {
      newLeft = minimumLeft;
    }
    if (newLeft > minimumRight) {
      newLeft = minimumRight;
    }
    setLeft(newLeft);
  }, [event, setLeft, timeLeft, timelineRight, tooltipWidth]);
  if (event === null) {
    return <span />;
  }
  const { data } = event;
  const { date } = data;
  const counts = [
    "accepted",
    "negotiationInProgress",
    "requiresUserIntervention",
    "userIntervened",
    "waitFirstResponse",
  ].reduce((acc, key) => {
    acc.push({
      count: data[key],
      key,
    });
    return acc;
  }, []);
  const now = new Date();
  const isCurrentYear = moment(date).isSame(now, "year");
  const dateString = isCurrentYear
    ? `${date.format("ddd M/DD")}`
    : `${date.format("ddd M/DD/YYYY")}`;
  return (
    <div
      style={{
        color: "black",
        fontSize: "12px",
        left,
        position: "absolute",
        top: 0,
        transform: "translate(-48%, -100%)",
        zIndex: 5,
      }}
      ref={ref}
    >
      <div className={style.stackedBarTooltip}>
        <div className={style.stackedBarTooltip__date}>{dateString}</div>
        <table className={style.stackedBarTooltip__table}>
          <tbody>
            {counts.map(({ key, count }) => {
              const label = toLabel(labelMap, key);
              return (
                <tr key={key}>
                  <td className={style.stackedBarTooltip__labelCell}>
                    <div
                      className={style.stackedBarTooltip__dot}
                      style={{ backgroundColor: toColor(colorMap, key) }}
                    />
                    {`${label}:`}
                  </td>
                  <td className={style.stackedBarTooltip__countCell}>
                    {count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TimelineAxis() {
  const timelineWidth = useContext(ElementWidthContext);
  return (
    <div
      className={style.timelineAxis}
      style={{ bottom: "37.6px", width: timelineWidth - 30 }}
    />
  );
}

const TimelineEvent = React.memo(
  ({
    accepted,
    date,
    datum,
    negotiationInProgress,
    requiresUserIntervention,
    userIntervened,
    waitFirstResponse,
  }) => {
    return toStackedBar(
      date,
      [
        {
          height: accepted,
          key: "accepted",
        },
        {
          height: requiresUserIntervention,
          key: "requiresUserIntervention",
        },
        {
          height: negotiationInProgress,
          key: "negotiationInProgress",
        },
        {
          height: userIntervened,
          key: "userIntervened",
        },
        {
          height: waitFirstResponse,
          key: "waitFirstResponse",
        },
      ],
      datum
    );
  }
);

const ListItem = React.memo(({ onClick, index, style: infiniteStyle }) => {
  const scale = useContext(ScaleContext);
  // const search = useContext(SearchContext);
  // const [_, setCalendarFilterType] = useContext(
  //   SearchCalendarFilterTypeContext
  // );
  const setCurrentEvent = useContext(SetTimelineCurrentEventContext);
  const data = useContext(TimelineDataContext);
  const ref = useRef(null);
  const datum = useMemo(() => {
    return data[index];
  }, [index, data]);
  const {
    date,
    accepted = 0,
    negotiationInProgress = 0,
    requiresUserIntervention = 0,
    userIntervened = 0,
    waitFirstResponse = 0,
  } = datum || {};
  const now = new Date();
  const isStartOfMonth = moment(date).startOf("month").isSame(date, "day");
  const isEndOfMonth = moment(date).endOf("month").isSame(date, "day");
  const isToday = moment(date).isSame(now, "day");
  const isBefore = moment(date).isBefore(now, "day");
  // const isDateInRange = isInRange(
  //   date,
  //   search.filter.dateFilter.start,
  //   search.filter.dateFilter.end
  // );
  // TODO: Provide a way to highlight a range
  const isDateInRange = false;
  const onDateClick = useCallback(() => {
    onClick(data);
  }, [date]);
  const showTooltipOfEvent = useCallback(() => {
    const { left } = ref.current.getBoundingClientRect();
    setCurrentEvent({
      data: datum,
      position: {
        x: left,
      },
    });
  }, [datum, setCurrentEvent]);
  return (
    <div
      tabIndex={0}
      ref={ref}
      role="button"
      index={index}
      style={infiniteStyle}
      className={cx(style.stackedBar__container, {
        [style.timeline__startOfMonth]: isStartOfMonth,
        [style.timeline__endOfMonth]: isEndOfMonth,
        [style.timeline__inRange]: isDateInRange,
        [style.timeline__before]: isBefore,
        [style.timeline__today]: isToday,
      })}
      onMouseEnter={showTooltipOfEvent}
      onFocus={showTooltipOfEvent}
      onClick={onDateClick}
      onKeyPress={onDateClick}
    >
      {datum.type === "loading" && (
        <LoadingBar
          load={datum.load}
          date={datum.date}
          nextOffset={datum.nextOffset}
        />
      )}
      {datum.type !== "loading" && (
        <TimelineEvent
          datum={datum}
          date={date}
          accepted={scale(accepted)}
          requiresUserIntervention={scale(requiresUserIntervention)}
          negotiationInProgress={scale(negotiationInProgress)}
          userIntervened={scale(userIntervened)}
          waitFirstResponse={scale(waitFirstResponse)}
        />
      )}
    </div>
  );
});

function TimelineEvents() {
  const data = useContext(TimelineDataContext);
  const listRef = useRef(null);
  const width = useContext(ElementWidthContext);
  const currentDayIndex = useMemo(() => {
    const today = new Date();
    return data.findIndex(({ date }) => moment(date).isSame(today, "day"));
  }, [data]);
  const centerOnCurrentDay = useCallback(() => {
    if (listRef.current !== null) {
      if (currentDayIndex > -1) {
        listRef.current.scrollToItem(currentDayIndex, "start");
      }
    }
  }, [currentDayIndex]);
  const getDate = useCallback(
    (index) => {
      const item = data[index];
      return item.date.unix();
    },
    [data]
  );
  useEffect(() => {
    centerOnCurrentDay();
  }, [centerOnCurrentDay]);
  return (
    <List
      initialScrollOffset={currentDayIndex * ITEM_SIZE}
      itemCount={data.length}
      itemKey={getDate}
      itemSize={ITEM_SIZE}
      layout="horizontal"
      ref={listRef}
      width={width}
    >
      {ListItem}
    </List>
  );
}

export function Timeline({
  colorMap,
  error,
  initialized,
  hasMoreData,
  labelMap,
  nextOffset,
  resources,
}) {
  const { timeline: initial } = useInterpolateTimeline(
    useMemo(() => {
      return {
        error,
        initialized,
        hasMoreData,
        nextOffset,
        resources,
      };
    })
  );
  const timelineRef = useRef(null);
  const [currentEvent, setCurrentEvent] = useState(null);
  const data = useMemo(() => initial, [initial]);
  const clear = useCallback(
    (event) => {
      event.stopPropagation();
      setCurrentEvent(null);
    },
    [setCurrentEvent]
  );
  if (!Array.isArray(data)) {
    return <LoadingCard height={300} />;
  }
  return (
    <div className="row">
      <div className="col-12">
        <ColorMapContext.Provider value={colorMap}>
          <LabelMapContext.Provider value={labelMap}>
            <TimelineDataContext.Provider value={data}>
              <SetTimelineCurrentEventContext.Provider value={setCurrentEvent}>
                <div onMouseLeave={clear} onBlur={clear}>
                  <div className={style.timelineContainer} ref={timelineRef}>
                    <ElementSize elementRef={timelineRef}>
                      <div>
                        <TimelineAxis index={0} />
                      </div>
                      <Scale data={data}>
                        <TimelineEvents />
                      </Scale>
                      <Tooltip event={currentEvent} />
                    </ElementSize>
                  </div>
                </div>
              </SetTimelineCurrentEventContext.Provider>
            </TimelineDataContext.Provider>
          </LabelMapContext.Provider>
        </ColorMapContext.Provider>
      </div>
    </div>
  );
}
