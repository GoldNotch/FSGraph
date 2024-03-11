

import { GraphView } from "../@types/GraphView";
import { GraphControlling, Ngraph } from "../@types/Graph";
import GraphViewConfiguration = GraphView.GraphViewConfiguration;
import GraphState = GraphControlling.GraphState;
import NodeView = GraphView.NodeView;
import LinkView = GraphView.LinkView;
import Sizer = GraphView.Sizer;
import vec2 from "../../modified_modules/tsm/vec2";
import { InputManager } from "./InputManager";
import LinkPainter = GraphView.Painter;
import NodeGroup = GraphView.NodeGroup;
import AABB = GraphView.AABB;
import { Controller } from "../@types/GUI";
import { LayoutBuilder } from "../@types/LayoutBuilder";
import { Range, ScalarParam } from "../@types/Param";
import GraphRenderer from "./GraphRenderer";
import { onClickNode, onDragEndNode, onDragNode, onDragScene, onEnterNode, onLeaveNode, onZoom } from "./EventHandlers";
import RebuildQuadtree = GraphView.RebuildQuadTree;
import * as chroma from 'chroma.ts'
import NodeData = GraphControlling.NodeData;
import LinkGroup = GraphView.LinkGroup;
import LinksForNode = GraphView.LinksForNode;
import { createColorsForGraphView, getEmphasizedColor } from "../@types/Color";
import Quadtree from "quadtree-lib";

/*
* Класс управляет холстом рисования графа и является менеджером сцены
* Должен уметь рисовать GraphState на холсте
* На входе подается GraphState и ViewConfiguration, по ним строится изображение
*/

/*
* QuadTree has strange bug: if AABB across axis (x ~= 0 or y ~= 0) 
*when it can't  detect them under cursor
*/
export class CanvasManager {
    constructor(viewport: HTMLElement,
        controller: Controller) {
        this.graph_view = null;
        this.view_configuration = null;
        this.controller = controller;
        this.canvas = document.createElement('canvas');
        this.canvas.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); };
        this.canvas.style.display = 'block';
        this.canvas.style.margin = '0px';
        viewport.appendChild(this.canvas);
        this.viewport = viewport;
        this.toggled_node = null;
        this.inputManager = new InputManager();
        this.inputManager.bindCanvas(this.canvas, this.detectObjectsUnderCursor.bind(this));
        this.renderer = new GraphRenderer(this.canvas);
        this.nodes_to_refresh = new Set();
        this.links_to_refresh = new Set();
    }

    // ------------------------ public API ------------------------------
    //привязать граф и настройки визуализации для него
    bindGraph(state: GraphState, config: GraphViewConfiguration): void {
        this.view_configuration = config;
        //Создаем визуальное представление графа
        if (!config) {
            throw new DOMException("There's no view configuration for graph");
        }

        let selected_node_ids = [];
        const new_graph_view = this.makeGraphView(state, this.view_configuration);
        if (this.graph_view) {
            //move nodes and links state from old graph to new
            Object.keys(new_graph_view.nodes).forEach(id => {
                const node: NodeView = new_graph_view.nodes[id];
                if (this.graph_view.nodes.hasOwnProperty(id)) {
                    const old_node_view = this.graph_view.nodes[id];
                    node.position = old_node_view.position;
                    if (old_node_view.is_selected)
                        selected_node_ids.push(node.id);
                }
            });
            new_graph_view.RebuildQuadtree();
        }
        this.graph_view = new_graph_view;
        //привязываем сцену к менеджеру ввода/вывода
        this.inputManager.bindScene(this.graph_view);
        //привязываем граф к рендереру
        this.renderer.bindGraphView(this.graph_view, this.view_configuration);
        //включаем выделенную ноду
        if (this.toggled_node) {
            const id = this.toggled_node.id;
            this.toggled_node = null;
            this.ToggleNode(id);
        }
        selected_node_ids.forEach(id => this.SelectNode(id));
        this.refreshAllNodesAndLinks();
    }

    saveGraphViewToFile(clustered: boolean = false) {
        const graph_data = {};
        const nodes = [];
        Object.keys(this.graph_view.nodes).forEach(node_id => {
            const node_view: NodeView = this.graph_view.nodes[node_id];
            nodes.push({
                "id": node_view.id,
                "position": node_view.position.xy,
                "is_hidden": node_view.is_hidden,
                "weight": node_view.data['weight'] || undefined,
				"group": clustered ? node_view.group : 0,
				"label": node_view.data['label']
            });
        });
        const links = [];
        this.graph_view.links.forEach(link => {
		    if (!clustered || link.from.group == link.to.group)
				links.push({
					"source": link.from.id, "target": link.to.id,
					"is_hidden": link.is_hidden,
					"weight": link.data["weight"] || 0
				});
        });
        graph_data["nodes"] = nodes;
        graph_data["edges"] = links;
        return graph_data;
    }


    loadGraphView(graph_data) {
        console.log('load graph view');
        const nodes: object[] = graph_data["nodes"];
        const links: object[] = graph_data["edges"] || graph_data["links"];
        nodes.forEach(node => {
            const node_id = node["id"];
            const node_pos = node["position"];
            const is_hidden = node["is_hidden"];
            const node_view = this.graph_view.nodes[node_id];
            if (node_view) {
                if (!node_view.is_hidden && is_hidden)
                    this.controller("ImportingGraph_HideNode", { "node_id": node_id });
                else if (node_view.is_hidden && !is_hidden)
                    this.controller("ImportingGraph_ShowNode", { "node_id": node_id });
                node_view.position.x = node_pos[0];
                node_view.position.y = node_pos[1];
            }
        });
        this.graph_view.RebuildQuadtree();

        links.forEach(link => {
            const from_id = link["fromId"] || link["source"];
            const to_id = link["toId"] || link["target"];
            const is_hidden = link["is_hidden"];
            const link_view: LinkView = this.graph_view.links_from_node[from_id][to_id];
            if (link_view) {
                if (link_view.is_hidden && !is_hidden)
                    this.controller("ImportingGraph_ShowLink", { "fromId": from_id, "toId": to_id });
                else if (!link_view.is_hidden && is_hidden)
                    this.controller("ImportingGraph_HideLink", { "fromId": from_id, "toId": to_id });
            }
        });
        if (this.toggled_node)
            this.ToggleNode(this.toggled_node.id);
        this.refreshAllNodesAndLinks();
        this.update();
    }

    // ----- updates ----------
    updateViewConfiguration(): void {
        const config = this.view_configuration;
        Object.values(this.graph_view.nodes).forEach(node => {
            node.size = CanvasManager.calcNodeSize(config, node.data.norm_weight);
            const hex_color = this.view_configuration.node_colors_per_group[node.group];
            node.base_color = chroma.color(hex_color);
            node.emphasized_color = getEmphasizedColor(node.base_color);
        });
        this.graph_view.RebuildQuadtree();

        Object.values(this.graph_view.links).forEach(link => {
            const weight = link.data['norm_weight'];
            link.size = CanvasManager.calcLinkSize(config, link.data.norm_weight);
        });
        this.refreshAllNodesAndLinks();
    }

    //обновить все состояние объекта + перерисовать граф
    update(): void {
        if (this.canvas.width != this.viewport.clientWidth ||
            this.canvas.height != this.viewport.clientHeight) {
            this.canvas.width = this.viewport.clientWidth;
            this.canvas.height = this.viewport.clientHeight;
        }
        if (this.canvas.width != 0 && this.canvas.height != 0) {
            this.nodes_to_refresh.forEach(node_view => this.renderer.refreshNode(node_view));
            this.links_to_refresh.forEach(link_view => this.renderer.refreshLink(link_view));
            this.renderer.render();
            this.nodes_to_refresh.clear();
            this.links_to_refresh.clear();
        }
    }

    savePNG(): void {
        var link = document.createElement('a');
        link.download = 'graph.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }

    // ------- Действия с графом -----
    //уложить граф
    layoutGraph(builder: LayoutBuilder) {
        builder.layout(this.graph_view, this.view_configuration.scene_size);
        //refresh all nodes and links
        Object.values(this.graph_view.nodes).forEach(node_view => this.nodes_to_refresh.add(node_view));
        this.graph_view.links.forEach(link_view => this.links_to_refresh.add(link_view));
    }

    // подготовить рендерер для определенного кол-ва кластеров (генерация цветов + рендереров)
    setClustersCount(count: number){
        const colors = createColorsForGraphView(count, 1.0);
        for (let i = 0; i < count; i++) {
            this.view_configuration.node_colors_per_group[i] = colors[i];
            this.view_configuration.node_renderer_per_group[i] = this.view_configuration.node_renderer_per_group[0];
        }
    }

    //переместить граф(offset - смещение в клиентских координатах холста)
    translateGraph(offset: vec2) {
        this.renderer.moveCamera(offset);
    }
    //отзумить в позицию
    zoomAt(value: number) {
        this.renderer.scaleGraph(value);
    }
    //повернуть граф на угол(в градусах)
    rotateGraph(new_angle: number) {
        this.renderer.rotation = new_angle / 180 * Math.PI;
    }

    //----- Действия с нодами ------
    //Переместить ноду
    translateNode(node_id: Ngraph.NodeId, offset: vec2) {
        const node_view = this.graph_view.nodes[node_id];
        if (node_view) {
            const cos = Math.cos(this.renderer.rotation);
            const sin = Math.sin(this.renderer.rotation);
            const speed = this.view_configuration.scene_size / this.scaleFactor;
            const x = offset.x * speed;
            const y = offset.y * speed;
            node_view.position.x += (x * cos - y * sin);
            node_view.position.y += (x * sin + y * cos);
            this.nodes_to_refresh.add(node_view);
            this.addAdjacentLinksToRefresh(node_id, false);
        }
    }
    //скрыть ноду
    HideNode(node_id: Ngraph.NodeId): boolean {
        const node_view: NodeView = this.graph_view.nodes[node_id];
        if (node_view && !node_view.is_hidden) {
            node_view.is_hidden = true;
            this.graph_view.quad_tree.remove(this.graph_view.aabbs[node_id]);
            if (node_view.is_selected)
                this.DeselectNode(node_id);
            if (node_view.is_hovered)
                this.HoverOffNode(node_id);
            if (node_view.is_toggled)
                this.ToggleNode(node_id);
            this.nodes_to_refresh.add(node_view);
            this.addAdjacentLinksToRefresh(node_id);
            return true;
        }
        return false;
    }
    //показать ноду
    ShowNode(node_id: Ngraph.NodeId): boolean {
        const node_view: NodeView = this.graph_view.nodes[node_id];
        if (node_view && node_view.is_hidden) {
            node_view.is_hidden = false;
            this.graph_view.quad_tree.push(this.graph_view.aabbs[node_id]);
            this.nodes_to_refresh.add(node_view);
            this.addAdjacentLinksToRefresh(node_id);
            return true;
        }
        return false;
    }
    SetNodeLabel(node_id: Ngraph.NodeId, new_label: string) {
        const node_view: NodeView = this.graph_view.nodes[node_id];
        if (node_view)
            node_view.data.label = new_label;
    }
    //Включить или выключить ноду(при обычном клике)
    ToggleNode(node_id: Ngraph.NodeId) {
        const node_view: NodeView = this.graph_view.nodes[node_id];
        //если нажали на новую вершину(ранее не выделенную)
        if (!this.toggled_node || node_id != this.toggled_node.id) {
            if (this.toggled_node) {
                this.toggled_node.is_toggled = false;
                this.toggled_node.zOrder = 0;
                this.nodes_to_refresh.add(this.toggled_node);
                this.DeselectAdjacentNodes(this.toggled_node.id);
                this.controller("OnToggleOffNode", { "node_id": this.toggled_node.id });
            }
            this.toggled_node = node_view;
            this.toggled_node.is_toggled = true;
            this.toggled_node.zOrder = 1;
            this.nodes_to_refresh.add(this.toggled_node);
            this.SelectAdjacentNodes(this.toggled_node.id);
            this.controller("OnToggleOnNode", { "node_id": this.toggled_node.id });
        } else {
            this.toggled_node.is_toggled = false;
            this.toggled_node.zOrder = 0;
            this.nodes_to_refresh.add(this.toggled_node);
            this.DeselectAdjacentNodes(this.toggled_node.id);
            this.controller("OnToggleOffNode", { "node_id": this.toggled_node.id });
            this.toggled_node = null;
        }
    }
    //выделить ноду
    SelectNode(node_id: Ngraph.NodeId): boolean {
        const node_view = this.graph_view.nodes[node_id];
        if (node_view && !node_view.is_hidden && !node_view.is_selected) {
            node_view.is_selected = true;
            node_view.zOrder = 1;
            this.nodes_to_refresh.add(node_view);
            this.SelectAdjacentNodes(node_id);
            this.controller("OnSelectNode", { "node_id": node_id });
            return true;
        }
        return false;
    }
    //снять выделение с ноды
    DeselectNode(node_id: Ngraph.NodeId): boolean {
        const node_view = this.graph_view.nodes[node_id];
        if (node_view && node_view.is_selected) {
            node_view.is_selected = false;
            node_view.zOrder = 0;
            this.nodes_to_refresh.add(node_view);
            this.DeselectAdjacentNodes(node_id);
            this.controller("OnDeselectNode", { "node_id": node_id });
            return true;
        }
        return false;
    }
    //действия когда навели курсор на ноду
    HoverOnNode(node_id: Ngraph.NodeId) {
        const node_view = this.graph_view.nodes[node_id];
        if (node_view && !node_view.is_hidden) {
            node_view.is_hovered = true;
            node_view.zOrder = 1;
            this.nodes_to_refresh.add(node_view);
            this.SelectAdjacentNodes(node_id);
        }
    }
    //действия когда сняли курсор с ноды
    HoverOffNode(node_id: Ngraph.NodeId) {
        const node_view = this.graph_view.nodes[node_id];
        if (node_view) {
            node_view.is_hovered = false;
            node_view.zOrder = 0;
            this.nodes_to_refresh.add(node_view);
            this.DeselectAdjacentNodes(node_id);
        }
    }

    // --------------- Действия с дугами --------------
    ShowLink(from_id: Ngraph.NodeId, to_id: Ngraph.NodeId): boolean {
        const view: LinkView = this.graph_view.links_from_node[from_id][to_id];
        if (view && view.is_hidden) {
            const to: NodeView = view.to;
            const from: NodeView = view.from;
            if (!to.is_hidden && !from.is_hidden) {
                view.is_hidden = false;
                if (this.graph_view.links_to_node[from_id][to_id] &&
                    to.is_toggled || to.is_selected || to.is_hovered)
                    from.selected_adjacent_vertex_count++;
                //если показываем дугу, между двумя выделенными вершинами, то надо выделить дугу
                if (from.is_toggled || from.is_selected || from.is_hovered) {
                    to.selected_adjacent_vertex_count += Number(from.is_toggled) + Number(from.is_selected) + Number(from.is_hovered);
                    this.nodes_to_refresh.add(to);
                }
                this.links_to_refresh.add(view);
                return true;
            }
        }
        return false;
    }

    HideLink(from_id: Ngraph.NodeId, to_id: Ngraph.NodeId): boolean {
        const view: LinkView = this.graph_view.links_from_node[from_id][to_id];
        if (view && !view.is_hidden) {
            const to: NodeView = view.to;
            const from: NodeView = view.from;
            view.is_hidden = true;
            if (this.graph_view.links_to_node[from_id][to_id] &&
                to.is_toggled || to.is_selected || to.is_hovered)
                from.selected_adjacent_vertex_count--;
            //Когда скрываем дугу, то если краевые вершины выделены,
            // то у другой вершины надо убрать выделение как у смежной вершины
            if (from.is_toggled || from.is_selected || from.is_hovered) {
                to.selected_adjacent_vertex_count--;
                this.nodes_to_refresh.add(to);
            }

            this.links_to_refresh.add(view);
            return true;
        }
        return false;
    }

    // ----------------------------- Private --------------------------
    private canvas: HTMLCanvasElement;                      //канвас
    private viewport: HTMLElement;
    public readonly controller: Controller;                 //внешний контроллер который будет реагировать на события внутри этого класса
    private view_configuration: GraphViewConfiguration;     //настройка визуализции графа

    private graph_view: GraphView.GraphView;    //визуальная модель графа
    private inputManager: InputManager;         //менеджер управления мышью
    private renderer: GraphRenderer;            //рисовальщик графа

    //внутреннее состояние
    private toggled_node: NodeView;                         //включенная вершина

    private nodes_to_refresh: Set<NodeView>;
    private links_to_refresh: Set<LinkView>;

    //эта функция вызывается при каждом перемещении мыши
    private detectObjectsUnderCursor(cursor_pos: vec2): AABB[] {
        if (!this.graph_view)
            return [];
        //RenderManager кэширует позицию курсора мыши в координатах сцены у себя
        //чтобы потом, при зумировании не пересчитывать всякий раз позицию курсора в координатах мыши
        this.renderer.CursorPos = cursor_pos;
        const cursor_pos_at_scene = this.renderer.CursorPosAtScene;

        const click_aabb: AABB = {
            x: cursor_pos_at_scene.x + 2 * this.view_configuration.scene_size,
            y: cursor_pos_at_scene.y + 2 * this.view_configuration.scene_size,
            width: 0.1, height: 0.1
        };
        return this.graph_view.quad_tree.colliding(click_aabb);
    }

    private get scaleFactor() { return this.renderer.scaleFactor; }

    // -------------------------- Makers --------------------------------

    //create GraphView from ngraph.graph
    private makeGraphView(state: GraphState, config: GraphViewConfiguration): GraphView.GraphView {
        //создаем квадро дерево для сцены
        const quad_tree = new Quadtree<AABB>({
            width: config.scene_size,
            height: config.scene_size,
            maxElements: 4
        });

        //создаем модель представления графа
        //Важно понять, что рисуется всегда mutable_graph, но graph_view заполняется по source_graph
        const graph_view: GraphView.GraphView = {
            nodes: {},
            node_groups: {},
            links: [],
            links_from_node: {},
            links_to_node: {},
            quad_tree: quad_tree,
            aabbs: {},
            onDrag: onDragScene.bind(this),
            onDragEnd: null,
            onZoom: onZoom.bind(this),
            onClick: async (clicked_obj, evt) => {
                if (this.toggled_node) {
                    this.ToggleNode(this.toggled_node.id); this.update();
                }
            }
        };
        graph_view.RebuildQuadtree = RebuildQuadtree.bind(graph_view);

        //заполняем ноды в представлении графа. Ноды заполняются по source_graph т.к. он является более полной версией mutable_graph
        state.source_graph.forEachNode((node => {
            const mutable_node = state.mutable_graph.getNode(node.id);
            const data: NodeData = mutable_node && mutable_node.data ? mutable_node.data : node.data;
            const view = CanvasManager.makeNodeView(config, graph_view, node.id, data);
            view.is_hidden = state.isManuallyHiddenNode(node.id) || !state.mutable_graph.hasNode(node.id);
            if (!graph_view.node_groups[data.group]) graph_view.node_groups[data.group] = {};
            graph_view.nodes[node.id] = view;
            graph_view.node_groups[data.group][node.id] = view;
            graph_view.links_from_node[node.id] = {};
            graph_view.links_to_node[node.id] = {};
        }));

        //заполняем связи в представлении графа
        state.source_graph.forEachLink(link => {
            const from = graph_view.nodes[link.fromId];
            const to = graph_view.nodes[link.toId];
            const view = CanvasManager.makeLinkView(from, to, link, config);
            view.is_hidden = state.isManuallyHiddenNode(link.fromId) || state.isManuallyHiddenNode(link.toId) ||
                !state.mutable_graph.hasLink(link.fromId, link.toId) || state.isManuallyHiddenLink(link);
            graph_view.links.push(view);
            graph_view.links_from_node[link.fromId][link.toId] = view;
            graph_view.links_to_node[link.toId][link.fromId] = view;
        });

        //заполняем квадродерево
        graph_view.quad_tree.clear();
        Object.keys(graph_view.nodes).forEach(id => {
            const aabb = this.makeAABB(graph_view.nodes[id]);
            graph_view.aabbs[id] = aabb;
            graph_view.quad_tree.push(aabb);
        });
        return graph_view;
    }

    private static calcNodeSize(view_config: GraphViewConfiguration, norm_weight: number) {
        return view_config.node_sizer(norm_weight) * view_config.node_size_coeff.value + view_config.node_size_coeff.range.min;
    }

    private static calcLinkSize(view_config: GraphViewConfiguration, norm_weight: number) {
        return view_config.link_sizer(norm_weight) * view_config.link_size_coeff.value + view_config.link_size_coeff.range.min;
    }

    //create NodeView from node as SceneObject
    private static makeNodeView(view_config: GraphViewConfiguration, graph_view: GraphView.GraphView, node_id: Ngraph.NodeId, data: NodeData): NodeView {
        const pos = new vec2([-60 + Math.random() * 120, -60 + Math.random() * 120]);
        const hex_color = view_config.node_colors_per_group[data.group];
        return {
            group: data.group,
            position: pos,
            base_color: chroma.color(hex_color),
            emphasized_color: getEmphasizedColor(chroma.color(hex_color)),
            is_hovered: false,
            is_selected: false,
            is_toggled: false,
            selected_adjacent_vertex_count: 0,
            is_hidden: false,
            size: CanvasManager.calcNodeSize(view_config, data.norm_weight),
            zOrder: 0,
            id: node_id,
            data: Object.assign({}, data),
            graph_view: graph_view
        };
    }

    //create linkView from link as SceneObject
    private static makeLinkView(from: NodeView, to: NodeView, link: Ngraph.Link, view_config: GraphViewConfiguration): LinkView {
        return {
            from: from,
            to: to,
            size: CanvasManager.calcLinkSize(view_config, link.data.norm_weight),
            alpha: 1.0,
            zOrder: 0,
            //is_emphasized: false,
            is_hidden: false,
            painter: view_config.link_painter,
            data: Object.assign({}, link.data)
        };
    }

    //create aabb for node
    private makeAABB(node: NodeView): AABB {
        return {
            x: node.position.x - node.size + 2 * this.view_configuration.scene_size,
            y: node.position.y - node.size + 2 * this.view_configuration.scene_size,
            width: 2 * node.size,
            height: 2 * node.size,
            scene_object: node,
            onClick: onClickNode.bind(this),
            onDrag: onDragNode.bind(this),
            onDragEnd: onDragEndNode.bind(this),
            onEnter: onEnterNode.bind(this),
            onLeave: onLeaveNode.bind(this)
        }
    }

    //выделить смежные вершины с данной
    private SelectAdjacentNodes(node_id: Ngraph.NodeId) {
        const out_links: LinkView[] = Object.values(this.graph_view.links_from_node[node_id]);
        out_links.forEach(link => {
            if (!link.is_hidden) {
                link.to.selected_adjacent_vertex_count++;
                link.zOrder += 2;
                this.links_to_refresh.add(link);
                this.nodes_to_refresh.add(link.to);
            }
        });
        const in_links: LinkView[] = Object.values(this.graph_view.links_to_node[node_id]);
        in_links.forEach(link => {
            if (!link.is_hidden) {
                link.from.selected_adjacent_vertex_count++;
                link.zOrder++;
                this.links_to_refresh.add(link);
                this.nodes_to_refresh.add(link.from);
            }
        });
    }

    //снять выделение со смежных вершин
    private DeselectAdjacentNodes(node_id: Ngraph.NodeId) {
        const out_links: LinkView[] = Object.values(this.graph_view.links_from_node[node_id]);
        out_links.forEach(link => {
            if (!link.is_hidden) {
                link.to.selected_adjacent_vertex_count--;
                link.zOrder -= 2;
                this.links_to_refresh.add(link);
                this.nodes_to_refresh.add(link.to);
            }
        });
        const in_links: LinkView[] = Object.values(this.graph_view.links_to_node[node_id]);
        in_links.forEach(link => {
            if (!link.is_hidden) {
                link.from.selected_adjacent_vertex_count--;
                link.zOrder--;
                this.links_to_refresh.add(link);
                this.nodes_to_refresh.add(link.from);
            }
        });
    }

    private refreshAllNodesAndLinks() {
        Object.values(this.graph_view.nodes).forEach(node_view => this.nodes_to_refresh.add(node_view));
        this.graph_view.links.forEach(link_view => this.links_to_refresh.add(link_view));
    }

    private addAdjacentLinksToRefresh(node_id: Ngraph.NodeId, with_to_node: boolean = true) {
        //update links
        const out_links = Object.values(this.graph_view.links_from_node[node_id]) as LinkView[];
        out_links.forEach(link => {
            this.links_to_refresh.add(link);
            if (with_to_node)
                this.nodes_to_refresh.add(link.to);
        });
        const in_links = Object.values(this.graph_view.links_to_node[node_id]) as LinkView[];
        in_links.forEach(link => {
            this.links_to_refresh.add(link);
            if (with_to_node)
                this.nodes_to_refresh.add(link.from);
        });
    }
}