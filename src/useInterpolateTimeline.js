import moment from 'moment';

export default function useInterpolateTimeline({
  error,
  initialized: isTimelineLoaded,
  hasMoreData,
  nextOffset,
  resources,
}) {
  if (resources !== null) {
    const { data, total } = resources;
    let { earliestDate } = resources;
    if (earliestDate.length < 1) {
      earliestDate = moment().subtract(90, 'days');
    }
    let start = moment(earliestDate).startOf('day');
    if (moment().diff(start, 'days') < 120) {
      start = moment().subtract(90, 'days');
    }
    const end = moment()
      .add(30, 'days')
      .endOf('day');
    const times = data.map(d => {
      return d.date.slice(0, 10);
    });
    const currentStart = moment(
      times[times.length - 1],
      'YYYY-MM-DD',
    ).startOf('day');
    const timeline = [];
    let load = hasMoreData;
    for (
      let i = moment(end);
      !start.isSameOrAfter(i);
      i = moment(i).subtract(1, 'days')
    ) {
      const dateString = i.format('YYYY-MM-DD');
      const index = times.findIndex(time => time === dateString);
      if (index > -1) {
        timeline.unshift({
          ...data[index],
          date: moment(i),
          type: 'bar',
        });
      } else if (
        !i.isSameOrAfter(currentStart, 'day') &&
        times.length > 0 &&
        hasMoreData
      ) {
        timeline.unshift({
          date: moment(i),
          load,
          nextOffset,
          type: 'loading',
        });
        load = false;
      } else {
        timeline.unshift({
          accepted: 0,
          date: moment(i),
          negotiationInProgress: 0,
          requiresUserIntervention: 0,
          type: 'bar',
          userIntervened: 0,
          waitFirstResponse: 0,
        });
      }
    }
    const mid = Math.floor(times.length / 2);
    return {
      error,
      isTimelineLoaded,
      meta: {
        center: times[mid],
        total,
      },
      raw: data,
      timeline,
    };
  }
  return {
    data: null,
    error,
    isTimelineLoaded,
  };
}
