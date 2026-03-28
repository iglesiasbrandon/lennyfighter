import { NavBar } from '../components/NavBar';
import { LeaderboardClient } from './LeaderboardClient';

export const metadata = { title: 'Leaderboard — LennyFighter' };

export default function LeaderboardPage() {
  return (
    <>
      <NavBar />
      <LeaderboardClient />
    </>
  );
}
