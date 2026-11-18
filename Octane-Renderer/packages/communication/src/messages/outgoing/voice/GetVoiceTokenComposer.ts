import { IMessageComposer } from '@octane/api';

/** Custom voice composer (6102): asks the emulator for a LiveKit access token after entering a room. */
export class GetVoiceTokenComposer implements IMessageComposer<[]>
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
