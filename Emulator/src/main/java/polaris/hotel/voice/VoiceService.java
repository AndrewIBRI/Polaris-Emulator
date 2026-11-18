package polaris.hotel.voice;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import com.google.gson.JsonObject;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import polaris.Emulator;

/**
 * Issues LiveKit access tokens for the in-room voice system (docs/PLANO-VOZ-CAMERA.md).
 *
 * A token is a plain HS256 JWT signed with the shared API secret; the LiveKit server
 * validates it on connect. Everything is configured via config.ini / env:
 *
 *   voice.livekit.url       public URL the client connects to (wss://host/livekit)
 *   voice.livekit.api_key   shared API key
 *   voice.livekit.api_secret shared API secret
 */
public class VoiceService {
    private static final Logger LOGGER = LoggerFactory.getLogger(VoiceService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    public static boolean isConfigured() {
        return getApiKey() != null && getApiSecret() != null && getServerUrl() != null;
    }

    public static String getServerUrl() {
        String url = Emulator.getConfig().getValue("voice.livekit.url", "");
        return (url == null || url.isBlank()) ? null : url.trim();
    }

    public static String getApiKey() {
        String key = Emulator.getConfig().getValue("voice.livekit.api_key", "");
        return (key == null || key.isBlank()) ? null : key.trim();
    }

    public static String getApiSecret() {
        String secret = Emulator.getConfig().getValue("voice.livekit.api_secret", "");
        return (secret == null || secret.isBlank()) ? null : secret.trim();
    }

    /**
     * Builds a LiveKit room-join token for the given user in the given room.
     * Room names are "hotel-<roomId>" so a connection is scoped to one hotel room.
     */
    public static String createRoomToken(String identity, String displayName, int roomId) {
        String apiKey = getApiKey();
        String apiSecret = getApiSecret();
        if (apiKey == null || apiSecret == null) return null;

        long now = Instant.now().getEpochSecond();
        String roomName = "hotel-" + roomId;

        JsonObject video = new JsonObject();
        video.addProperty("roomJoin", true);
        video.addProperty("room", roomName);
        video.addProperty("roomCreate", true);
        video.addProperty("roomList", true);
        video.addProperty("canPublish", true);
        video.addProperty("canSubscribe", true);
        video.addProperty("canPublishData", true);
        video.addProperty("hidden", false);
        video.addProperty("recorder", false);

        JsonObject claims = new JsonObject();
        claims.addProperty("iss", apiKey);
        claims.addProperty("sub", identity);
        claims.addProperty("iat", now);
        claims.addProperty("nbf", now - 30);
        claims.addProperty("exp", now + 12 * 3600);
        claims.addProperty("jti", identity + "-" + roomName);
        claims.addProperty("name", displayName == null ? identity : displayName);
        claims.add("video", video);

        String payload = claims.toString();

        String encodedHeader = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String encodedPayload = base64Url(payload);
        String signingInput = encodedHeader + "." + encodedPayload;

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(apiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature = mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8));
            return signingInput + "." + base64UrlBytes(signature);
        } catch (Exception e) {
            LOGGER.error("Failed to sign LiveKit token for identity `{}`", identity, e);
            return null;
        }
    }

    public static String generateApiSecret() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return base64UrlBytes(bytes);
    }

    private static String base64Url(String value) {
        return base64UrlBytes(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String base64UrlBytes(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
