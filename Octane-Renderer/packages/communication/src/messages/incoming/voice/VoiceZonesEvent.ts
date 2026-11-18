import { IMessageEvent } from '@octane/api';
import { MessageEvent } from '@octane/events';
import { VoiceZonesParser } from '../../parser';

export class VoiceZonesEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, VoiceZonesParser);
    }

    public getParser(): VoiceZonesParser
    {
        return this.parser as VoiceZonesParser;
    }
}
