import { createOctaneStore } from './createOctaneStore';

/** One video tile in the transmission window (local preview or remote stream). */
export interface VoiceVideo
{
    /** Unique key: participantIdentity + ':' + source. */
    id: string;
    /** LiveKit participant identity (user-<id>) or 'Eu'. */
    identity: string;
    /** 'camera' | 'screen' */
    source: 'camera' | 'screen';
    /** The video MediaStreamTrack to render in a <video> element. */
    track: MediaStreamTrack;
    /** True when the track is our own local publish (no audio, show "Você"). */
    local: boolean;
}

/**
 * In-room voice state (LiveKit self-hosted, docs/PLANO-VOZ-CAMERA.md):
 * HUD switches, spatial ("proximity") mode vs "assembleia" (everyone hears
 * everyone) and the mute-on-blur user preference.
 */
interface VoiceState {
    /** LiveKit server url + access token handed by the emulator. */
    url: string;
    token: string;
    connected: boolean;
    connecting: boolean;
    /** "Assembleia" mode: everyone in the room hears everyone. */
    assembly: boolean;
    micOn: boolean;
    camOn: boolean;
    screenOn: boolean;
    /** Other people currently in the voice call. */
    remoteCount: number;
    /** Mute the mic automatically when the window loses focus, but only when nobody is listening. */
    autoMuteOnBlur: boolean;
    /** True while the auto-mute is active (focus left, mic forced off). */
    autoMuted: boolean;
    /** Last permission/device error message, shown in the settings menu. */
    error: string;
    /** Audio/video devices detected in the browser. */
    devices: MediaDeviceInfo[];
    /** Selected devices (persisted). */
    micDeviceId: string;
    speakerDeviceId: string;
    /** Remote audio volume, 0..1 (persisted). */
    volume: number;
    /** Video tiles currently published in the room (local + remote). */
    videos: VoiceVideo[];
    /** Whether the transmission window is open. */
    videoWindowVisible: boolean;

    setUrl: (url: string) => void;
    setToken: (token: string) => void;
    setConnected: (connected: boolean) => void;
    setConnecting: (connecting: boolean) => void;
    setAssembly: (assembly: boolean) => void;
    setMicOn: (micOn: boolean) => void;
    setCamOn: (camOn: boolean) => void;
    setScreenOn: (screenOn: boolean) => void;
    setRemoteCount: (remoteCount: number) => void;
    setAutoMuteOnBlur: (autoMuteOnBlur: boolean) => void;
    setAutoMuted: (autoMuted: boolean) => void;
    setError: (error: string) => void;
    setDevices: (devices: MediaDeviceInfo[]) => void;
    setMicDeviceId: (micDeviceId: string) => void;
    setSpeakerDeviceId: (speakerDeviceId: string) => void;
    setVolume: (volume: number) => void;
    /** Adds/updates a video tile; opening a new one re-opens the window. */
    addVideo: (video: VoiceVideo) => void;
    removeVideo: (id: string) => void;
    clearVideos: () => void;
    setVideoWindowVisible: (visible: boolean) => void;
}

const STORAGE_KEY = 'octane:voice:auto-mute-on-blur';

const loadPref = (key: string, fallback: string): string =>
{
    try
    {
        return window.localStorage.getItem('octane:voice:' + key) ?? fallback;
    }
    catch
    {
        return fallback;
    }
};

const savePref = (key: string, value: string): void =>
{
    try
    {
        window.localStorage.setItem('octane:voice:' + key, value);
    }
    catch
    {
        // storage can be blocked; the preference just won't persist
    }
};

const loadAutoMuteOnBlur = (): boolean =>
{
    try
    {
        return window.localStorage.getItem(STORAGE_KEY) === '1';
    }
    catch
    {
        return false;
    }
};

export const useVoiceStore = createOctaneStore<VoiceState>()((set) => ({
    url: '',
    token: '',
    connected: false,
    connecting: false,
    assembly: false,
    micOn: false,
    camOn: false,
    screenOn: false,
    remoteCount: 0,
    autoMuteOnBlur: loadAutoMuteOnBlur(),
    autoMuted: false,
    error: '',
    devices: [],
    micDeviceId: loadPref('mic-device', ''),
    speakerDeviceId: loadPref('speaker-device', ''),
    volume: parseFloat(loadPref('volume', '1')) || 1,
    videos: [],
    videoWindowVisible: true,

    addVideo: (video) => set((state) =>
    {
        const videos = state.videos.filter((existing) => existing.id !== video.id);

        videos.push(video);

        // a new stream arriving re-opens the transmission window
        return { videos, videoWindowVisible: true };
    }),
    removeVideo: (id) => set((state) => ({ videos: state.videos.filter((video) => video.id !== id) })),
    clearVideos: () => set({ videos: [] }),
    setVideoWindowVisible: (videoWindowVisible) => set({ videoWindowVisible }),

    setError: (error) => set({ error }),
    setDevices: (devices) => set({ devices }),
    setMicDeviceId: (micDeviceId) => { savePref('mic-device', micDeviceId); set({ micDeviceId }); },
    setSpeakerDeviceId: (speakerDeviceId) => { savePref('speaker-device', speakerDeviceId); set({ speakerDeviceId }); },
    setVolume: (volume) => { savePref('volume', String(volume)); set({ volume }); },

    setUrl: (url) => set({ url }),
    setToken: (token) => set({ token }),
    setConnected: (connected) => set({ connected }),
    setConnecting: (connecting) => set({ connecting }),
    setAssembly: (assembly) => set({ assembly }),
    setMicOn: (micOn) => set({ micOn }),
    setCamOn: (camOn) => set({ camOn }),
    setScreenOn: (screenOn) => set({ screenOn }),
    setRemoteCount: (remoteCount) => set({ remoteCount }),
    setAutoMuteOnBlur: (autoMuteOnBlur) =>
    {
        try
        {
            window.localStorage.setItem(STORAGE_KEY, autoMuteOnBlur ? '1' : '0');
        }
        catch
        {
            // storage can be blocked; the preference just won't persist
        }

        set({ autoMuteOnBlur });
    },
    setAutoMuted: (autoMuted) => set({ autoMuted })
}));
