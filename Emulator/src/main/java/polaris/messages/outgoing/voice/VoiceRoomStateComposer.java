package polaris.messages.outgoing.voice;

import polaris.messages.ServerMessage;
import polaris.messages.outgoing.MessageComposer;
import polaris.messages.outgoing.Outgoing;

/**
 * Room-wide voice state: whether the room is in "assembleia" mode (everyone
 * hears everyone regardless of position/zone) and, in later phases, the
 * per-user zone map.
 */
public class VoiceRoomStateComposer extends MessageComposer {
    private final int roomId;
    private final boolean assemblyMode;

    public VoiceRoomStateComposer(int roomId, boolean assemblyMode) {
        this.roomId = roomId;
        this.assemblyMode = assemblyMode;
    }

    @Override
    protected ServerMessage composeInternal() {
        this.response.init(Outgoing.VoiceRoomStateComposer);
        this.response.appendInt(this.roomId);
        this.response.appendBoolean(this.assemblyMode);
        return this.response;
    }
}
