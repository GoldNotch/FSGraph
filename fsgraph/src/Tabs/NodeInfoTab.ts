import { Controller, HTMLSwitch, id_prefix, ITab, TabConfiguration } from "../@types/GUI";
import { GraphControlling, Ngraph } from "../@types/Graph";
import GraphState = GraphControlling.GraphState;
import { Translator } from "../Translator";
import { IsInRange, Range } from "../@types/Param";

const local_id_prefix = 'node_info_tab';
const in_links_list_id = id_prefix + local_id_prefix + "_incoming_links_list";
const out_links_list_id = id_prefix + local_id_prefix + "_outcoming_links_list";
const link_li_base_id = id_prefix + local_id_prefix + "_link";

enum SortingMode {
    NO_SORT,
    ALPHABETIC_ASC,
    ALPHABETIC_DESC,
    WEIGHT_ASC,
    WEIGHT_DESC
}

export class NodeInfoTab implements ITab {
    // ------------------------- API -------------------------------

    constructor(config?: TabConfiguration) {
        this.container = null;
        this.controller = null;
        this.translator = null;
    }

    build(htmlContainer: HTMLElement,
        controller: Controller,
        translator: Translator) {
        this.container = htmlContainer;
        this.controller = controller;
        this.translator = translator;
        this.container.style.flex = '1 1 auto';
        this.clear();
    }

    clear(): void {
        this.container.innerHTML = `<p>${this.translator.apply('LOC_NO_SELECTED_NODE')}</p>`
    }

    fill(data: any): void {
        const state = <GraphState>data['graph'];
        this.state = state;
        const node_id = <Ngraph.NodeId>data['node_id'];
        if (!state || node_id == undefined) {
            this.clear();
            return;
        }
        const node = state.mutable_graph.getNode(node_id);
        this.current_node_id = node_id;
        this.container.innerHTML = "";

        const node_info = document.createElement('div');
        //------------- поле для изменения названия заголовка вершины ---------------------
        {
            const node_name_input = document.createElement('input');
            node_name_input.type = 'text';
            node_name_input.style.fontWeight = 'bold';
            node_name_input.style.width = '300px';
            node_name_input.style.marginRight = '5px';
            node_name_input.value = node.data.label;
            const change_label_button = document.createElement('button');
            change_label_button.className = 'scivi_button';
            change_label_button.innerText = this.translator.apply('LOC_CHANGE');
            change_label_button.onclick = (event) => this.controller("ChangeNodeName", {
                "node_id": node_id,
                "new_name": node_name_input.value
            });
            node_info.appendChild(node_name_input);
            node_info.appendChild(change_label_button);
        }
        // ------------------ Формируем список данных вершины ------------------------
        {
            const list = document.createElement('ul');
            list.style.listStyleType = 'disc';
            if (node.data) {
                Object.keys(node.data).forEach(name => {
                    const li = document.createElement('li');
                    li.innerText = `${name}: ${node.data[name]}`;
                    list.appendChild(li);
                });
            }
            node_info.appendChild(list);
        }
        this.container.appendChild(node_info);
        makeSectionBorder(this.container);

        let out_links: Ngraph.Link[] = [], in_links: Ngraph.Link[] = [];
        const links = state.source_graph.getLinks(node_id);
        if (links) {
            links.forEach(link => {
                if (state.mutable_graph.hasNode(link.fromId) &&
                    state.mutable_graph.hasNode(link.toId)) {
                    if (link.fromId == node_id)
                        out_links.push(link);
                    else if (link.toId == node_id)
                        in_links.push(link);
                }
            });
        }
        in_links = in_links.sort((x, y) => y.data['weight'] - x.data['weight'])
        out_links = out_links.sort((x, y) => y.data['weight'] - x.data['weight'])

        const AllNoneStates = [this.translator.apply('LOC_ALL'), this.translator.apply('LOC_NONE')];
        const SortStates = [this.translator.apply("#no_sort"),
        this.translator.apply("#sort_asc"),
        this.translator.apply("#sort_desc")];

        // ------------------ Формируем список исходящих дуг -------------------
        {
            const out_links_info = document.createElement('div');
            //----------------- Заголовок -------------------
            const ul_label = document.createElement('label');
            ul_label.innerText = `${this.translator.apply('#out_links_text')} (${out_links.length})`;
            ul_label.style.marginLeft = '1rem';
            out_links_info.appendChild(ul_label);

            const switch_panel = document.createElement('div');
            switch_panel.style.display = 'flex';
            const vis_switch = new HTMLSwitch(AllNoneStates, false, this.translator.apply('LOC_VISIBLE'), true);
            vis_switch.onSwitch = (state) => {
                if (state == AllNoneStates[0])
                    this.controller("showLinksFromNode", { "node_id": node.id });
                else if (state == AllNoneStates[1])
                    this.controller("hideLinksFromNode", { "node_id": node.id });
            };
            const sort_alphabet_switch = new HTMLSwitch(SortStates, true, this.translator.apply('#sort_alphabetically_text'), true);
            sort_alphabet_switch.getRootStyle().marginLeft = '10px';
            const sort_by_weight_switch = new HTMLSwitch(SortStates, true, this.translator.apply('#sort_by_weight_text'), true);
            sort_by_weight_switch.getRootStyle().marginLeft = '10px';
            sort_alphabet_switch.onSwitch = (state) => {
                sort_by_weight_switch.setState(0);
                if (state == SortStates[1])
                    out_links = out_links.sort((x, y) => {
                        const to_x = this.state.source_graph.getNode(x.toId);
                        const to_y = this.state.source_graph.getNode(y.toId);
                        return to_x.data.label > to_y.data.label ? 1 : -1;
                    });
                else if (state == SortStates[2])
                    out_links = out_links.sort((x, y) => {
                        const to_x = this.state.source_graph.getNode(x.toId);
                        const to_y = this.state.source_graph.getNode(y.toId);
                        return to_x.data.label > to_y.data.label ? -1 : 1;
                    });
                this.updateList(out_links_list_id, out_links, false);
            };
            sort_by_weight_switch.onSwitch = (state) => {
                sort_alphabet_switch.setState(0);
                if (state == SortStates[1])
                    out_links = out_links.sort((x, y) => x.data['weight'] - y.data['weight']);
                else if (state == SortStates[2])
                    out_links = out_links.sort((x, y) => y.data['weight'] - x.data['weight']);
                this.updateList(out_links_list_id, out_links, false);
            };
            vis_switch.appendToElement(switch_panel);
            sort_alphabet_switch.appendToElement(switch_panel);
            if (state.meta.links_weight_range)
                sort_by_weight_switch.appendToElement(switch_panel);
            out_links_info.appendChild(switch_panel);

            const ul = document.createElement('ul');
            ul.style.listStyleType = 'none';
            ul.style.padding = '0.9rem';
            ul.id = out_links_list_id;
            out_links_info.appendChild(ul);
            this.container.appendChild(out_links_info);
            makeSectionBorder(this.container);
            sort_by_weight_switch.setState(2);
            this.updateList(out_links_list_id, out_links, false);
        }

        //----------------------- Формируем список входящих вершин -----------------------------
        {
            const in_links_info = document.createElement('div');
            //----------------- Заголовок -------------------
            const ul_label = document.createElement('label');
            ul_label.innerText = `${this.translator.apply('#in_links_text')} (${in_links.length})`;
            ul_label.style.marginLeft = '1rem';
            in_links_info.appendChild(ul_label);

            const switch_panel = document.createElement('div');
            switch_panel.style.display = 'flex';
            const vis_switch = new HTMLSwitch(AllNoneStates, false, this.translator.apply('LOC_VISIBLE'), true);
            vis_switch.onSwitch = (state) => {
                if (state == AllNoneStates[0])
                    this.controller("showLinksToNode", { "node_id": node.id });
                else if (state == AllNoneStates[1])
                    this.controller("hideLinksToNode", { "node_id": node.id });
            };

            const sort_alphabet_switch = new HTMLSwitch(SortStates, true, this.translator.apply('#sort_alphabetically_text'), true);
            sort_alphabet_switch.getRootStyle().marginLeft = '10px';
            const sort_by_weight_switch = new HTMLSwitch(SortStates, true, this.translator.apply('#sort_by_weight_text'), true);
            sort_by_weight_switch.getRootStyle().marginLeft = '10px';
            sort_alphabet_switch.onSwitch = (state) => {
                sort_by_weight_switch.setState(0);
                if (state == SortStates[1])
                in_links = in_links.sort((x, y) => {
                        const from_x = this.state.source_graph.getNode(x.fromId);
                        const from_y = this.state.source_graph.getNode(y.fromId);
                        return from_x.data.label > from_y.data.label ? 1 : -1;
                    });
                else if (state == SortStates[2])
                    in_links = in_links.sort((x, y) => {
                        const from_x = this.state.source_graph.getNode(x.fromId);
                        const from_y = this.state.source_graph.getNode(y.fromId);
                        return from_x.data.label > from_y.data.label ? -1 : 1;
                    });

                this.updateList(in_links_list_id, in_links, true);
            };
            
            sort_by_weight_switch.onSwitch = (state) => {
                sort_alphabet_switch.setState(0);
                if (state == SortStates[1])
                in_links = in_links.sort((x, y) => x.data['weight'] - y.data['weight']);
                else if (state == SortStates[2])
                    in_links = in_links.sort((x, y) => y.data['weight'] - x.data['weight']);

                this.updateList(in_links_list_id, in_links, true);
            };
            vis_switch.appendToElement(switch_panel);
            sort_alphabet_switch.appendToElement(switch_panel);
            if (state.meta.links_weight_range)
                sort_by_weight_switch.appendToElement(switch_panel);
            in_links_info.appendChild(switch_panel);

            const ul = document.createElement('ul');
            ul.style.listStyleType = 'none';
            ul.style.padding = '0.9rem';
            ul.id = in_links_list_id;
            in_links_info.appendChild(ul);
            this.container.appendChild(in_links_info);
            sort_by_weight_switch.setState(2);
            this.updateList(in_links_list_id, in_links, true);
        }
    }

    onHideLink(fromId, toId) {
        let li: HTMLLIElement;
        if (fromId == this.current_node_id)
            li = document.getElementById(`${link_li_base_id}_to_${toId}`) as HTMLLIElement;
        else if (toId == this.current_node_id)
            li = document.getElementById(`${link_li_base_id}_from_${fromId}`) as HTMLLIElement;
        if (li)
            li.getElementsByTagName('input')[0].checked = false;
    }

    onShowLink(fromId, toId) {
        let li: HTMLLIElement;
        if (fromId == this.current_node_id)
            li = document.getElementById(`${link_li_base_id}_to_${toId}`) as HTMLLIElement;
        else if (toId == this.current_node_id)
            li = document.getElementById(`${link_li_base_id}_from_${fromId}`) as HTMLLIElement;
        if (li)
            li.getElementsByTagName('input')[0].checked = true;
    }

    // ----------------------- Private ----------------------
    private container: HTMLElement;
    private controller: Controller;
    private translator: Translator;
    private current_node_id: Ngraph.NodeId;
    private state: GraphState;

    private updateList(ul_id, links: Ngraph.Link<GraphControlling.LinkData>[], are_incoming: boolean) {
        const ul = document.getElementById(ul_id);
        ul.innerHTML = '';
        links.forEach(link => {
            const li = document.createElement('li');
            let label;
            if (are_incoming) {
                label = this.state.source_graph.getNode(link.fromId).data.label;
                li.id = `${link_li_base_id}_from_${link.fromId}`
            }
            else {
                label = this.state.source_graph.getNode(link.toId).data.label;
                li.id = `${link_li_base_id}_to_${link.toId}`
            }
            const label_span = document.createElement('span');
            if (this.state.meta.links_weight_range)
                label_span.innerText = `${label} (${link.data['weight']})`;
            else label_span.innerText = label;

            const input = document.createElement('input');//visibility_checkbox
            input.type = 'checkbox';
            input.style.display = 'inline-block';
            input.checked = !this.state.isManuallyHiddenLink(link) &&
                this.state.mutable_graph.hasLink(link.fromId, link.toId) != undefined;
            input.onclick = () => {
                if (input.checked)
                    this.controller("ShowLink", { "link": link, "manually": true });
                else this.controller("HideLink", { "link": link, "manually": true });
            };
            input.style.marginRight = '3rem';
            li.appendChild(input);
            li.appendChild(label_span);
            ul.appendChild(li);
        });
    }
}

function makeSectionBorder(container: HTMLElement) {
    container.appendChild(document.createElement('br'));
    container.appendChild(document.createElement('hr'));
    container.appendChild(document.createElement('br'));
}