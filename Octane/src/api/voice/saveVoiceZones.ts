import { SendMessageComposer } from '..';
import { SaveVoiceZonesComposer } from '@octane/renderer';
import { IZone } from '@octane/renderer';

/** Sends the saved voice zones + per-room factors to the emulator.
 *  Kept OUT of useVoice() on purpose: useVoice() registers message handlers,
 *  and mounting it twice (widget + zone editor) would double-connect LiveKit. */
export const saveVoiceZones = (zones: IZone[], factors: { same: number; other: number; outside: number }, videoGlobal: boolean) =>
{
    SendMessageComposer(new SaveVoiceZonesComposer(factors, videoGlobal, zones));
};
