import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { classNames } from '../../../../layout';
import { useVoice } from '../../../../hooks/voice/useVoice';
import { useVoiceStore } from '../../../../state/voiceStore';
import '../../../../css/room/VoiceWidget.css';

/**
 * HUD do sistema de voz de sala (docs/PLANO-VOZ-CAMERA.md): microfone,
 * câmera, compartilhamento de tela, indicador do modo "assembleia" e um
 * menu de configuração (dispositivos de áudio + volume).
 * Clique com o botão direito no microfone alterna o mute automático
 * ao perder o foco (só quando ninguém está ouvindo).
 */
export const VoiceWidgetView: FC<{}> = (props) =>
{
    const { requestToken, disconnect, toggleMic, toggleCam, toggleScreen, refreshDevices, setMicDevice, setSpeakerDevice, setVolume } = useVoice();

    const { connected, connecting, micOn, camOn, screenOn, assembly, remoteCount, autoMuteOnBlur, autoMuted, error, devices, micDeviceId, speakerDeviceId, volume, setAutoMuteOnBlur } = useVoiceStore();

    const [ menuOpen, setMenuOpen ] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() =>
    {
        requestToken();

        return () => disconnect();
    }, [ requestToken, disconnect ]);

    useEffect(() =>
    {
        if(!menuOpen) return;

        refreshDevices();

        const onOutside = (event: MouseEvent) =>
        {
            if(menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
        };

        window.addEventListener('mousedown', onOutside);

        return () => window.removeEventListener('mousedown', onOutside);
    }, [ menuOpen, refreshDevices ]);

    const mics = devices.filter((device) => device.kind === 'audioinput' && device.label);
    const speakers = devices.filter((device) => device.kind === 'audiooutput' && device.label);

    const onVolume = useCallback((event: React.ChangeEvent<HTMLInputElement>) =>
    {
        setVolume(parseFloat(event.target.value));
    }, [ setVolume ]);

    return (
        <div className="octane-voice-widget">
            <button
                type="button"
                className={ classNames('octane-voice-widget__button', (micOn || autoMuted) && 'is-active', error && !micOn && 'is-error') }
                disabled={ !connected && !connecting }
                onClick={ toggleMic }
                onContextMenu={ (event) =>
                    {
                        event.preventDefault();

                        setAutoMuteOnBlur(!autoMuteOnBlur);
                    } }
                title={ autoMuteOnBlur ? 'Mute automático ao perder foco: LIGADO' : 'Mute automático ao perder foco: DESLIGADO' }>
                <i className="octane-icon icon-mic" />
                { autoMuted && <span className="octane-voice-widget__badge">Zz</span> }
            </button>
            <button
                type="button"
                className={ classNames('octane-voice-widget__button', camOn && 'is-active', error && !camOn && 'is-error') }
                disabled={ !connected && !connecting }
                onClick={ toggleCam }
                title="Câmera">
                <i className="octane-icon icon-camera" />
            </button>
            <button
                type="button"
                className={ classNames('octane-voice-widget__button', screenOn && 'is-active') }
                disabled={ !connected && !connecting }
                onClick={ toggleScreen }
                title="Compartilhar tela">
                <i className="octane-icon icon-screenshare" />
            </button>
            <div className="octane-voice-widget__settings" ref={ menuRef }>
                <button
                    type="button"
                    className={ classNames('octane-voice-widget__button', menuOpen && 'is-active') }
                    onClick={ () => setMenuOpen(!menuOpen) }
                    title="Configurações de voz">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 4a8.6 8.6 0 0 0-.1-1.28l2.02-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.38.96a8.7 8.7 0 0 0-2.22-1.28L15.5.32A.5.5 0 0 0 15 0H9a.5.5 0 0 0-.5.42l-.36 2.54A8.7 8.7 0 0 0 5.92 4.2l-2.38-.96a.5.5 0 0 0-.6.22L1.02 6.78a.5.5 0 0 0 .12.64l2.02 1.58a8.6 8.6 0 0 0 0 2.56L1.14 13.14a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.38-.96a8.7 8.7 0 0 0 2.22 1.28l.36 2.54a.5.5 0 0 0 .5.42h6a.5.5 0 0 0 .5-.42l.36-2.54a8.7 8.7 0 0 0 2.22-1.28l2.38.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.02-1.58c.06-.42.1-.85.1-1.28z" transform="translate(0 2)" />
                    </svg>
                </button>
                { menuOpen &&
                    <div className="octane-voice-widget__menu">
                        <div className="octane-voice-widget__menu-status">
                            { connecting && 'Conectando…' }
                            { connected && !error && 'Voz conectada ✓' }
                            { !connected && !connecting && 'Desconectado' }
                        </div>
                        { error &&
                            <div className="octane-voice-widget__menu-error">{ error }</div> }
                        <label className="octane-voice-widget__menu-label">
                            Microfone
                            <select value={ micDeviceId } onChange={ (event) => setMicDevice(event.target.value) }>
                                <option value="">Padrão do sistema</option>
                                { mics.map((device) =>
                                    <option key={ device.deviceId } value={ device.deviceId }>{ device.label }</option>) }
                            </select>
                        </label>
                        <label className="octane-voice-widget__menu-label">
                            Alto-falante
                            <select value={ speakerDeviceId } onChange={ (event) => setSpeakerDevice(event.target.value) }>
                                <option value="">Padrão do sistema</option>
                                { speakers.map((device) =>
                                    <option key={ device.deviceId } value={ device.deviceId }>{ device.label }</option>) }
                            </select>
                        </label>
                        <label className="octane-voice-widget__menu-label">
                            Volume dos outros: { Math.round(volume * 100) }%
                            <input type="range" min="0" max="1" step="0.05" value={ volume } onChange={ onVolume } />
                        </label>
                        <div className="octane-voice-widget__menu-check">
                            <input
                                id="octane-voice-automute"
                                type="checkbox"
                                checked={ autoMuteOnBlur }
                                onChange={ () => setAutoMuteOnBlur(!autoMuteOnBlur) } />
                            <label htmlFor="octane-voice-automute">Mute automático ao perder o foco</label>
                        </div>
                    </div> }
            </div>
            { assembly &&
                <div className="octane-voice-widget__assembly">
                    Modo assembleia
                </div> }
            { (remoteCount > 0) &&
                <div className="octane-voice-widget__assembly" style={ { background: 'rgba(255,255,255,0.08)', borderColor: 'transparent', color: '#fff' } }>
                    { remoteCount }
                </div> }
        </div>
    );
};
