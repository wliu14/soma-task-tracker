'use client';

import { useMemo, useRef, useState } from 'react';

interface TodoWithDeps {
  id: number;
  title: string;
  dueDate?: string | null;
  dependsOn: Array<{ dependencyId: number; dependency: { id: number; title: string } }>;
  dependedOnBy: Array<{ dependentId: number; dependent: { id: number; title: string } }>;
}

interface DependencyGraphProps {
  todos: TodoWithDeps[];
}

export function DependencyGraph({ todos }: DependencyGraphProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [scrollPos, setScrollPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });

  if (todos.length === 0) {
    return null;
  }

  // Base date used to convert relative "day offsets" into calendar dates.
  const today = new Date();
  const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;

  const dueOffsetById = new Map<number, number>();
  todos.forEach(todo => {
    if (!todo.dueDate) {
      dueOffsetById.set(todo.id, 0);
      return;
    }
    const d = new Date(todo.dueDate);
    if (Number.isNaN(d.getTime())) {
      dueOffsetById.set(todo.id, 0);
      return;
    }
    const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((localMidnight.getTime() - baseDate.getTime()) / msPerDay);
    dueOffsetById.set(todo.id, Math.max(0, diffDays));
  });

  // Calculate earliest start dates (calendar) using topological sort.
  // We assume each dependency adds a 1-day sequencing constraint. (No task durations.)
  const buildAdjacencyList = () => {
    const adj = new Map<number, number[]>();
    const inDegree = new Map<number, number>();
    const depsByNode = new Map<number, number[]>();

    todos.forEach(todo => {
      if (!adj.has(todo.id)) adj.set(todo.id, []);
      if (!inDegree.has(todo.id)) inDegree.set(todo.id, 0);
      if (!depsByNode.has(todo.id)) depsByNode.set(todo.id, []);
    });

    todos.forEach(todo => {
      todo.dependsOn.forEach(dep => {
        adj.get(dep.dependencyId)?.push(todo.id);
        inDegree.set(todo.id, (inDegree.get(todo.id) || 0) + 1);
        const list = depsByNode.get(todo.id)!;
        list.push(dep.dependencyId);
      });
    });

    return { adj, inDegree, depsByNode };
  };

  const { adj, inDegree, depsByNode } = buildAdjacencyList();

  // Kahn's algorithm for topological sort
  const queue = Array.from(inDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([id, _]) => id);

  const topoOrder: number[] = [];
  const earliestStartDays = new Map<number, number>();
  const predecessor = new Map<number, number | null>();

  queue.forEach(id => {
    earliestStartDays.set(id, 0);
    predecessor.set(id, null);
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);

    adj.get(current)?.forEach(neighbor => {
      const deps = depsByNode.get(neighbor) || [];

      // If the task has no dependencies, it can start at "today" (offset 0).
      if (deps.length === 0) {
        if (!earliestStartDays.has(neighbor)) {
          earliestStartDays.set(neighbor, 0);
          predecessor.set(neighbor, null);
        }
      } else {
        // Longest path: choose dependency that maximizes earliest start,
        // but also respect that the earliest start cannot be before the
        // dependency's own due date (if it has one).
        let bestStart = -Infinity;
        let bestDep: number | null = null;
        deps.forEach(depId => {
          const depEarliest = earliestStartDays.get(depId) || 0;
          const depDueOffset = dueOffsetById.get(depId) ?? 0;
          const candidate = Math.max(depEarliest, depDueOffset);
          if (candidate > bestStart) {
            bestStart = candidate;
            bestDep = depId;
          }
        });

        const existing = earliestStartDays.get(neighbor);
        if (existing === undefined || bestStart > existing) {
          earliestStartDays.set(neighbor, bestStart === -Infinity ? 0 : bestStart);
          predecessor.set(neighbor, bestDep);
        }
      }

      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Find critical path (longest chain) using DP predecessor map
  const allStarts = Array.from(earliestStartDays.entries());
  const maxEntry = allStarts.reduce<[number, number] | null>(
    (best, [id, start]) => {
      if (best === null || start > best[1]) return [id, start];
      return best;
    },
    null
  );

  const criticalPathNodes = new Set<number>();

  if (maxEntry) {
    let current: number | null = maxEntry[0];
    while (current !== null && !criticalPathNodes.has(current)) {
      criticalPathNodes.add(current);
      current = predecessor.get(current) ?? null;
    }
  }

  const { nodesByColumn, earliestStartDateById } = useMemo(() => {
    // Layout nodes by column (topo depth in days)
    const nodesByColumn = new Map<number, number[]>();
    todos.forEach(todo => {
      const column = earliestStartDays.get(todo.id) || 0;
      if (!nodesByColumn.has(column)) nodesByColumn.set(column, []);
      nodesByColumn.get(column)?.push(todo.id);
    });

    // Compute actual calendar dates as "baseDate + offsetDays"
    const earliestStartDateById = new Map<number, Date>();
    todos.forEach(todo => {
      const offsetDays = earliestStartDays.get(todo.id) || 0;
      const startDate = new Date(baseDate);
      startDate.setDate(baseDate.getDate() + offsetDays);
      earliestStartDateById.set(todo.id, startDate);
    });

    return { nodesByColumn, earliestStartDateById };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, baseDate.getTime()]);

  // SVG dimensions
  const columnWidth = 200;
  const rowHeight = 100;
  const nodeRadius = 40;
  const maxColumns = nodesByColumn.size;
  const maxRows = Math.max(...Array.from(nodesByColumn.values()).map(n => n.length));
  // Force a wider canvas so horizontal overflow always exists when needed.
  // (Some devices/OS settings hide horizontal scrollbars unless overflow is obvious.)
  const svgWidth = Math.max(900, maxColumns * columnWidth + 200);
  // Add generous vertical padding so labels and nodes fit,
  // and so content can overflow the fixed-height container.
  const svgHeight = Math.max(600, maxRows * rowHeight + 200);

  // Calculate node positions
  const nodePositions = new Map<number, { x: number; y: number }>();
  nodesByColumn.forEach((nodeIds, column) => {
    nodeIds.forEach((nodeId, rowIndex) => {
      const x = column * columnWidth + 150;
      const y = (rowIndex + 0.5) * (svgHeight / nodeIds.length) + 50;
      nodePositions.set(nodeId, { x, y });
    });
  });

  const selectedTodo = selectedId === null ? null : todos.find(t => t.id === selectedId) || null;
  const selectedStartDate =
    selectedId === null ? null : earliestStartDateById.get(selectedId) || null;

  const formatDate = (d: Date) => d.toLocaleDateString();

  const shortenLineToCircle = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    radius: number
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: from.x + ux * radius,
      y1: from.y + uy * radius,
      x2: to.x - ux * radius,
      y2: to.y - uy * radius,
    };
  };

  return (
    <div className="mt-12 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Task Dependency Graph</h2>

      {/* Scrollable graph area */}
      <div
        ref={scrollRef}
        className="h-80 w-full overflow-x-scroll overflow-y-scroll border border-gray-200 rounded-lg relative bg-white cursor-grab active:cursor-grabbing select-none"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          scrollbarGutter: 'stable both-edges',
          // Ensure pointer-drag pan isn't interpreted as a browser gesture.
          touchAction: 'none',
        }}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          setScrollPos({ left: el.scrollLeft, top: el.scrollTop });
        }}
        onPointerDown={(e) => {
          if (!scrollRef.current) return;

          // If the user pressed on a node circle, don't start panning;
          // let the node click handler run.
          const target = e.target as Element | null;
          const pressedNode = target?.closest?.('[data-node-circle="true"]');
          if (pressedNode) {
            dragRef.current.isDragging = false;
            return;
          }

          // capture pointer so we still get move events over the SVG
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          dragRef.current.isDragging = true;
          dragRef.current.startX = e.clientX;
          dragRef.current.startY = e.clientY;
          dragRef.current.startScrollLeft = scrollRef.current.scrollLeft;
          dragRef.current.startScrollTop = scrollRef.current.scrollTop;
        }}
        onPointerMove={(e) => {
          if (!scrollRef.current) return;
          if (!dragRef.current.isDragging) return;
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          scrollRef.current.scrollLeft = dragRef.current.startScrollLeft - dx;
          scrollRef.current.scrollTop = dragRef.current.startScrollTop - dy;
        }}
        onPointerUp={() => {
          dragRef.current.isDragging = false;
        }}
        onPointerCancel={() => {
          dragRef.current.isDragging = false;
        }}
        onWheel={(e) => {
          // Make horizontal panning reliable:
          // - trackpads often send deltaX; use it
          // - allow Shift+wheel to pan horizontally (deltaY -> scrollLeft)
          const el = scrollRef.current;
          if (!el) return;

          const absX = Math.abs(e.deltaX);
          const absY = Math.abs(e.deltaY);

          if (absX > 0) {
            el.scrollLeft += e.deltaX;
            // prevent page scroll from stealing the gesture
            e.preventDefault();
            return;
          }

          if (e.shiftKey && absY > 0) {
            el.scrollLeft += e.deltaY;
            e.preventDefault();
          } else if (absY > 0 && el.scrollWidth > el.clientWidth) {
            // If the graph overflows horizontally, let normal wheel also pan a bit.
            // This helps on devices that don't provide deltaX.
            el.scrollLeft += e.deltaY * 0.6;
            e.preventDefault();
          }
        }}
      >
        {/* inline-block wrapper ensures horizontal overflow scrolls */}
        <div ref={canvasRef} className="inline-block" style={{ width: svgWidth }}>
          <svg width={svgWidth} height={svgHeight} className="block">
          {/* Arrow markers */}
          <defs>
            <marker
              id="arrowGray"
              markerWidth="12"
              markerHeight="12"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L0,12 L12,6 z" fill="#cbd5e1" />
            </marker>
            <marker
              id="arrowOrange"
              markerWidth="12"
              markerHeight="12"
              refX="10"
              refY="6"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L0,12 L12,6 z" fill="#f97316" />
            </marker>
          </defs>

          {/* Render edges */}
          {todos.flatMap(todo =>
            todo.dependsOn.map(dep => {
              const from = nodePositions.get(dep.dependencyId);
              const to = nodePositions.get(todo.id);

              if (!from || !to) return null;

              const isOnCriticalPath =
                criticalPathNodes.has(todo.id) && criticalPathNodes.has(dep.dependencyId);

              const { x1, y1, x2, y2 } = shortenLineToCircle(from, to, nodeRadius);

              return (
                <g key={`edge-${dep.dependencyId}-${todo.id}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isOnCriticalPath ? '#f97316' : '#cbd5e1'}
                    strokeWidth={isOnCriticalPath ? 3 : 2}
                    markerEnd={isOnCriticalPath ? 'url(#arrowOrange)' : 'url(#arrowGray)'}
                  />
                </g>
              );
            })
          )}

          {/* Render nodes */}
          {todos.map(todo => {
            const pos = nodePositions.get(todo.id);
            const isOnCriticalPath = criticalPathNodes.has(todo.id);
            const offsetDays = earliestStartDays.get(todo.id) || 0;

            const startDate = earliestStartDateById.get(todo.id) || baseDate;
            const title =
              todo.title && todo.title.trim().length > 0
                ? todo.title
                : `Untitled task (#${todo.id})`;

            if (!pos) return null;

            return (
              <g key={`node-${todo.id}`}>
                {/* Node circle */}
                <circle
                  data-node-circle="true"
                  cx={pos.x}
                  cy={pos.y}
                  r={nodeRadius}
                  fill={isOnCriticalPath ? '#fed7aa' : '#e2e8f0'}
                  stroke={isOnCriticalPath ? '#f97316' : '#94a3b8'}
                  strokeWidth={isOnCriticalPath ? 3 : 2}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedId(todo.id);
                  }}
                />

                {/* Task title inside node */}
                <text
                  x={pos.x}
                  y={pos.y - 4}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#1e293b"
                  pointerEvents="none"
                >
                  {title.length > 12 ? `${title.slice(0, 11)}…` : title}
                </text>

              </g>
            );
          })}
          </svg>
        </div>

        {/* Selected node tooltip rendered in SVG coordinates for exact placement */}
        {selectedTodo && selectedStartDate && selectedId !== null && nodePositions.has(selectedId) && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgWidth}
            height={svgHeight}
          >
            {(() => {
              const node = nodePositions.get(selectedId)!;
              const tooltipW = 260;
              const tooltipH = 44;
              const gap = 6;
              const placeRight = node.x + nodeRadius + gap + tooltipW <= svgWidth;
              const x = placeRight ? node.x + nodeRadius + gap : node.x - nodeRadius - gap - tooltipW;
              const y = node.y - tooltipH / 2;

              return (
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={tooltipW}
                    height={tooltipH}
                    rx={6}
                    fill="rgba(15,23,42,0.92)"
                  />
                  <text x={x + 8} y={y + 16} fontSize="12" fill="#f8fafc" fontWeight="600">
                    {selectedTodo.title}
                  </text>
                  <text x={x + 8} y={y + 31} fontSize="11" fill="#f8fafc">
                    Earliest possible start: {formatDate(selectedStartDate)}
                  </text>
                </g>
              );
            })()}
          </svg>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>
          <span className="inline-block w-3 h-3 bg-orange-100 border-2 border-orange-500 rounded-full mr-2"></span>
          <strong>Critical Path:</strong> The longest chain of dependent tasks
        </p>
        <p className="mt-1">
          <strong>Arrow direction:</strong> Task A → Task B means <em>Task B depends on Task A</em>.
        </p>
      </div>

    </div>
  );
}
