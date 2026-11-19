import { FC, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { GetRoomEngine, GetSessionDataManager, RoomObjectCategory, RoomObjectVariable } from '@octane/renderer';
import { useVoiceStore, VoiceZoneArea } from '../../../../state/voiceStore';
import { useVoice } from '../../../../hooks/voice/useVoice';
import { GetRoomSession } from '../../../../api';
import '../../../../css/room/VoiceZoneEditor.css';

// Diamante 2:1 — mesma projeção isométrica do jogo.
const CELL_W = 36;
const CELL_H = 18;
const ORIGIN_X = 200;
const ORIGIN_Y = 40;

const ZONE_COLORS = [
    '#3ddc84',
    '#4aa8ff',
    '#ffb84a',
    '#ff6b6b',
    '#b980ff',
    '#5bd6d2'
];

interface FurniMarker
{
    x: number;
    y: number;
    name: string;
}

/** Parses a Nitro floor model string into rows of walkable flags. */
const parseTilemap = (tilemap: string): boolean[][] =>
{
    if(!tilemap) return [];

    const rows: boolean[][] = [];

    for(const line of tilemap.split(/\r\n|\r|\n/))
    {
        if(!line) continue;

        const row: boolean[] = [];

        for(let i = 0; i < line.length; i += 2)
        {
            const value = parseInt(line.slice(i, i + 2), 16);

            row.push(!Number.isNaN(value) && value >= 0);
        }

        rows.push(row);
    }

    return rows;
};

/** Isometric projection of a tile (same angle as the in-game room). */
const isoPoint = (x: number, y: number): { px: number; py: number } =>
{
    return { px: ORIGIN_X + (x - y) * (CELL_W / 2), py: ORIGIN_Y + (x + y) * (CELL_H / 2) };
};

const diamondPoints = (x: number, y: number): string =>
{
    const { px, py } = isoPoint(x, y);
    const halfW = CELL_W / 2;
    const halfH = CELL_H / 2;

    return `${ px },${ py + halfH / 2 } ${ px + halfW },${ py + halfH } ${ px },${ py + halfH * 1.5 } ${ px - halfW },${ py + halfH }`;
};

/** Zone editor rendered over the room seen from the game's isometric angle, with furniture markers (admin only). */
export const VoiceZoneEditorView: FC<{}> = () =>
{
    const zones = useVoiceStore((state) => state.zones);
    const zoneEditorOpen = useVoiceStore((state) => state.zoneEditorOpen);
    const tilemap = useVoiceStore((state) => state.zoneTilemap);
    const zoneFactors = useVoiceStore((state) => state.zoneFactors);
    const setZoneEditorOpen = useVoiceStore((state) => state.setZoneEditorOpen);
    const { saveZones } = useVoice();

    const rows = useMemo(() => parseTilemap(tilemap), [ tilemap ]);

    const [ draft, setDraft ] = useState<VoiceZoneArea[]>([]);
    const [ selected, setSelected ] = useState<number>(-1);
    const [ factors, setFactors ] = useState({ same: 100, other: 10, outside: 35 });
    const drawingRef = useRef<{ startX: number; startY: number; index: number } | null>(null);

    // Grid size: from the floor model; fallback when no heightmap was cached.
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0) || 15;
    const rowCount = rows.length || 10;

    // Móveis da sala: um marcador por tile, tooltip com os nomes (mesmos do jogo).
    const furni = useMemo<FurniMarker[]>(() =>
    {
        if(!zoneEditorOpen) return [];

        const session = GetRoomSession();

        if(!session) return [];

        const byTile = new Map<string, string[]>();

        try
        {
            const engine = GetRoomEngine();
            const dataManager = GetSessionDataManager();

            for(const obj of engine.getRoomObjects(session.roomId, RoomObjectCategory.FLOOR))
            {
                if(!obj || !obj.model) continue;

                const typeId = obj.model.getValue<number>(RoomObjectVariable.FURNITURE_TYPE_ID);

                if(!typeId) continue;

                const location = (obj as { getLocation?: () => { x: number; y: number; z: number } }).getLocation?.();

                if(!location) continue;

                const name = dataManager.getFloorItemData(typeId)?.name || `#${typeId}`;
                const key = `${ Math.floor(location.x) },${ Math.floor(location.y) }`;
                const list = byTile.get(key) || [];

                list.push(name);
                byTile.set(key, list);
            }
        }
        catch
        {
            // engine indisponível: editor continua sem móveis
        }

        const markers: FurniMarker[] = [];

        for(const [ key, names ] of byTile)
        {
            const [ x, y ] = key.split(',').map(Number);

            markers.push({ x, y, name: names.slice(0, 3).join(', ') + (names.length > 3 ? ` (+${ names.length - 3 })` : '') });
        }

        return markers;
    }, [ zoneEditorOpen ]);

    const isWalkable = (x: number, y: number): boolean =>
    {
        if(!rows.length) return true;

        const row = rows[y];

        return row ? !!row[x] : false;
    };

    const resetDraft = useCallback(() =>
    {
        setDraft(zones.map((zone) => ({ ...zone })));
        setFactors({ ...zoneFactors });
        setSelected(-1);
    }, [ zones, zoneFactors ]);

    // Recarrega o rascunho cada vez que o editor abre.
    useEffect(() =>
    {
        if(zoneEditorOpen) resetDraft();
    }, [ zoneEditorOpen, resetDraft ]);

    if(!zoneEditorOpen) return null;

    const close = () => setZoneEditorOpen(false);

    const tileFromEvent = (event: React.MouseEvent<SVGElement>): { x: number; y: number } | null =>
    {
        const cell = event.currentTarget;

        return { x: Number(cell.getAttribute('data-x')), y: Number(cell.getAttribute('data-y')) };
    };

    const onTileMouseDown = (event: React.MouseEvent<SVGElement>) =>
    {
        const tile = tileFromEvent(event);

        if(!tile) return;

        // Clique sobre uma zona existente seleciona; em área livre desenha.
        const hit = draft.findIndex((zone) => tile.x >= zone.x && tile.x < zone.x + zone.width && tile.y >= zone.y && tile.y < zone.y + zone.height);

        if(hit >= 0)
        {
            setSelected(hit);

            return;
        }

        const index = draft.length;

        if(index >= 32) return;

        setSelected(index);
        drawingRef.current = { startX: tile.x, startY: tile.y, index };
        setDraft((current) => [ ...current, { id: 0, name: `Zona ${current.length + 1}`, x: tile.x, y: tile.y, width: 1, height: 1 } ]);
    };

    const onTileMouseEnter = (event: React.MouseEvent<SVGElement>) =>
    {
        const drawing = drawingRef.current;

        if(!drawing) return;

        const tile = tileFromEvent(event);

        if(!tile) return;

        setDraft((current) =>
        {
            const next = [ ...current ];

            next[drawing.index] = {
                ...next[drawing.index],
                x: Math.min(drawing.startX, tile.x),
                y: Math.min(drawing.startY, tile.y),
                width: Math.abs(tile.x - drawing.startX) + 1,
                height: Math.abs(tile.y - drawing.startY) + 1
            };

            return next;
        });
    };

    const finishDrawing = () =>
    {
        drawingRef.current = null;
    };

    const deleteSelected = () =>
    {
        if(selected < 0) return;

        setDraft((current) => current.filter((_, index) => index !== selected));
        setSelected(-1);
    };

    const save = () =>
    {
        saveZones(draft.map((zone) => ({ id: 0, name: zone.name, x: zone.x, y: zone.y, width: zone.width, height: zone.height })), factors);
        setZoneEditorOpen(false);
    };

    const width = (colCount + rowCount) * (CELL_W / 2) + ORIGIN_X * 2;
    const height = (colCount + rowCount) * (CELL_H / 2) + ORIGIN_Y * 2;

    return (
        <div className="voice-zone-editor-overlay">
            <div className="voice-zone-editor">
                <div className="voice-zone-editor-header">
                    <span className="voice-zone-editor-title">Zonas de áudio</span>
                    <span className="voice-zone-editor-subtitle">Sala no mesmo ângulo do jogo — desenhe as zonas com base nos móveis</span>
                </div>
                <div className="voice-zone-editor-body">
                    <div className="voice-zone-editor-canvas" onMouseUp={ finishDrawing } onMouseLeave={ finishDrawing }>
                        <svg width={ width } height={ height }>
                            { Array.from({ length: rowCount }).map((_, y) =>
                                Array.from({ length: colCount }).map((__, x) =>
                                {
                                    const zoneIndex = draft.findIndex((zone) => x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height);
                                    const walkable = isWalkable(x, y);

                                    return (
                                        <polygon
                                            key={ `${ x }-${ y }` }
                                            data-x={ x }
                                            data-y={ y }
                                            points={ diamondPoints(x, y) }
                                            className={ [
                                                'voice-zone-cell',
                                                !walkable ? 'is-blocked' : '',
                                                zoneIndex >= 0 ? 'is-zone' : ''
                                            ].join(' ') }
                                            fill={ zoneIndex >= 0 ? ZONE_COLORS[zoneIndex % ZONE_COLORS.length] : undefined }
                                            onMouseDown={ onTileMouseDown }
                                            onMouseEnter={ onTileMouseEnter }
                                        />
                                    );
                                }))
                            }
                            { furni.map((marker) =>
                            {
                                const { px, py } = isoPoint(marker.x, marker.y);

                                return (
                                    <circle
                                        key={ `furni-${ marker.x }-${ marker.y }` }
                                        cx={ px }
                                        cy={ py + CELL_H / 2 }
                                        r={ 7 }
                                        className="voice-zone-furni"
                                        pointerEvents="none"
                                    >
                                        <title>{ marker.name }</title>
                                    </circle>
                                );
                            }) }
                            { draft.map((zone, index) =>
                            {
                                const { px, py } = isoPoint(zone.x, zone.y);

                                return (
                                    <text
                                        key={ `label-${ index }` }
                                        x={ px }
                                        y={ py + 12 }
                                        className={ index === selected ? 'is-selected' : '' }
                                    >
                                        { zone.name }
                                    </text>
                                );
                            }) }
                        </svg>
                    </div>
                    <div className="voice-zone-editor-panel">
                        <div className="voice-zone-editor-hint">
                            Clique e arraste para desenhar uma zona. Clique numa zona para renomear ou apagar.
                        </div>
                        <ul className="voice-zone-editor-list">
                            { draft.map((zone, index) => (
                                <li
                                    key={ index }
                                    className={ index === selected ? 'is-selected' : '' }
                                    onMouseDown={ () => setSelected(index) }
                                >
                                    <span className="voice-zone-editor-swatch" style={ { background: ZONE_COLORS[index % ZONE_COLORS.length] } } />
                                    <input
                                        value={ zone.name }
                                        onChange={ (event) =>
                                        {
                                            const name = event.currentTarget.value;

                                            setDraft((current) => current.map((item, i) => (i === index ? { ...item, name } : item)));
                                        } }
                                    />
                                    <span className="voice-zone-editor-size">{ zone.width }x{ zone.height } ({ zone.x },{ zone.y })</span>
                                </li>
                            )) }
                        </ul>
                        { selected >= 0 && (
                            <div className="voice-zone-editor-actions">
                                <button className="voice-zone-editor-button is-danger" onClick={ deleteSelected }>Apagar zona</button>
                            </div>
                        ) }
                        <div className="voice-zone-editor-factors">
                            <span className="voice-zone-editor-factors-title">Volumes (por sala)</span>
                            <label>
                                Na mesma zona
                                <input type="range" min={ 0 } max={ 100 } value={ factors.same }
                                    onChange={ (event) => setFactors((current) => ({ ...current, same: Number(event.target.value) })) } />
                                <b>{ factors.same }%</b>
                            </label>
                            <label>
                                Em outra zona
                                <input type="range" min={ 0 } max={ 100 } value={ factors.other }
                                    onChange={ (event) => setFactors((current) => ({ ...current, other: Number(event.target.value) })) } />
                                <b>{ factors.other }%</b>
                            </label>
                            <label>
                                Fora de zona
                                <input type="range" min={ 0 } max={ 100 } value={ factors.outside }
                                    onChange={ (event) => setFactors((current) => ({ ...current, outside: Number(event.target.value) })) } />
                                <b>{ factors.outside }%</b>
                            </label>
                        </div>
                    </div>
                </div>
                <div className="voice-zone-editor-footer">
                    <button className="voice-zone-editor-button" onClick={ close }>Cancelar</button>
                    <button className="voice-zone-editor-button is-primary" onClick={ save }>Salvar</button>
                </div>
            </div>
        </div>
    );
};
