export type MicConnectionStatus = 'muted' | 'open' | 'connecting' | 'reconnecting' | 'failed';

export interface AudioSignalPayload {
  type: 'rtc:offer' | 'rtc:answer' | 'rtc:ice-candidate';
  targetUserId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface RoomAudioCallbacks {
  onStatusChange: (status: MicConnectionStatus, errorMsg?: string | null) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
  onSignal: (signal: AudioSignalPayload) => void;
}

export interface IRoomAudioProvider {
  init(myUserId: string, iceServers: RTCIceServer[], callbacks: RoomAudioCallbacks): void;
  syncPeers(activePeerIds: string[], canPublishAudio: boolean): Promise<void>;
  setPublishEnabled(enabled: boolean): Promise<boolean>;
  setDeafened(deafened: boolean): void;
  setVoiceVolume(volume01: number): void;
  handleIncomingSignal(fromUserId: string, msg: { type: string; sdp?: any; candidate?: any }): Promise<void>;
  handleResume(): void;
  destroy(): void;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  audioEl: HTMLAudioElement;
  senderAdded: boolean;
}

/**
 * Real WebRTC peer-to-peer multi-party audio mesh + Web Audio VAD engine.
 * Designed behind IRoomAudioProvider so SFU backends (LiveKit/Agora/mediasoup) can swap in seamlessly.
 */
export class WebRtcMeshAudioProvider implements IRoomAudioProvider {
  private myUserId = '';
  private iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  private callbacks: RoomAudioCallbacks | null = null;
  private peers = new Map<string, PeerEntry>();
  private localStream: MediaStream | null = null;
  private canPublish = false;
  private isDeafened = false;
  private voiceVolume = 1;
  private status: MicConnectionStatus = 'muted';

  // Web Audio VAD
  private audioCtx: AudioContext | null = null;
  private vadTimer: number | null = null;
  private lastSpeaking = false;
  private destroyed = false;

  init(myUserId: string, iceServers: RTCIceServer[], callbacks: RoomAudioCallbacks): void {
    this.myUserId = myUserId;
    if (Array.isArray(iceServers) && iceServers.length > 0) {
      this.iceServers = iceServers;
    }
    this.callbacks = callbacks;
    this.destroyed = false;
    this.emitStatus('muted', null);
  }

  private emitStatus(status: MicConnectionStatus, err: string | null = null) {
    if (this.status === status && err === null && status === 'muted') return;
    this.status = status;
    this.callbacks?.onStatusChange(status, err);
  }

  private async ensureLocalStream(): Promise<MediaStream | null> {
    if (this.localStream && this.localStream.getAudioTracks().some((t) => t.readyState === 'live')) {
      return this.localStream;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.emitStatus('failed', 'المتصفح لا يدعم الوصول إلى المايكروفون');
      return null;
    }
    try {
      this.emitStatus('connecting', null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (this.destroyed) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      this.localStream = stream;
      this.startVad(stream);
      return stream;
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'تم رفض إذن المايكروفون من المتصفح'
          : err?.name === 'NotFoundError'
          ? 'لم يتم العثور على مايكروفون متصل'
          : 'تعذر تشغيل المايكروفون';
      this.emitStatus('failed', msg);
      return null;
    }
  }

  private startVad(stream: MediaStream) {
    this.stopVad();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.45;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      this.audioCtx = ctx;

      this.vadTimer = window.setInterval(() => {
        if (this.destroyed) return;
        if (!this.canPublish || !this.localStream?.getAudioTracks().some((t) => t.enabled)) {
          if (this.lastSpeaking) {
            this.lastSpeaking = false;
            this.callbacks?.onSpeakingChange(false);
          }
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const speakingNow = avg > 14;
        if (speakingNow !== this.lastSpeaking) {
          this.lastSpeaking = speakingNow;
          this.callbacks?.onSpeakingChange(speakingNow);
        }
      }, 120);
    } catch {
      // VAD is enhancement; audio transport works without it
    }
  }

  private stopVad() {
    if (this.vadTimer !== null) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.lastSpeaking) {
      this.lastSpeaking = false;
      this.callbacks?.onSpeakingChange(false);
    }
  }

  async setPublishEnabled(enabled: boolean): Promise<boolean> {
    this.canPublish = enabled;
    if (!enabled) {
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
      if (this.lastSpeaking) {
        this.lastSpeaking = false;
        this.callbacks?.onSpeakingChange(false);
      }
      this.emitStatus('muted', null);
      return true;
    }

    const stream = await this.ensureLocalStream();
    if (!stream) {
      this.canPublish = false;
      return false;
    }
    stream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    // Attach tracks to any existing peer connections that didn't have our track yet
    for (const [peerId, entry] of this.peers.entries()) {
      await this.attachLocalTracksAndMaybeOffer(peerId, entry);
    }
    this.emitStatus('open', null);
    return true;
  }

  setDeafened(deafened: boolean): void {
    this.isDeafened = deafened;
    for (const entry of this.peers.values()) {
      entry.audioEl.muted = deafened;
    }
  }

  setVoiceVolume(volume01: number): void {
    const v = Math.max(0, Math.min(1, volume01));
    this.voiceVolume = v;
    for (const entry of this.peers.values()) {
      entry.audioEl.volume = v;
    }
  }

  async syncPeers(activePeerIds: string[], canPublishAudio: boolean): Promise<void> {
    if (this.destroyed) return;
    if (!canPublishAudio && this.canPublish) {
      await this.setPublishEnabled(false);
    }

    const desiredSet = new Set(activePeerIds.filter((id) => id && id !== this.myUserId));

    // Close disconnected peers
    for (const [peerId, entry] of Array.from(this.peers.entries())) {
      if (!desiredSet.has(peerId)) {
        this.closePeer(peerId, entry);
      }
    }

    // Connect new peers
    for (const peerId of desiredSet) {
      if (!this.peers.has(peerId)) {
        const entry = this.createPeerConnection(peerId);
        this.peers.set(peerId, entry);
        if (this.localStream && this.canPublish) {
          await this.attachLocalTracksAndMaybeOffer(peerId, entry);
        } else if (this.myUserId < peerId) {
          // Listener can still negotiate recvonly offer so speaker stream flows smoothly
          entry.pc.addTransceiver('audio', { direction: 'recvonly' });
          await this.sendOffer(peerId, entry);
        }
      }
    }
  }

  private createPeerConnection(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    (audioEl as any).playsInline = true;
    audioEl.muted = this.isDeafened;
    audioEl.volume = this.voiceVolume;
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);

    const entry: PeerEntry = {
      pc,
      makingOffer: false,
      pendingCandidates: [],
      audioEl,
      senderAdded: false,
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && !this.destroyed) {
        this.callbacks?.onSignal({
          type: 'rtc:ice-candidate',
          targetUserId: peerId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      if (this.destroyed) return;
      const remoteStream = e.streams?.[0] || new MediaStream([e.track]);
      if (audioEl.srcObject !== remoteStream) {
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(() => {});
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (this.destroyed) return;
      const st = pc.iceConnectionState;
      if (st === 'disconnected') {
        if (this.canPublish) this.emitStatus('reconnecting', null);
      } else if (st === 'failed') {
        if (this.canPublish) {
          this.emitStatus('reconnecting', null);
          try {
            pc.restartIce();
          } catch {}
        }
      } else if ((st === 'connected' || st === 'completed') && this.canPublish) {
        this.emitStatus('open', null);
      }
    };

    return entry;
  }

  private async attachLocalTracksAndMaybeOffer(peerId: string, entry: PeerEntry): Promise<void> {
    if (!this.localStream || entry.senderAdded) return;
    entry.senderAdded = true;
    for (const track of this.localStream.getAudioTracks()) {
      entry.pc.addTrack(track, this.localStream);
    }
    if (this.myUserId < peerId || entry.pc.signalingState === 'stable') {
      await this.sendOffer(peerId, entry);
    }
  }

  private async sendOffer(peerId: string, entry: PeerEntry): Promise<void> {
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer({ offerToReceiveAudio: true });
      if (entry.pc.signalingState !== 'stable') return;
      await entry.pc.setLocalDescription(offer);
      if (entry.pc.localDescription) {
        this.callbacks?.onSignal({
          type: 'rtc:offer',
          targetUserId: peerId,
          sdp: entry.pc.localDescription.toJSON(),
        });
      }
    } catch {
      // Ignore transient signaling error
    } finally {
      entry.makingOffer = false;
    }
  }

  async handleIncomingSignal(fromUserId: string, msg: { type: string; sdp?: any; candidate?: any }): Promise<void> {
    if (this.destroyed || !fromUserId || fromUserId === this.myUserId) return;
    let entry = this.peers.get(fromUserId);
    if (!entry) {
      entry = this.createPeerConnection(fromUserId);
      this.peers.set(fromUserId, entry);
      if (this.localStream && this.canPublish && !entry.senderAdded) {
        entry.senderAdded = true;
        for (const track of this.localStream.getAudioTracks()) {
          entry.pc.addTrack(track, this.localStream);
        }
      }
    }

    const pc = entry.pc;
    const polite = this.myUserId > fromUserId;

    try {
      if (msg.type === 'rtc:offer' && msg.sdp) {
        const offerCollision = entry.makingOffer || pc.signalingState !== 'stable';
        if (offerCollision && !polite) {
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        for (const cand of entry.pendingCandidates.splice(0)) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
          this.callbacks?.onSignal({
            type: 'rtc:answer',
            targetUserId: fromUserId,
            sdp: pc.localDescription.toJSON(),
          });
        }
      } else if (msg.type === 'rtc:answer' && msg.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          for (const cand of entry.pendingCandidates.splice(0)) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
        }
      } else if (msg.type === 'rtc:ice-candidate' && msg.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        } else {
          entry.pendingCandidates.push(msg.candidate);
        }
      }
    } catch {
      // Recoverable peer glare / closed state
    }
  }

  private closePeer(peerId: string, entry: PeerEntry) {
    try {
      entry.pc.onicecandidate = null;
      entry.pc.ontrack = null;
      entry.pc.oniceconnectionstatechange = null;
      entry.pc.close();
    } catch {}
    try {
      entry.audioEl.srcObject = null;
      entry.audioEl.remove();
    } catch {}
    this.peers.delete(peerId);
  }

  handleResume(): void {
    if (this.destroyed) return;
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    for (const entry of this.peers.values()) {
      const st = entry.pc.iceConnectionState;
      if (st === 'disconnected' || st === 'failed') {
        try {
          entry.pc.restartIce();
        } catch {}
      }
      if (entry.audioEl.srcObject && entry.audioEl.paused && !this.isDeafened) {
        entry.audioEl.play().catch(() => {});
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.canPublish = false;
    this.stopVad();
    for (const [peerId, entry] of Array.from(this.peers.entries())) {
      this.closePeer(peerId, entry);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.localStream = null;
    }
  }
}
