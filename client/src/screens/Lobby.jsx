import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const LobbyScreen = () => {
  const [displayName, setDisplayName] = useState("");
  const [room, setRoom] = useState("");

  const navigate = useNavigate();

  const handleSubmitForm = useCallback(
    (e) => {
      e.preventDefault();
      if (!displayName?.trim() || !room?.trim()) return;

      const name = displayName.trim();
      window.sessionStorage.setItem("rtc-display-name", name);
      window.sessionStorage.setItem("rtc-email", name);
      navigate(`/room/${room.trim()}`, {
        state: { displayName: name },
      });
    },
    [displayName, room, navigate]
  );

  return (
    <div className="lobby-page">
      <div className="lobby-card">
        <p className="tagline">SyncCall Meet</p>
        <h1>Jump into your video room</h1>
        <p className="lobby-subtitle">
          Fast, secure meetings for your team. Enter your details to connect.
        </p>
        <form className="lobby-form" onSubmit={handleSubmitForm}>
          <label htmlFor="displayName">Your name</label>
          <input
            type="text"
            id="displayName"
            placeholder="Alex Kim"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <label htmlFor="room">Room ID</label>
          <input
            type="text"
            id="room"
            placeholder="team-standup"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
          />
          <button type="submit">Join Room</button>
        </form>
      </div>
    </div>
  );
};

export default LobbyScreen;
