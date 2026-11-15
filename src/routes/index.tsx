import { createFileRoute } from '@tanstack/react-router';
import { GameView } from '../ui/GameView';

export const Route = createFileRoute('/')({
  component: GameView,
});
