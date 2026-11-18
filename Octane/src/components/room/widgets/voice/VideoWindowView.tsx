import { FC, useCallback, useEffect, useRef } from 'react';
import { DraggableWindowPosition, OctaneCardContentView, OctaneCardHeaderView, OctaneCardView } from '../../../../common';
import { useVoiceStore, VoiceVideo } from '../../../../state/voiceStore';
import { voiceConnection } from '../../../../api/voice/VoiceConnection';
import '../../../../css/room/VoiceWidget.css';

/** Renders one video MediaStreamTrack in a <video> element. */
const VideoTile: FC<{ video: VoiceVideo; className?: string }> = ({ video, className }) =>
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
        <div className={ 'octane-video-window__tile' + (className ? ' ' + className : '') }>
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

const VolumeControl: FC<{}> = () =>
{
    const { volume, setVolume } = useVoiceStore();

    const onVolume = useCallback((event: React.ChangeEvent<HTMLInputElement>) =>
    {
        const parsed = parseFloat(event.target.value);

        setVolume(parsed);
        voiceConnection.setVolume(parsed);
    }, []);

    return (
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
    );
};

/**
 * Janela pop-up da CÂMERA (local + remotos), separada da transmissão.
 * Pequena, como nos apps de videochamada.
 */
export const CameraWindowView: FC<{}> = () =>
{
    const { videos, cameraWindowVisible, setCameraWindowVisible } = useVoiceStore();

    const cameras = videos.filter((video) => video.source === 'camera');

    if(!cameras.length || !cameraWindowVisible) return null;

    return (
        <OctaneCardView
            className="octane-video-window octane-video-window--camera"
            disableDrag={ false }
            style={ { pointerEvents: 'auto' } }
            theme="primary-slim"
            uniqueKey="voice-camera-window"
            windowPosition={ DraggableWindowPosition.CENTER }>
            <OctaneCardHeaderView
                headerText="Câmera"
                onCloseClick={ () => setCameraWindowVisible(false) } />
            <OctaneCardContentView className="bg-[#1b1b1f] relative" overflow="auto">
                <div className="octane-video-window__grid">
                    { cameras.map((video) =>
                        <VideoTile key={ video.id } video={ video } />) }
                </div>
            </OctaneCardContentView>
        </OctaneCardView>
    );
};

/**
 * Janela da TRANSMISSÃO (compartilhamento de tela, local + remoto).
 * Em tela cheia, a câmera vira picture-in-picture no canto inferior
 * direito, por cima da tela — como nos apps de videochamada.
 */
export const ScreenWindowView: FC<{}> = () =>
{
    const containerRef = useRef<HTMLDivElement>(null);

    const { videos, screenWindowVisible, setScreenWindowVisible } = useVoiceStore();

    const screens = videos.filter((video) => video.source === 'screen');
    const cameras = videos.filter((video) => video.source === 'camera');

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

    if(!screens.length || !screenWindowVisible) return null;

    return (
        <OctaneCardView
            className="octane-video-window octane-video-window--screen"
            disableDrag={ false }
            style={ { pointerEvents: 'auto' } }
            theme="primary-slim"
            uniqueKey="voice-screen-window"
            windowPosition={ DraggableWindowPosition.CENTER }>
            <OctaneCardHeaderView
                headerText="Transmissão"
                onCloseClick={ () => setScreenWindowVisible(false) } />
            <OctaneCardContentView className="bg-[#1b1b1f] relative" overflow="auto">
                <div ref={ containerRef } className="octane-video-window__stage">
                    <div className="octane-video-window__grid">
                        { screens.map((video) =>
                            <VideoTile key={ video.id } video={ video } />) }
                    </div>

                    { cameras.length > 0 &&
                        <div className="octane-video-window__pip">
                            { cameras.map((video) =>
                                <VideoTile key={ 'pip-' + video.id } video={ video } className="octane-video-window__tile--pip" />) }
                        </div> }

                    <div className="octane-video-window__controls">
                        <button
                            className="octane-video-window__btn"
                            type="button"
                            onClick={ onFullscreen }
                            title="Tela cheia">
                            ⛶ Tela cheia
                        </button>
                        <VolumeControl />
                    </div>
                </div>
            </OctaneCardContentView>
        </OctaneCardView>
    );
};
