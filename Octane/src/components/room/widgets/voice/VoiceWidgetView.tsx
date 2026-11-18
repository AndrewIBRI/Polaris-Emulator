import { FC, useEffect } from 'react';
import { classNames } from '../../../../layout';
import { useVoice } from '../../../../hooks/voice/useVoice';
import { useVoiceStore } from '../../../../state/voiceStore';
import '../../../../css/room/VoiceWidget.css';

/**
 * HUD do sistema de voz de sala (docs/PLANO-VOZ-CAMERA.md): microfone,
 * câmera, compartilhamento de tela e indicador do modo "assembleia".
 * Clique com o botão direito no microfone alterna o mute automático
 * ao perder o foco (só quando ninguém está ouvindo).
 */
export const VoiceWidgetView: FC<{}> = (props) =>
{
    const { requestToken, disconnect, toggleMic, toggleCam, toggleScreen } = useVoice();

    const { connected, connecting, micOn, camOn, screenOn, assembly, remoteCount, autoMuteOnBlur, autoMuted, setAutoMuteOnBlur } = useVoiceStore();

    useEffect(() =>
    {
        requestToken();

        return () => disconnect();
    }, [requestToken, disconnect]);

    return (
        <div className="octane-voice-widget">
            <button
                type="button"
                className={ classNames('octane-voice-widget__button', (micOn || autoMuted) && 'is-active') }
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
                className={ classNames('octane-voice-widget__button', camOn && 'is-active') }
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
