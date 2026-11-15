import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/Game';
import { Hud } from './Hud';

/** Mounts the canvas game once and layers the staged HUD on top. */
export function GameView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const g = new Game(canvas, container);
    g.start();
    setGame(g);
    if (import.meta.env.DEV) (window as unknown as { game?: Game }).game = g;
    return () => {
      g.dispose();
      setGame(null);
    };
  }, []);

  return (
    <div className="stage" ref={containerRef}>
      <canvas className="stage__canvas" ref={canvasRef} />
      {game && <Hud game={game} />}
    </div>
  );
}
