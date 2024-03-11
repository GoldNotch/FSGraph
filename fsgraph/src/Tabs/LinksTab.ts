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

import {Controller, id_prefix, ITab, TabConfiguration} from "../@types/GUI";
import {GraphControlling, Ngraph} from "../@types/Graph";
import GraphState = GraphControlling.GraphState;
import {Translator} from "../Translator";

const local_id_prefix = "_LinksTab";
const cell_id_prefix = id_prefix + local_id_prefix + "_CellLink";
const row_id_prefix = id_prefix + local_id_prefix + "_RowNode";
const header_id_prefix = id_prefix + local_id_prefix + "_HeaderNode";

export class LinksTab implements ITab
{
    constructor(config?: TabConfiguration) {
    }

    build(htmlContainer: HTMLElement, controller: (command: string, args: { [p: string]: any }) => Promise<void>, translator: Translator) {
        this.container = htmlContainer;
        this.controller = controller;
        this.translator = translator;
        this.container.style.flex = '1 1 auto';
        this.connectivity_panel = document.createElement('table');
        this.connectivity_panel.style.borderSpacing="0";
        this.connectivity_panel.className = 'connectivity_matrix';
        this.container.appendChild(this.connectivity_panel);
        this.clear();
    }

    clear(): void {
        this.connectivity_panel.innerHTML = '';
    }

    fill(data: any): void {
        const state = data as GraphState;
        let nodes: Ngraph.Node<GraphControlling.NodeData>[] = [];
        this.clear();
        const header = document.createElement('tr');
        const empty_cell = document.createElement('th');
        empty_cell.className = 'connectivity_matrix_header top_header'
        header.appendChild(empty_cell);
        state.source_graph.forEachNode(node => {
            nodes.push(node);
            const cell = document.createElement('th');
            cell.id = `${header_id_prefix}_${node.id}`;
            cell.innerText = node.data.label;
            cell.className = 'connectivity_matrix_header top_header';
            header.appendChild(cell);
        });
        const cell_buttons_header = document.createElement('th');
        cell_buttons_header.className = 'connectivity_matrix_header top_header';
        header.appendChild(cell_buttons_header);
        this.connectivity_panel.appendChild(header);

        nodes.forEach(from => {
            const row = document.createElement('tr');
            row.id = `${row_id_prefix}_${from.id}`;
            const header = document.createElement('th');
            header.scope = 'row';
            header.className = 'connectivity_matrix_header';
            header.innerText = from.data.label;
            row.appendChild(header);
            nodes.forEach(to => {
                const cell = document.createElement('td');
                cell.id = `${cell_id_prefix}_${from.id}_${to.id}`;
                cell.style.textAlign = 'center';
                const link = state.source_graph.getLink(from.id, to.id);
                if (link)
                {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = state.mutable_graph.hasLink(from.id, to.id) != null;
                    checkbox.onchange = (e) => {
                        if (checkbox.checked)
                            this.controller("ShowLink", {"link": link, "manually": true});
                        else this.controller("HideLink", {"link": link, "manually": true});
                    };
                    cell.appendChild(checkbox);
                }
                else
                    cell.innerText = '🞩';
                row.appendChild(cell);
            });
            const buttons_cell = document.createElement('th');
            buttons_cell.className = 'connectivity_matrix_header right_header';
            buttons_cell.scope = 'row';
            buttons_cell.style.display = 'flex';
            //кнопки: видимы все или ни один
            const btnAll = document.createElement('button');
            btnAll.innerText = this.translator.apply('LOC_ALL');
            btnAll.className = 'scivi_button';
            btnAll.style.width = 'auto';
            btnAll.style.textAlign = 'center';
            btnAll.onclick = (e) => this.controller("showLinksFromNode", {"node_id": from.id});
            const btnNone = document.createElement('button');
            btnNone.innerText = this.translator.apply('LOC_NONE');
            btnNone.className = 'scivi_button';
            btnNone.style.width = 'auto';
            btnNone.style.textAlign = 'center';
            btnNone.onclick = (e) => this.controller("hideLinksFromNode", {"node_id": from.id});
            buttons_cell.appendChild(btnAll);
            buttons_cell.appendChild(btnNone);

            row.appendChild(buttons_cell);
            this.connectivity_panel.appendChild(row);
        });

        const buttons_row = document.createElement('tr');
        const left_header = document.createElement('th');
        left_header.className = 'connectivity_matrix_header';
        left_header.scope = 'row';
        left_header.innerText = this.translator.apply('#links_visibility_text');
        buttons_row.appendChild(left_header);
        
        nodes.forEach(node => {
            const cell = document.createElement("td");
            cell.className = 'connectivity_matrix_header bottom_header'
             //кнопки: видимы все или ни один
             const btnAll = document.createElement('button');
             btnAll.innerText = this.translator.apply('LOC_ALL');
             btnAll.className = 'scivi_button';
             btnAll.style.width = 'auto';
             btnAll.style.textAlign = 'center';
             btnAll.onclick = (e) => this.controller("showLinksToNode", {"node_id": node.id});
             const btnNone = document.createElement('button');
             btnNone.innerText = this.translator.apply('LOC_NONE');
             btnNone.className = 'scivi_button';
             btnNone.style.width = 'auto';
             btnNone.style.textAlign = 'center';
             btnNone.onclick = (e) => this.controller("hideLinksToNode", {"node_id": node.id});
             cell.appendChild(btnAll);
             cell.appendChild(btnNone);

            buttons_row.appendChild(cell);
        });

        const right_header = document.createElement('th');
        right_header.className = 'connectivity_matrix_header right_header';
        right_header.scope = 'row';
        buttons_row.appendChild(right_header);

        this.connectivity_panel.appendChild(buttons_row);
    }

    onHideNode(node_id)
    {
        const node_row = document.getElementById(`${row_id_prefix}_${node_id}`);
        node_row.style.display = 'none';
        const header = document.getElementById(`${header_id_prefix}_${node_id}`);
        header.style.display = 'none';
        //first row is header
        //last row for buttons
        for(let i = 1; i < this.connectivity_panel.rows.length - 1; i++)
        {
            const row = this.connectivity_panel.rows[i];
            const from_id = Number(row.id.split('_')[4]);
            const cell = document.getElementById(`${cell_id_prefix}_${from_id}_${node_id}`);
            cell.style.display = 'none';
        }
    }

    onShowNode(node_id)
    {
        const node_row = document.getElementById(`${row_id_prefix}_${node_id}`);
        node_row.style.display = 'table-row';
        const header = document.getElementById(`${header_id_prefix}_${node_id}`);
        header.style.display = 'table-cell';
        for(let i = 1; i < this.connectivity_panel.rows.length - 1; i++)
        {
            const row = this.connectivity_panel.rows[i];
            const from_id = Number(row.id.split('_')[4]);
            const cell = document.getElementById(`${cell_id_prefix}_${from_id}_${node_id}`);
            cell.style.display = 'table-cell';
        }
    }

    onHideLink(fromId, toId)
    {
        const cell = document.getElementById(`${cell_id_prefix}_${fromId}_${toId}`);
        const inputs = cell.getElementsByTagName('input');
        if (inputs.length > 0)
            inputs[0].checked = false;
    }

    onShowLink(fromId, toId)
    {
        const cell = document.getElementById(`${cell_id_prefix}_${fromId}_${toId}`);
        const inputs = cell.getElementsByTagName('input');
        if (inputs.length > 0)
            inputs[0].checked = true;
    }

    // ----------------------- Private ----------------------
    private container: HTMLElement;
    private controller: Controller;
    private translator: Translator;
    private connectivity_panel: HTMLTableElement;

}