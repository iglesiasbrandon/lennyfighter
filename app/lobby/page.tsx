import { NavBar } from '../components/NavBar';
import { LobbyClient } from '../components/LobbyClient';

export const metadata = { title: 'Lobby — LennyFighter' };

export default function LobbyPage() {
  return (
    <>
      <NavBar />
      <LobbyClient />
    </>
  );
}
