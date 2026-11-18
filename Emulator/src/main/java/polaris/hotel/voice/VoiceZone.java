package polaris.hotel.voice;

/**
 * A rectangular audio zone on the room floor (tile coordinates).
 * Zones are edited in-game by admins (editor styled after the floor plan
 * editor) and drive the client-side spatial audio: players in the same
 * zone hear each other, other zones bleed, outside tiles are muffled.
 */
public record VoiceZone(int id, String name, int x, int y, int width, int height) {
}
