package polaris.messages.outgoing.voice;

import polaris.hotel.voice.VoiceZone;
import polaris.messages.ServerMessage;
import polaris.messages.outgoing.MessageComposer;
import polaris.messages.outgoing.Outgoing;

import java.util.List;

/**
 * The room's audio zones + whether the receiving user may edit them.
 * Structure: roomId, canEdit, sameFactor, otherFactor, outsideFactor (percent),
 * count, then per zone: id, name, x, y, width, height.
 */
public class VoiceZonesComposer extends MessageComposer {
    private final int roomId;
    private final boolean canEdit;
    private final int sameFactor;
    private final int otherFactor;
    private final int outsideFactor;
    private final List<VoiceZone> zones;

    public VoiceZonesComposer(int roomId, boolean canEdit, int sameFactor, int otherFactor, int outsideFactor, List<VoiceZone> zones) {
        this.roomId = roomId;
        this.canEdit = canEdit;
        this.sameFactor = sameFactor;
        this.otherFactor = otherFactor;
        this.outsideFactor = outsideFactor;
        this.zones = zones == null ? List.of() : zones;
    }

    @Override
    protected ServerMessage composeInternal() {
        this.response.init(Outgoing.VoiceZonesComposer);
        this.response.appendInt(this.roomId);
        this.response.appendBoolean(this.canEdit);
        this.response.appendInt(this.sameFactor);
        this.response.appendInt(this.otherFactor);
        this.response.appendInt(this.outsideFactor);
        this.response.appendInt(this.zones.size());

        for (VoiceZone zone : this.zones) {
            this.response.appendInt(zone.id());
            this.response.appendString(zone.name());
            this.response.appendInt(zone.x());
            this.response.appendInt(zone.y());
            this.response.appendInt(zone.width());
            this.response.appendInt(zone.height());
        }

        return this.response;
    }
}
