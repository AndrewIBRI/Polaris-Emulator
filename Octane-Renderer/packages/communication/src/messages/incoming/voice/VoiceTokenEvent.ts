import { IMessageEvent } from '@octane/api';
import { MessageEvent } from '@octane/events';
import { VoiceTokenParser } from '../../parser';

export class VoiceTokenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, VoiceTokenParser);
    }

    public getParser(): VoiceTokenParser
    {
        return this.parser as VoiceTokenParser;
    }
}
