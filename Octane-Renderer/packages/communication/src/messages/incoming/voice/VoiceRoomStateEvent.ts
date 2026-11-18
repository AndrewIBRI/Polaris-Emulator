import { IMessageEvent } from '@octane/api';
import { MessageEvent } from '@octane/events';
import { VoiceRoomStateParser } from '../../parser';

export class VoiceRoomStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, VoiceRoomStateParser);
    }

    public getParser(): VoiceRoomStateParser
    {
        return this.parser as VoiceRoomStateParser;
    }
}
