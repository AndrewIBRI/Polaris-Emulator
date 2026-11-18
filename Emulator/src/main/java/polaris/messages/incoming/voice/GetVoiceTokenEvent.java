package polaris.messages.incoming.voice;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import polaris.hotel.rooms.Room;
import polaris.hotel.voice.VoiceService;
import polaris.messages.ClientMessage;
import polaris.messages.incoming.MessageHandler;
import polaris.messages.outgoing.voice.VoiceRoomStateComposer;
import polaris.messages.outgoing.voice.VoiceTokenComposer;

/**
 * Client asks for a LiveKit access token (sent right after entering a room).
 * Answers with the public LiveKit URL + a room-scoped JWT, followed by the
 * room's voice state (assembleia flag). If voice is not configured, only the
 * state is sent so the client stays silent without hanging.
 */
public class GetVoiceTokenEvent extends MessageHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(GetVoiceTokenEvent.class);

    @Override
    public void handle() throws Exception {
        final Room room = this.currentRoom();
        if (room == null) return;

        if (this.client.getUser() == null
                || this.client.getUser().getUserInfo() == null
                || !VoiceService.isConfigured()) {
            this.client.sendResponse(new VoiceRoomStateComposer(room.getId(), room.isVoiceAssembly()));
            return;
        }

        final String identity = "user-" + this.client.getUser().getUserInfo().getId();
        final String displayName = this.client.getUser().getUserInfo().getUsername();
        final String token = VoiceService.createRoomToken(identity, displayName, room.getId());

        if (token == null) {
            LOGGER.warn("Voice token generation failed for `{}` in room {}", identity, room.getId());
            this.client.sendResponse(new VoiceRoomStateComposer(room.getId(), room.isVoiceAssembly()));
            return;
        }

        this.client.sendResponse(new VoiceTokenComposer(VoiceService.getServerUrl(), token));
        this.client.sendResponse(new VoiceRoomStateComposer(room.getId(), room.isVoiceAssembly()));
    }
}
