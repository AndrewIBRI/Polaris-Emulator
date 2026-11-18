import { IMessageDataWrapper, IMessageParser } from '@octane/api';

/** Custom voice event (6101): LiveKit URL + room-scoped access token. */
export class VoiceTokenParser implements IMessageParser
{
    private _url: string = '';
    private _token: string = '';

    public flush(): boolean
    {
        this._url = '';
        this._token = '';

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._url = wrapper.readString();
        this._token = wrapper.readString();

        return true;
    }

    public get url(): string
    {
        return this._url;
    }

    public get token(): string
    {
        return this._token;
    }
}
