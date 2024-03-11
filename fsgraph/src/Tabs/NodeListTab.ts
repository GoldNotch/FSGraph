import {Controller, HTMLSwitch, id_prefix, ITab, TabConfiguration} from "../@types/GUI";
import {GraphControlling, Ngraph} from "../@types/Graph";
import GraphState = GraphControlling.GraphState;
import {Translator} from "../Translator";
import { ScalarParam, Range, IsInRange } from "../@types/Param";
import { HTMLSlider } from "../@types/GUI";

enum ListFilterType
{
        NoFilter,
        SubstringFilter,
        StringFilter,
        RegExpFilter
}

const local_id_prefix = '_node_list_tab';
const node_list_filter_panel_id = id_prefix + local_id_prefix + '_filter_panel';
const node_list_header_id = id_prefix + local_id_prefix + '_header';
const node_list_content_id = id_prefix + local_id_prefix + '_content';
const node_filter_slider_id = id_prefix + local_id_prefix + '_node_filter_slider';

enum SortingMode
{
    NO_SORT,
    ALPHABETIC_ASC,
    ALPHABETIC_DESC,
    WEIGHT_ASC,
    WEIGHT_DESC
}

export class NodeListTab implements ITab {
    // ------------------------- API -------------------------------

    constructor(config?: TabConfiguration) {
        this.container = null;
        this.controller = null;
        this.translator = null;
        this.state = null;
        this.filter_string = "";
    }

    build(htmlContainer: HTMLElement,
          controller: Controller,
          translator: Translator)
    {
        this.container = htmlContainer;
        this.controller = controller;
        this.translator = translator;
        this.container.style.flex = '1 1 auto';
        //фильтр вершин
        const filter_panel = document.createElement('div');
        filter_panel.id = node_list_filter_panel_id;

        //------------- весовой фильтр вершин -----------------
        {
            this.node_filter_elem = new HTMLSlider(node_filter_slider_id ,this.translator.apply("LOC_NODE_THRESHOLD"));
            this.node_filter_elem.onChanged = (range) => this.updateList(range);
            this.node_filter_elem.appendToElement(filter_panel);
            filter_panel.appendChild(document.createElement('br'));
        }
        //----------------Кнопка Не--------------
        {
            const notBtn = document.createElement('button');
            notBtn.className = 'scivi_button';
            notBtn.innerText = translator.apply("LOC_NOT");
            notBtn.onclick = () => {
                this.m_not = !this.m_not;
                if (this.m_not)
                    notBtn.classList.add("pushed");
                else notBtn.classList.remove('pushed');
                this.updateList(this.node_filter_elem.getRange());
            };
            filter_panel.appendChild(notBtn);
        }
        // ---------------- поле ввода строки --------------
        {
            const input = document.createElement('input');
            input.type = 'text';
            input.style.marginRight = '5px';
            input.width = 200;
            input.oninput = () => {
                this.filter_string = input.value;
                this.updateList(this.node_filter_elem.getRange());
            };
            filter_panel.appendChild(input);
        }
        // ------------ кнопка Найти по строке -------------
        {
            const btn = document.createElement('button');
            btn.className = 'scivi_button';
            btn.innerText = translator.apply("LOC_FINDSTRING");
            btn.onclick = () => {};
            filter_panel.appendChild(btn);
        }
        // ------------ кнопка Найти по regexp -------------
        {
            const btn = document.createElement('button');
            btn.className = 'scivi_button';
            btn.innerText = translator.apply("LOC_FINDREGEXP");
            btn.onclick = () => {};
            filter_panel.appendChild(btn);
        }
        this.container.appendChild(filter_panel);

        // ----------------- Панель с кнопочками ----------------
        const header = document.createElement('div');
        header.id =node_list_header_id;
        header.style.marginTop = '5px';
        header.style.display = 'flex';
        
        const AllNoneStates = [this.translator.apply('LOC_ALL'), this.translator.apply('LOC_NONE')];
        const SortStates = [this.translator.apply("#no_sort"),
                            this.translator.apply("#sort_asc"), 
                            this.translator.apply("#sort_desc")];
        const vis_switch = new HTMLSwitch(AllNoneStates, false, translator.apply('LOC_VISIBLE'), true);
        vis_switch.onSwitch = (state) => {
            if (state == AllNoneStates[0])
                this.controller("ShowAllNodesInList", {"list": this.filtered_nodes});
            else if (state == AllNoneStates[1])
                this.controller("HideAllNodesInList", {"list": this.filtered_nodes});
        };
        vis_switch.appendToElement(header);
        const sel_switch = new HTMLSwitch(AllNoneStates, false, translator.apply('LOC_SELECTED'), true);
        sel_switch.getRootStyle().marginLeft = '10px';
        sel_switch.onSwitch = (state) => {
            console.log('sel', state);
            if (state == AllNoneStates[0])
                this.controller("SelectAllNodesInList", {"list": this.filtered_nodes});
            else if (state == AllNoneStates[1])
                this.controller("DeselectAllNodesInList", {"list": this.filtered_nodes});
        };
        sel_switch.appendToElement(header);
        const sort_alphabet_switch = new HTMLSwitch(SortStates, true, translator.apply('#sort_alphabetically_text'), true);
        sort_alphabet_switch.getRootStyle().marginLeft = '10px';
        const sort_by_weight_switch = new HTMLSwitch(SortStates, true, translator.apply('#sort_by_weight_text'), true);
        sort_by_weight_switch.getRootStyle().marginLeft = '10px';
        sort_alphabet_switch.onSwitch = (state) => {
            sort_by_weight_switch.setState(0);
            if (state == SortStates[0])
                this.sorting = SortingMode.NO_SORT;
            else if (state == SortStates[1])
                this.sorting = SortingMode.ALPHABETIC_ASC;
            else if (state == SortStates[2])
                this.sorting = SortingMode.ALPHABETIC_DESC;
            this.updateList(this.node_filter_elem.getRange());
        };
        sort_by_weight_switch.onSwitch = (state) => {
            if (this.state.meta.nodes_weight_range){
                sort_alphabet_switch.setState(0);
                if (state == SortStates[0])
                    this.sorting = SortingMode.NO_SORT;
                else if (state == SortStates[1])
                    this.sorting = SortingMode.WEIGHT_ASC;
                else if (state == SortStates[2])
                    this.sorting = SortingMode.WEIGHT_DESC;
                this.updateList(this.node_filter_elem.getRange());
            }
        };
        sort_alphabet_switch.appendToElement(header);
        sort_by_weight_switch.appendToElement(header);
        sort_alphabet_switch.setState(1);
        this.container.appendChild(header);

        // -----------------     Сам список вершин ---------------------
        const content = document.createElement('div');
        content.id = node_list_content_id;
        this.container.appendChild(content);
        this.clear();
    }

    clear(): void
    {
        document.getElementById(node_list_content_id).innerHTML = `<p>${this.translator.apply('LOC_NO_GRAPH')}</p>`;
        this.state = null;
        this.selected_nodes = [];
        this.node_filter_elem.clear();
    }

    fill(data: any): void
    {
        this.state = data;
        this.node_filter_elem.setGlobalRange(this.state.meta.nodes_weight_range);
        if (!this.state.meta.nodes_weight_range)
            this.updateList(undefined);
    }

    onHideNode(node_id: Ngraph.NodeId)
    {
        const row = document.getElementById(`node_info_${node_id}`);
        const input = <HTMLInputElement>row.getElementsByTagName('input')[0];
        input.checked = false;
    }

    onShowNode(node_id: Ngraph.NodeId)
    {
        const row = document.getElementById(`node_info_${node_id}`);
        const input = <HTMLInputElement>row.getElementsByTagName('input')[0];
        input.checked = true;
    }

    onSelectedNode(node_id: Ngraph.NodeId) : void
    {
        const row = document.getElementById(`node_info_${node_id}`);
        const input = <HTMLInputElement>row.getElementsByTagName('input')[1];
        input.checked = true;
    }

    onDeselectedNode(node_id: Ngraph.NodeId): void
    {
        const row = document.getElementById(`node_info_${node_id}`);
        const input = <HTMLInputElement>row.getElementsByTagName('input')[1];
        input.checked = false;
    }

    // ----------------------- Private ----------------------
    private container: HTMLElement;
    private controller: Controller;
    private translator: Translator;
    private filter_string: string;
    private m_not: boolean;
    private state: GraphState;
    private selected_nodes: Ngraph.NodeId[];
    private node_filter_elem : HTMLSlider;
    private filtered_nodes : Ngraph.NodeId[] = [];
    private sorting : SortingMode = SortingMode.ALPHABETIC_ASC;

    //draw list of nodes
    private updateList(weight_range: Range<number>)
    {
        if (this.state) 
        {
            const ul = document.getElementById(node_list_content_id);
            ul.innerHTML = '';
            let filtered_nodes : Ngraph.Node<GraphControlling.NodeData>[] = [];
            this.state.source_graph
                .forEachNode(node => {
                    if ((!weight_range || IsInRange(weight_range, node.data['weight'])) &&
                        matchStr(node.data.label, this.filter_string,
                            ListFilterType.SubstringFilter, this.m_not))
                        filtered_nodes.push(node);
                    return false;
                });
            switch(this.sorting){
                case SortingMode.ALPHABETIC_ASC: 
                    filtered_nodes = filtered_nodes.sort((x,y) => (x.data.label < y.data.label) ? -1 : 1); break;
                case SortingMode.ALPHABETIC_DESC:
                    filtered_nodes = filtered_nodes.sort((x,y) => (x.data.label < y.data.label) ? 1 : -1); break;
                case SortingMode.WEIGHT_ASC: 
                filtered_nodes = filtered_nodes.sort((x,y) => x.data.norm_weight - y.data.norm_weight); break;
                case SortingMode.WEIGHT_DESC:
                    filtered_nodes = filtered_nodes.sort((x,y) => y.data.norm_weight - x.data.norm_weight); break;
            }
            this.filtered_nodes = [];
            filtered_nodes.forEach(node => {
                this.postNodeInfo(ul, node);
                this.filtered_nodes.push(node.id);
            });
        }
        else{
            console.log('WARNING: UpdateList on null state');
            this.clear();
        }
    }

    private postNodeInfo(ul: HTMLElement, node: Ngraph.Node)
    {
        const li = document.createElement('li');
        li.id = `node_info_${node.id}`;
        li.style.listStyleType = 'none';
        //visual checkbox
        const vis = document.createElement('input');
        vis.type = 'checkbox';
        vis.style.marginLeft = '18px';
        vis.checked = this.state.mutable_graph.hasNode(node.id) != undefined;
        vis.onclick = () => {
            if (vis.checked)
                this.controller("ShowNode", {"node_id": node.id, "manually": true});
            else {
                this.controller("HideNode", {"node_id": node.id, "manually": true});
                this.deleteFromSelectedNodes(node.id)
            } 
        };
        //selection checkbox
        const sel = document.createElement('input');
        sel.type = 'checkbox';
        sel.style.marginLeft = '55px';
        sel.style.marginRight = '18px';
        sel.checked = this.selected_nodes.indexOf(node.id) != -1;
        sel.onclick = () => {
            if (sel.checked){
                this.controller("SelectNode", {"node_id": node.id});
                this.selected_nodes.push(node.id);
            }
            else if (this.deleteFromSelectedNodes(node.id))
                this.controller("DeselectNode", {"node_id": node.id});
        };
        //label
        const label = document.createElement('span');
        label.style.fontWeight = 'normal';
        if (node.data['weight'])
            label.innerText = `${node.data.label} (${node.data['weight']})`;
        else label.innerText = node.data.label;
        li.appendChild(vis);
        li.appendChild(sel);
        li.appendChild(label);
        ul.appendChild(li);
    }

    private deleteFromSelectedNodes(node_id: Ngraph.NodeId)
    {
        //spaw deleting node.id with last node.id and delete last
        const index = this.selected_nodes.indexOf(node_id)
        if (index != -1){
            const last_index = this.selected_nodes.length - 1;
            let temp = this.selected_nodes[last_index];
            this.selected_nodes[last_index] = this.selected_nodes[index];
            this.selected_nodes[index] = temp;
            this.selected_nodes.pop();
            return true;
        }
        return false;
    }
}





function matchStr(str: string, pattern: string, type: ListFilterType, is_inverse: boolean): boolean {
    if (pattern === null || pattern.length === 0)
        return true;
    else {
        switch (type) {
            case ListFilterType.NoFilter:
                return true;

            case ListFilterType.SubstringFilter:
                if (is_inverse)
                    return str.indexOf(pattern) == -1;
                else
                    return str.indexOf(pattern) != -1;

            case ListFilterType.StringFilter:
                if (is_inverse)
                    return str !== pattern;
                else
                    return str === pattern;

            case ListFilterType.RegExpFilter:
                if (is_inverse)
                    return str.match(pattern) == null;
                else
                    return str.match(pattern) != null;
        }
    }
}