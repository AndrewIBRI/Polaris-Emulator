import { FC, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { GetRoomEngine, GetSessionDataManager } from '@octane/renderer';
import { VoiceZoneArea } from '../../../../state/voiceStore';
import { GetRoomSession } from '../../../../api';

// Render top-down (estilo do editor de floor plan azul): grade de quadrados alinhada,
// chão azul e tiles com móveis pintados em outra cor — sem projeção isométrica.
const TILE = 14;
const GAP = 1;

const FLOOR_COLOR = '#0065ff'; // mesmo azul do COLORMAP h=0 do editor de floor plan
const FURNI_COLOR = '#ffa000'; // tiles com móveis
const EMPTY_COLOR = '#f2f2f2';

interface FurniMarker
{
    x: number;
    y: number;
    name: string;
}

interface CanvasTile
{
    x: number;
    y: number;
    sx: number;
    sy: number;
}

/** Móveis da sala ao vivo: um marcador por tile com os nomes reais (mesmos do jogo). */
export const collectFurni = (): FurniMarker[] =>
{
    const session = GetRoomSession();

    if(!session) return [];

    const byTile = new Map<string, string[]>();

    try
    {
        const engine = GetRoomEngine();
        const dataManager = GetSessionDataManager();

        for(const item of engine.getRoomFurnitureData(session.roomId) || [])
        {
            const name = dataManager.getFloorItemData(item.typeId)?.name || `#${item.typeId}`;
            const key = `${ item.x },${ item.y }`;
            const list = byTile.get(key) || [];

            list.push(name);
            byTile.set(key, list);
        }
    }
    catch
    {
        // engine indisponível: segue sem móveis
    }

    const markers: FurniMarker[] = [];

    for(const [ key, names ] of byTile)
    {
        const [ x, y ] = key.split(',').map(Number);

        markers.push({ x, y, name: names.slice(0, 3).join(', ') + (names.length > 3 ? ` (+${ names.length - 3 })` : '') });
    }

    return markers;
};

/** Converte hex #rrggbb em rgba com alpha. */
const withAlpha = (hex: string, alpha: number): string =>
{
    const value = parseInt(hex.slice(1), 16);

    return `rgba(${ (value >> 16) & 255 },${ (value >> 8) & 255 },${ value & 255 },${ alpha })`;
};

const ZONE_COLORS = [ '#3ddc84', '#4aa8ff', '#ffb84a', '#ff6b6b', '#b980ff', '#5bd6d2' ];

export const zoneColor = (index: number): string => ZONE_COLORS[index % ZONE_COLORS.length];

interface Props
{
    heights: number[][];
    draft: VoiceZoneArea[];
    selected: number;
    onTileMouseDown: (x: number, y: number) => void;
    onTileHover: (x: number, y: number) => void;
    onTileSelect: (index: number) => void;
    onFinish: () => void;
}

/** Render top-down do editor de zonas: quadrados alinhados, chão azul, móveis destacados, zonas por cima. */
export const VoiceZoneCanvas: FC<Props> = ({ heights, draft, selected, onTileMouseDown, onTileHover, onTileSelect, onFinish }) =>
{
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ furni, setFurni ] = useState<FurniMarker[]>([]);
    const drawingRef = useRef(false);

    const layout = useMemo(() =>
    {
        const tiles: CanvasTile[] = [];
        const size = TILE + GAP;

        for(let y = 0; y < heights.length; y++)
        {
            for(let x = 0; x < (heights[y]?.length ?? 0); x++)
            {
                if(heights[y][x] < 0) continue;

                tiles.push({ x, y, sx: x * size, sy: y * size });
            }
        }

        if(!tiles.length) return { width: 1, height: 1, tiles: [] };

        return {
            width: Math.max(...tiles.map((tile) => tile.sx)) + TILE,
            height: Math.max(...tiles.map((tile) => tile.sy)) + TILE,
            tiles
        };
    }, [ heights ]);

    const tileAt = useMemo(() =>
    {
        const map = new Map<string, CanvasTile>();

        for(const tile of layout.tiles) map.set(`${ tile.x },${ tile.y }`, tile);

        return map;
    }, [ layout ]);

    useEffect(() =>
    {
        setFurni(collectFurni());
    }, []);

    // Pinta: grade top-down + zonas por cima.
    useEffect(() =>
    {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if(!canvas || !context) return;

        canvas.width = Math.max(1, layout.width);
        canvas.height = Math.max(1, layout.height);

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const furniSet = new Set(furni.map((marker) => `${ marker.x },${ marker.y }`));

        for(const tile of layout.tiles)
        {
            context.fillStyle = furniSet.has(`${ tile.x },${ tile.y }`) ? FURNI_COLOR : FLOOR_COLOR;
            context.fillRect(tile.sx, tile.sy, TILE, TILE);
        }

        for(const [ index, zone ] of draft.entries())
        {
            const color = zoneColor(index);

            for(let y = zone.y; y < zone.y + zone.height; y++)
            {
                for(let x = zone.x; x < zone.x + zone.width; x++)
                {
                    const tile = tileAt.get(`${ x },${ y }`);

                    if(!tile) continue;

                    context.fillStyle = withAlpha(color, selected === index ? 0.85 : 0.6);
                    context.fillRect(tile.sx, tile.sy, TILE, TILE);
                    context.strokeStyle = color;
                    context.lineWidth = 1;
                    context.strokeRect(tile.sx + 0.5, tile.sy + 0.5, TILE - 1, TILE - 1);
                }
            }

            const first = tileAt.get(`${ zone.x },${ zone.y }`);

            if(first)
            {
                context.font = 'bold 10px sans-serif';
                context.fillStyle = '#1a1a1a';
                context.fillText(zone.name, first.sx + 2, first.sy - 2);
            }
        }
    }, [ layout, draft, selected, tileAt, furni ]);

    const hitTest = (clientX: number, clientY: number): CanvasTile | null =>
    {
        const canvas = canvasRef.current;

        if(!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const size = TILE + GAP;
        const x = Math.floor((clientX - rect.left) / size);
        const y = Math.floor((clientY - rect.top) / size);

        return tileAt.get(`${ x },${ y }`) || null;
    };

    const onMouseMove = (event: ReactMouseEvent<HTMLCanvasElement>) =>
    {
        const tile = hitTest(event.clientX, event.clientY);

        if(tile && drawingRef.current) onTileHover(tile.x, tile.y);
    };

    const onMouseDown = (event: ReactMouseEvent<HTMLCanvasElement>) =>
    {
        const tile = hitTest(event.clientX, event.clientY);

        if(!tile) return;

        const hit = draft.findIndex((zone) => tile.x >= zone.x && tile.x < zone.x + zone.width && tile.y >= zone.y && tile.y < zone.y + zone.height);

        if(hit >= 0)
        {
            onTileSelect(hit);

            return;
        }

        drawingRef.current = true;
        onTileMouseDown(tile.x, tile.y);
    };

    const onMouseUp = () =>
    {
        drawingRef.current = false;
        onFinish();
    };

    return (
        <div className="fp-air-preview" data-testid="voice-zone-canvas">
            <div className="voice-zone-paint-layer" style={ { width: layout.width, height: layout.height } }>
                <canvas
                    ref={ canvasRef }
                    className="fp-air-preview-canvas voice-zone-paint-canvas"
                    onMouseDown={ onMouseDown }
                    onMouseMove={ onMouseMove }
                    onMouseUp={ onMouseUp }
                    onMouseLeave={ onMouseUp }
                />
            </div>
        </div>
    );
};
