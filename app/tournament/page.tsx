import { NavBar } from '../components/NavBar';
import { TournamentClient } from '../components/TournamentClient';

export const metadata = { title: 'Tournament — LennyFighter' };

export default function TournamentPage() {
  return (
    <>
      <NavBar />
      <TournamentClient />
    </>
  );
}
