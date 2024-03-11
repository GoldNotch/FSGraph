import {Rendering} from "./WebGLRendering";
import vec2 from "../../modified_modules/tsm/vec2";
import {ScalarParam} from "./Param";
import * as chroma from "chroma.ts";
import {GraphControlling, Ngraph} from "./Graph";
import Quadtree from "quadtree-lib"

export module GraphView
{
    import IRenderer = Rendering.IRenderer;
    import NodeData = GraphControlling.NodeData;


    //функция которая вычисляет размер объекта исходя из веса объекта (не учитывает ограничения на размер)
    export type Sizer = (weight: number) => number;
    //функция которая вычисляет цвет на основе другого цвета
    export type Painter = (color: Rendering.Color) => Rendering.Color;

    export type onDragFunc = (sender: object, offset: vec2) => Promise<void>;
    export type onDragEndFunc = (sender: object) =>  Promise<void>;
    export type onClickFunc = (sender: object, event: MouseEvent) =>  Promise<void>;
    export type onDblClickFunc = (sender: object, event: MouseEvent) =>  Promise<void>;
    export type onEnterFunc = (sender: object) =>  Promise<void>;
    export type onLeaveFunc = (sender: object) =>  Promise<void>;
    export type onZoomFunc = (sender: object, dScroll: number, cursor_pos: vec2) =>  Promise<void>;

    export type AABB = {
        x: number;
        y: number;
        width: number;
        height: number;
        scene_object?: object;
        onClick?: onClickFunc;
        onDblClick?: onDblClickFunc;
        onDrag?: onDragFunc;
        onDragEnd?: onDragEndFunc;
        onEnter?: onEnterFunc;
        onLeave?: onLeaveFunc;
    }

    export type GraphViewConfiguration = {
        //размер сцены
        scene_size: number;
        //рендереры для дуг и вершин разных групп
        link_renderer: IRenderer;
        use_auto_orientation_detection: boolean;
        node_renderer_per_group: {[id: number] : IRenderer};
        //настройки цвета для каждой группы - hex формат
        node_colors_per_group: {[id: number] : string};
        link_painter: Painter;
        label_painter: Painter;
        //настройки размеров дуг и вершин
        node_sizer: Sizer;
        link_sizer: Sizer;
        node_size_coeff: ScalarParam;
        link_size_coeff: ScalarParam;
        node_border_width: number;
        //размер шрифта
        label_font_size: number;
        always_show_labels: boolean;
        always_show_weights: boolean;
        label_layout_strategy: number; //0 - around_vertex, 1 - inside_vertex
        //укладчик по умолчанию
        layout_builder: string;
        //настройка скрола
        scroll_value: ScalarParam;
    }

    export type NodeView = {
        group: number;
        position: vec2;                      // позиция относительно pivot графа, где рисуется точка
        zOrder: number;
        base_color: chroma.Color;               // базовый цвет вершины определенный как цвет вершины в группе
        emphasized_color: chroma.Color;         // цвет выделенной вершины
        is_hovered: boolean;                    // метка о том, что вершина покрыта мышкой (hover)
        is_selected: boolean;                   // метка о том, выделена ли вершина(shift + LMB or GUI)
        is_toggled: boolean;                    //метка о том, что вершина включена (click)
        //is_emphasized: boolean;
        selected_adjacent_vertex_count: number; //количество выделенных смежных вершин
        is_hidden: boolean;
        size: number;                      // линейный размер вершины (радиус/длина квадрата/половина ромба/половина основания треугольника)

        id: Ngraph.NodeId;              // логическая модель ноды
        data: NodeData;
        graph_view: GraphView;          //нужно для получения квадродерева
    }

    export function isNodeViewEmphasized(node: NodeView) {
        return !node.is_hidden && (node.is_hovered || node.is_selected || node.is_toggled || node.selected_adjacent_vertex_count > 0);
    }

    export type LinkView = {
        alpha : number;
        size: number;
        zOrder: number;
        is_hidden: boolean;
        painter: Painter;
        from: NodeView;
        to: NodeView;
        data: {[_:string]: any};
    }

    export function isLinkViewEmphasized(link: LinkView) {
        const from = link.from;
        const to = link.to;
        if (!from.is_hidden && !to.is_hidden)
        {
            const X = from.is_hovered || from.is_selected || from.is_toggled;
            const Y = to.is_hovered || to.is_selected || to.is_toggled;
            return (X && Y) || (X && to.selected_adjacent_vertex_count > 0) || (Y && from.selected_adjacent_vertex_count > 0);
        }
        else return false;
    }

    export function isLinkViewDisabled(link: LinkView) {
        return link.is_hidden || link.to.is_hidden || link.from.is_hidden;
    }

    export type NodeGroup = {[id: number]: NodeView};
    export type LinkGroup = {[id: number]: LinkView};
    export type LinksForNode = {[fromId: number] : {[toId: number]: LinkView}};
    export type RebuildQuadtreeFunc = () => void;

    export type GraphView = {
        nodes: NodeGroup;       //просто список всех нод графа
        node_groups: {[group:number]: NodeGroup};   //разделение нод на группы
        links_from_node: LinksForNode;              //список всех дуг исходящих из вершины
        links_to_node: LinksForNode;              //список всех дуг исходящих из вершины
        links: LinkView[];                          //список всех дуг графа
        quad_tree: Quadtree<AABB>;
        aabbs: {[id: number]: AABB};
        onDrag?: onDragFunc;
        onDragEnd?: onDragEndFunc;
        onZoom?: onZoomFunc;
        RebuildQuadtree?: RebuildQuadtreeFunc;
        onClick?: onClickFunc;
    }

    export type LabelStyle = {
        font_size: number;
        padding: number;
        is_bordered: boolean;
        is_bold: boolean;
        text_color: string;
        background_color: string;
    }

    export function RebuildQuadTree()
    {
        //this is GraphView
        this.quad_tree.clear();
        Object.values((<GraphView>this).aabbs).forEach(aabb => {
            const node = <NodeView>aabb.scene_object;
            aabb.x = node.position.x - node.size + 2 * this.quad_tree.width;
            aabb.y = node.position.y - node.size + 2 * this.quad_tree.width;
            aabb.width = 2 * node.size;
            aabb.height = 2 * node.size;
            if (!node.is_hidden)
                this.quad_tree.push(aabb);
        });
    }
}