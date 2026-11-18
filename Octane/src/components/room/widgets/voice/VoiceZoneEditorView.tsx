import { FC, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useVoiceStore, VoiceZoneArea } from '../../../../state/voiceStore';
import { useVoice } from '../../../../hooks/voice/useVoice';
import '../../../../css/room/VoiceZoneEditor.css';

const CELL_SIZE = 18;

const ZONE_COLORS = [
    '#3ddc84',
    '#4aa8ff',
    '#ffb84a',
    '#ff6b6b',
    '#b980ff',
    '#5bd6d2'
];

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

/** Zone editor with a floor-plan-editor-style top-down grid (admin only). */
export const VoiceZoneEditorView: FC<{}> = () =>
{
    const zones = useVoiceStore((state) => state.zones);
    const zoneEditorOpen = useVoiceStore((state) => state.zoneEditorOpen);
    const tilemap = useVoiceStore((state) => state.zoneTilemap);
    const setZoneEditorOpen = useVoiceStore((state) => state.setZoneEditorOpen);
    const { saveZones } = useVoice();

    const rows = useMemo(() => parseTilemap(tilemap), [ tilemap ]);

    const [ draft, setDraft ] = useState<VoiceZoneArea[]>([]);
    const [ selected, setSelected ] = useState<number>(-1);
    const drawingRef = useRef<{ startX: number; startY: number; index: number } | null>(null);

    // Grid size: from the floor model; fallback when no heightmap was cached.
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0) || 15;
    const rowCount = rows.length || 10;

    const isWalkable = (x: number, y: number): boolean =>
    {
        if(!rows.length) return true;

        const row = rows[y];

        return row ? !!row[x] : false;
    };

    const resetDraft = useCallback(() =>
    {
        setDraft(zones.map((zone) => ({ ...zone })));
        setSelected(-1);
    }, [ zones ]);

    // Recarrega o rascunho cada vez que o editor abre.
    useEffect(() =>
    {
        if(zoneEditorOpen) resetDraft();
    }, [ zoneEditorOpen, resetDraft ]);

    if(!zoneEditorOpen) return null;

    const close = () => setZoneEditorOpen(false);

    const tileFromEvent = (event: React.MouseEvent<SVGRectElement>): { x: number; y: number } | null =>
    {
        const cell = event.currentTarget;

        return { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
    };

    const onTileMouseDown = (event: React.MouseEvent<SVGRectElement>) =>
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

    const onTileMouseEnter = (event: React.MouseEvent<SVGRectElement>) =>
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

    const renameSelected = (name: string) =>
    {
        if(selected < 0) return;

        setDraft((current) => current.map((zone, index) => (index === selected ? { ...zone, name } : zone)));
    };

    const save = () =>
    {
        saveZones(draft.map((zone) => ({ id: 0, name: zone.name, x: zone.x, y: zone.y, width: zone.width, height: zone.height })));
        setZoneEditorOpen(false);
    };

    const width = colCount * CELL_SIZE;
    const height = rowCount * CELL_SIZE;

    return (
        <div className="voice-zone-editor-overlay">
            <div className="voice-zone-editor">
                <div className="voice-zone-editor-header">
                    <span className="voice-zone-editor-title">Zonas de áudio</span>
                    <span className="voice-zone-editor-subtitle">Desenhe as áreas onde as pessoas devem se ouvir</span>
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
                                        <rect
                                            key={ `${ x }-${ y }` }
                                            data-x={ x }
                                            data-y={ y }
                                            x={ x * CELL_SIZE }
                                            y={ y * CELL_SIZE }
                                            width={ CELL_SIZE }
                                            height={ CELL_SIZE }
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
                            { draft.map((zone, index) => (zone.width >= 1 && zone.height >= 1) && (
                                <text
                                    key={ `label-${ index }` }
                                    x={ zone.x * CELL_SIZE + 4 }
                                    y={ zone.y * CELL_SIZE + CELL_SIZE - 4 }
                                    className={ index === selected ? 'is-selected' : '' }
                                >
                                    { zone.name }
                                </text>
                            )) }
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
