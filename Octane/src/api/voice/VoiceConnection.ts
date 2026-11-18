import { LocalParticipant, ParticipantEvent, RemoteAudioTrack, RemoteParticipant, Room, RoomEvent, Track } from 'livekit-client';
import { useVoiceStore } from '../../state/voiceStore';

/**
 * Thin singleton around a LiveKit room (docs/PLANO-VOZ-CAMERA.md).
 *
 * Spatial voice: while the room is not in "assembleia" mode the emulator-side
 * zone rules apply; this class only publishes/subscribes tracks — the server
 * decides who connects where. Remote mic audio is auto-attached to <audio>
 * elements so browsers play it without extra UI.
 */
/** Maps browser getUserMedia/getDisplayMedia failures to short pt-BR hints. */
const describeMediaError = (error: unknown): string =>
{
    const name = (error as { name?: string; message?: string })?.name ?? '';

    if(name.includes('NotAllowed') || name.includes('Permission')) return 'Permissão negada no navegador — libere mic/câmera nas configurações do site (ícone do cadeado na barra de endereço).';
    if(name.includes('NotFound')) return 'Nenhum dispositivo encontrado.';
    if(name.includes('NotReadable')) return 'O dispositivo está em uso por outro aplicativo.';
    if(name.includes('getDisplayMedia') || name.includes('AbortError')) return 'Compartilhamento de tela cancelado.';

    return 'Falha ao acessar o dispositivo: ' + (name || 'erro desconhecido');
};

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

            console.log('[Octane] [Voice] CONECTADO ao LiveKit', room.name);

            useVoiceStore.getState().setConnected(true);
            useVoiceStore.getState().setConnecting(false);
            useVoiceStore.getState().setError('');
            useVoiceStore.getState().setMicOn(false);
            useVoiceStore.getState().setCamOn(false);
            useVoiceStore.getState().setScreenOn(false);
            this._refreshRemoteCount();
            this.refreshDevices();
        }
        catch (error)
        {
            console.error('[Octane] [Voice] FALHA ao conectar ao LiveKit:', error);
            console.error('[Octane] [Voice] url tentada:', url, '| token (20 chars):', token?.slice(0, 20));

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
            console.log('[Octane] [Voice] setMicrophoneEnabled(' + enabled + ') — pedindo permissão ao navegador…');
            await participant.setMicrophoneEnabled(enabled);
            console.log('[Octane] [Voice] mic ' + (enabled ? 'LIGADO' : 'DESLIGADO'), participant.getTrackPublication(Track.Source.Microphone)?.track);
        }
        catch (error)
        {
            console.error('[Octane] [Voice] ERRO no microfone:', error);

            useVoiceStore.getState().setError(describeMediaError(error));

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
            console.log('[Octane] [Voice] setCameraEnabled(' + enabled + ') — pedindo permissão ao navegador…');
            await participant.setCameraEnabled(enabled);
            console.log('[Octane] [Voice] câmera ' + (enabled ? 'LIGADA' : 'DESLIGADA'));
        }
        catch (error)
        {
            console.error('[Octane] [Voice] ERRO na câmera:', error);

            useVoiceStore.getState().setError(describeMediaError(error));

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
            console.log('[Octane] [Voice] setScreenShareEnabled(' + enabled + ') — abrindo seletor do navegador…');
            await participant.setScreenShareEnabled(enabled, { audio: true });
            console.log('[Octane] [Voice] tela ' + (enabled ? 'COMPARTILHADA' : 'PARADA'));
        }
        catch (error)
        {
            console.error('[Octane] [Voice] ERRO no compartilhamento de tela:', error);

            useVoiceStore.getState().setError(describeMediaError(error));
            useVoiceStore.getState().setScreenOn(!enabled); // revert (e.g. picker cancelled)

            return false;
        }

        useVoiceStore.getState().setScreenOn(enabled);

        return true;
    }

    /** Lists the browser's mic/camera/speaker devices (labels need prior permission). */
    public async refreshDevices(): Promise<void>
    {
        try
        {
            const devices = await navigator.mediaDevices.enumerateDevices();

            useVoiceStore.getState().setDevices(devices);
        }
        catch
        {
            // without permission the list comes back empty-labeled; not fatal
        }
    }

    public async setMicDevice(deviceId: string): Promise<void>
    {
        const store = useVoiceStore.getState();

        if(this.isConnected && this._room.switchActiveDevice)
        {
            try
            {
                await this._room.switchActiveDevice('audioinput', deviceId);
            }
            catch (error)
            {
                store.setError(describeMediaError(error));
            }
        }

        store.setMicDeviceId(deviceId);
    }

    public async setSpeakerDevice(deviceId: string): Promise<void>
    {
        const store = useVoiceStore.getState();

        if(this.isConnected && this._room.switchActiveDevice)
        {
            try
            {
                await this._room.switchActiveDevice('audiooutput', deviceId);
            }
            catch (error)
            {
                store.setError(describeMediaError(error));
            }
        }

        store.setSpeakerDeviceId(deviceId);
    }

    /** Applies the saved volume to every subscribed remote mic track. */
    public setVolume(volume: number): void
    {
        const store = useVoiceStore.getState();

        store.setVolume(volume);

        for(const participant of Array.from(this._room?.remoteParticipants.values() ?? []))
        {
            const track = participant.getTrackPublication(Track.Source.Microphone)?.track as RemoteAudioTrack | undefined;

            if(track && typeof track.setVolume === 'function') track.setVolume(volume);
        }
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
            console.log('[Octane] [Voice] track remoto recebido:', track.source, track.kind);

            if(track.source === Track.Source.Microphone)
            {
                track.attach(); // creates + plays an <audio> element automatically

                const { volume } = useVoiceStore.getState();
                const remote = track as RemoteAudioTrack;

                if(typeof remote.setVolume === 'function') remote.setVolume(volume);

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
