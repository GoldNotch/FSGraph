import * as Split from "split.js";
import { CanvasManager } from "./CanvasManager/CanvasManager";
import { GraphControlling, Ngraph } from "./@types/Graph";
import GraphState = GraphControlling.GraphState;
import { GraphView } from "./@types/GraphView";
import GraphViewConfiguration = GraphView.GraphViewConfiguration;
import Graph = GraphControlling.Graph;
import getFirstState = GraphControlling.getFirstState;
import { Controller, GUIConfiguration, id_prefix } from "./@types/GUI";
import { Translator } from "./Translator";
import * as chroma from 'chroma.ts'
import { createColorsForGraphView } from "./@types/Color";
import { NodeListTab } from "./Tabs/NodeListTab";
import CalculateState = GraphControlling.calculateState;
import { IsInRange, Range, ScalarParam } from "./@types/Param";
import { NodeInfoTab } from "./Tabs/NodeInfoTab";
import { LinksTab } from "./Tabs/LinksTab";
import { LinkId } from "ngraph.graph";
import { OrientedStraightLinkRenderer } from "./Renderers/OrientedStraightLinkRenderer";
import { StraightLinkRenderer } from "./Renderers/StraightLinkRenderer";

const graph_view_content_id = id_prefix + "_graph_view";
const graph_viewport_id = id_prefix + "_viewport";
const graph_rotate_bar_id = id_prefix + "_rotate_bar";
const graph_state_bar_id = id_prefix + "_state_bar";
const graph_state_stub_id = id_prefix + "_state_stub";
const graph_state_stub_btn_id = id_prefix + "_state_stub_btn";

const tabs_id = id_prefix + "_tabs";

export class GUI {
    constructor(controller: Controller) {
        this.canvas_manager = null;
        this.out_controller = controller;
    }

    //------------------------- API ------------------------

    build(baseContainer: HTMLElement, config: GUIConfiguration, translator: Translator): void {
        this.gui_configuration = config;
        this.translator = translator;

        baseContainer.innerHTML = `
        <aside id=${graph_view_content_id} class="split split-horizontal">
            <div id=${graph_rotate_bar_id} class="ui-slider-handle">
                <div id=${graph_rotate_bar_id}_handle class="ui-slider-handle"></div>
            </div>
            <div id=${graph_viewport_id}></div>
            
            <div id=${graph_state_bar_id} style="position: relative">
                 <div id=${graph_state_bar_id}_line></div>
                 <div id=${graph_state_bar_id}_labels></div>
                 <div id=${graph_state_stub_id} class="scivi_state_line_curtain scivi_state_line_curtain_bg">
                    <div id=${graph_state_stub_btn_id} class="scivi_state_line_curtain_lbl">
                        ${this.translator.apply('LOC_STATECALCULATED')}
                    </div>
                </div>
            </div>
        </aside>`;

        const stub = document.getElementById(graph_state_stub_id);
        stub.style.display = 'flex';
        stub.style.flexDirection = 'column';
        stub.style.justifyContent = 'center';
        stub.style.alignItems = 'center';
        document.getElementById(graph_state_stub_btn_id).onclick = () => {
            GUI.hideStateBarStub();
            const state_index = $('#' + graph_state_bar_id + "_line").slider("option", "value");
            const state = Object.values(this.bound_graph.states)[state_index || 0];
            this.setState(state);
        };
        GUI.hideStateBarStub();

        //если кол-во вкладок больше чем 0, то создаем боковую панель
        if (Object.keys(config).length > 0) {
            const right_sidebar = document.createElement('aside');
            right_sidebar.className = 'split split-horizontal';
            right_sidebar.style.display = 'flex';
            right_sidebar.style.flexDirection = 'column';
            right_sidebar.id = tabs_id;
            const tabs_list = document.createElement('ul');
            right_sidebar.appendChild(tabs_list);

            Object.keys(config).forEach(tab_id => {
                const li = document.createElement('li');
                const link = '#' + tab_id;
                li.innerHTML = `<a id=${id_prefix + tab_id + '_link'} href=${link}>${translator.apply(link)}</a>`;
                tabs_list.appendChild(li);
            });
            Object.keys(config).forEach(tab_id => {
                const tab_container = document.createElement('div');
                tab_container.id = tab_id;
                right_sidebar.appendChild(tab_container);
            });
            baseContainer.appendChild(right_sidebar);

            Split(['#' + graph_view_content_id, '#' + tabs_id], {
                gutterSize: 10,
                cursor: 'col-resize',
                sizes: [55, 45],
                //minSize:350,
                onDrag: () => this.canvas_manager.update()
            });

            //вкладки
            $("#" + tabs_id).tabs({
                heightStyle: "fill"
            });
        }

        //инициализируем левую панель
        this.initGraphViewPanel();
        //инициализируем каждую вкладку
        Object.keys(config).forEach(tab_id => {
            const container = document.getElementById(tab_id);
            config[tab_id].build(container, this.TabsController.bind(this), translator);
        });
        document.body.onresize = () => {
            const viewport = document.getElementById(graph_viewport_id);
            this.canvas_manager.update();
        }
    }

    bindGraph(graph: Graph, config: GraphViewConfiguration) {
        if (graph.states.length > 0) {
            this.bound_graph = graph;
            if (graph.states.length > 1)
                this.fillStateBar();
            this.view_configuration = config;
            if (config.use_auto_orientation_detection) {
                if (graph.meta.is_oriented && typeof (config.link_renderer) != OrientedStraightLinkRenderer.toString())
                    config.link_renderer = new OrientedStraightLinkRenderer();
                if (!graph.meta.is_oriented && typeof (config.link_renderer) != StraightLinkRenderer.toString())
                    config.link_renderer = new StraightLinkRenderer();
            }
			
			if (graph.max_groups_count > 1)
			{
				const colors = createColorsForGraphView(graph.max_groups_count, 1.0);
                for (let i = 0; i < graph.max_groups_count; i++) {
                    this.view_configuration.node_colors_per_group[i] = colors[i];
                    this.view_configuration.node_renderer_per_group[i] = this.view_configuration.node_renderer_per_group[0];
                }
			}
			
            this.setState(getFirstState(graph));
            if (this.gui_configuration['calculator_tab'])
                this.gui_configuration['calculator_tab'].fill(graph);
        }
    }

    // -------------------- Private -------------------------

    //Контроллер, который обрабатывает команды интерфейса где-то снаружи
    private out_controller: Controller;
    private gui_configuration: GUIConfiguration;
    private translator: Translator;

    private canvas_manager: CanvasManager;              //управляющий канвасом - рисует граф, заголовки и т.д.
    private bound_graph: Graph;                         //привязанный граф
    private active_state: GraphState;                   //активное состояние
    private view_configuration: GraphViewConfiguration; //настройки визуализации графа

    //id ноды, на которую кликнули мышкой и инфу о которой нужно отобразить во вкладке node_info_tab
    private toggled_node_id: Ngraph.NodeId = undefined;

    //---------------- private funcs -----------------
    private initGraphViewPanel() {
        const aside = document.getElementById(graph_view_content_id);
        aside.style.display = 'flex';
        aside.style.flexDirection = 'column';
        aside.style.justifyContent = 'space-between';

        //слайдер поворота
        const rotate_bar = document.getElementById(graph_rotate_bar_id);
        rotate_bar.style.marginTop = '0.5rem';
        rotate_bar.style.marginBottom = '0.5rem';
        rotate_bar.style.marginLeft = '2rem';
        rotate_bar.style.marginRight = '2rem';
        const rotate_bar_handle = $('#' + graph_rotate_bar_id + "_handle");
        $("#" + graph_rotate_bar_id).slider({
            min: -180,
            max: 180,
            value: 0,
            step: 5,
            slide: (event, ui) => {
                const value = ui.value || 0;
                rotate_bar_handle.text(`${value}°`);
                this.canvas_manager.rotateGraph(value);
                this.canvas_manager.update();
            },
            create: () => rotate_bar_handle.text(`${0}°`)
        });
        const viewport = document.getElementById(graph_viewport_id);
        viewport.style.flex = '1 1 auto';
        viewport.style.padding = '0px';
        this.canvas_manager = new CanvasManager(viewport, this.CanvasManagerController.bind(this));
    }

    private fillStateBar() {
        //слайдер состояний
        const states_count = Object.keys(this.bound_graph.states).length;
        const width_per_state = 100 / states_count;
        const state_bar = document.getElementById(graph_state_bar_id + "_line");
        state_bar.style.marginTop = '0.5rem';
        state_bar.style.marginRight = `${width_per_state / 2}%`;
        state_bar.style.marginLeft = `${width_per_state / 2}%`;
        $('#' + graph_state_bar_id + "_line").slider({
            min: 0,
            max: states_count - 1,
            value: 0,
            step: 1,
            slide: (event, ui) => {
                const state = this.bound_graph.states[ui.value || 0];
                this.setState(state);
            }
        });
        const state_bar_labels = document.getElementById(graph_state_bar_id + '_labels');
        this.bound_graph.states.forEach(state => {
            const label = document.createElement('div');
            label.style.display = 'inline-block';
            label.style.textAlign = 'center';
            label.innerHTML = `<span>|</span><br/><label>${state.label}</label>`;
            label.classList.add('scivi_fsgraph_stateline_label');
            label.style.width = `${width_per_state}%`;
            state_bar_labels.appendChild(label);
        });
    }

    //Назначить состояние графа. Вызывается при каждом переключении состояния, при вычислении состояния и при вычислении модулярности
    private setState(state: GraphState): void {
        this.active_state = state;
        //Инициализируем GUI до того как загрузим граф в canvas Manager,
        // потому что выделенные вершины должны отмечаться на уже нарисованном гуе
        if (this.gui_configuration['node_list_tab'])
            this.gui_configuration['node_list_tab'].fill(state);
        if (this.gui_configuration['about_graph_tab'])
            this.gui_configuration['about_graph_tab'].fill(state);
        if (this.gui_configuration['links_tab'])
            this.gui_configuration['links_tab'].fill(state);
        if (this.gui_configuration['node_info_tab'])
            this.gui_configuration['node_info_tab'].fill({
                "graph": this.active_state,
                "node_id": this.toggled_node_id
            });
        this.canvas_manager.bindGraph(state, this.view_configuration);
        if (this.gui_configuration["clusters_info_tab"])
            this.gui_configuration["clusters_info_tab"].fill({
                "state": this.active_state,
                "view_config": this.view_configuration
            });
        this.canvas_manager.update();
    }

    private static showStateBarStub() {
        const stub = document.getElementById(graph_state_stub_id);
        stub.style.display = 'flex';
    }

    private static hideStateBarStub() {
        const stub = document.getElementById(graph_state_stub_id);
        stub.style.display = 'none';
    }

    private hideNode(node_id, manually = false) {
        if (this.canvas_manager.HideNode(node_id) &&
            this.active_state.hideNode(node_id, manually)) {
            if (node_id == this.toggled_node_id)
                this.toggled_node_id = undefined;

            if (this.gui_configuration['node_info_tab'])
                this.gui_configuration['node_info_tab'].fill({
                    "graph": this.active_state,
                    "node_id": this.toggled_node_id
                });
            const node_list_tab = this.gui_configuration['node_list_tab'] as NodeListTab;
            if (node_list_tab)
                node_list_tab.onHideNode(node_id);
            const links_tab = this.gui_configuration['links_tab'] as LinksTab;
            if (links_tab)
                links_tab.onHideNode(node_id);
        }
    }

    private showNode(node_id, manually = false) {
        if (this.active_state.showNode(node_id, manually) &&
            this.canvas_manager.ShowNode(node_id)) {
            if (this.gui_configuration['node_info_tab'])
                this.gui_configuration['node_info_tab'].fill({
                    "graph": this.active_state,
                    "node_id": this.toggled_node_id
                });
            const node_list_tab = this.gui_configuration['node_list_tab'] as NodeListTab;
            if (node_list_tab)
                node_list_tab.onShowNode(node_id);
            const links_tab = this.gui_configuration['links_tab'] as LinksTab;
            if (links_tab)
                links_tab.onShowNode(node_id);
        }
    }

    private hideLink(fromId, toId, manually = false) {
        var need_update_graph_info_tab = false;
        if (this.canvas_manager.HideLink(fromId, toId) &&
            this.active_state.hideLink(fromId, toId, manually)) {
            const node_info_tab = this.gui_configuration['node_info_tab'] as NodeInfoTab;
            if (node_info_tab)
                node_info_tab.onHideLink(fromId, toId);
            const links_tab = this.gui_configuration['links_tab'] as LinksTab;
            if (links_tab)
                links_tab.onHideLink(fromId, toId);
            need_update_graph_info_tab = true;
        }
        //hide back link
        if (!this.active_state.meta.is_oriented)
            if (this.canvas_manager.HideLink(toId, fromId) &&
                this.active_state.hideLink(toId, fromId, manually)) {
                const node_info_tab = this.gui_configuration['node_info_tab'] as NodeInfoTab;
                if (node_info_tab)
                    node_info_tab.onHideLink(toId, fromId);
                const links_tab = this.gui_configuration['links_tab'] as LinksTab;
                if (links_tab)
                    links_tab.onHideLink(toId, fromId);
                need_update_graph_info_tab = true;
            }
        if (need_update_graph_info_tab && this.gui_configuration['about_graph_tab'])
            this.gui_configuration['about_graph_tab'].fill(this.active_state);
    }

    private showLink(fromId, toId, manually = false) {
        var need_update_graph_info_tab = false;
        if (this.active_state.showLink(fromId, toId, manually) &&
            this.canvas_manager.ShowLink(fromId, toId)) {
            const node_info_tab = this.gui_configuration['node_info_tab'] as NodeInfoTab;
            if (node_info_tab)
                node_info_tab.onShowLink(fromId, toId);
            const links_tab = this.gui_configuration['links_tab'] as LinksTab;
            if (links_tab)
                links_tab.onShowLink(fromId, toId);
            need_update_graph_info_tab = true;
        }
        //show back link
        if (!this.active_state.meta.is_oriented)
            if (this.canvas_manager.ShowLink(toId, fromId) &&
                this.active_state.showLink(toId, fromId, manually)) {
                const node_info_tab = this.gui_configuration['node_info_tab'] as NodeInfoTab;
                if (node_info_tab)
                    node_info_tab.onShowLink(toId, fromId);
                const links_tab = this.gui_configuration['links_tab'] as LinksTab;
                if (links_tab)
                    links_tab.onShowLink(toId, fromId);
                need_update_graph_info_tab = true;
            }
        if (need_update_graph_info_tab && this.gui_configuration['about_graph_tab'])
            this.gui_configuration['about_graph_tab'].fill(this.active_state);
    }

    //------------------ Controllers -----------------------
    private async CanvasManagerController(command: string, args) {
        switch (command) {
            case "OnToggleOnNode": {
                this.toggled_node_id = args['node_id'];
                if (this.gui_configuration["node_info_tab"])
                    this.gui_configuration["node_info_tab"].fill({
                        "graph": this.active_state,
                        "node_id": this.toggled_node_id
                    });
            } break;
            case "OnToggleOffNode": {
                if (this.gui_configuration["node_info_tab"])
                    this.gui_configuration["node_info_tab"].clear();
                this.toggled_node_id = undefined;
            } break;
            case "OnSelectNode": {
                const node_list_tab = this.gui_configuration["node_list_tab"] as NodeListTab;
                if (node_list_tab)
                    node_list_tab.onSelectedNode(args['node_id']);
            } break;
            case "OnDeselectNode": {
                const node_list_tab = this.gui_configuration["node_list_tab"] as NodeListTab;
                if (node_list_tab)
                    node_list_tab.onDeselectedNode(args['node_id']);
            } break;
            case "ImportingGraph_HideNode": this.hideNode(args['node_id']); break;
            case "ImportingGraph_ShowNode": this.showNode(args['node_id']); break;
            case "ImportingGraph_HideLink": this.hideLink(args['fromId'], args["toId"]); break;
            case "ImportingGraph_ShowLink": this.showLink(args['fromId'], args["toId"]); break;
            default: {
                console.log("unknown command from CanvasManager", command, args);
            } break;
        }
    }

    private async TabsController(command: string, args) {
        switch (command) {
            //----------------- Graph Editing -----------------
            case 'ShowNode': {
                const node_id: Ngraph.NodeId = args["node_id"];
                const is_manually = args["manually"] || false;
                this.showNode(node_id, is_manually);
            } break;
            case 'HideNode': {
                const node_id: Ngraph.NodeId = args["node_id"];
                const is_manually = args["manually"] || false;
                this.hideNode(node_id, is_manually);
            } break;
            case "ShowAllNodesInList": {
                const nodes_list = args['list'] as Ngraph.NodeId[];
                nodes_list.forEach(id => this.showNode(id, true));
            } break;
            case "HideAllNodesInList": {
                const nodes_list = args['list'] as Ngraph.NodeId[];
                nodes_list.forEach(id => this.hideNode(id, true));
            } break;
            case 'ShowLink': {
                const link = args['link'];
                const is_manually = args['manually'] || false;
                this.showLink(link.fromId, link.toId, is_manually);
            } break;
            case 'HideLink': {
                const link = args['link'];
                const is_manually = args['manually'] || false;
                this.hideLink(link.fromId, link.toId, is_manually);
            } break;
            case "FilterLinks": {
                const links = args['links'];
                const range = args['range'];
                links.forEach(link_id => {
                    if (IsInRange(range, link_id.weight))
                        this.showLink(link_id.fromId, link_id.toId);
                    else
                        this.hideLink(link_id.fromId, link_id.toId);
                });
            } break;
            case "showLinksFromNode": {
                const node_id = args['node_id'];
                const links = this.active_state.source_graph.getLinks(node_id);
                links.forEach(link => {
                    if (link.fromId == node_id)
                        this.showLink(link.fromId, link.toId, true);
                })
            } break;
            case 'hideLinksFromNode': {
                const node_id = args['node_id'];
                const links = this.active_state.source_graph.getLinks(node_id);
                links.forEach(link => {
                    if (link.fromId == node_id)
                        this.hideLink(link.fromId, link.toId, true);
                })
            } break;
            case "showLinksToNode": {
                const node_id = args['node_id'];
                const links = this.active_state.source_graph.getLinks(node_id);
                links.forEach(link => {
                    if (link.toId == node_id)
                        this.showLink(link.fromId, link.toId, true);
                })
            } break;
            case 'hideLinksToNode': {
                const node_id = args['node_id'];
                const links = this.active_state.source_graph.getLinks(node_id);
                links.forEach(link => {
                    if (link.toId == node_id)
                        this.hideLink(link.fromId, link.toId, true);
                })
            } break;
            case 'Clusterise': {
                this.active_state.clusterize();
                const clusters_count = this.active_state.groups.getNodesCount();
                this.canvas_manager.setClustersCount(clusters_count);
                this.setState(this.active_state);
            } break;
			case 'ResetClusters': {
                this.active_state.resetClusters();
                this.canvas_manager.setClustersCount(1);
                this.setState(this.active_state);
            } break;
            case "CalcState": {
                const expr = args['expr'];
                const state = CalculateState(this.bound_graph, expr);
                this.setState(state);
                GUI.showStateBarStub();
            } break;
            //---------------- Visual Settings ---------------------
            case 'layout': this.canvas_manager.layoutGraph(args['builder']); break;
            case 'SelectNode': {
                const id = args["node_id"];
                if (this.canvas_manager.SelectNode(id)) {
                    const node_list_tab = this.gui_configuration["node_list_tab"] as NodeListTab;
                    if (node_list_tab)
                        node_list_tab.onSelectedNode(id);
                }
            } break;
            case 'DeselectNode': {
                const id = args["node_id"];
                if (this.canvas_manager.DeselectNode(id)) {
                    const node_list_tab = this.gui_configuration["node_list_tab"] as NodeListTab;
                    if (node_list_tab)
                        node_list_tab.onDeselectedNode(id);
                }
            } break;
            case "SelectAllNodesInList": {
                const list = args['list'] as Ngraph.NodeId[];
                const node_list_tab = this.gui_configuration["node_list_tab"] as NodeListTab;
                list.forEach(id => {
                    if (this.canvas_manager.SelectNode(id) && node_list_tab)
                        node_list_tab.onSelectedNode(id);
                });

            } break;
            case "DeselectAllNodesInList": {
                const list = args['list'] as Ngraph.NodeId[];
                const node_list_tab = this.gui_configuration["node_list_tab"] as NodeListTab;
                list.forEach(id => {
                    if (this.canvas_manager.DeselectNode(id) && node_list_tab)
                        node_list_tab.onDeselectedNode(id);
                });
            } break;
            case "ChangeNodeName": {
                const node_id = args["node_id"];
                const new_label = args['new_name'];
                this.active_state.mutable_graph.getNode(node_id).data.label = new_label;
                this.active_state.source_graph.getNode(node_id).data.label = new_label;
                this.canvas_manager.SetNodeLabel(node_id, new_label);
            } break;
            case "NodeSizeCoeffChanged": {
                this.view_configuration.node_size_coeff.value = args['new_coeff'];
                this.canvas_manager.updateViewConfiguration();
            } break;
            case "LinkSizeCoeffChanged": {
                this.view_configuration.link_size_coeff.value = args['new_coeff'];
                this.canvas_manager.updateViewConfiguration();
            } break;
            case "SetNodeAlpha": {
                Object.keys(this.view_configuration.node_colors_per_group).forEach(group => {
                    const hex_color = this.view_configuration.node_colors_per_group[group];
                    const color = chroma.color(hex_color).alpha(args['alpha']);
                    this.view_configuration.node_colors_per_group[group] = color.hex("rgba")
                });
                this.canvas_manager.updateViewConfiguration();
            } break;
            case "SetBorderSize": {
                const size = args['size'];
                this.view_configuration.node_border_width = size;
                this.canvas_manager.updateViewConfiguration();
            } break;

            case 'SavePNG': this.canvas_manager.savePNG(); break;
            case 'ToggleLabelsShowing': this.view_configuration.always_show_labels = !this.view_configuration.always_show_labels; break;
            case "ToggleWeightsShowing": this.view_configuration.always_show_weights = !this.view_configuration.always_show_weights; break;
            case "SetLabelFontSize": this.view_configuration.label_font_size = args['font_size']; break;
            case "SelectLabelLayoutStrategy":
                {
                    const value = Number(args['strategy_id']);
                    this.view_configuration.label_layout_strategy = value;
                    this.canvas_manager.updateViewConfiguration();
                } break;
            case "ChangeColorForGroup": {
                const group_id = args['group_id'];
                const color = args['color'];
                this.view_configuration.node_colors_per_group[group_id] = color;
                this.canvas_manager.updateViewConfiguration();
            } break;
            case "ExportGraph": 
			{
				const is_clustered = !!args && "clustered" in args;
                const file_content = {};
                file_content["graph_data"] = this.canvas_manager.saveGraphViewToFile(is_clustered);
                file_content["state"] = this.active_state.label;
                download(JSON.stringify(file_content), "graph_layout.json", 'text/plain');
            } break;
            case "ImportGraph": {
                const content = args['imported_state'];
				console.log(content);
                if (content["state"]) {
                    var new_state_index = this.bound_graph.states
                        .findIndex(x => x.label == content['state']);
					if (new_state_index == -1 && !isNaN(Number(content["state"])))
						new_state_index = Number(content["state"]);
                    if (new_state_index != -1) 
					{
                        const new_state = this.bound_graph.states[new_state_index];
                        new_state.import(content["graph_data"]);
                        const clusters_count = this.active_state.groups.getNodesCount();
                        this.canvas_manager.setClustersCount(clusters_count);
                        $('#' + graph_state_bar_id + "_line").slider({ value: new_state_index });
                        this.setState(new_state);
                        
                        this.canvas_manager.loadGraphView(content["graph_data"]);
                        this.toggled_node_id = undefined;
                        if (this.gui_configuration["node_info_tab"])
                            this.gui_configuration["node_info_tab"].fill({
                                "graph": this.active_state,
                                "node_id": this.toggled_node_id
                            });

                    }
                    else console.log('can\'t find state with name', content['state'], "states:", this.bound_graph.states);
                }
                else console.log('invalid state', content['state']);

            } break;
            default: console.log('unknown event: ', command, args); break;
        }
        this.canvas_manager.update();
    }
}

function download(content, fileName, contentType) {
    var a = document.createElement("a");
    var file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}