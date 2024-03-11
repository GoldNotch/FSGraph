// Copyright 2022 JohnCorn
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Controller, HTMLSlider, id_prefix, ITab, TabConfiguration } from "../@types/GUI";
import { GraphControlling, Ngraph } from "../@types/Graph";
import GraphState = GraphControlling.GraphState;
import GroupNodeData = GraphControlling.GroupNodeData;
import { Translator } from "../Translator";
import { Chart } from "chart.js";
import { GraphView } from "../@types/GraphView";
import { IsInRange, Range } from "../@types/Param";

const local_id_prefix = '_clusters_info_tab';
const internal_links_slider_base_id = id_prefix + local_id_prefix + '_internal_slider';
const external_links_slider_base_id = id_prefix + local_id_prefix + '_external_slider';

export class ClusterInfoTab implements ITab {
    constructor(config?: TabConfiguration) {
        this.container = null;
        this.controller = null;
        this.translator = null;
    }

    build(htmlContainer: HTMLElement, controller: (command: string, args: { [p: string]: any }) => Promise<void>, translator: Translator) {
        this.container = htmlContainer;
        this.controller = controller;
        this.translator = translator;
        this.container.style.flex = '1 1 auto';
        //create header
        this.header = document.createElement('div');
        this.header.style.textAlign = 'center';
        this.container.appendChild(this.header);
        //create canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext("2d");
        this.container.appendChild(this.canvas);
        this.chart = new Chart(this.ctx, {
            type: "doughnut",
            data: {}
        });

        this.stub_panel = document.createElement('div');
        this.stub_panel.innerText = this.translator.apply("LOC_STATSTUB");
        this.container.appendChild(this.stub_panel);


        this.clear();
    }

    clear(): void {
        this.header.innerHTML = '';
        this.header.innerText = `${this.translator.apply("LOC_NO_GRAPH")}`;
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.onclick = null;
        this.state = undefined;
        this.current_visible_panel = null;
        this.group_control_panels = [];
    }

    fill(data: any): void {
        const graph_state = data['state'] as GraphState;
        const view_config = data["view_config"] as GraphView.GraphViewConfiguration;
        if (!graph_state || !view_config) {
            this.clear();
            return;
        }
        this.state = graph_state;
        this.view_config = view_config;
        this.group_control_panels = [];

        const groups_count = graph_state.groups.getNodesCount();
        const groups: Ngraph.Node<GroupNodeData>[] = [];
        graph_state.groups.forEachNode(group => { groups.push(group); return false; });
        this.header.innerHTML = '';
        this.header.innerText = `${this.translator.apply('LOC_STATCAPTION')}${groups_count})`;
        //--------------- update chart -------------------------------
        this.chart.data.labels = groups.map(x => x.data.label);
        const dataset = {
            label: 'clusters chart',
            data: groups.map(x => x.data.nodes.length),
            backgroundColor: Object.values(view_config.node_colors_per_group),
            hoverOffset: 4
        }
        this.chart.data.datasets = [dataset];
        this.chart.update();
        this.canvas.onclick = (e) => this.clickOnCanvas(e);
        if (this.current_visible_panel)
            this.current_visible_panel.style.display = 'none';
        this.current_visible_panel = this.stub_panel;
        this.stub_panel.style.display = 'block';

        //generate panel for each group
        groups.forEach(group => this.postGroupPanel(group));
    }

    // ----------------------- Private ----------------------
    private container: HTMLElement;
    private controller: Controller;
    private translator: Translator;
    private chart: Chart;
    private canvas: HTMLCanvasElement;
    private state: GraphState;
    private view_config: GraphView.GraphViewConfiguration;
    private ctx: CanvasRenderingContext2D
    private current_visible_panel: HTMLElement = null;

    //panels
    private header: HTMLElement = null;
    private stub_panel: HTMLElement = null;
    private group_control_panels: HTMLElement[] = [];
    private external_sliders : Map<Ngraph.NodeId, Map<Ngraph.NodeId, HTMLSlider>> = new Map();

    private clickOnCanvas(evt) {
        let clicked_cluster = this.chart.getElementsAtEvent(evt)[0];
        this.current_visible_panel.style.display = 'none';
        if (clicked_cluster) {
            const group_id = clicked_cluster._index;
            const panel = this.group_control_panels[group_id];
            if (panel) {
                panel.style.display = 'block';
                this.current_visible_panel = panel;
            }
        }
        else {
            this.stub_panel.style.display = 'block';
            this.current_visible_panel = this.stub_panel;
        }
    }

    private postGroupPanel(group: Ngraph.Node<GroupNodeData>) {
        const group_color = this.view_config.node_colors_per_group[group.id].substring(0, 7);

        const panel = document.createElement('div');
        //---------- Информация о кластере --------------
        {
            const label = document.createElement('label');
            label.innerText = `${this.translator.apply('LOC_GROUP')} ${group.id}.`;
            panel.appendChild(label);

            const color_info = document.createElement('span');
            color_info.innerText = `${this.translator.apply('LOC_COLOR')}:`;
            color_info.style.marginLeft = '1rem';
            const color_picker = document.createElement('input');
            color_picker.type = 'color';
            color_picker.value = group_color;
            color_picker.onchange = (evt) => {
                this.chart.data.datasets[0].backgroundColor[group.id] = color_picker.value;
                this.chart.update();
                this.controller("ChangeColorForGroup", { "group_id": group.id, "color": color_picker.value });
            }
            color_info.appendChild(color_picker);
            panel.appendChild(color_info);
        }
        //--------------- Фильтрация дуг -----------------
        if (this.state.meta.links_weight_range &&
            this.state.meta.links_weight_range.min < this.state.meta.links_weight_range.max) {
            //---------- internal links -------------------
            {
                const slider = new HTMLSlider(`${internal_links_slider_base_id}_${group.id}`,
                    this.translator.apply("LOC_INTERNAL_LINKS_FILTER"));
                slider.onChanged = (range) => this.controller("FilterLinks",
                    {
                        "links": group.data.internal_links,
                        "range": range
                    });
                slider.setGlobalRange(group.data.internal_links_weight_range);
                slider.appendToElement(panel);
            }

            //--------- external links ---------------
            if (group.links) {
                makeSectionBorder(panel);
                const label = document.createElement('label');
                label.innerText = this.translator.apply('LOC_EXTERNAL_LINKS_FILTER');
                panel.appendChild(label);
                group.links.forEach(link => {
                    if (link.fromId == group.id) {
                        const to = this.state.groups.getNode(link.toId);
                        const color = this.view_config.node_colors_per_group[to.id];
                        const slider = new HTMLSlider(`${external_links_slider_base_id}_${link.fromId}_${to.id}`, 
                                        `${to.data.label}  <span style="background-color:${color}; border-radius: 50%">    </span>`);
                        slider.onChanged = (range) => {
                            this.controller("FilterLinks", {
                                "links": link.data.links,
                                "range": range
                            });
                            if (!this.state.meta.is_oriented){
                                const back_sliders = this.external_sliders.get(to.id)
                                if (back_sliders){
                                    const back_slider = back_sliders.get(link.fromId);
                                    if (back_slider)
                                        back_slider.setRange(range);
                                }
                            }
                        }
                        slider.setGlobalRange(link.data.links_weight_range);
                        slider.appendToElement(panel);
                        if (!this.external_sliders.has(link.fromId))
                            this.external_sliders.set(link.fromId, new Map());
                        this.external_sliders.get(link.fromId).set(link.toId, slider);
                    }
                    return false;
                });
            }
        }
        //----------- вершины кластера ---------------------
        {
            const ul_label = document.createElement('label');
            ul_label.innerText = `${this.translator.apply('LOC_LINKEDNODES')}`;
            const ul = document.createElement('ul');
            group.data.nodes.forEach(node_id => {
                const node = this.state.mutable_graph.getNode(node_id);
                if (node) {
                    const li = document.createElement('li');
                    li.innerText = node.data.label;
                    ul.appendChild(li);
                }
            });

            makeSectionBorder(panel);
            panel.appendChild(ul_label);
            panel.appendChild(ul);
        }
        panel.style.display = 'none';
        this.group_control_panels.push(panel);
        this.container.appendChild(panel);
    }
}

function makeSectionBorder(container: HTMLElement) {
    container.appendChild(document.createElement('br'));
    container.appendChild(document.createElement('hr'));
    container.appendChild(document.createElement('br'));
}