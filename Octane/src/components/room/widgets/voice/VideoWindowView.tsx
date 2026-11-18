import { FC, useCallback, useEffect, useRef } from 'react';
import { DraggableWindowPosition, OctaneCardContentView, OctaneCardHeaderView, OctaneCardView } from '../../../../common';
import { useVoiceStore, VoiceVideo } from '../../../../state/voiceStore';
import { voiceConnection } from '../../../../api/voice/VoiceConnection';
import '../../../../css/room/VoiceWidget.css';

/**
 * Janela de transmissão (mesma linguagem visual das janelas do jogo):
 * mostra a câmera e a tela compartilhada — locais e de todo mundo na sala —
 * com fullscreen e volume (áudio da tela compartilhada).
 */
const VideoTile: FC<{ video: VoiceVideo }> = ({ video }) =>
{
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() =>
    {
        const element = videoRef.current;

        if(!element) return;

        element.srcObject = new MediaStream([ video.track ]);
        element.play().catch(() =>
        {
            // autoplay pode falhar sem gesto; o próximo play (interação) recupera
        });

        return () =>
        {
            element.srcObject = null;
        };
    }, [ video.track ]);

    const label = video.local ? 'Você' : video.identity;

    return (
        <div className="octane-video-window__tile">
            <video
                ref={ videoRef }
                className="octane-video-window__video"
                autoPlay
                muted={ video.local }
                playsInline />
            <span className="octane-video-window__label">
                { label } · { video.source === 'camera' ? 'Câmera' : 'Tela' }
            </span>
        </div>
    );
};

export const VideoWindowView: FC<{}> = () =>
{
    const containerRef = useRef<HTMLDivElement>(null);

    const { videos, volume, videoWindowVisible, setVideoWindowVisible, setVolume } = useVoiceStore();

    const onVolume = useCallback((event: React.ChangeEvent<HTMLInputElement>) =>
    {
        voiceConnection.setVolume(parseFloat(event.target.value));
    }, []);

    const onFullscreen = useCallback(() =>
    {
        const element = containerRef.current;

        if(!element) return;

        if(document.fullscreenElement)
        {
            document.exitFullscreen().catch(() => {});
        }
        else
        {
            element.requestFullscreen().catch(() => {});
        }
    }, []);

    if(!videos.length || !videoWindowVisible) return null;

    return (
        <OctaneCardView
            className="octane-video-window"
            disableDrag={ false }
            style={ { pointerEvents: 'auto' } }
            theme="primary-slim"
            uniqueKey="voice-video-window"
            windowPosition={ DraggableWindowPosition.CENTER }>
            <OctaneCardHeaderView
                headerText="Transmissão"
                onCloseClick={ () => setVideoWindowVisible(false) } />
            <OctaneCardContentView className="bg-[#1b1b1f] relative" overflow="auto">
                <div ref={ containerRef } className="octane-video-window__grid">
                    { videos.map((video) =>
                        <VideoTile key={ video.id } video={ video } />) }
                </div>
                <div className="octane-video-window__controls">
                    <button
                        className="octane-video-window__btn"
                        type="button"
                        onClick={ onFullscreen }
                        title="Tela cheia">
                        ⛶ Tela cheia
                    </button>
                    <label className="octane-video-window__volume">
                        🔊 { Math.round(volume * 100) }%
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={ volume }
                            onChange={ onVolume } />
                    </label>
                </div>
            </OctaneCardContentView>
        </OctaneCardView>
    );
};
