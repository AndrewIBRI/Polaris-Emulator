import { useEffect, useRef } from 'react';
import { GetRoomEngine, GetSessionDataManager, RoomObjectCategory } from '@octane/renderer';
import { GetRoomSession } from '../../api';
import { voiceConnection } from '../../api/voice/VoiceConnection';
import { useVoiceStore, VoiceZoneArea } from '../../state/voiceStore';

const SPATIAL_TICK_MS = 500;

/** Default volume levels: same zone = full, other zone = bleed, outside = muffled. */
const DEFAULT_SAME = 100;
const DEFAULT_OTHER = 10;
const DEFAULT_OUTSIDE = 35;
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
        useVoiceStore.setState({ currentZone: -1 });

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

        // Os objetos de sala expõem a posição por getLocation() (IVector3D), não por propriedade.
        const location = typeof unit.getLocation === 'function'
            ? unit.getLocation()
            : (unit as { location?: { x: number; y: number } }).location;

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

    // Indicador do HUD: em qual zona estamos agora.
    useVoiceStore.setState({ currentZone: myZone });

    const factors = state.zoneFactors ?? { same: DEFAULT_SAME, other: DEFAULT_OTHER, outside: DEFAULT_OUTSIDE };
    const applied = new Set<string>();

    for(const user of users)
    {
        if(user.webID === userId) continue;

        // Identidade LiveKit do usuário (ver voiceServer/token).
        const identity = `user-${user.webID}`;

        if(myZone === -1)
        {
            voiceConnection.setSpatialVolume(identity, factors.outside / 100);
        }
        else
        {
            const zone = zoneOf(state.zones, user.x, user.y);

            voiceConnection.setSpatialVolume(identity, zone === myZone ? factors.same / 100 : factors.other / 100);
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
