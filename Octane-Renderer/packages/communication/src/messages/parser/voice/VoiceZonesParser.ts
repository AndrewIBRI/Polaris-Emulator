import { IMessageDataWrapper, IMessageParser } from '@octane/api';

export interface IZone
{
    id: number;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Custom voice event (6106): room audio zones + edit permission. */
export class VoiceZonesParser implements IMessageParser
{
    private _roomId: number = 0;
    private _canEdit: boolean = false;
    private _zones: IZone[] = [];

    public flush(): boolean
    {
        this._roomId = 0;
        this._canEdit = false;
        this._zones = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._roomId = wrapper.readInt();
        this._canEdit = wrapper.readBoolean();

        const count = wrapper.readInt();

        for(let i = 0; i < count; i++)
        {
            this._zones.push({
                id: wrapper.readInt(),
                name: wrapper.readString(),
                x: wrapper.readInt(),
                y: wrapper.readInt(),
                width: wrapper.readInt(),
                height: wrapper.readInt()
            });
        }

        return true;
    }

    public get roomId(): number
    {
        return this._roomId;
    }

    public get canEdit(): boolean
    {
        return this._canEdit;
    }

    public get zones(): IZone[]
    {
        return this._zones;
    }
}
