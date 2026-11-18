package polaris.messages.incoming.voice;

import polaris.hotel.rooms.Room;
import polaris.messages.ClientMessage;
import polaris.messages.incoming.MessageHandler;
import polaris.messages.outgoing.voice.VoiceZonesComposer;

/**
 * Client asks for the room's audio zones (sent on room entry and whenever
 * the zone editor opens). Replies with the zones + edit permission.
 */
public class GetVoiceZonesEvent extends MessageHandler {
    @Override
    public void handle() throws Exception {
        final Room room = this.currentRoom();
        if (room == null) return;

        boolean canEdit = room.canEditVoiceZones(this.client.getUser());
        this.client.sendResponse(new VoiceZonesComposer(room.getId(), canEdit, room.getVoiceZones()));
    }
}
