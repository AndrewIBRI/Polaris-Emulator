import { FC, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { GetRoomEngine } from '@octane/renderer';
import { GetRoomSession } from '../../../../api';
import { OctaneCardContentView, OctaneCardHeaderView, OctaneCardView } from '../../../../common/card';
import { useVoiceStore, VoiceZoneArea } from '../../../../state/voiceStore';
import { saveVoiceZones } from '../../../../api/voice/saveVoiceZones';
import { VoiceZoneCanvas, loadTileImage, zoneColor } from './VoiceZoneCanvas';
import '../../../../css/room/VoiceZoneEditor.css';

/** Parses the room's floor model string into tile heights: ONE base36 char per tile ('x' = blocked), like the game does. */
const parseHeights = (tilemap: string): number[][] =>
{
    if(!tilemap) return [];

    const rows: number[][] = [];

    for(const line of tilemap.split('\r'))
    {
        if(!line) continue;

        const row: number[] = [];

        for(const char of line)
        {
            row.push((char === 'x' || char === 'X') ? -1 : parseInt(char, 36));
        }

        rows.push(row);
    }

    return rows;
};

/** Zone editor: same window and SAME render as the Floor Plan Editor preview — zones painted over the room's tiles (admin only). */
export const VoiceZoneEditorView: FC<{}> = () =>
{
    const zones = useVoiceStore((state) => state.zones);
    const zoneEditorOpen = useVoiceStore((state) => state.zoneEditorOpen);
    const tilemap = useVoiceStore((state) => state.zoneTilemap);
    const zoneFactors = useVoiceStore((state) => state.zoneFactors);
    const setZoneEditorOpen = useVoiceStore((state) => state.setZoneEditorOpen);

    // Preferência: heightmap do evento; fallback: heightmap ao vivo do engine do jogo (caso o evento tenha passado antes do hook montar).
    const heights = useMemo(() =>
    {
        const parsed = parseHeights(tilemap);

        if(parsed.length) return parsed;

        try
        {
            const session = GetRoomSession();

            return session ? (GetRoomEngine().getRoomFloorHeights(session.roomId) ?? []) : [];
        }
        catch
        {
            return [];
        }
    }, [ tilemap ]);

    const [ draft, setDraft ] = useState<VoiceZoneArea[]>([]);
    const [ selected, setSelected ] = useState<number>(-1);
    const [ factors, setFactors ] = useState({ same: 100, other: 10, outside: 35 });
    const [ tileImage, setTileImage ] = useState<HTMLImageElement | null>(null);
    const drawingRef = useRef<{ startX: number; startY: number; index: number } | null>(null);

    useEffect(() =>
    {
        loadTileImage().then(setTileImage);
    }, []);

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

    const beginDraw = (x: number, y: number) =>
    {
        const index = draft.length;

        if(index >= 32) return;

        setSelected(index);
        drawingRef.current = { startX: x, startY: y, index };
        setDraft((current) => [ ...current, { id: 0, name: `Zona ${current.length + 1}`, x, y, width: 1, height: 1 } ]);
    };

    const hoverDraw = (x: number, y: number) =>
    {
        const drawing = drawingRef.current;

        if(!drawing) return;

        setDraft((current) =>
        {
            const next = [ ...current ];

            next[drawing.index] = {
                ...next[drawing.index],
                x: Math.min(drawing.startX, x),
                y: Math.min(drawing.startY, y),
                width: Math.abs(x - drawing.startX) + 1,
                height: Math.abs(y - drawing.startY) + 1
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
        saveVoiceZones(draft.map((zone) => ({ id: 0, name: zone.name, x: zone.x, y: zone.y, width: zone.width, height: zone.height })), factors);
        setZoneEditorOpen(false);
    };

    const closeFromBackdrop = (event: React.MouseEvent) =>
    {
        // só fecha quando o clique atinge o próprio backdrop (não a janela/children)
        if(event.target !== event.currentTarget) return;

        close();
    };

    return (
        <div className="voice-zone-editor-overlay" onMouseDown={ closeFromBackdrop }>
            <OctaneCardView
                uniqueKey="voice-zone-editor"
                className="w-[662px] h-[600px] min-w-[662px] min-h-[600px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)]"
                classNames={['octane-floorplan-window', 'voice-zone-editor-window']}
                theme="primary-slim"
            >
                <OctaneCardHeaderView headerText="Zonas de áudio" onCloseClick={ close } />
                <OctaneCardContentView overflow="hidden" className="flex flex-col">
                    <div className="fp-body">
                        <div className="fp-banner">
                            <span className="fp-banner-logo" />
                            <span className="fp-banner-text">
                                <span className="fp-banner-title">Zonas de áudio da sala</span>
                                <span className="fp-banner-subtitle">Mesmo render do floor plan — pinte as zonas por cima dos tiles</span>
                            </span>
                        </div>
                        <div className="fp-panels">
                            <div className="fp-panel is-plan">
                                <div className="fp-panel-head">
                                    <span className="fp-panel-title">Zonas ({ draft.length })</span>
                                    <span className="fp-panel-info">Clique e arraste para pintar</span>
                                </div>
                                <div className="fp-panel-body voice-zone-editor-body">
                                    <VoiceZoneCanvas
                                        heights={ heights }
                                        draft={ draft }
                                        selected={ selected }
                                        tileImage={ tileImage }
                                        onTileMouseDown={ beginDraw }
                                        onTileHover={ hoverDraw }
                                        onTileSelect={ setSelected }
                                        onFinish={ finishDrawing }
                                    />
                                </div>
                            </div>
                            <div className="fp-panel is-preview">
                                <div className="fp-panel-head">
                                    <span className="fp-panel-title">Volumes (por sala)</span>
                                    <span className="fp-panel-info">Aplicados a todos os avatares</span>
                                </div>
                                <div className="fp-panel-body">
                                    <ul className="voice-zone-editor-list">
                                        { draft.map((zone, index) => (
                                            <li
                                                key={ index }
                                                className={ index === selected ? 'is-selected' : '' }
                                                onMouseDown={ () => setSelected(index) }
                                            >
                                                <span className="voice-zone-editor-swatch" style={ { background: zoneColor(index) } } />
                                                <input
                                                    value={ zone.name }
                                                    onChange={ (event) =>
                                                    {
                                                        const name = event.target.value;

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
                        </div>
                    </div>
                    <div className="fp-footer">
                        <button className="fp-btn" onClick={ close }>Cancelar</button>
                        <button className="fp-btn is-blue" onClick={ save }>Salvar</button>
                    </div>
                </OctaneCardContentView>
            </OctaneCardView>
        </div>
    );
};
