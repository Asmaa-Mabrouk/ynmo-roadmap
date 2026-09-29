/**
 * @module main
 * Application entry point. Imports every module for its side effects in the SAME order the app used
 * when it was one concatenated script (top-level listeners/registrations depend on it), then starts the app.
 */
import { S } from './core/state.js';
import * as model from './core/model.js';
import { commit, removeItem } from './core/saving.js';
import { render } from './ui/gantt-render.js';
import { allRoadmaps } from './pages/roadmaps.js';
import './core/saving.js';
import './ui/people-picker.js';
import './ui/drag.js';
import './ui/gantt-render.js';
import './ui/editing.js';
import './ui/export.js';
import './core/supabase.js';
import './ui/avatars.js';
import './auth/gate.js';
import './auth/profile.js';
import './core/shared.js';
import './pages/roadmaps.js';
import './pages/ideas.js';
import './pages/resources.js';
import './pages/vacations.js';
import './pages/log.js';
import './app/shell.js';
import './features/safety.js';
import './features/presence.js';
import './features/dependencies.js';
import './features/log-tools.js';
import './features/capacity.js';
import './features/baselines.js';
import './features/sharing.js';
import './app/extras-wiring.js';
import './ui/dropdowns.js';
import './ui/loading.js';
import { init } from './pages/ideas-columns.js';

/** Handles for automated tests and console debugging (the app itself never reads window.__ynmo). */
window.__ynmo = {
  S, state: model.state, items: model.items, directory: model.directory, allRoadmaps, commit, removeItem, render,
  get NDAYS() { return model.NDAYS; },
  get vacs() { return S.vacs; },
};

init();
