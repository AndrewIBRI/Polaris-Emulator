import { createOctaneStore } from './createOctaneStore';

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
}

const STORAGE_KEY = 'octane:voice:auto-mute-on-blur';

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
