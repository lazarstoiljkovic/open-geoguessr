import React, { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import GuessMap from '../../components/Map/GuessMap';
import GoogleGuessMap from '../../components/GoogleGuessMap/GoogleGuessMap';
import GoogleResultsMap from '../../components/GoogleResultsMap/GoogleResultsMap';
import Timer from '../../components/Timer/Timer';
import Scoreboard from '../../components/Scoreboard/Scoreboard';
import LocationGallery from '../../components/LocationGallery/LocationGallery';
import MapillaryViewer from '../../components/MapillaryViewer/MapillaryViewer';
import GoogleStreetViewViewer from '../../components/GoogleStreetViewViewer/GoogleStreetViewViewer';
import useCountdown from '../../hooks/useCountdown';
import { MAPILLARY_TOKEN, GOOGLE_MAPS_KEY } from '../../env';
import './Game.scss';

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const { user, isAuthenticated } = useAuth();
  const {
    room, status, currentRound, roundIndex, totalRounds, durationSeconds,
    countdownSeconds, roundCountdown, myGuess, myGuessResult, roundResults, finalResults,
    joinRoom, submitGuess, nextRound, leaveRoom,
    isSubmittingGuess, isAdvancingRound,
  } = useGame();
  const navigate = useNavigate();

  const timeLeft = useCountdown(durationSeconds, status === 'playing' && !myGuess, currentRound?.startedAt);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (code && !room) joinRoom(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'waiting') navigate(`/room/${code}`);
  }, [status, code, navigate]);

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
    const sorted = [...finalResults.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    return (
      <div className="game-page game-page--results">
        <div className="game-page__final-card">
          <h1 className="game-page__final-title">🏆 Game Over!</h1>
          <p className="game-page__final-winner">
            Winner: <strong>{winner.username}</strong> with {winner.score.toLocaleString()} pts
          </p>
          <Scoreboard players={finalResults.players} currentUserId={user?.id} />
          <button className="btn btn--primary btn--lg" onClick={handleLeave}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  // ── Round results ────────────────────────────────────────────────────────

  if (status === 'round_results' && roundResults) {
    const { round, players, isLastRound } = roundResults;
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
                <span className="game-page__my-score">+{myRoundGuess.roundScore}</span>
              </div>
            ) : (
              <div className="game-page__no-guess">No guess submitted this round</div>
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

  return (
    <div className="game-page">
      {currentRound && (
        <>
          <div className="game-page__hud">
            <div className="game-page__round-info">
              Round {roundIndex + 1} / {totalRounds}
              {useGoogle && (
                <span className="game-page__mapillary-badge">🌐 Google Street View</span>
              )}
              {useMapillary && (
                <span className="game-page__mapillary-badge">🌐 Mapillary</span>
              )}
            </div>
            <div className="game-page__timer-wrap">
              <Timer seconds={myGuess ? 0 : timeLeft} total={durationSeconds} />
            </div>
          </div>

          <div className="game-page__play-area">
            <div className="game-page__location-pane">
              {useGoogle ? (
                <GoogleStreetViewViewer lat={viewerLat!} lng={viewerLng!} apiKey={GOOGLE_MAPS_KEY} panoId={streetViewPanoId} />
              ) : useMapillary ? (
                <MapillaryViewer imageId={mapillaryId!} accessToken={MAPILLARY_TOKEN} />
              ) : (
                <LocationGallery images={galleryImages} alt="Guess this location" />
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
                <GoogleGuessMap onGuess={handleGuess} disabled={!!myGuess || isSubmittingGuess} />
              ) : (
                <GuessMap onGuess={handleGuess} disabled={!!myGuess || isSubmittingGuess} myGuess={myGuess} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
