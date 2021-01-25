import React, { useEffect, useState } from 'react';

export const ElementHeightContext = React.createContext(0);
export const ElementWidthContext = React.createContext(0);
export const ElementLeftContext = React.createContext(0);
export const ElementRightContext = React.createContext(0);

export function useSize(elementRef) {
  const [dimensions, setDimensions] = useState({
    height: 0,
    width: 0,
  });
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (entry.contentRect) {
          setDimensions({
            height: entry.contentRect.height,
            width: entry.contentRect.width,
          });
        }
      }
    });
    const element = elementRef?.current || null;
    if (element === null) {
      return;
    }
    resizeObserver.observe(element);
    return () => {
      resizeObserver.unobserve(element);
    };
  }, [elementRef]);
  return dimensions;
}

export function ElementSize({ children, elementRef }) {
  const { height, width } = useSize(elementRef);
  const { left = 0, right = 0 } =
    elementRef.current?.getBoundingClientRect() || {};
  return (
    <ElementHeightContext.Provider value={height}>
      <ElementWidthContext.Provider value={width}>
        <ElementLeftContext.Provider value={left}>
          <ElementRightContext.Provider value={right}>
            {children}
          </ElementRightContext.Provider>
        </ElementLeftContext.Provider>
      </ElementWidthContext.Provider>
    </ElementHeightContext.Provider>
  );
}
