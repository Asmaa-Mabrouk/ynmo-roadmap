/**
 * @module core/state
 * The single mutable application state shared by all modules.
 * ES module imports are read-only bindings, so every value that is REASSIGNED from more than one module lives on this object.
 * Read/write as `S.name`. Nothing else in the app owns cross-module mutable state.
 */
export const S = {
  inflight: 0,
  readonly: false,
  needRender: false,
  over: {},
  picker: null,
  offOpen: false,
  dragging: false,
  me: null,
  drawerOpen: false,
  members: [],
  vacNotice: null,
  db: null,
  wantRm: null,
  daysoff: {},
  extras: {},
  roadmaps: {},
  ideas: {},
  vacs: {},
  logs: [],
  logsMore: false,
  presCh: null,
  pres: {},
  logsBusy: false,
  logsOld: [],
  SHARE: false,
  ghostOn: false,
  undoStack: [],
  baselines: {},
  shares: {},
  sprints: {},
  sitems: {},
  reports: {},
  setup: {},
};
