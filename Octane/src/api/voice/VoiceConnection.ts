import { LocalParticipant, ParticipantEvent, RemoteParticipant, Room, RoomEvent, Track } from 'livekit-client';
import { useVoiceStore } from '../../state/voiceStore';

/**
 * Thin singleton around a LiveKit room (docs/PLANO-VOZ-CAMERA.md).
 *
 * Spatial voice: while the room is not in "assembleia" mode the emulator-side
 * zone rules apply; this class only publishes/subscribes tracks — the server
 * decides who connects where. Remote mic audio is auto-attached to <audio>
 * elements so browsers play it without extra UI.
 */
class VoiceConnection
{
    private _room: Room = null;

    public async connect(url: string, token: string): Promise<void>
    {
        const store = useVoiceStore.getState();

        if(!url || !token) return;

        this.disconnect();

        const room = new Room({ dynacast: false, adaptiveStream: false });

        this._bind(room);

        store.setConnecting(true);

        try
        {
            await room.connect(url, token);

            useVoiceStore.getState().setConnected(true);
            useVoiceStore.getState().setConnecting(false);
            useVoiceStore.getState().setMicOn(false);
            useVoiceStore.getState().setCamOn(false);
            useVoiceStore.getState().setScreenOn(false);
            this._refreshRemoteCount();
        }
        catch (error)
        {
            useVoiceStore.getState().setConnecting(false);
            useVoiceStore.getState().setConnected(false);

            throw error;
        }
    }

    public disconnect(): void
    {
        if(this._room)
        {
            this._room.disconnect();

            this._room = null;
        }

        useVoiceStore.getState().setConnected(false);
        useVoiceStore.getState().setConnecting(false);
        useVoiceStore.getState().setMicOn(false);
        useVoiceStore.getState().setCamOn(false);
        useVoiceStore.getState().setScreenOn(false);
        useVoiceStore.getState().setRemoteCount(0);
    }

    public get isConnected(): boolean
    {
        return !!this._room && this._room.state === 'connected';
    }

    public async setMicEnabled(enabled: boolean): Promise<boolean>
    {
        const participant = this._localParticipant();

        if(!participant) return false;

        try
        {
            await participant.setMicrophoneEnabled(enabled);
        }
        catch
        {
            return false;
        }

        useVoiceStore.getState().setMicOn(enabled);
        useVoiceStore.getState().setAutoMuted(false);

        return true;
    }

    public async setCameraEnabled(enabled: boolean): Promise<boolean>
    {
        const participant = this._localParticipant();

        if(!participant) return false;

        try
        {
            await participant.setCameraEnabled(enabled);
        }
        catch
        {
            return false;
        }

        useVoiceStore.getState().setCamOn(enabled);

        return true;
    }

    public async setScreenShareEnabled(enabled: boolean): Promise<boolean>
    {
        const participant = this._localParticipant();

        if(!participant) return false;

        try
        {
            await participant.setScreenShareEnabled(enabled);
        }
        catch
        {
            return false;
        }

        useVoiceStore.getState().setScreenOn(enabled);

        return true;
    }

    private _localParticipant(): LocalParticipant
    {
        return this._room?.localParticipant ?? null;
    }

    private _refreshRemoteCount(): void
    {
        useVoiceStore.getState().setRemoteCount(this._room ? Array.from(this._room.remoteParticipants.values()).length : 0);
    }

    private _bind(room: Room): void
    {
        room.on(RoomEvent.ParticipantConnected, () => this._refreshRemoteCount());
        room.on(RoomEvent.ParticipantDisconnected, () => this._refreshRemoteCount());

        room.on(RoomEvent.TrackSubscribed, (track: Track) =>
        {
            if(track.source === Track.Source.Microphone)
            {
                track.attach(); // creates + plays an <audio> element automatically

                this._refreshRemoteCount();
            }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: Track) =>
        {
            if(track.source === Track.Source.Microphone)
            {
                track.detach().forEach((element) => element.remove());
            }
        });

        room.on(RoomEvent.Disconnected, () =>
        {
            this._room = null;

            useVoiceStore.getState().setConnected(false);
            useVoiceStore.getState().setMicOn(false);
            useVoiceStore.getState().setCamOn(false);
            useVoiceStore.getState().setScreenOn(false);
            useVoiceStore.getState().setRemoteCount(0);
        });

        for(const participant of Array.from(room.remoteParticipants.values()))
        {
            participant.on(ParticipantEvent.TrackSubscribed, (track: Track) =>
            {
                if(track.source === Track.Source.Microphone) track.attach();
            });

            participant.on(ParticipantEvent.TrackUnsubscribed, (track: Track) =>
            {
                if(track.source === Track.Source.Microphone)
                {
                    track.detach().forEach((element) => element.remove());
                }
            });
        }
    }
}

export const voiceConnection = new VoiceConnection();
