import { IMessageComposer } from '@octane/api';

/** Custom voice composer (6105): asks the emulator for the room's audio zones. */
export class GetVoiceZonesComposer implements IMessageComposer<[]>
{
    public getMessageArray(): []
    {
        return [];
    }

    public dispose(): void
    {
        return;
    }
}
