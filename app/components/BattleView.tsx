'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { calculateDamage, getRandomTrivia, calculateSelfDamage, applyItemStats } from '../../lib/gameLogic';
import { ItemSelector } from './ItemSelector';
import { BattleArena } from './BattleArena';
import { consumeItem } from '../lib/api';
import { FIGHTERS } from '../../lib/fighterData';
import type { Fighter, Move, TriviaQuestion, GameItem, InventoryEntry } from '../../lib/types';

interface BattleViewProps {
  matchData: {
    matchId: string;
    player1: { id: string; fighter: Fighter };
    player2: { id: string; fighter: Fighter };
  };
  onMatchEnd: (winnerId: string, reason: string) => void;
  inventory: InventoryEntry[];
  restoredGameState?: Record<string, unknown> | null;
  onStateChange?: (gameState: Record<string, unknown>) => void;
}

interface GameState {
  p1Hp: number;
  p2Hp: number;
  p1MaxHp: number;
  p2MaxHp: number;
  currentTurn: 'player1' | 'player2';
  turnNumber: number;
  trivia: TriviaQuestion | null;
  selectedMove: number;
  log: string[];
  status: 'item_select' | 'active' | 'finished';
  // Item state
  selectedItem: GameItem | null;
  itemUsed: boolean;
  itemConsumed: boolean;
  // Passive trackers
  pivotPotionActive: boolean;
  bridgeRoundActive: boolean;
  bridgeRoundTriggered: boolean;
  scopeCreepActive: boolean;
  // Active-use effect pending for next attack
  doubleDamageNext: boolean;
  nullifyTypeNext: boolean;
  stolenMove: Move | null;
  // The Memo
  revealedMoves: Array<{ name: string; power: number; type: string }> | null;
  // Hook Model
  eliminatedOption: number | null;
  // Track used trivia indices to avoid repeats
  usedTriviaIndices: Record<string, number[]>;
}

interface DamagePopup {
  id: number;
  x: string;
  y: string;
  value: number;
  correct: boolean;
}

export function BattleView({ matchData, onMatchEnd, inventory, restoredGameState, onStateChange }: BattleViewProps) {
  const { player1, player2 } = matchData;
  const popupId = useRef(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Apply pre-match stat modifications based on selected item
  const applyPreMatchStats = useCallback((fighter: Fighter, item: GameItem | null): Fighter => {
    const newStats = applyItemStats(fighter, item);
    if (!newStats) return fighter;
    return { ...fighter, stats: { ...fighter.stats, atk: newStats.atk, def: newStats.def } };
  }, []);

  const [gameState, setGameState] = useState<GameState>(() => {
    // Restore from saved state if available (page refresh during bot match)
    if (restoredGameState) {
      return restoredGameState as unknown as GameState;
    }
    const usedTriviaIndices: Record<string, number[]> = {};
    const initialTrivia = getRandomTrivia(player2.fighter, usedTriviaIndices, FIGHTERS);
    return {
    p1Hp: player1.fighter.stats.hp,
    p2Hp: player2.fighter.stats.hp,
    p1MaxHp: player1.fighter.stats.hp,
    p2MaxHp: player2.fighter.stats.hp,
    currentTurn: Math.random() < 0.5 ? 'player1' : 'player2',
    turnNumber: 1,
    trivia: initialTrivia,
    selectedMove: 0,
    log: ['Battle Start!'],
    status: inventory.length > 0 ? 'item_select' : 'active',
    selectedItem: null,
    itemUsed: false,
    itemConsumed: false,
    pivotPotionActive: false,
    bridgeRoundActive: false,
    bridgeRoundTriggered: false,
    scopeCreepActive: false,
    doubleDamageNext: false,
    nullifyTypeNext: false,
    stolenMove: null,
    revealedMoves: null,
    eliminatedOption: null,
    usedTriviaIndices,
  }; });

  // Save game state to sessionStorage on every change (for page refresh restoration)
  useEffect(() => {
    if (onStateChange && gameState.status !== 'finished') {
      onStateChange(gameState as unknown as Record<string, unknown>);
    }
  }, [gameState, onStateChange]);

  // The effective fighters (after pre-match item boosts)
  const [effectiveP1Fighter, setEffectiveP1Fighter] = useState(player1.fighter);

  const [p1Anim, setP1Anim] = useState('');
  const [p2Anim, setP2Anim] = useState('');
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [itemToast, setItemToast] = useState<{ name: string; description: string } | null>(null);
  const [showFight, setShowFight] = useState(false);
  const [showKO, setShowKO] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<{ selectedAnswer: string; correctAnswer: string; isCorrect: boolean } | null>(null);

  // Show item activation toast
  const showItemToast = useCallback((name: string, description: string) => {
    setItemToast({ name, description });
    safeTimeout(() => setItemToast(null), 2500);
  }, [safeTimeout]);

  // Handle item selection from the ItemSelector
  const handleItemSelect = useCallback((itemId: string | null) => {
    if (!itemId) {
      // No item selected, start battle
      setGameState(prev => ({ ...prev, status: 'active' }));
      return;
    }

    const entry = inventory.find(e => e.item.id === itemId);
    if (!entry) {
      setGameState(prev => ({ ...prev, status: 'active' }));
      return;
    }

    const item = entry.item;

    // Apply pre-match effects
    const modifiedFighter = applyPreMatchStats(player1.fighter, item);
    setEffectiveP1Fighter(modifiedFighter);

    // Determine first turn (First-Mover Advantage)
    const goFirst = item.effect === 'go_first';

    // Set up passive items
    const pivotPotionActive = item.effect === 'block_self_damage';
    const bridgeRoundActive = item.effect === 'revive_20pct';

    // The Memo: reveal opponent moves
    const revealedMoves = item.effect === 'reveal_move'
      ? player2.fighter.moves.map(m => ({ name: m.name, power: m.power, type: m.type }))
      : null;

    // Hook Model: eliminate a wrong answer from the first trivia
    let eliminatedOption: number | null = null;
    if (item.effect === 'eliminate_wrong_answer' && gameState.trivia) {
      const correctAnswer = gameState.trivia.answer;
      const wrongIndices = gameState.trivia.options
        .map((opt, i) => ({ opt, i }))
        .filter(({ opt }) => opt !== correctAnswer)
        .map(({ i }) => i);
      if (wrongIndices.length > 0) {
        eliminatedOption = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
      }
    }

    setGameState(prev => ({
      ...prev,
      status: 'active',
      selectedItem: item,
      p1Hp: modifiedFighter.stats.hp,
      p1MaxHp: modifiedFighter.stats.hp,
      currentTurn: goFirst ? 'player1' : prev.currentTurn,
      pivotPotionActive,
      bridgeRoundActive,
      revealedMoves,
      eliminatedOption,
    }));

    // Show toast for pre-match items
    if (item.timing === 'pre_match') {
      showItemToast(item.name, item.description);
    }
  }, [inventory, player1.fighter, player2.fighter, applyPreMatchStats, showItemToast, gameState.trivia]);

  const calcDamage = useCallback((move: Move, correct: boolean, attacker: Fighter, defender: Fighter, nullifyType: boolean): number => {
    return calculateDamage(
      move,
      correct,
      { fighter: { stats: attacker.stats, type: attacker.type } },
      { fighter: { stats: defender.stats, type: defender.type } },
      { nullifyType },
    );
  }, []);

  const showDamage = useCallback((side: 'player' | 'opponent', value: number, correct: boolean) => {
    const id = ++popupId.current;
    const x = side === 'opponent' ? '75%' : '25%';
    const y = side === 'opponent' ? '30%' : '50%';
    setDamagePopups(prev => [...prev, { id, x, y, value, correct }]);
    safeTimeout(() => {
      setDamagePopups(prev => prev.filter(p => p.id !== id));
    }, 1000);
  }, [safeTimeout]);

  // Consume item via API (fire-and-forget, only once)
  const consumeSelectedItem = useCallback((item: GameItem) => {
    setGameState(prev => {
      if (prev.itemConsumed) return prev;
      // Fire the API call
      consumeItem(item.id).catch(() => {
        // Silent fail -- item was used in-game regardless
      });
      return { ...prev, itemConsumed: true };
    });
  }, []);

  // Handle active-use item button click
  const handleUseItem = useCallback(() => {
    setGameState(prev => {
      if (prev.itemUsed || !prev.selectedItem) return prev;
      const item = prev.selectedItem;

      let updates: Partial<GameState> = { itemUsed: true };

      switch (item.effect) {
        case 'heal_30pct': {
          const healAmount = Math.round(prev.p1MaxHp * 0.3);
          const newHp = Math.min(prev.p1MaxHp, prev.p1Hp + healAmount);
          updates = { ...updates, p1Hp: newHp };
          break;
        }
        case 'double_damage': {
          updates = { ...updates, doubleDamageNext: true };
          break;
        }
        case 'nullify_type': {
          updates = { ...updates, nullifyTypeNext: true };
          break;
        }
        case 'steal_move': {
          // Steal opponent's highest-power move
          const bestMove = [...player2.fighter.moves].sort((a, b) => b.power - a.power)[0];
          if (bestMove) {
            updates = { ...updates, stolenMove: bestMove };
          }
          break;
        }
        case 'invert_answer': {
          updates = { ...updates, scopeCreepActive: true };
          break;
        }
      }

      return { ...prev, ...updates };
    });
    // Show toast
    setGameState(prev => {
      if (prev.selectedItem) {
        showItemToast(prev.selectedItem.name, prev.selectedItem.description);
        consumeSelectedItem(prev.selectedItem);
      }
      return prev;
    });
  }, [player2.fighter.moves, showItemToast, consumeSelectedItem]);

  const canUseActiveItem = gameState.selectedItem
    && gameState.selectedItem.timing === 'active_use'
    && !gameState.itemUsed
    && gameState.status === 'active'
    && gameState.currentTurn === 'player1';

  const handleAnswer = useCallback((answer: string) => {
    if (gameState.status !== 'active' || gameState.currentTurn !== 'player1') return;

    const correct = answer === gameState.trivia?.answer;

    // Set answer feedback for BattleArena to display
    const correctAnswer = gameState.trivia?.answer ?? '';
    setAnswerFeedback({ selectedAnswer: answer, correctAnswer, isCorrect: correct });

    // Determine the move to use
    let move: Move;
    let usingStolenMove = false;
    if (gameState.stolenMove) {
      move = gameState.stolenMove;
      usingStolenMove = true;
    } else {
      move = effectiveP1Fighter.moves[gameState.selectedMove];
    }

    // Apply double damage
    const useNullifyType = gameState.nullifyTypeNext;
    let damage = calcDamage(move, correct, effectiveP1Fighter, player2.fighter, useNullifyType);
    if (gameState.doubleDamageNext) {
      damage = damage * 2;
    }

    // Self-damage for wrong answer
    let selfDamage = calculateSelfDamage(move.power, correct);

    // Pivot Potion: block self-damage once
    let pivotPotionActive = gameState.pivotPotionActive;
    if (selfDamage > 0 && pivotPotionActive) {
      selfDamage = 0;
      pivotPotionActive = false;
      showItemToast('Pivot Potion', 'Blocked self-damage from wrong answer!');
      if (gameState.selectedItem) {
        consumeSelectedItem(gameState.selectedItem);
      }
    }

    const newP2Hp = Math.max(0, gameState.p2Hp - damage);
    let newP1Hp = Math.max(0, gameState.p1Hp - selfDamage);

    // Animate
    setP1Anim('attacking');
    safeTimeout(() => {
      setP1Anim('');
      setP2Anim('hit');
      showDamage('opponent', damage, correct);
      safeTimeout(() => setP2Anim(''), 300);
    }, 400);

    const moveName = usingStolenMove ? `${move.name} (STOLEN)` : move.name;
    const logEntry = `Turn ${gameState.turnNumber}: ${player1.fighter.name} used ${moveName}! ${correct ? 'Correct!' : 'Wrong!'} ${damage} dmg${selfDamage ? ` (${selfDamage} self-dmg)` : ''}`;

    // Clear one-shot active effects
    const doubleDamageNext = false;
    const nullifyTypeNext = false;
    const stolenMove = null;

    // Check for KO
    if (newP2Hp <= 0 || newP1Hp <= 0) {
      let winnerId: string;
      let reason: string;

      if (newP1Hp <= 0 && gameState.bridgeRoundActive && !gameState.bridgeRoundTriggered) {
        // Bridge Round: revive with 20% HP
        newP1Hp = Math.round(gameState.p1MaxHp * 0.2);
        showItemToast('Bridge Round', 'Revived with 20% HP!');
        if (gameState.selectedItem) {
          consumeSelectedItem(gameState.selectedItem);
        }
        // Continue the match -- fall through to bot turn
        setGameState(prev => ({
          ...prev,
          p1Hp: newP1Hp,
          p2Hp: newP2Hp,
          currentTurn: 'player2',
          trivia: null,
          log: [...prev.log, logEntry],
          pivotPotionActive,
          doubleDamageNext,
          nullifyTypeNext,
          stolenMove,
          bridgeRoundTriggered: true,
          eliminatedOption: null,
        }));
        // Schedule bot turn
        scheduleBotTurn(newP1Hp, newP2Hp, pivotPotionActive, true);
        return;
      }

      if (newP2Hp <= 0) {
        winnerId = player1.id;
        reason = 'ko';
      } else {
        winnerId = player2.id;
        reason = 'self_ko';
      }

      setGameState(prev => ({
        ...prev,
        p1Hp: newP1Hp,
        p2Hp: newP2Hp,
        status: 'finished',
        trivia: null,
        log: [...prev.log, logEntry, `${winnerId === player1.id ? player1.fighter.name : player2.fighter.name} wins!`],
        doubleDamageNext,
        nullifyTypeNext,
        stolenMove,
        eliminatedOption: null,
      }));
      safeTimeout(() => onMatchEnd(winnerId, reason), 2500);
      return;
    }

    // Transition to bot turn
    setGameState(prev => ({
      ...prev,
      p1Hp: newP1Hp,
      p2Hp: newP2Hp,
      currentTurn: 'player2',
      trivia: null,
      log: [...prev.log, logEntry],
      pivotPotionActive,
      doubleDamageNext,
      nullifyTypeNext,
      stolenMove,
      eliminatedOption: null,
    }));

    scheduleBotTurn(newP1Hp, newP2Hp, pivotPotionActive, gameState.bridgeRoundTriggered);
  // Note: scheduleBotTurn is declared after handleAnswer but called within it.
  // We use the function hoisting behavior of useCallback (it's assigned before the next render).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, effectiveP1Fighter, player1, player2, onMatchEnd, calcDamage, showDamage, showItemToast, consumeSelectedItem, safeTimeout]);

  // Schedule the bot's turn after a delay
  const scheduleBotTurn = useCallback((currentP1Hp: number, currentP2Hp: number, pivotPotionStillActive: boolean, bridgeAlreadyTriggered: boolean) => {
    safeTimeout(() => {
      const botMove = player2.fighter.moves[Math.floor(Math.random() * player2.fighter.moves.length)];
      const botCorrect = Math.random() < 0.6;

      // Scope Creep: invert bot's correct answer
      let effectiveBotCorrect = botCorrect;
      let scopeCreepTriggered = false;

      setGameState(prev => {
        if (prev.scopeCreepActive && botCorrect) {
          effectiveBotCorrect = false;
          scopeCreepTriggered = true;
        }

        const botDamage = calcDamage(botMove, effectiveBotCorrect, player2.fighter, effectiveP1Fighter, false);
        const botSelfDamage = calculateSelfDamage(botMove.power, effectiveBotCorrect);

        let afterBotP1Hp = Math.max(0, currentP1Hp - botDamage);
        const afterBotP2Hp = Math.max(0, currentP2Hp - botSelfDamage);

        // Animate bot
        setP2Anim('attacking');
        safeTimeout(() => {
          setP2Anim('');
          setP1Anim('hit');
          showDamage('player', botDamage, effectiveBotCorrect);
          safeTimeout(() => setP1Anim(''), 300);
        }, 400);

        if (scopeCreepTriggered) {
          showItemToast('Scope Creep', "Bot's correct answer was inverted!");
        }

        const botLog = `Turn ${prev.turnNumber}: ${player2.fighter.name} used ${botMove.name}! ${effectiveBotCorrect ? 'Correct!' : 'Wrong!'} ${botDamage} dmg`;

        if (afterBotP1Hp <= 0 || afterBotP2Hp <= 0) {
          // Check Bridge Round for bot KO on player
          if (afterBotP1Hp <= 0 && prev.bridgeRoundActive && !bridgeAlreadyTriggered && !prev.bridgeRoundTriggered) {
            afterBotP1Hp = Math.round(prev.p1MaxHp * 0.2);
            showItemToast('Bridge Round', 'Revived with 20% HP!');
            if (prev.selectedItem) {
              consumeSelectedItem(prev.selectedItem);
            }
            const nextTrivia = getRandomTrivia(player2.fighter, prev.usedTriviaIndices, FIGHTERS);
            // Apply Hook Model to new trivia
            let newEliminated: number | null = null;
            if (prev.selectedItem?.effect === 'eliminate_wrong_answer' && !prev.itemUsed) {
              const wrongIndices = nextTrivia.options
                .map((opt, i) => ({ opt, i }))
                .filter(({ opt }) => opt !== nextTrivia.answer)
                .map(({ i }) => i);
              if (wrongIndices.length > 0) {
                newEliminated = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
              }
            }
            return {
              ...prev,
              p1Hp: afterBotP1Hp,
              p2Hp: afterBotP2Hp,
              currentTurn: 'player1' as const,
              turnNumber: prev.turnNumber + 1,
              trivia: nextTrivia,
              selectedMove: 0,
              log: [...prev.log, botLog],
              bridgeRoundTriggered: true,
              scopeCreepActive: scopeCreepTriggered ? false : prev.scopeCreepActive,
              eliminatedOption: newEliminated,
            };
          }

          const winnerId = afterBotP1Hp <= 0 ? player2.id : player1.id;
          safeTimeout(() => onMatchEnd(winnerId, 'ko'), 2500);
          return {
            ...prev,
            p1Hp: afterBotP1Hp,
            p2Hp: afterBotP2Hp,
            status: 'finished' as const,
            trivia: null,
            log: [...prev.log, botLog],
            scopeCreepActive: scopeCreepTriggered ? false : prev.scopeCreepActive,
            eliminatedOption: null,
          };
        }

        const nextTrivia = getRandomTrivia(player2.fighter, prev.usedTriviaIndices, FIGHTERS);

        // Apply Hook Model to each new trivia question if item not yet consumed
        let newEliminated: number | null = null;
        if (prev.selectedItem?.effect === 'eliminate_wrong_answer' && !prev.itemConsumed) {
          const wrongIndices = nextTrivia.options
            .map((opt, i) => ({ opt, i }))
            .filter(({ opt }) => opt !== nextTrivia.answer)
            .map(({ i }) => i);
          if (wrongIndices.length > 0) {
            newEliminated = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
          }
        }

        return {
          ...prev,
          p1Hp: afterBotP1Hp,
          p2Hp: afterBotP2Hp,
          currentTurn: 'player1' as const,
          turnNumber: prev.turnNumber + 1,
          trivia: nextTrivia,
          selectedMove: 0,
          log: [...prev.log, botLog],
          scopeCreepActive: scopeCreepTriggered ? false : prev.scopeCreepActive,
          eliminatedOption: newEliminated,
        };
      });
    }, 1500);
  }, [player1, player2, effectiveP1Fighter, calcDamage, showDamage, onMatchEnd, showItemToast, consumeSelectedItem, safeTimeout]);

  // Consume Hook Model item on first trivia display (it applies every turn, consumed once)
  useEffect(() => {
    if (
      gameState.status === 'active' &&
      gameState.selectedItem?.effect === 'eliminate_wrong_answer' &&
      gameState.eliminatedOption !== null &&
      !gameState.itemConsumed
    ) {
      consumeSelectedItem(gameState.selectedItem);
    }
  }, [gameState.status, gameState.selectedItem, gameState.eliminatedOption, gameState.itemConsumed, consumeSelectedItem]);

  // Consume The Memo item once battle starts
  useEffect(() => {
    if (
      gameState.status === 'active' &&
      gameState.selectedItem?.effect === 'reveal_move' &&
      gameState.revealedMoves &&
      !gameState.itemConsumed
    ) {
      consumeSelectedItem(gameState.selectedItem);
    }
  }, [gameState.status, gameState.selectedItem, gameState.revealedMoves, gameState.itemConsumed, consumeSelectedItem]);

  // Consume passive items (Pivot Potion, Bridge Round) -- these are consumed when they trigger,
  // handled in the battle logic above via consumeSelectedItem calls

  // FIGHT! announcement when battle becomes active
  useEffect(() => {
    if (gameState.status === 'active') {
      setShowFight(true);
      const t = safeTimeout(() => setShowFight(false), 2000);
      return () => clearTimeout(t);
    }
  }, [gameState.status, safeTimeout]);

  // K.O.! announcement
  useEffect(() => {
    if (gameState.status === 'finished') {
      setShowKO(true);
      const t = safeTimeout(() => setShowKO(false), 2500);
      return () => clearTimeout(t);
    }
  }, [gameState.status, safeTimeout]);

  // Screen shake + impact flash on damage
  const prevP1Hp = useRef(gameState.p1Hp);
  const prevP2Hp = useRef(gameState.p2Hp);
  useEffect(() => {
    if (gameState.p1Hp < prevP1Hp.current || gameState.p2Hp < prevP2Hp.current) {
      setShaking(true);
      setShowImpact(true);
      const t1 = safeTimeout(() => setShaking(false), 300);
      const t2 = safeTimeout(() => setShowImpact(false), 150);
      prevP1Hp.current = gameState.p1Hp;
      prevP2Hp.current = gameState.p2Hp;
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    prevP1Hp.current = gameState.p1Hp;
    prevP2Hp.current = gameState.p2Hp;
  }, [gameState.p1Hp, gameState.p2Hp, safeTimeout]);

  // If bot goes first, trigger the bot's turn when the game becomes active
  const botFirstTurnFired = useRef(false);
  useEffect(() => {
    if (gameState.status === 'active' && gameState.currentTurn === 'player2' && !botFirstTurnFired.current) {
      botFirstTurnFired.current = true;
      scheduleBotTurn(gameState.p1Hp, gameState.p2Hp, gameState.pivotPotionActive, false);
    }
  }, [gameState.status, gameState.currentTurn, gameState.p1Hp, gameState.p2Hp, gameState.pivotPotionActive, scheduleBotTurn]);

  // Item selection phase
  if (gameState.status === 'item_select') {
    return (
      <div className="game-wrapper">
        <div className="game-title">
          <h1>LennyFighter</h1>
          <div className="subtitle">Select your item for battle!</div>
        </div>
        <ItemSelector inventory={inventory} onSelect={handleItemSelect} />
      </div>
    );
  }

  return (
    <div className="game-wrapper">
      {/* Title */}
      <div className="game-title">
        <h1>LennyFighter</h1>
        <div className="subtitle">Battle for LennyCoin!</div>
      </div>

      <div className="game-layout">
        {/* Left HUD */}
        <div className="player-hud">
          <div className="hud-avatar">
            <img src={player1.fighter.avatar} alt={player1.fighter.name} />
          </div>
          <div className="hud-name">You</div>
          <div className="hud-fighter-name">{player1.fighter.name}</div>
          <span className={`hud-type-badge type-${player1.fighter.type}`}>{player1.fighter.type}</span>
          <div className="hud-stats">
            <div className="hud-stat"><span>ATK</span><span>{effectiveP1Fighter.stats.atk}</span></div>
            <div className="hud-stat"><span>DEF</span><span>{effectiveP1Fighter.stats.def}</span></div>
            <div className="hud-stat"><span>SPD</span><span>{effectiveP1Fighter.stats.spd}</span></div>
          </div>
          <div className="hud-turn-indicator">
            {gameState.currentTurn === 'player1' ? '-- YOUR TURN' : '-- WAITING'}
          </div>
          {gameState.selectedItem && (
            <div style={{
              marginTop: '8px',
              padding: '4px 8px',
              backgroundColor: '#2d2d4a',
              border: '1px solid #a855f7',
              borderRadius: '6px',
              fontSize: '22px',
              color: '#c4b5fd',
              textAlign: 'center',
            }}>
              {gameState.selectedItem.name}
              {gameState.itemUsed && gameState.selectedItem.timing === 'active_use' && (
                <span style={{ color: '#a0a0b0', marginLeft: '4px' }}>(used)</span>
              )}
            </div>
          )}
        </div>

        {/* Main arena + questions */}
        <div style={{ flex: 1 }}>
          <BattleArena
            leftPlayer={{ fighter: player1.fighter, hp: gameState.p1Hp, maxHp: gameState.p1MaxHp, username: 'You' }}
            rightPlayer={{ fighter: player2.fighter, hp: gameState.p2Hp, maxHp: player2.fighter.stats.hp, username: 'Bot' }}
            isMyTurn={gameState.currentTurn === 'player1'}
            turnNumber={gameState.turnNumber}
            status={gameState.status}
            trivia={gameState.trivia ? {
              question: gameState.trivia.question,
              options: gameState.trivia.options,
              eliminatedOption: gameState.eliminatedOption,
              revealedMoves: gameState.revealedMoves,
            } : null}
            selectedMove={gameState.selectedMove}
            onSelectMove={(i) => setGameState(prev => ({ ...prev, selectedMove: i }))}
            onAnswer={handleAnswer}
            onForfeit={() => {
              if (window.confirm('Forfeit the match? The bot wins.')) {
                onMatchEnd(player2.id, 'forfeit');
              }
            }}
            canUseItem={!!canUseActiveItem}
            onUseItem={handleUseItem}
            answerFeedback={answerFeedback}
            onFeedbackDone={() => setAnswerFeedback(null)}
            extraMoveButtons={gameState.stolenMove ? (
              <button
                className="move-btn"
                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => setGameState(prev => ({ ...prev, selectedMove: -1 }))}
              >
                {gameState.stolenMove.name} (STOLEN, PWR:{gameState.stolenMove.power})
              </button>
            ) : undefined}
            leftAnim={p1Anim}
            rightAnim={p2Anim}
            damagePopups={damagePopups}
            showFight={showFight}
            showKO={showKO}
            shaking={shaking}
            showImpact={showImpact}
            moves={effectiveP1Fighter.moves}
            opponentType={player2.fighter.type}
            waitingMessage="Opponent is thinking..."
            finishedMessage={gameState.status === 'finished' ? gameState.log[gameState.log.length - 1] : undefined}
          />

          {/* Mobile HUD bar — visible only on mobile when sidebars are hidden */}
          <div className="mobile-hud">
            <div className="mobile-hud-item">
              <span>Lv 1</span>
              {canUseActiveItem && <span className="mobile-hud-item-badge">Item Ready</span>}
            </div>
            <div className="mobile-hud-status">
              {gameState.currentTurn === 'player1' ? "Your Turn" : "Bot's Turn"}
            </div>
            <div className="mobile-hud-item">
              <span>Turn {gameState.turnNumber}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="game-footer">
            <div>
              <h4>How to Play:</h4>
              <ul>
                <li>Click answers to respond</li>
                <li>Select moves to attack</li>
              </ul>
            </div>
            <div>
              <h4>About this game:</h4>
              <ul>
                <li>Built with Vinext + Cloudflare</li>
                <li>Durable Objects for multiplayer</li>
                <li>Inspired by PokeLenny</li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Item activation toast */}
      {itemToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#a855f7',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          zIndex: 1100,
          boxShadow: '0 4px 12px rgba(168, 85, 247, 0.5)',
          textAlign: 'center',
          maxWidth: '90vw',
        }}>
          <div>{itemToast.name}</div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>{itemToast.description}</div>
        </div>
      )}
    </div>
  );
}
