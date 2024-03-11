import {Controller, id_prefix, ITab, TabConfiguration} from "../@types/GUI";
import {GraphControlling} from "../@types/Graph";
import GraphState = GraphControlling.GraphState;
import {Translator} from "../Translator";

const local_id_prefix = '_about_tab';

const graph_name_text = id_prefix + local_id_prefix + '_graph_name';
const nodes_count_metric = id_prefix + local_id_prefix + '_nodes_count_metric';
const links_count_metric = id_prefix + local_id_prefix + '_links_count_metric';
const groups_count_metric = id_prefix + local_id_prefix + '_groups_count_metric';
const density_metric = id_prefix + local_id_prefix + '_density_metric';

export class AboutGraphTab implements ITab
{
    constructor(config?: TabConfiguration) {
        this.container = null;
        this.controller = null;
        this.translator = null;
    }

    build(htmlContainer: HTMLElement, controller: (command: string, args: { [p: string]: any }) => Promise<void>, translator: Translator) {
        this.container = htmlContainer;
        this.controller = controller;
        this.translator = translator;
        this.container.style.height = '100%';
        this.clear();
    }

    clear(): void {
        this.container.innerHTML = `
            <h3 id=${graph_name_text}>no graph</h3>
            <h3>${this.translator.apply('#metrics')}</h3>
            <ul>
                <li style="list-style-type: none">${this.translator.apply('#groups_count')}: <span id=${groups_count_metric}></span></li>
                <li style="list-style-type: none">${this.translator.apply('#nodes_count')}: <span id=${nodes_count_metric}></span></li>
                <li style="list-style-type: none">${this.translator.apply('#links_count')}: <span id=${links_count_metric}></span></li>
                <li style="list-style-type: none">${this.translator.apply('#density')}: <span id = ${density_metric}></span></li>
            </ul>
        `;
    }

    fill(data: any): void {
        const state : GraphState = data;
        const groups_count = state.groups.getNodesCount();
        document.getElementById(graph_name_text).innerText = `::${state.label}`;
        document.getElementById(nodes_count_metric).innerText = String(state.meta.nodes_count);
        document.getElementById(links_count_metric).innerText = String(state.meta.links_count);
        document.getElementById(groups_count_metric).innerText = String(groups_count);
        const density = state.mutable_graph.getLinksCount() / state.meta.links_count;
        document.getElementById(density_metric).innerText = String(density);
    }

    // ----------------------- Private ----------------------
    private container: HTMLElement;
    private controller: Controller;
    private translator: Translator;

}