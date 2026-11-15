import type { Game } from '../game/Game';
import type { HudSnapshot } from '../game/hud';
import { useState, type PointerEvent as RPointerEvent } from 'react';
import { storage } from '../platform/storage';
import { MainMenu, PauseButton, PauseMenu, WelcomeBack } from './Menus';
import { useHud } from './useHud';

/**
 * Staged HUD. Each panel only exists once its phase has unlocked it:
 *  phase 1–2 → objective card only
 *  phase 3   → + cash / resource counters, day counter
 *  phase 5   → + fire health, threat meter, morale
 *  wildlife  → + your health (outside the walls) and warmth (blizzards)
 *  events    → + one event card while an event is running
 */
export function Hud({ game }: { game: Game }) {
  const hud = useHud(game);
  const app = hud.app;
  if (app.mode === 'menu') {
    return (
      <div className="hud">
        <MainMenu game={game} app={app} />
      </div>
    );
  }
  return (
    <div className="hud">
      <div className="hud__top">
        <div className="hud__col">
          {hud.camp && <CampLevel c={hud.camp} />}
          {hud.resources && <ResourceBar r={hud.resources} morale={hud.morale} />}
          {hud.vitals && <Vitals v={hud.vitals} />}
        </div>
        <div className="hud__col hud__col--right">
          {app.mode === 'playing' && !hud.gameOver && <PauseButton game={game} />}
          {hud.day && (
            <span className={`daychip ${hud.day.night ? 'daychip--night' : ''}`}>
              <i /> Day {hud.day.day}
            </span>
          )}
          {hud.defense && <DefensePanel d={hud.defense} />}
        </div>
      </div>
      <ObjectiveCard hud={hud} />
      {hud.event && <EventCard e={hud.event} />}
      {hud.toast && (
        <div className={`toast toast--${hud.toast.kind}`} key={hud.toast.id}>
          <b>{hud.toast.title}</b>
          <span>{hud.toast.sub}</span>
        </div>
      )}
      {hud.dragHint && (
        <div className="draghint">
          <div className="draghint__hand" />
          <span>Drag to move</span>
        </div>
      )}
      {app.mode === 'paused' && <PauseMenu game={game} app={app} />}
      {app.mode === 'welcome' && app.welcome && <WelcomeBack game={game} app={app} />}
      {hud.gameOver && (
        <div className="gameover">
          <div className="gameover__card">
            <h2>The fire went out</h2>
            <p>The pack scattered the camp and took a quarter of your cash. Your buildings and survivors are safe.</p>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => game.relight()}>
              Relight the fire
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const OBJECTIVE_MIN_KEY = 'frostline.ui.objectiveMin';

/**
 * The current mission. Compact and tucked to the left under the HUD; the
 * button in its corner folds it into a one-line pill (remembered between
 * sessions), and tapping the pill opens it again.
 */
function ObjectiveCard({ hud }: { hud: HudSnapshot }) {
  const [min, setMin] = useState(() => storage.get(OBJECTIVE_MIN_KEY) === '1');
  const toggle = () => {
    setMin((v: boolean) => {
      storage.set(OBJECTIVE_MIN_KEY, v ? '0' : '1');
      return !v;
    });
  };
  const stop = (e: RPointerEvent) => e.stopPropagation();
  const pct = hud.progress ? Math.min(100, (hud.progress.value / hud.progress.total) * 100) : 0;
  if (min) {
    return (
      <button type="button" className="objective objective--min" key={`m-${hud.phase}-${hud.stepIndex}`} onPointerDown={stop} onClick={toggle} aria-label="Show mission">
        <span className="objective__ring" style={{ ['--p' as string]: `${pct}%` }} />
        <span className="objective__line">{hud.objective}</span>
        {hud.progress && (
          <b key={hud.progress.value} className="bump">
            {hud.progress.value}/{hud.progress.total}
          </b>
        )}
        <i className="objective__chev objective__chev--down" />
      </button>
    );
  }
  return (
    <div className="objective" key={`${hud.phase}-${hud.stepIndex}`}>
      <button type="button" className="objective__fold" onPointerDown={stop} onClick={toggle} aria-label="Hide mission">
        <i className="objective__chev" />
      </button>
      <div className="objective__phase">
        Phase {hud.phase} · {hud.phaseTitle}
        {hud.stepCount > 1 && (
          <span className="objective__dots">
            {Array.from({ length: hud.stepCount }, (_, i) => (
              <i key={i} className={i < hud.stepIndex ? 'done' : i === hud.stepIndex ? 'now' : ''} />
            ))}
          </span>
        )}
      </div>
      <div className="objective__text">{hud.objective}</div>
      {hud.progress && (
        <div className="objective__progress">
          <div className="objective__bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          <b key={hud.progress.value} className="bump">
            {hud.progress.value}/{hud.progress.total}
          </b>
        </div>
      )}
      {hud.hint && <div className="objective__hint">{hud.hint}</div>}
    </div>
  );
}

function CampLevel({ c }: { c: NonNullable<HudSnapshot['camp']> }) {
  return (
    <div className="camplevel">
      <span className="camplevel__badge" key={c.level}>
        {c.level}
      </span>
      <div className="camplevel__body">
        <span className="camplevel__label">Camp level</span>
        <div className="camplevel__bar">
          <span style={{ width: `${Math.min(100, (c.xp / c.next) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function ResourceBar({ r, morale }: { r: NonNullable<HudSnapshot['resources']>; morale: HudSnapshot['morale'] }) {
  return (
    <div className="resources">
      <span className="chip chip--coin">
        <i className="ico ico--coin" />
        <b key={r.coins} className="bump">
          ${r.coins}
        </b>
      </span>
      <span className="chip">
        <i className="ico ico--wood" />
        <b key={r.wood} className="bump">
          {r.wood}
        </b>
      </span>
      <span className="chip">
        <i className="ico ico--stone" />
        <b key={r.stone} className="bump">
          {r.stone}
        </b>
      </span>
      {morale && (
        <span className={`chip chip--morale ${morale.value < 35 ? 'chip--low' : ''}`}>
          <i className="ico ico--morale" />
          Morale {morale.value}
        </span>
      )}
    </div>
  );
}

function Vitals({ v }: { v: NonNullable<HudSnapshot['vitals']> }) {
  return (
    <div className="vitals">
      <div className="vitals__row">
        <span className="vitals__label">You</span>
        <div className="meter meter--hp">
          <span className={v.hp < 35 ? 'low' : ''} style={{ width: `${(v.hp / v.maxHp) * 100}%` }} />
        </div>
      </div>
      {v.warmth !== null && (
        <div className="vitals__row">
          <span className="vitals__label vitals__label--cold">Warm</span>
          <div className="meter meter--warm">
            <span className={v.warmth < 30 ? 'low' : ''} style={{ width: `${v.warmth}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function DefensePanel({ d }: { d: NonNullable<HudSnapshot['defense']> }) {
  const hp = (d.health / d.maxHealth) * 100;
  const threat =
    d.wolves > 0 ? `Wolf pack · ${d.wolves} left` : d.nextWaveIn !== null ? `Next pack in ${d.nextWaveIn}s` : 'All quiet';
  return (
    <div className={`defense ${d.wolves > 0 ? 'defense--alert' : ''}`}>
      <div className="defense__row">
        <span className="defense__label">Fire</span>
        <div className="meter">
          <span className={hp < 35 ? 'low' : ''} style={{ width: `${hp}%` }} />
        </div>
      </div>
      <div className="defense__threat">{threat}</div>
    </div>
  );
}

function EventCard({ e }: { e: NonNullable<HudSnapshot['event']> }) {
  return (
    <div className={`event event--${e.kind}`} key={e.kind}>
      <div className="event__head">
        <span className="event__icon" />
        <b>{e.title}</b>
        <span className="event__time">{e.remaining}s</span>
      </div>
      <div className="event__text">{e.text}</div>
      <div className="event__bar">
        <span style={{ width: `${e.ratio * 100}%` }} />
      </div>
    </div>
  );
}
