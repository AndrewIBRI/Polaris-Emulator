import { IMessageDataWrapper, IMessageParser } from '@octane/api';

/** Custom voice event (6104): room voice state — assembly (everyone hears everyone) flag. */
export class VoiceRoomStateParser implements IMessageParser
{
    private _roomId: number = 0;
    private _assembly: boolean = false;

    public flush(): boolean
    {
        this._roomId = 0;
        this._assembly = false;

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._roomId = wrapper.readInt();
        this._assembly = wrapper.readBoolean();

        return true;
    }

    public get roomId(): number
    {
        return this._roomId;
    }

    public get assembly(): boolean
    {
        return this._assembly;
    }
}
