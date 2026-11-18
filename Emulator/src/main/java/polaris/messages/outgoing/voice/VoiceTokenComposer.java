package polaris.messages.outgoing.voice;

import polaris.messages.ServerMessage;
import polaris.messages.outgoing.MessageComposer;
import polaris.messages.outgoing.Outgoing;

public class VoiceTokenComposer extends MessageComposer {
    private final String url;
    private final String token;

    public VoiceTokenComposer(String url, String token) {
        this.url = url;
        this.token = token;
    }

    @Override
    protected ServerMessage composeInternal() {
        this.response.init(Outgoing.VoiceTokenComposer);
        this.response.appendString(this.url);
        this.response.appendString(this.token);
        return this.response;
    }
}
