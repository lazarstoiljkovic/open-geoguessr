import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import GuessMap from '../../components/Map/GuessMap';
import GoogleGuessMap from '../../components/GoogleGuessMap/GoogleGuessMap';
import GoogleResultsMap from '../../components/GoogleResultsMap/GoogleResultsMap';
import SpectatorMap from '../../components/SpectatorMap/SpectatorMap';
import Timer from '../../components/Timer/Timer';
import Scoreboard from '../../components/Scoreboard/Scoreboard';
import LocationGallery from '../../components/LocationGallery/LocationGallery';
import MapillaryViewer from '../../components/MapillaryViewer/MapillaryViewer';
import GoogleStreetViewViewer from '../../components/GoogleStreetViewViewer/GoogleStreetViewViewer';
import Chat from '../../components/Chat/Chat';
import useCountdown from '../../hooks/useCountdown';
import { MAPILLARY_TOKEN, GOOGLE_MAPS_KEY } from '../../env';
import './Game.scss';

function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (target === 0) { setVal(0); return; }
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

const AVATAR_COLORS = ['#f0c040', '#5aabff', '#a78bfa', '#4cdd8a', '#ff5f5f', '#fb923c', '#f472b6', '#34d399'];

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const { user, isAuthenticated } = useAuth();
  const {
    room, status, currentRound, roundIndex, totalRounds, durationSeconds,
    countdownSeconds, roundCountdown, myGuess, myGuessResult, roundResults, finalResults,
    allRoundResults, messages, sendMessage, eliminatedPlayerIds, livePlayerPins, broadcastPinMove,
    joinRoom, submitGuess, nextRound, leaveRoom,
    isSubmittingGuess, isAdvancingRound,
    requestHint, hintResults, usedHints,
  } = useGame();
  const navigate = useNavigate();
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const isEliminated = eliminatedPlayerIds.includes(user?.id ?? '');

  const timeLeft = useCountdown(durationSeconds, status === 'playing' && !myGuess, currentRound?.startedAt);

  // Score count-up for round results
  const myRoundGuessScore = (() => {
    if (status === 'round_results' && roundResults) {
      const g = roundResults.round.guesses.find((g) => g.userId === user?.id);
      return g?.roundScore ?? 0;
    }
    return 0;
  })();
  const animatedScore = useCountUp(myRoundGuessScore);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (code) joinRoom(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (room && status === 'waiting') navigate(`/room/${code}`);
  }, [room, status, code, navigate]);

  const handleGuess = useCallback((lat: number, lng: number) => {
    submitGuess(lat, lng);
  }, [submitGuess]);

  const handleLeave = () => {
    leaveRoom();
    navigate('/');
  };

  // ── Countdown screen ────────────────────────────────────────────────────

  if (status === 'countdown') {
    return (
      <div className="game-page game-page--countdown">
        <div className="game-page__countdown-bubble">
          <span className="game-page__countdown-number">{countdownSeconds}</span>
          <p>Get ready!</p>
        </div>
      </div>
    );
  }

  // ── Between-round countdown ─────────────────────────────────────────────

  if (status === 'round_countdown') {
    return (
      <div className="game-page game-page--countdown">
        <div className="game-page__countdown-bubble">
          <span className="game-page__countdown-number">{roundCountdown}</span>
          <p>Next round starting...</p>
        </div>
      </div>
    );
  }

  // ── Game over ───────────────────────────────────────────────────────────

  if (status === 'game_over' && finalResults) {
    const MEDALS = ['🥇', '🥈', '🥉'];
    const sorted = [...finalResults.players].sort((a, b) => b.score - a.score);
    const podium = sorted.slice(0, 3);

    // Podium order: 2nd | 1st | 3rd
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
    const podiumRanks = [2, 1, 3];
    const podiumHeights = [110, 140, 90];

    return (
      <div className="game-page game-page--results">
        <div className="game-page__final-card">
          <h1 className="game-page__final-title">🏆 Game Over!</h1>

          {/* Podium */}
          <div className="game-page__podium">
            {podiumOrder.map((player, i) => {
              if (!player) return null;
              const rank = podiumRanks[i];
              const height = podiumHeights[i];
              const colorIdx = sorted.indexOf(player);
              const color = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length];
              const initials = player.username.slice(0, 2).toUpperCase();
              const isMe = player.userId === user?.id;
              return (
                <div key={player.userId} className={`game-page__podium-place game-page__podium-place--${rank}`}>
                  <div className="game-page__podium-avatar" style={{ background: `${color}22`, border: `2px solid ${color}`, color }}>
                    {initials}
                    {isMe && <span className="game-page__podium-you">you</span>}
                  </div>
                  <div className="game-page__podium-name">{player.username}</div>
                  <div className="game-page__podium-score" style={{ color }}>{player.score.toLocaleString()}</div>
                  <div className="game-page__podium-bar" style={{ height, background: `${color}22`, borderColor: color }}>
                    <span className="game-page__podium-medal">{MEDALS[rank - 1]}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* All players accordion with round breakdown */}
          <div className="game-page__player-list">
            {sorted.map((player, idx) => {
              const isMe = player.userId === user?.id;
              const isOpen = expandedPlayer === player.userId;
              const medal = idx < 3 ? MEDALS[idx] : `${idx + 1}.`;
              return (
                <div
                  key={player.userId}
                  className={`game-page__player-accordion${isOpen ? ' game-page__player-accordion--open' : ''}`}
                >
                  <button
                    className={`game-page__player-header${isMe ? ' game-page__player-header--me' : ''}`}
                    onClick={() => setExpandedPlayer(isOpen ? null : player.userId)}
                  >
                    <span className="game-page__player-medal">{medal}</span>
                    <span className="game-page__player-name">
                      {player.username}
                      {player.isHost && <span className="game-page__badge game-page__badge--host">HOST</span>}
                      {isMe && <span className="game-page__badge game-page__badge--me">you</span>}
                    </span>
                    <span className="game-page__player-score">{player.score.toLocaleString()}</span>
                    <span className="game-page__chevron">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="game-page__player-rounds">
                      {allRoundResults.length === 0 ? (
                        <p className="game-page__rounds-empty">No round data</p>
                      ) : (
                        allRoundResults.map((round) => {
                          const guess = round.guesses.find((g) => g.userId === player.userId);
                          return (
                            <div key={round.index} className="game-page__round-row">
                              <span className="game-page__round-num">R{round.index + 1}</span>
                              <span className="game-page__round-loc">
                                {round.locationName}
                                {round.locationCountry ? `, ${round.locationCountry}` : ''}
                              </span>
                              {guess ? (
                                <>
                                  <span className="game-page__round-dist">
                                    {guess.distanceKm < 1
                                      ? `${Math.round(guess.distanceKm * 1000)} m`
                                      : `${Math.round(guess.distanceKm).toLocaleString()} km`}
                                  </span>
                                  <span className="game-page__round-pts">+{guess.roundScore}</span>
                                </>
                              ) : (
                                <span className="game-page__round-skip">no guess</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="btn btn--primary btn--lg" onClick={handleLeave}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // ── Round results ────────────────────────────────────────────────────────

  if (status === 'round_results' && roundResults) {
    const { round, players, isLastRound, elimination } = roundResults;
    const isHost = room?.hostId === user?.id;
    const myRoundGuess = round.guesses.find((g) => g.userId === user?.id);

    return (
      <div className="game-page game-page--round-results">
        <div className="game-page__results-layout">
          <div className="game-page__results-map">
            <h3 className="game-page__location-reveal">
              📍 {round.location.name}
              {(round.location as { country?: string }).country && (
                <span className="game-page__location-country">
                  , {(round.location as { country?: string }).country}
                </span>
              )}
            </h3>
            {GOOGLE_MAPS_KEY ? (
              <GoogleResultsMap
                guesses={round.guesses}
                correctLat={round.location.lat!}
                correctLng={round.location.lng!}
                players={players}
              />
            ) : (
              <GuessMap
                disabled
                guesses={round.guesses}
                correctLat={round.location.lat}
                correctLng={round.location.lng}
                myGuess={myRoundGuess ? { lat: myRoundGuess.lat, lng: myRoundGuess.lng } : undefined}
              />
            )}
          </div>
          <div className="game-page__results-sidebar">
            {myRoundGuess ? (
              <div className="game-page__my-result">
                <div>
                  <div className="game-page__my-label">Your guess</div>
                  <div className="game-page__my-distance">
                    {myRoundGuess.distanceKm < 1
                      ? `${Math.round(myRoundGuess.distanceKm * 1000)} m away`
                      : `${Math.round(myRoundGuess.distanceKm).toLocaleString()} km away`}
                  </div>
                </div>
                <span className="game-page__my-score">+{animatedScore}</span>
              </div>
            ) : (
              <div className="game-page__no-guess">No guess submitted this round</div>
            )}

            {elimination && elimination.eliminatedUserIds.length > 0 && (
              <div className="game-page__elimination-notice">
                {elimination.isTieBreaker && (
                  <div className="game-page__tiebreaker-badge">⚔️ Tiebreaker round</div>
                )}
                <div className="game-page__eliminated-label">Eliminated this round:</div>
                {elimination.eliminatedUserIds.map((uid) => {
                  const p = players.find((pl) => pl.userId === uid);
                  const isMe = uid === user?.id;
                  return (
                    <div key={uid} className={`game-page__eliminated-player${isMe ? ' game-page__eliminated-player--me' : ''}`}>
                      💀 {p?.username ?? uid}{isMe ? ' (you)' : ''}
                    </div>
                  );
                })}
              </div>
            )}

            <Scoreboard players={players} currentUserId={user?.id} />
            {isHost ? (
              <button
                className="btn btn--primary btn--lg"
                onClick={nextRound}
                disabled={isAdvancingRound}
              >
                {isAdvancingRound ? 'Loading...' : isLastRound ? '🏆 See Final Results' : 'Next Round →'}
              </button>
            ) : (
              <p className="game-page__waiting-host">Waiting for host to continue...</p>
            )}
            <div className="game-page__results-chat">
              <Chat messages={messages} currentUserId={user?.id} onSend={sendMessage} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────

  const mapillaryId = currentRound?.location.mapillaryImageId;
  const viewerLat = (currentRound?.location as { viewerLat?: number }).viewerLat;
  const viewerLng = (currentRound?.location as { viewerLng?: number }).viewerLng;
  const streetViewPanoId = currentRound?.location.streetViewPanoId;
  if (viewerLat !== undefined) console.log('[GSV] lat=%s lng=%s panoId=%s', viewerLat, viewerLng, streetViewPanoId);
  const galleryImages = currentRound?.location.images ?? (currentRound?.location.imageUrl ? [currentRound.location.imageUrl] : []);
  const useGoogle = !!(GOOGLE_MAPS_KEY && viewerLat !== undefined && viewerLng !== undefined);
  const useMapillary = !useGoogle && !!(mapillaryId && MAPILLARY_TOKEN);

  const isEliminationMode = room?.gameMode === 'elimination';
  const activePlayers = (room?.players ?? []).filter((p) => !eliminatedPlayerIds.includes(p.userId));
  const remainingCount = activePlayers.length;

  return (
    <div className="game-page">
      {currentRound && (
        <>
          <div className="game-page__hud">
            <div className="game-page__round-info">
              {isEliminationMode ? (
                <>
                  <span className="game-page__round-pill">Round {roundIndex + 1}</span>
                  <span className="game-page__remaining">{remainingCount} remaining</span>
                  {isEliminated && <span className="game-page__spectating-badge">👁 Spectating</span>}
                </>
              ) : (
                <>
                  <span className="game-page__round-pill">Round {roundIndex + 1} / {totalRounds}</span>
                  {useGoogle && <span className="game-page__mapillary-badge">🌐 Street View</span>}
                  {useMapillary && <span className="game-page__mapillary-badge">🌐 Mapillary</span>}
                </>
              )}
            </div>
            <div className="game-page__timer-wrap">
              <Timer seconds={myGuess ? 0 : timeLeft} total={durationSeconds} />
            </div>
          </div>

          {isEliminated ? (
            <div className="game-page__play-area game-page__play-area--spectator">
              <div className="game-page__location-pane">
                {useGoogle ? (
                  <GoogleStreetViewViewer lat={viewerLat!} lng={viewerLng!} apiKey={GOOGLE_MAPS_KEY} panoId={streetViewPanoId} />
                ) : useMapillary ? (
                  <MapillaryViewer imageId={mapillaryId!} accessToken={MAPILLARY_TOKEN} />
                ) : (
                  <LocationGallery images={galleryImages} alt="Guess this location" />
                )}
                <div className="game-page__spectator-banner">
                  You've been eliminated — watch the remaining players
                </div>
                {chatOpen ? (
                  <div className="game-page__chat-float">
                    <button className="game-page__chat-toggle" onClick={() => setChatOpen(false)}>
                      <span>💬 Chat</span>
                      <span className="game-page__chat-chevron">▼</span>
                    </button>
                    <Chat messages={messages} currentUserId={user?.id} onSend={sendMessage} />
                  </div>
                ) : (
                  <button className="game-page__chat-pill" onClick={() => setChatOpen(true)}>
                    <span>💬 Chat</span>
                    {messages.length > 0 && <span className="game-page__chat-badge">{messages.length}</span>}
                    <span className="game-page__chat-chevron">▲</span>
                  </button>
                )}
              </div>
              <div className="game-page__spectator-map-pane">
                <SpectatorMap
                  livePlayerPins={livePlayerPins}
                  activePlayers={activePlayers}
                  followingUserId={followingUserId}
                  onFollowPlayer={(id) => setFollowingUserId(id || null)}
                />
              </div>
            </div>
          ) : (
            <div className="game-page__play-area">
              <div className="game-page__location-pane">
                {useGoogle ? (
                  <GoogleStreetViewViewer lat={viewerLat!} lng={viewerLng!} apiKey={GOOGLE_MAPS_KEY} panoId={streetViewPanoId} />
                ) : useMapillary ? (
                  <MapillaryViewer imageId={mapillaryId!} accessToken={MAPILLARY_TOKEN} />
                ) : (
                  <LocationGallery images={galleryImages} alt="Guess this location" />
                )}

                {room?.hintsEnabled && (
                  <div className="game-page__hints">
                    <button
                      className={`game-page__hint-btn${usedHints.has('continent') ? ' game-page__hint-btn--used' : ''}`}
                      onClick={() => requestHint('continent')}
                      disabled={usedHints.has('continent')}
                    >
                      {hintResults.continent ? `🌍 ${hintResults.continent}` : '🌍 Continent'}
                    </button>
                    <button
                      className={`game-page__hint-btn${usedHints.has('country') ? ' game-page__hint-btn--used' : ''}`}
                      onClick={() => requestHint('country')}
                      disabled={usedHints.has('country')}
                    >
                      {hintResults.country ? `🏳️ ${hintResults.country}` : '🏳️ Country'}
                    </button>
                  </div>
                )}

                {myGuessResult ? (
                  <div className="game-page__submitted-overlay">
                    <div className="game-page__submitted-icon">✅</div>
                    <p>Guess submitted!</p>
                    {myGuessResult.roundScore > 0 && (
                      <p className="game-page__submitted-score">+{myGuessResult.roundScore} pts</p>
                    )}
                  </div>
                ) : GOOGLE_MAPS_KEY ? (
                  <GoogleGuessMap
                    onGuess={handleGuess}
                    onPinMove={broadcastPinMove}
                    disabled={!!myGuess || isSubmittingGuess}
                  />
                ) : (
                  <GuessMap onGuess={handleGuess} disabled={!!myGuess || isSubmittingGuess} myGuess={myGuess} />
                )}

                {chatOpen ? (
                  <div className="game-page__chat-float">
                    <button className="game-page__chat-toggle" onClick={() => setChatOpen(false)}>
                      <span>💬 Chat</span>
                      <span className="game-page__chat-chevron">▼</span>
                    </button>
                    <Chat messages={messages} currentUserId={user?.id} onSend={sendMessage} />
                  </div>
                ) : (
                  <button className="game-page__chat-pill" onClick={() => setChatOpen(true)}>
                    <span>💬 Chat</span>
                    {messages.length > 0 && <span className="game-page__chat-badge">{messages.length}</span>}
                    <span className="game-page__chat-chevron">▲</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
