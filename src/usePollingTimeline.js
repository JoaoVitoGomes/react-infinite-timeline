import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import moment from 'moment';
import shortid from 'shortid';

import { useMeetingsClient } from '../MeetingsClient';
import { useSearch } from '../Search';
import { isAbortedError } from '../../utils/error';

const LIMIT = 250;

export default function usePollingTimeline(milliseconds = 3000) {
  const tag = useRef(shortid.generate());
  const [hasMoreData, setHasMoreData] = useState(false);
  const [offsets, setOffsets] = useState(0);
  const [loadedOffsets, setLoadedOffsets] = useState(0);
  const [total, setTotal] = useState(100);
  const addPage = useCallback(
    page => {
      if (page === null) {
        return;
      }
      if (offsets >= page) {
        return;
      }
      if (hasMoreData) {
        setOffsets(page);
      }
    },
    [offsets, hasMoreData, setOffsets],
  );
  const client = useMeetingsClient();
  const search = useSearch();
  const interval = useRef(null);
  const [pollingState, setPollingState] = useState({
    error: null,
    initialized: false,
    pages: offsets,
    resources: null,
  });
  const fetchSearch = useCallback(async () => {
    try {
      if (client.isSearchingTimeline({ tags: [tag.current] })) {
        return;
      }
      const { filter } = search;
      const { dateFilter, ...timelineFilter } = filter;
      const payloads = await Promise.all(
        [...Array(offsets + 1).keys()].map(offset => {
          return client.searchTimeline(
            {
              filter: timelineFilter,
              paging: { limit: LIMIT, offset },
            },
            {
              tags: [tag.current],
            },
          );
        }),
      );
      const payload = payloads.reduce(
        (acc, page) => {
          if (page.data !== null) {
            acc.data = acc.data.concat(page.data);
          }
          acc.total = page.total;
          acc.earliestDate = page.earliestDate;
          acc.latestDate = page.latestDate;
          return acc;
        },
        {
          data: [],
          earliestDate: moment().subtract(90, 'days'),
          latestDate: moment().add(30, 'days'),
          total: 0,
        },
      );
      setTotal(payload.total);
      const resources = payload;
      const newPollingState = {
        error: null,
        initialized: true,
        resources,
      };
      if (newPollingState.resources.data === null) {
        newPollingState.resources.data = [];
      }
      setPollingState(newPollingState);
      setLoadedOffsets(offsets);
    } catch (error) {
      if (isAbortedError(error)) {
        return;
      }
      if (error.message === 'Already fetching meetings') {
        return;
      }
      setPollingState(prev => {
        return {
          ...prev,
          error,
        };
      });
    }
  }, [client, search, offsets, setTotal]);
  useEffect(() => {
    fetchSearch();
    const tagCopy = tag.current;
    return () => {
      client.abortGetRequests([tagCopy]);
    };
  }, [client, fetchSearch, interval, milliseconds, setPollingState]);
  useEffect(() => {
    interval.current = setInterval(fetchSearch, milliseconds);
    const tagCopy = tag.current;
    return () => {
      client.abortGetRequests([tagCopy]);
      clearInterval(interval.current);
    };
  }, [client, fetchSearch, interval, milliseconds, setPollingState]);
  useEffect(() => {
    setHasMoreData(total - (offsets + 1) * LIMIT > 0);
  }, [setHasMoreData, total, offsets]);
  return {
    addPage,
    ...pollingState,
    hasMoreData,
    nextOffset: hasMoreData ? loadedOffsets + 1 : null,
  };
}
