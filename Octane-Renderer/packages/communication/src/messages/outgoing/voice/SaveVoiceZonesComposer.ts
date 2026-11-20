import { IMessageComposer } from '@octane/api';

/** Custom voice composer (6107): saves the room's audio zones (admin only). */
export class SaveVoiceZonesComposer implements IMessageComposer<(string | number | boolean)[]>
{
    private _data: (string | number | boolean)[];

    constructor(factors: { same: number; other: number; outside: number }, videoGlobal: boolean, zones: { name: string; x: number; y: number; width: number; height: number }[])
    {
        this._data = [ factors.same, factors.other, factors.outside, videoGlobal, zones.length ];

        for(const zone of zones)
        {
            this._data.push(zone.name, zone.x, zone.y, zone.width, zone.height);
        }
    }

    public getMessageArray(): (string | number | boolean)[]
    {
        return this._data;
    }

    public dispose(): void
    {
        this._data = null;
    }
}
