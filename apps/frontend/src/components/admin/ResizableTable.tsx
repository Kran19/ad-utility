'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface ColumnWidthConfig {
  [key: string]: number;
}

export function useResizableColumns(
  tableId: string,
  defaultWidths: ColumnWidthConfig,
  minWidth: number = 70
) {
  const [widths, setWidths] = useState<ColumnWidthConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`table_widths_${tableId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...defaultWidths, ...parsed };
        }
      } catch {
        // Fallback to default
      }
    }
    return defaultWidths;
  });

  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);
  const activeColRef = useRef<string | null>(null);

  // Synchronize localStorage
  const saveWidths = useCallback(
    (newWidths: ColumnWidthConfig) => {
      setWidths(newWidths);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`table_widths_${tableId}`, JSON.stringify(newWidths));
        } catch {
          // ignore
        }
      }
    },
    [tableId]
  );

  const handleMouseDown = useCallback(
    (colKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const currentWidth = widths[colKey] || defaultWidths[colKey] || 150;
      startXRef.current = e.clientX;
      startWidthRef.current = currentWidth;
      activeColRef.current = colKey;
      setActiveColumn(colKey);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!activeColRef.current) return;
        const deltaX = moveEvent.clientX - startXRef.current;
        const newWidth = Math.max(minWidth, startWidthRef.current + deltaX);

        setWidths((prev) => ({
          ...prev,
          [activeColRef.current!]: newWidth,
        }));
      };

      const handleMouseUp = () => {
        if (activeColRef.current) {
          setWidths((latest) => {
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(`table_widths_${tableId}`, JSON.stringify(latest));
              } catch {}
            }
            return latest;
          });
        }

        activeColRef.current = null;
        setActiveColumn(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [widths, defaultWidths, minWidth, tableId]
  );

  const resetColumnWidth = useCallback(
    (colKey: string) => {
      const defaultW = defaultWidths[colKey] || 150;
      const updated = { ...widths, [colKey]: defaultW };
      saveWidths(updated);
    },
    [defaultWidths, widths, saveWidths]
  );

  const resetAllWidths = useCallback(() => {
    saveWidths(defaultWidths);
  }, [defaultWidths, saveWidths]);

  const getColStyle = useCallback(
    (colKey: string) => {
      const w = widths[colKey] || defaultWidths[colKey];
      if (!w) return {};
      return {
        width: `${w}px`,
        minWidth: `${w}px`,
        maxWidth: `${w}px`,
      };
    },
    [widths, defaultWidths]
  );

  return {
    widths,
    activeColumn,
    handleMouseDown,
    resetColumnWidth,
    resetAllWidths,
    getColStyle,
  };
}

interface ResizableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  colKey: string;
  width?: number;
  onResizeStart?: (colKey: string, e: React.MouseEvent) => void;
  onDoubleClickResize?: (colKey: string) => void;
  isActive?: boolean;
  children: React.ReactNode;
}

export const ResizableTh: React.FC<ResizableThProps> = ({
  colKey,
  width,
  onResizeStart,
  onDoubleClickResize,
  isActive,
  children,
  className = '',
  style = {},
  ...props
}) => {
  const colStyle = width
    ? {
        ...style,
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
      }
    : style;

  return (
    <th
      className={`relative group select-none ${className} ${isActive ? 'bg-indigo-950/60 text-indigo-200' : ''}`}
      style={colStyle}
      {...props}
    >
      <div className="w-full flex items-center justify-between overflow-hidden pr-2">
        <span className="truncate">{children}</span>
      </div>

      {/* Excel-like Column Resize Handle */}
      <div
        onMouseDown={(e) => onResizeStart?.(colKey, e)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClickResize?.(colKey);
        }}
        title="Drag to resize column (Double click to reset)"
        className={`absolute right-0 top-0 bottom-0 w-3 -mr-1.5 cursor-col-resize flex items-center justify-center z-10 group/handle transition-all ${
          isActive ? 'opacity-100' : 'opacity-0 hover:opacity-100'
        }`}
      >
        <div
          className={`w-[2px] h-full transition-colors ${
            isActive
              ? 'bg-indigo-500 shadow-md shadow-indigo-500/50'
              : 'bg-slate-700 group-hover/handle:bg-indigo-400 group-hover:bg-slate-700'
          }`}
        />
      </div>
    </th>
  );
};
