/**
 * CPM-style scheduling on a task DAG (activity-on-node).
 *
 * **Forward pass:** ES, EF with duration (default 1 day) and optional due-date finish floor.
 * **Backward pass:** LF = project end for sinks, else min(LS of successors); LS = LF − duration.
 * **Total float / slack:** LF − EF. `slackCriticalNodes` = slack === 0. `criticalPathNodes` adds the **driver
 * spine** (walk back from every task whose EF equals project end via forward driver predecessors) for a full orange graph chain.
 *
 * `estimatedDurationDays` is optional and not persisted in DB/UI yet; see README (Solution → Algorithms).
 */
export interface SchedulableTodo {
  id: number;
  title: string;
  dueDate?: string | null;
  /** Optional; when absent, duration is treated as 1 day. */
  estimatedDurationDays?: number | null;
  dependsOn: Array<{ dependencyId: number }>;
}

export interface ScheduleResult {
  earliestStartDays: Map<number, number>;
  earliestFinishDays: Map<number, number>;
  latestStartDays: Map<number, number>;
  latestFinishDays: Map<number, number>;
  slackDays: Map<number, number>;
  earliestStartDates: Map<number, Date>;
  /** Strict CPM: total float === 0. */
  slackCriticalNodes: Set<number>;
  /**
   * Graph highlight: zero-slack tasks plus the driver spine (walk backward from a max-EF task
   * following the dependency that set each task’s earliest start). Shows a full orange chain
   * even when upstream tasks have float (e.g. X → Y with only Y slack-critical).
   */
  criticalPathNodes: Set<number>;
  nodesByColumn: Map<number, number[]>;
}

export function computeSchedule(
  todos: SchedulableTodo[],
  now: Date = new Date()
): ScheduleResult {
  const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;

  const dueOffsetById = new Map<number, number>();
  const durationDaysById = new Map<number, number>();
  todos.forEach((todo) => {
    if (!todo.dueDate) {
      dueOffsetById.set(todo.id, 0);
    } else {
      const d = new Date(todo.dueDate);
      if (Number.isNaN(d.getTime())) {
        dueOffsetById.set(todo.id, 0);
      } else {
        const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.round((localMidnight.getTime() - baseDate.getTime()) / msPerDay);
        dueOffsetById.set(todo.id, Math.max(0, diffDays));
      }
    }
    const rawDuration = todo.estimatedDurationDays;
    const normalizedDuration =
      typeof rawDuration === 'number' && Number.isFinite(rawDuration)
        ? Math.max(1, Math.ceil(rawDuration))
        : 1;
    durationDaysById.set(todo.id, normalizedDuration);
  });

  const adj = new Map<number, number[]>();
  const succ = new Map<number, number[]>();
  const inDegree = new Map<number, number>();
  const depsByNode = new Map<number, number[]>();

  todos.forEach((todo) => {
    adj.set(todo.id, []);
    succ.set(todo.id, []);
    inDegree.set(todo.id, 0);
    depsByNode.set(todo.id, []);
  });

  todos.forEach((todo) => {
    todo.dependsOn.forEach((dep) => {
      adj.get(dep.dependencyId)?.push(todo.id);
      succ.get(dep.dependencyId)?.push(todo.id);
      inDegree.set(todo.id, (inDegree.get(todo.id) || 0) + 1);
      depsByNode.get(todo.id)?.push(dep.dependencyId);
    });
  });

  const inDegreeWorking = new Map(inDegree);
  const queue = Array.from(inDegreeWorking.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([id]) => id);

  const topoOrder: number[] = [];
  const earliestStartDays = new Map<number, number>();
  const earliestFinishDays = new Map<number, number>();
  /** Predecessor on the forward pass that fixed ES (max predecessor EF); roots → null. */
  const forwardDriverPredecessor = new Map<number, number | null>();

  queue.forEach((id) => {
    earliestStartDays.set(id, 0);
    earliestFinishDays.set(
      id,
      Math.max(durationDaysById.get(id) || 1, dueOffsetById.get(id) || 0)
    );
    forwardDriverPredecessor.set(id, null);
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);
    adj.get(current)?.forEach((neighbor) => {
      const deps = depsByNode.get(neighbor) || [];
      let bestStart = -1;
      let bestDep: number | null = null;

      deps.forEach((depId) => {
        const depEarliestFinish = earliestFinishDays.get(depId) || 0;
        if (depEarliestFinish > bestStart) {
          bestStart = depEarliestFinish;
          bestDep = depId;
        }
      });
      if (bestStart < 0) bestStart = 0;

      const existing = earliestStartDays.get(neighbor);
      if (existing === undefined || bestStart > existing) {
        earliestStartDays.set(neighbor, bestStart);
        earliestFinishDays.set(
          neighbor,
          Math.max(
            bestStart + (durationDaysById.get(neighbor) || 1),
            dueOffsetById.get(neighbor) || 0
          )
        );
        forwardDriverPredecessor.set(neighbor, bestDep);
      }

      inDegreeWorking.set(neighbor, (inDegreeWorking.get(neighbor) || 0) - 1);
      if (inDegreeWorking.get(neighbor) === 0) queue.push(neighbor);
    });
  }

  todos.forEach((todo) => {
    if (!earliestStartDays.has(todo.id)) {
      earliestStartDays.set(todo.id, 0);
      earliestFinishDays.set(
        todo.id,
        Math.max(durationDaysById.get(todo.id) || 1, dueOffsetById.get(todo.id) || 0)
      );
      forwardDriverPredecessor.set(todo.id, null);
    }
  });

  const projectEnd = Array.from(earliestFinishDays.values()).reduce((m, v) => Math.max(m, v), 0);

  const latestFinishDays = new Map<number, number>();
  const latestStartDays = new Map<number, number>();
  const slackDays = new Map<number, number>();

  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i]!;
    const duration = durationDaysById.get(id) || 1;
    const successors = succ.get(id) || [];

    let lf: number;
    if (successors.length === 0) {
      lf = projectEnd;
    } else {
      let minLs = Infinity;
      for (const j of successors) {
        const lsJ = latestStartDays.get(j);
        if (lsJ !== undefined && lsJ < minLs) minLs = lsJ;
      }
      lf = minLs === Infinity ? projectEnd : minLs;
    }

    latestFinishDays.set(id, lf);
    const ls = lf - duration;
    latestStartDays.set(id, ls);

    const ef = earliestFinishDays.get(id) || 0;
    slackDays.set(id, lf - ef);
  }

  const topoSet = new Set(topoOrder);
  todos.forEach((todo) => {
    if (!topoSet.has(todo.id)) {
      const duration = durationDaysById.get(todo.id) || 1;
      const ef = earliestFinishDays.get(todo.id) || 0;
      latestFinishDays.set(todo.id, projectEnd);
      latestStartDays.set(todo.id, projectEnd - duration);
      slackDays.set(todo.id, projectEnd - ef);
    }
  });

  const slackCriticalNodes = new Set<number>();
  todos.forEach((todo) => {
    if ((slackDays.get(todo.id) || 0) === 0) {
      slackCriticalNodes.add(todo.id);
    }
  });

  const driverSpine = new Set<number>();
  for (const todo of todos) {
    const ef = earliestFinishDays.get(todo.id) || 0;
    if (ef !== projectEnd) continue;
    let cur: number | null = todo.id;
    while (cur !== null && !driverSpine.has(cur)) {
      driverSpine.add(cur);
      cur = forwardDriverPredecessor.get(cur) ?? null;
    }
  }

  const criticalPathNodes = new Set<number>();
  slackCriticalNodes.forEach((id) => criticalPathNodes.add(id));
  driverSpine.forEach((id) => criticalPathNodes.add(id));

  const earliestStartDates = new Map<number, Date>();
  const nodesByColumn = new Map<number, number[]>();
  todos.forEach((todo) => {
    const offset = earliestStartDays.get(todo.id) || 0;
    const startDate = new Date(baseDate);
    startDate.setDate(baseDate.getDate() + offset);
    earliestStartDates.set(todo.id, startDate);

    if (!nodesByColumn.has(offset)) nodesByColumn.set(offset, []);
    nodesByColumn.get(offset)?.push(todo.id);
  });

  return {
    earliestStartDays,
    earliestFinishDays,
    latestStartDays,
    latestFinishDays,
    slackDays,
    earliestStartDates,
    slackCriticalNodes,
    criticalPathNodes,
    nodesByColumn,
  };
}
