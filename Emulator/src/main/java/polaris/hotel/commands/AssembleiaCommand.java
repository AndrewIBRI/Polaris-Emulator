package polaris.hotel.commands;

import polaris.Emulator;
import polaris.hotel.gameclients.GameClient;
import polaris.hotel.rooms.Room;
import polaris.hotel.rooms.RoomChatMessageBubbles;

/**
 * :assembleia — toggles "assembly" voice mode for the current room: everyone
 * hears everyone regardless of position (overrides spatial zones while on).
 * Room owners and staff with rights can toggle it; state broadcasts to the room.
 */
public class AssembleiaCommand extends Command {
    public AssembleiaCommand() {
        super(
                "cmd_roommute",
                Emulator.getTexts()
                        .getValue("commands.keys.cmd_assembleia", "assembleia")
                        .split(";"));
    }

    @Override
    public boolean handle(GameClient gameClient, String[] params) throws Exception {
        Room room = gameClient.getUser().getUserInfo().getCurrentRoom();
        if (room == null) return true;

        boolean newValue = !room.isVoiceAssembly();
        room.setVoiceAssembly(newValue);

        final String message = newValue
                ? Emulator.getTexts()
                        .getValue("commands.generic.cmd_assembleia.on", "Modo assembleia ativado: todos se ouvem na sala.")
                : Emulator.getTexts()
                        .getValue("commands.generic.cmd_assembleia.off", "Modo assembleia desativado: voz por proximidade.");

        gameClient.getUser().whisper(message, RoomChatMessageBubbles.ALERT);
        return true;
    }
}
