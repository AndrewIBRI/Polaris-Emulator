import { useEffect, useRef } from 'react';
import { GetRoomEngine, GetSessionDataManager, RoomObjectCategory } from '@octane/renderer';
import { GetRoomSession } from '../../api';
import { voiceConnection } from '../../api/voice/VoiceConnection';
import { useVoiceStore, VoiceZoneArea } from '../../state/voiceStore';

const SPATIAL_TICK_MS = 500;

/** Volume levels: same zone = full, other zone = bleed, outside = muffled. */
const FACTOR_SAME = 1;
const FACTOR_OTHER = 0.1;
const FACTOR_OUTSIDE = 0.35;
const FACTOR_FULL = 1;

interface UserTile
{
    webID: number;
    x: number;
    y: number;
}

/** Reads every avatar's tile and applies per-participant volume by zone. */
const applySpatial = () =>
{
    const state = useVoiceStore.getState();

    // Sem zonas (ou modo assembleia): todos no mesmo volume.
    if(!state.zones.length || state.assembly)
    {
        for(const identity of state.spatialApplied)
        {
            voiceConnection.setSpatialVolume(identity, FACTOR_FULL);
        }

        return;
    }

    const session = GetRoomSession();

    if(!session) return;

    const userId = GetSessionDataManager().userId;
    const users: UserTile[] = [];

    for(const unit of GetRoomEngine().getRoomObjects(session.roomId, RoomObjectCategory.UNIT))
    {
        const userData = session.userDataManager.getUserDataByIndex(unit.id);

        if(!userData || userData.webID <= 0) continue;

        const location = (unit as { location: { x: number; y: number } }).location;

        if(!location) continue;

        users.push({ webID: userData.webID, x: Math.floor(location.x), y: Math.floor(location.y) });
    }

    const me = users.find((user) => user.webID === userId);

    // Sem a minha posição não dá para calcular: mantém o que já está aplicado.
    if(!me) return;

    const zoneOf = (zones: VoiceZoneArea[], x: number, y: number): number =>
    {
        for(let i = 0; i < zones.length; i++)
        {
            const zone = zones[i];

            if(x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height) return i;
        }

        return -1;
    };

    const myZone = zoneOf(state.zones, me.x, me.y);
    const applied = new Set<string>();

    for(const user of users)
    {
        if(user.webID === userId) continue;

        // Identidade LiveKit do usuário (ver voiceServer/token).
        const identity = `user-${user.webID}`;

        if(myZone === -1)
        {
            voiceConnection.setSpatialVolume(identity, FACTOR_OUTSIDE);
        }
        else
        {
            const zone = zoneOf(state.zones, user.x, user.y);

            voiceConnection.setSpatialVolume(identity, zone === myZone ? FACTOR_SAME : FACTOR_OTHER);
        }

        applied.add(identity);
    }

    useVoiceStore.setState({ spatialApplied: applied });
};

/**
 * Spatial voice via audio zones: a light 500ms tick reads avatar tiles from
 * the room engine and tells the LiveKit connection which volume factor each
 * remote participant should have. Mounted with the room voice widgets.
 */
export const useVoiceZonesSpatial = () =>
{
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() =>
    {
        applySpatial();
        timer.current = setInterval(applySpatial, SPATIAL_TICK_MS);

        return () =>
        {
            if(timer.current) clearInterval(timer.current);
            timer.current = null;
        };
    }, []);
};
