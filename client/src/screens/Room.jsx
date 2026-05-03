import React, { useEffect, useCallback, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import peer from "../service/peer";
import { useSocket } from "../context/SocketProvider";

const RoomPage = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const location = useLocation();
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState("");
  const [remoteDisplayName, setRemoteDisplayName] = useState("");
  const [peerKey, setPeerKey] = useState(0);
  const hasJoinedRoom = useRef(false);
  const remoteSocketIdRef = useRef(null);

  useEffect(() => {
    remoteSocketIdRef.current = remoteSocketId;
  }, [remoteSocketId]);

  const handleUserJoined = useCallback(({ email, id }) => {
    console.log(`Email ${email} joined room`);
    setRemoteSocketId(id);
    if (email) setRemoteDisplayName(email);
  }, []);

  const handleUserLeft = useCallback(({ id }) => {
    if (remoteSocketIdRef.current !== id) return;
    setRemoteSocketId(null);
    setRemoteDisplayName("");
    setRemoteStream(undefined);
  }, []);

  const handleCallUser = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    const offer = await peer.getOffer();
    socket.emit("user:call", { to: remoteSocketId, offer });
    setMyStream(stream);
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer, email }) => {
      setRemoteSocketId(from);
      if (email) setRemoteDisplayName(email);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans });
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (!myStream) return;
    for (const track of myStream.getTracks()) {
      peer.peer.addTrack(track, myStream);
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log("Call Accepted!");
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
  }, [remoteSocketId, socket]);

  useEffect(() => {
    const pc = peer.peer;
    pc.addEventListener("negotiationneeded", handleNegoNeeded);
    return () => {
      pc.removeEventListener("negotiationneeded", handleNegoNeeded);
    };
  }, [handleNegoNeeded, peerKey]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      const ans = await peer.getAnswer(offer);
      socket.emit("peer:nego:done", { to: from, ans });
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  const toggleMute = useCallback(() => {
    if (!myStream) return;
    const nextMuted = !isMuted;
    myStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted, myStream]);

  const toggleVideo = useCallback(() => {
    if (!myStream) return;
    const nextVideoOff = !isVideoOff;
    myStream.getVideoTracks().forEach((track) => {
      track.enabled = !nextVideoOff;
    });
    setIsVideoOff(nextVideoOff);
  }, [isVideoOff, myStream]);

  const copyRoomId = useCallback(async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
    } catch (error) {
      console.error("Failed to copy room id", error);
    }
  }, [roomId]);

  const endCall = useCallback(() => {
    myStream?.getTracks().forEach((track) => track.stop());
    setMyStream(undefined);
    setRemoteStream(undefined);
    setRemoteSocketId(null);
    setRemoteDisplayName("");
    setIsMuted(false);
    setIsVideoOff(false);
    peer.recreateConnection();
    setPeerKey((k) => k + 1);
    navigate("/");
  }, [myStream, navigate]);

  useEffect(() => {
    const pc = peer.peer;
    const onTrack = (ev) => {
      const rs = ev.streams;
      console.log("GOT TRACKS!!");
      setRemoteStream(rs[0]);
    };
    pc.addEventListener("track", onTrack);
    return () => pc.removeEventListener("track", onTrack);
  }, [peerKey]);

  useEffect(() => {
    return () => {
      myStream?.getTracks().forEach((track) => track.stop());
    };
  }, [myStream]);

  useEffect(() => {
    if (hasJoinedRoom.current || !roomId) return;

    const displayName =
      location.state?.displayName ||
      location.state?.email ||
      window.sessionStorage.getItem("rtc-display-name") ||
      window.sessionStorage.getItem("rtc-email") ||
      `guest-${socket.id?.slice(0, 6) || "user"}`;

    window.sessionStorage.setItem("rtc-display-name", displayName);
    window.sessionStorage.setItem("rtc-email", displayName);
    setMyDisplayName(displayName);
    socket.emit("room:join", { email: displayName, room: roomId });
    hasJoinedRoom.current = true;
  }, [location.state, roomId, socket]);

  useEffect(() => {
    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("incomming:call", handleIncommingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncomming);
    socket.on("peer:nego:final", handleNegoNeedFinal);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("incomming:call", handleIncommingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncomming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
    };
  }, [
    socket,
    handleUserJoined,
    handleUserLeft,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
  ]);

  const remoteLabel = remoteDisplayName || "Waiting…";

  return (
    <div className="room-page">
      <header className="room-header">
        <div>
          <p className="room-meta">Room</p>
          <h1>{roomId}</h1>
        </div>
        <div className="room-header-actions">
          <button type="button" className="secondary-btn" onClick={copyRoomId}>
            Copy Room ID
          </button>
          <span className={`status-pill ${remoteSocketId ? "online" : ""}`}>
            {remoteSocketId ? "Participant connected" : "Waiting for participant"}
          </span>
        </div>
      </header>

      <div className="participants-bar" aria-label="Participants">
        <div className="participant-chip">
          <span className={`participant-dot ${myDisplayName ? "live" : ""}`} aria-hidden />
          <span className="role">You</span>
          <strong>{myDisplayName || "—"}</strong>
        </div>
        <div className="participant-chip">
          <span
            className={`participant-dot ${remoteSocketId ? "live" : ""}`}
            aria-hidden
          />
          <span className="role">Participant</span>
          <strong>{remoteDisplayName || "Waiting…"}</strong>
        </div>
      </div>

      <main className="video-grid">
        <section className="video-card">
          <div className="video-title-row">
            <h2>{myDisplayName || "You"}</h2>
            <span>{isMuted ? "Muted" : "Mic on"}</span>
          </div>
          <div className="video-stage">
            {myStream ? (
              <ReactPlayer
                className="stream-player"
                playing
                muted
                width="100%"
                height="100%"
                url={myStream}
              />
            ) : (
              <div className="video-placeholder">
                Start a call to show your camera
              </div>
            )}
            <span className="video-name-badge">{myDisplayName || "You"}</span>
          </div>
        </section>

        <section className="video-card">
          <div className="video-title-row">
            <h2>{remoteLabel}</h2>
            <span>{remoteStream ? "Live" : "Not connected"}</span>
          </div>
          <div className="video-stage">
            {remoteStream ? (
              <ReactPlayer
                className="stream-player"
                playing
                width="100%"
                height="100%"
                url={remoteStream}
              />
            ) : (
              <div className="video-placeholder">
                {remoteDisplayName
                  ? `${remoteDisplayName}'s video will appear here`
                  : "Remote participant video appears here"}
              </div>
            )}
            <span className="video-name-badge">{remoteLabel}</span>
          </div>
        </section>
      </main>

      <footer className="controls-bar">
        <button
          type="button"
          className="secondary-btn"
          onClick={toggleMute}
          disabled={!myStream}
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={toggleVideo}
          disabled={!myStream}
        >
          {isVideoOff ? "Turn Video On" : "Turn Video Off"}
        </button>
        {myStream && (
          <button type="button" className="secondary-btn" onClick={sendStreams}>
            Share Stream
          </button>
        )}
        {remoteSocketId && (
          <button type="button" className="primary-btn" onClick={handleCallUser}>
            Start Call
          </button>
        )}
        <button type="button" className="end-call-btn" onClick={endCall}>
          End call
        </button>
      </footer>
    </div>
  );
};

export default RoomPage;
