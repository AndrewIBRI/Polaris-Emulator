import { FC, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { GetRoomEngine, GetSessionDataManager, RoomObjectCategory, RoomObjectVariable } from '@octane/renderer';
import { VoiceZoneArea } from '../../../../state/voiceStore';
import { GetRoomSession } from '../../../../api';

// Mesma projeção e mesmo tamanho de tile do preview do Floor Plan Editor (airPreview.ts).
import tileBase from '../../../../assets/images/floorplaneditor/preview/tile_preview_0.png';

const TILE = 18;

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

/** Carrega a imagem base do tile do preview do floor plan. */
export const loadTileImage = (): Promise<HTMLImageElement> =>
    new Promise((resolve) =>
    {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => resolve(image);
        image.src = tileBase;
    });

/** Móveis da sala ao vivo: um marcador por tile com os nomes reais (mesmos do jogo). */
export const collectFurni = (): FurniMarker[] =>
{
    const session = GetRoomSession();

    if(!session) return [];

    const byTile = new Map<string, string[]>();

    let dbgObjCount = -1;
    let dbgError = '';

    try
    {
        const engine = GetRoomEngine();
        const dataManager = GetSessionDataManager();
        const objects = engine.getRoomObjects(session.roomId, RoomObjectCategory.FLOOR) || [];

        dbgObjCount = objects.length;

        for(const obj of objects)
        {
            if(!obj || !obj.model) continue;

            const typeId = obj.model.getValue<number>(RoomObjectVariable.FURNITURE_TYPE_ID);

            if(!typeId) continue;

            const location = (obj as { getLocation?: () => { x: number; y: number } }).getLocation?.();

            if(!location) continue;

            const name = dataManager.getFloorItemData(typeId)?.name || `#${typeId}`;
            const key = `${ Math.floor(location.x) },${ Math.floor(location.y) }`;
            const list = byTile.get(key) || [];

            list.push(name);
            byTile.set(key, list);
        }
    }
    catch(error)
    {
        dbgError = String(error).slice(0, 120);

        // engine indisponível: segue sem móveis
    }

    (window as unknown as { __zDbg?: unknown }).__zDbg = { session: !!session, roomId: session?.roomId, objCount: dbgObjCount, error: dbgError, markers: byTile.size };

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
    tileImage: HTMLImageElement | null;
    onTileMouseDown: (x: number, y: number) => void;
    onTileHover: (x: number, y: number) => void;
    onTileSelect: (index: number) => void;
    onFinish: () => void;
}

/** Mesmo render do preview do Floor Plan Editor: tiles air_preview na projeção 8(x-y)/4(x+y), zonas pintadas por cima. */
export const VoiceZoneCanvas: FC<Props> = ({ heights, draft, selected, tileImage, onTileMouseDown, onTileHover, onTileSelect, onFinish }) =>
{
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ furni, setFurni ] = useState<FurniMarker[]>([]);
    const drawingRef = useRef(false);

    const layout = useMemo(() =>
    {
        const tiles: CanvasTile[] = [];
        const pxAt = (x: number, y: number, h: number) => ({ px: 8 * (x - y), py: 4 * (x + y) - 8 * h });

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for(let y = 0; y < heights.length; y++)
        {
            for(let x = 0; x < (heights[y]?.length ?? 0); x++)
            {
                const h = heights[y][x];

                if(h < 0) continue;

                const { px, py } = pxAt(x, y, h);

                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
                tiles.push({ x, y, sx: px, sy: py });
            }
        }

        if(!tiles.length) return { width: 1, height: 1, tiles: [] };

        return {
            width: maxX - minX + TILE,
            height: maxY - minY + TILE,
            tiles: tiles.map((tile) => ({ ...tile, sx: tile.sx - minX, sy: tile.sy - minY }))
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

    // Pinta: fundo branco + tiles (mesmas imagens do floor plan) + zonas por cima.
    useEffect(() =>
    {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');

        if(!canvas || !context) return;

        canvas.width = Math.max(1, layout.width);
        canvas.height = Math.max(1, layout.height);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        if(tileImage?.complete && tileImage.naturalWidth)
        {
            for(const tile of layout.tiles) context.drawImage(tileImage, tile.sx, tile.sy);
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

                    const cx = tile.sx + TILE / 2;
                    const cy = tile.sy + TILE / 2;

                    context.beginPath();
                    context.moveTo(cx, cy - TILE / 4);
                    context.lineTo(cx + TILE / 2, cy);
                    context.lineTo(cx, cy + TILE / 4);
                    context.lineTo(cx - TILE / 2, cy);
                    context.closePath();
                    context.fillStyle = withAlpha(color, selected === index ? 0.85 : 0.6);
                    context.fill();
                    context.strokeStyle = color;
                    context.lineWidth = 1;
                    context.stroke();
                }
            }

            const first = tileAt.get(`${ zone.x },${ zone.y }`);

            if(first)
            {
                context.font = 'bold 10px sans-serif';
                context.fillStyle = '#1a1a1a';
                context.fillText(zone.name, first.sx + TILE / 2 + 2, first.sy + 4);
            }
        }

        // Marcadores de móvel por cima (mesma posição do tile na sala).
        for(const marker of furni)
        {
            const tile = tileAt.get(`${ marker.x },${ marker.y }`);

            if(!tile) continue;

            const cx = tile.sx + TILE / 2;
            const cy = tile.sy + TILE / 2;

            context.beginPath();
            context.arc(cx, cy, 4, 0, Math.PI * 2);
            context.fillStyle = 'rgba(255,255,255,0.9)';
            context.fill();
            context.strokeStyle = '#222';
            context.stroke();
        }
    }, [ tileImage, layout, draft, selected, tileAt, furni ]);

    const hitTest = (clientX: number, clientY: number): CanvasTile | null =>
    {
        const canvas = canvasRef.current;

        if(!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;

        for(const tile of layout.tiles)
        {
            const dx = Math.abs(mx - (tile.sx + TILE / 2)) / (TILE / 2);
            const dy = Math.abs(my - (tile.sy + TILE / 2)) / (TILE / 4);

            if(dx + dy <= 1) return tile;
        }

        return null;
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
                { furni.map((marker) =>
                {
                    const tile = tileAt.get(`${ marker.x },${ marker.y }`);

                    if(!tile) return null;

                    return (
                        <div
                            key={ `furni-${ marker.x }-${ marker.y }` }
                            className="voice-zone-furni-dot"
                            style={ { left: tile.sx + TILE / 2 - 5, top: tile.sy + TILE / 2 - 5 } }
                            title={ marker.name }
                        />
                    );
                }) }
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
