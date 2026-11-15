import { useEffect, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { installOption, onInstallChange, promptInstall } from '../platform/install';
import type { AppState, Game } from '../game/Game';

/** Taps on menus must not also start the movement joystick underneath. */
const stop = (e: RPointerEvent) => e.stopPropagation();

function Overlay({ children, dim = true }: { children: ReactNode; dim?: boolean }) {
  return (
    <div className={`menu ${dim ? 'menu--dim' : ''}`} onPointerDown={stop}>
      {children}
    </div>
  );
}

export function MainMenu({ game, app }: { game: Game; app: AppState }) {
  const [confirm, setConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  return (
    <Overlay>
      <div className="menu__title">
        <span className="menu__flake">❄</span>
        <h1>Frostline</h1>
        <p>Light the fire. Feed the survivors. Hold the line.</p>
      </div>
      <div className="menu__buttons">
        {app.hasSave && !confirm && (
          <button type="button" className="btn btn--primary" onClick={() => game.play()}>
            Continue
          </button>
        )}
        {!app.hasSave && (
          <button type="button" className="btn btn--primary" onClick={() => game.newGame()}>
            Play
          </button>
        )}
        {app.hasSave && !confirm && (
          <button type="button" className="btn" onClick={() => setConfirm(true)}>
            New game
          </button>
        )}
        {confirm && (
          <div className="menu__confirm">
            <p>Start over? Your camp will be lost.</p>
            <div className="menu__row">
              <button type="button" className="btn btn--danger" onClick={() => game.newGame()}>
                Start over
              </button>
              <button type="button" className="btn" onClick={() => setConfirm(false)}>
                Keep my camp
              </button>
            </div>
          </div>
        )}
        <button type="button" className="btn btn--ghost" onClick={() => setShowSettings((v: boolean) => !v)}>
          Settings
        </button>
        {showSettings && <SettingsList game={game} app={app} />}
      </div>
      <InstallHint />
    </Overlay>
  );
}

/** "Install app" (Android/Chrome) or Add-to-Home-Screen instructions (iPhone Safari). */
function InstallHint() {
  const [option, setOption] = useState(installOption);
  const [open, setOpen] = useState(false);
  useEffect(() => onInstallChange(() => setOption(installOption())), []);
  if (option === 'prompt') {
    return (
      <button type="button" className="install" onClick={() => void promptInstall()}>
        <i className="install__icon" /> Install the app
      </button>
    );
  }
  if (option !== 'ios') return null;
  return (
    <div className="install install--ios">
      <button type="button" className="install__toggle" onClick={() => setOpen((v: boolean) => !v)}>
        <i className="install__icon" /> Play it as an app
      </button>
      {open && (
        <ol>
          <li>
            Tap <b>Share</b> <span className="install__share" /> at the bottom of Safari
          </li>
          <li>
            Choose <b>Add to Home Screen</b>
          </li>
          <li>Open Frostline from its icon: full screen, works offline</li>
        </ol>
      )}
    </div>
  );
}

export function PauseMenu({ game, app }: { game: Game; app: AppState }) {
  return (
    <Overlay>
      <div className="menu__card">
        <h2>Paused</h2>
        <button type="button" className="btn btn--primary" onClick={() => game.resume()}>
          Resume
        </button>
        <SettingsList game={game} app={app} />
        <button type="button" className="btn btn--ghost" onClick={() => game.toMenu()}>
          Main menu
        </button>
        <p className="menu__note">Your camp saves automatically.</p>
      </div>
    </Overlay>
  );
}

export function WelcomeBack({ game, app }: { game: Game; app: AppState }) {
  const w = app.welcome!;
  return (
    <Overlay>
      <div className="menu__card menu__card--welcome">
        <h2>Welcome back!</h2>
        <p>
          You were away for <b>{w.away}</b>. Your survivors kept the camp running.
        </p>
        <div className="menu__reward">
          <i className="coin" />+${w.amount}
        </div>
        <button type="button" className="btn btn--primary" onClick={() => game.collectWelcome()}>
          Collect
        </button>
      </div>
    </Overlay>
  );
}

export function PauseButton({ game }: { game: Game }) {
  return (
    <button type="button" className="pausebtn" aria-label="Pause" onPointerDown={stop} onClick={() => game.pause()}>
      <i />
      <i />
    </button>
  );
}

function SettingsList({ game, app }: { game: Game; app: AppState }) {
  const s = app.settings;
  const row = (key: keyof AppState['settings'], label: string) => (
    <button type="button" className={`toggle ${s[key] ? 'toggle--on' : ''}`} onClick={() => game.setSetting(key, !s[key])}>
      <span>{label}</span>
      <b>{s[key] ? 'On' : 'Off'}</b>
    </button>
  );
  return (
    <div className="menu__settings">
      {row('sound', 'Sound effects')}
      {row('music', 'Music')}
      {row('haptics', 'Vibration')}
    </div>
  );
}
