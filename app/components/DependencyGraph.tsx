'use client';

import { useMemo, useState } from 'react';
import { computeSchedule } from '@/lib/scheduling';
import type { TodoWithDeps } from '@/lib/types/todo';

interface DependencyGraphProps {
  todos: TodoWithDeps[];
}

export function DependencyGraph({ todos }: DependencyGraphProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { earliestStartDates, criticalPathNodes, nodesByColumn } = useMemo(
    () => computeSchedule(todos),
    [todos]
  );

  if (todos.length === 0) return null;

  const columnWidth = 200;
  const rowHeight = 100;
  const nodeRadius = 40;
  const sortedColumns = Array.from(nodesByColumn.keys()).sort((a, b) => a - b);
  const visualColumnIndex = new Map<number, number>();
  sortedColumns.forEach((col, idx) => visualColumnIndex.set(col, idx));
  // Use a single global row system so node Y positions are consistent across columns.
  const orderedIds = [...todos]
    .sort((a, b) => a.id - b.id)
    .map((t) => t.id);
  const rowIndexById = new Map<number, number>();
  orderedIds.forEach((id, idx) => rowIndexById.set(id, idx));
  const maxRows = Math.max(1, orderedIds.length);
  // Use compressed visual columns so sparse day offsets don't create absurdly long edges.
  const svgWidth = Math.max(900, Math.max(1, sortedColumns.length) * columnWidth + 200);
  const svgHeight = Math.max(600, maxRows * rowHeight + 200);

  const nodePositions = new Map<number, { x: number; y: number }>();
  nodesByColumn.forEach((nodeIds, column) => {
    nodeIds.forEach((nodeId) => {
      const x = (visualColumnIndex.get(column) ?? 0) * columnWidth + 150;
      const rowIndex = rowIndexById.get(nodeId) ?? 0;
      const y = 80 + rowIndex * rowHeight;
      nodePositions.set(nodeId, { x, y });
    });
  });

  const selectedTodo = selectedId === null ? null : todos.find((t) => t.id === selectedId) || null;
  const selectedStartDate = selectedId === null ? null : earliestStartDates.get(selectedId) || null;

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

      <div className="h-80 w-full overflow-auto border border-gray-200 rounded-lg relative bg-white">
        <div className="inline-block" style={{ width: svgWidth }}>
          <svg width={svgWidth} height={svgHeight} className="block">
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

            {todos.flatMap((todo) =>
              todo.dependsOn.map((dep) => {
                const from = nodePositions.get(dep.dependencyId);
                const to = nodePositions.get(todo.id);
                if (!from || !to) return null;

                const isOnCriticalPath =
                  criticalPathNodes.has(todo.id) && criticalPathNodes.has(dep.dependencyId);
                const { x1, y1, x2, y2 } = shortenLineToCircle(from, to, nodeRadius);

                return (
                  <line
                    key={`edge-${dep.dependencyId}-${todo.id}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isOnCriticalPath ? '#f97316' : '#cbd5e1'}
                    strokeWidth={isOnCriticalPath ? 3 : 2}
                    markerEnd={isOnCriticalPath ? 'url(#arrowOrange)' : 'url(#arrowGray)'}
                  />
                );
              })
            )}

            {todos.map((todo) => {
              const pos = nodePositions.get(todo.id);
              if (!pos) return null;

              const isOnCriticalPath = criticalPathNodes.has(todo.id);
              const title =
                todo.title && todo.title.trim().length > 0
                  ? todo.title
                  : `Untitled task (#${todo.id})`;

              return (
                <g key={`node-${todo.id}`}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={nodeRadius}
                    fill={isOnCriticalPath ? '#fed7aa' : '#e2e8f0'}
                    stroke={isOnCriticalPath ? '#f97316' : '#94a3b8'}
                    strokeWidth={isOnCriticalPath ? 3 : 2}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(todo.id)}
                  />
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

            {selectedTodo && selectedStartDate && selectedId !== null && nodePositions.has(selectedId) && (() => {
              const node = nodePositions.get(selectedId)!;
              const tooltipW = 280;
              const hasDue = selectedTodo.dueDate != null;
              const tooltipH = hasDue ? 58 : 44;
              const gap = 6;
              const placeRight = node.x + nodeRadius + gap + tooltipW <= svgWidth;
              const x = placeRight ? node.x + nodeRadius + gap : node.x - nodeRadius - gap - tooltipW;
              const y = node.y - tooltipH / 2;
              const dueLine = hasDue
                ? `Due: ${formatDate(new Date(selectedTodo.dueDate!))}`
                : null;

              return (
                <g pointerEvents="none">
                  <rect x={x} y={y} width={tooltipW} height={tooltipH} rx={6} fill="rgba(15,23,42,0.92)" />
                  <text x={x + 8} y={y + 16} fontSize="12" fill="#f8fafc" fontWeight="600">
                    {selectedTodo.title}
                  </text>
                  <text x={x + 8} y={y + 31} fontSize="11" fill="#f8fafc">
                    Earliest possible start: {formatDate(selectedStartDate)}
                  </text>
                  {dueLine && (
                    <text x={x + 8} y={y + 46} fontSize="11" fill="#f8fafc">
                      {dueLine}
                    </text>
                  )}
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600 space-y-1">
        <p>
          <span className="inline-block w-3 h-3 bg-orange-100 border-2 border-orange-500 rounded-full mr-2 align-middle"></span>
          <strong>Orange:</strong> if these run late, the finish date moves. (Each task counts as one day; due dates apply.)
        </p>
        <p>
          <strong>Arrows:</strong> A → B means B depends on A.
        </p>
      </div>
    </div>
  );
}
