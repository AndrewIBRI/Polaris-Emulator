import { useCallback, useEffect, useRef } from 'react';
import { SendMessageComposer } from '../../api';
import { voiceConnection } from '../../api/voice/VoiceConnection';
import { useVoiceStore } from '../../state/voiceStore';
import { useMessageEvent } from '../events';
import { GetVoiceTokenComposer, VoiceRoomStateEvent, VoiceTokenEvent } from '@octane/renderer';

/**
 * Wires the room voice system (docs/PLANO-VOZ-CAMERA.md): asks the emulator
 * for a LiveKit token as soon as the widget mounts, connects on
 * VoiceTokenEvent, follows VoiceRoomStateEvent (assembleia on/off) and
 * implements mute-on-blur (mic off when the window loses focus, but only if
 * nobody is listening).
 */
export const useVoice = () =>
{
    const requestToken = useCallback(() =>
    {
        SendMessageComposer(new GetVoiceTokenComposer());
    }, []);

    const disconnect = useCallback(() =>
    {
        voiceConnection.disconnect();
    }, []);

    const toggleMic = useCallback(() =>
    {
        const { micOn, connected } = useVoiceStore.getState();

        if(!connected)
        {
            console.warn('[Octane] [Voice] toggleMic ignorado: voz NÃO está conectada');

            return;
        }

        voiceConnection.setMicEnabled(!micOn);
    }, []);

    const toggleCam = useCallback(() =>
    {
        const { camOn, connected } = useVoiceStore.getState();

        if(!connected) return;

        voiceConnection.setCameraEnabled(!camOn);
    }, []);

    const toggleScreen = useCallback(() =>
    {
        const { screenOn, connected } = useVoiceStore.getState();

        if(!connected) return;

        voiceConnection.setScreenShareEnabled(!screenOn);
    }, []);

    const refreshDevices = useCallback(() => voiceConnection.refreshDevices(), []);

    const setMicDevice = useCallback((deviceId: string) => voiceConnection.setMicDevice(deviceId), []);

    const setSpeakerDevice = useCallback((deviceId: string) => voiceConnection.setSpeakerDevice(deviceId), []);

    const setVolume = useCallback((volume: number) => voiceConnection.setVolume(volume), []);

    useMessageEvent<VoiceTokenEvent>(VoiceTokenEvent, (event) =>
    {
        const parser = event.getParser();

        if(!parser.url || !parser.token) return;

        voiceConnection.connect(parser.url, parser.token).catch(() => voiceConnection.disconnect());
    });

    useMessageEvent<VoiceRoomStateEvent>(VoiceRoomStateEvent, (event) =>
    {
        useVoiceStore.getState().setAssembly(event.getParser().assembly);
    });

    // Mute-on-blur: only when the user enabled it and nobody else is in the call.
    const wasMutedByBlur = useRef(false);

    useEffect(() =>
    {
        const onHide = () =>
        {
            const { autoMuteOnBlur, micOn, connected, remoteCount, setMicOn, setAutoMuted } = useVoiceStore.getState();

            if(!connected || !autoMuteOnBlur || document.visibilityState !== 'hidden') return;

            if(micOn && remoteCount === 0)
            {
                wasMutedByBlur.current = true;

                voiceConnection.setMicEnabled(false);
                setMicOn(false);
                setAutoMuted(true);
            }
        };

        const onVisible = () =>
        {
            if(document.visibilityState !== 'visible') return;

            if(wasMutedByBlur.current)
            {
                wasMutedByBlur.current = false;

                voiceConnection.setMicEnabled(true);
            }
        };

        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('focus', onVisible);

        return () =>
        {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('focus', onVisible);
        };
    }, []);

    return { requestToken, disconnect, toggleMic, toggleCam, toggleScreen, refreshDevices, setMicDevice, setSpeakerDevice, setVolume };
};
