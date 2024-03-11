import modularity from '../../modified_modules/NonRandomLouvain'
import createGraph, {
    Graph as ngraph_graph,
    Node as ngraph_node,
    Link as ngraph_link,
    NodeId as ngraph_node_id,
    LinkId as ngraph_link_id,
    Link
} from "ngraph.graph";
import { StateCalculatorOperand } from "..";
import { InvalidRange, Range } from "../@types/Param";

export module Ngraph {
    export type Graph<NodeData = any, LinkData = any> = ngraph_graph<NodeData, LinkData>;
    export type Link<Data = any> = ngraph_link<Data>;
    export type Node<Data = any> = ngraph_node<Data>;
    export type NodeId = ngraph_node_id;
    export type LinkId = ngraph_link_id;
}


export module GraphControlling {
    export type NodeData = {
        label: string;
        group: number;
        norm_weight: number;
        [_: string]: any;
    }

    export type LinkData = {
        norm_weight: number;
        [_: string]: any;
    };

    export type GraphMeta = {
        nodes_count: number;
        links_count: number;
        is_oriented: boolean;
        links_weight_range?: Range<number>;
        nodes_weight_range?: Range<number>;
    }
    export const EmptyMeta: GraphMeta = { nodes_count: 0, links_count: 0, is_oriented: true};

    export type LinkId = {
        fromId: Ngraph.NodeId;
        toId: Ngraph.NodeId;
        weight?: number;
    }

    export type GroupNodeData = {
        label: string;
        nodes: Ngraph.NodeId[];
        internal_links: LinkId[];//связи внутри кластера
        internal_links_weight_range: Range<number>;
        external_links_weight_range: Range<number>;//по всем внешним кластерам
    }

    export type GroupLinkData = {
        links_weight_range?: Range<number>;
        links: LinkId[];//связи с другими кластерами
    }

    export class GraphState {

        constructor(label?: string) {
            this.label = label || "";
            this.mutable_graph = createGraph();
            this.source_graph = createGraph();
            this.manually_hidden_node_ids = [];
            this.manually_hidden_links = [];
            this.meta = Object.assign({}, EmptyMeta);
            this.groups = createGraph();
        }

        // -------------------- API -------------------------
        //вручную скрытая вершина
        isManuallyHiddenNode(node_id: Ngraph.NodeId): boolean {
            return this.manually_hidden_node_ids.indexOf(node_id) != -1;
        }

        isManuallyHiddenLink(link: Ngraph.Link): boolean {
            return this.manually_hidden_links
                .find((hidden_link) => link.fromId == hidden_link.fromId &&
                    link.toId == hidden_link.toId) != undefined;
        }

        hideNode(node_id: Ngraph.NodeId, manually: boolean = false) : boolean {
            const deleted = this.mutable_graph.removeNode(node_id);
            if (deleted && manually)
                this.manually_hidden_node_ids.push(node_id);
            return deleted;
        }

        showNode(node_id: Ngraph.NodeId, manually: boolean = false) : boolean {
            const node = this.source_graph.getNode(node_id);
            const links = this.source_graph.getLinks(node_id);
            if (node && !this.mutable_graph.hasNode(node_id)) {
                this.mutable_graph.beginUpdate();
                const added = this.mutable_graph.addNode(node_id, Object.assign({}, node.data));
                if (links) {
                    links.forEach(link => {
                        const from = this.mutable_graph.getNode(link.fromId);
                        const to = this.mutable_graph.getNode(link.toId);
                        if (from && to && this.mutable_graph.hasLink(from.id, to.id) == undefined &&
                            !this.isManuallyHiddenLink(link)) {
                            const data = Object.assign({}, link.data);
                            this.mutable_graph.addLink(link.fromId, link.toId, data);
                        }
                    });
                }
                this.mutable_graph.endUpdate();
                if (manually) {
                    const index = this.manually_hidden_node_ids.indexOf(node_id);
                    if (index != -1) {
                        const len = this.manually_hidden_node_ids.length;
                        let temp = this.manually_hidden_node_ids[index];
                        this.manually_hidden_node_ids[index] = this.manually_hidden_node_ids[len - 1];
                        this.manually_hidden_node_ids[len - 1] = temp;
                        this.manually_hidden_node_ids.pop();
                    }
                    else console.log('WARNING: it\'s try to show not manually hided node');
                }
                return added != null || added != undefined;
            }
            else return false;


        }

        hideLink(fromId: Ngraph.NodeId, toId: Ngraph.NodeId, manually: boolean = false) : boolean {
            const deleting_link = this.mutable_graph.getLink(fromId, toId);
            if (deleting_link) {
                const deleted = this.mutable_graph.removeLink(deleting_link);
                if (deleted && manually)
                    this.manually_hidden_links.push({ fromId: fromId, toId: toId });
                return deleted;
            }
            else return false;
        }

        showLink(fromId: Ngraph.NodeId, toId: Ngraph.NodeId, manually: boolean = false) : boolean {
            const from = this.mutable_graph.getNode(fromId);
            const to = this.mutable_graph.getNode(toId);
            const link = this.source_graph.getLink(fromId, toId);
            if (from && to && !this.mutable_graph.hasLink(fromId, toId)) 
            {
                const data = Object.assign({}, link.data);
                const added = this.mutable_graph.addLink(fromId, toId, data);

                if (manually) {
                    const index = this.manually_hidden_links.findIndex(x => x.fromId == link.fromId && x.toId == link.toId);
                    if (index != -1) {
                        const len = this.manually_hidden_links.length;
                        let temp = this.manually_hidden_links[index];
                        this.manually_hidden_links[index] = this.manually_hidden_links[len - 1];
                        this.manually_hidden_links[len - 1] = temp;
                        this.manually_hidden_links.pop();
                    }
                    else console.log('WARNING: it\'s try to show not manually hided link');
                }
                return added != null || added != undefined;
            }
            else return false;

        }

        updateMeta() {
            let has_link_weights = false;
            let has_node_weights = false;
            let is_oriented = false;

            this.source_graph.forEachNode(node => {
                has_node_weights = has_node_weights || node.data['weight'];
            });

            this.source_graph.forEachLink(link => {
                const w = link.data['weight'];
                has_link_weights = has_link_weights || w;
                if (!is_oriented){
                    const back_link = this.source_graph.getLink(link.toId, link.fromId);
                    is_oriented = !back_link || back_link.data['weight'] != w;
                    if (back_link && back_link.data['weight'] != w)
                    {
                        const from = this.source_graph.getNode(link.fromId);
                        const to  = this.source_graph.getNode(link.toId);
                        console.log('graph isn\'t oriented because weights are\'n equal between', 
                                from.data.label, 'and', to.data.label);
                    }
                }
                return is_oriented;
            });


            this.meta.links_count = this.mutable_graph.getLinksCount();
            this.meta.nodes_count = this.mutable_graph.getNodesCount();
            this.meta.is_oriented = is_oriented;

            //calc range of weights
            if (has_node_weights) {
                const range: Range<number> = InvalidRange();
                this.source_graph.forEachNode(node => {
                    range.max = Math.max(range.max, node.data['weight']);
                    range.min = Math.min(range.min, node.data['weight']);
                    range.avg += node.data['weight'];
                    return false;
                });
                range.avg /= this.source_graph.getNodesCount();
                this.meta.nodes_weight_range = range;
                //нормируем веса вершин
                this.source_graph.forEachNode(node => {
                    const weight = node.data['weight'];
                    const range = this.meta.nodes_weight_range;
                    if (!isNaN(weight))
                        if (range.min != range.max)
                            node.data.norm_weight = (weight - range.min) / (range.max - range.min);
                        else node.data.norm_weight = 1.0;
                });
                this.mutable_graph.forEachNode(node => {
                    const weight = node.data['weight'];
                    const range = this.meta.nodes_weight_range;
                    if (!isNaN(weight))
                        if (range.min != range.max)
                            node.data.norm_weight = (weight - range.min) / (range.max - range.min);
                        else node.data.norm_weight = 1.0;
                });
            }
            else this.meta.nodes_weight_range = undefined;
            //calc range of weights
            if (has_link_weights) {
                const range: Range<number> = InvalidRange();
                this.source_graph.forEachLink(link => {
                    range.max = Math.max(range.max, link.data['weight']);
                    range.min = Math.min(range.min, link.data['weight']);
                    range.avg += link.data['weight'];
                    return false;
                });
                range.avg /= this.source_graph.getLinksCount();
                this.meta.links_weight_range = range;
                //нормируем веса дуг
                this.source_graph.forEachLink(link => {
                    const weight = link.data['weight'];
                    const range = this.meta.links_weight_range;
                    if (weight)
                        if (range.min != range.max)
                            link.data.norm_weight = (weight - range.min) / (range.max - range.min);
                        else link.data.norm_weight = 1.0;
                });
                this.mutable_graph.forEachLink(link => {
                    const weight = link.data['weight'];
                    const range = this.meta.links_weight_range;
                    if (weight)
                        if (range.min != range.max)
                            link.data.norm_weight = (weight - range.min) / (range.max - range.min);
                        else link.data.norm_weight = 1.0;
                });
            }
            else this.meta.links_weight_range = undefined;
        }

        updateGroups() {
            const has_link_weights = this.meta.links_weight_range != undefined;
            this.groups.clear();
            //update groups
            this.mutable_graph.forEachNode(node => {
                const group_id = node.data.group;
                let group = this.groups.getNode(group_id);
                if (!group)
                    group = this.groups.addNode(group_id, {
                        label: `cluster_${group_id}`,
                        internal_links: [],
                        nodes: [],
                        internal_links_weight_range: has_link_weights ? InvalidRange() : undefined,
                        external_links_weight_range: has_link_weights ? InvalidRange() : undefined,
                    });
                group.data.nodes.push(node.id);
            });

            //fill internal and external links for each group
            this.mutable_graph.forEachLink(link => {
                const from = this.mutable_graph.getNode(link.fromId);
                const to = this.mutable_graph.getNode(link.toId);
                if (from.data.group == to.data.group) {
                    const group = this.groups.getNode(from.data.group);
                    const link_id : LinkId = {fromId: link.fromId, toId: link.toId, weight: link.data['weight']};
                    group.data.internal_links.push(link_id);
                    const range = group.data.internal_links_weight_range;
                    if (range) {
                        range.min = Math.min(range.min, link.data['weight']);
                        range.max = Math.max(range.max, link.data['weight']);
                    }
                }
                else {
                    let group_link = this.groups.getLink(from.data.group, to.data.group);
                    if (!group_link) {
                        const data: GroupLinkData = {
                            links: [],
                            links_weight_range: has_link_weights ? InvalidRange() : undefined
                        };
                        group_link = this.groups.addLink(from.data.group, to.data.group, data);
                    }
                    const link_id : LinkId = {fromId: link.fromId, toId: link.toId, weight: link.data['weight']};
                    group_link.data.links.push(link_id);
                    const range = group_link.data.links_weight_range;
                    if (range) {
                        range.min = Math.min(range.min, link.data['weight']);
                        range.max = Math.max(range.max, link.data['weight']);
                        const from = this.groups.getNode(group_link.fromId);
                        from.data.external_links_weight_range.min = Math.min(range.min, from.data.external_links_weight_range.min);
                        from.data.external_links_weight_range.max = Math.max(range.max, from.data.external_links_weight_range.max);
                    }
                }
            });


        }

        clusterize(): void {
            const clusters = modularity(this.mutable_graph);
            const groups_ids = [];
            //create groups and distibute nodes to groups
            this.mutable_graph.forEachNode((node) => {
                let group_id = clusters.getClass(node.id);
                if (groups_ids.indexOf(group_id) == -1)
                    groups_ids.push(group_id);
                group_id = groups_ids.indexOf(group_id);
                node.data.group = group_id;
            });
            this.updateGroups();
        }
		
		resetClusters() : void {
            this.mutable_graph.forEachNode((node) => {
                node.data.group = 0;
            });
            this.updateGroups();
		}

        copy(): GraphState {
            const new_graph = new GraphState(this.label);

            this.source_graph.forEachNode(node => {
                const data = Object.assign({}, node.data);
                new_graph.source_graph.addNode(node.id, data);
            });
            this.source_graph.forEachLink(link => {
                const data = Object.assign({}, link.data);
                new_graph.source_graph.addLink(link.fromId, link.toId, data);
            });

            this.mutable_graph.forEachNode(node => {
                const data = Object.assign({}, node.data);
                new_graph.mutable_graph.addNode(node.id, data);
            });
            this.mutable_graph.forEachLink(link => {
                const data = Object.assign({}, link.data);
                new_graph.mutable_graph.addLink(link.fromId, link.toId, data);
            });
            new_graph.meta = Object.assign(this.meta);
            return new_graph;
        }

        import(graph_data): void
        {
            console.log('import graph state')
            const nodes: object[] = graph_data["nodes"];
            const links: object[] = graph_data["edges"] || graph_data["links"];
            console.log(nodes);
		    console.log(links);
            
            nodes.forEach(node => {
                const node_id = node["id"];
                const group = node["group"];
                const weight = node['weight'];
                const label = node['label'] || node['name'];
                const cur_node = this.mutable_graph.getNode(node_id);
                if (cur_node)
                {
                    cur_node.data.group = group;
                    cur_node.data.label = label;
                    if (weight)
                        cur_node.data['weight'] = weight;
                }
                else console.error('error in importing graph_state\'s node. No node', node);
            });

            /*links.forEach(link => {
                const from_id = link["fromId"] || link["source"];
                const to_id = link["toId"] || link["target"];
            });*/

            this.updateMeta();
            this.updateGroups();
        }

        // ---------------------- Data --------------------
        label: string;
        mutable_graph: Ngraph.Graph<NodeData, LinkData>; //=исходный граф с приминением фильтрации, кластеризации
        readonly source_graph: Ngraph.Graph<NodeData, LinkData>;//Исходный граф, который заполняется на момент чтения GraphData и больше не изменяется
        meta: GraphMeta;
        groups: Ngraph.Graph<GroupNodeData, GroupLinkData>;
        private readonly manually_hidden_node_ids: Ngraph.NodeId[];
        private readonly manually_hidden_links: LinkId[];
    }

    export type Graph = {
        states: GraphState[];
        //метаинформация о графе
        meta: GraphMeta;
        max_groups_count: number;
    };

    export interface IGraphSerializer {
        fromJSON(states: Object): Graph;
    }

    export function getFirstState(graph: Graph): GraphState {
        return graph.states[Object.keys(graph.states)[0]];
    }

    export function updateGraphMeta(graph: Graph) {
        graph.meta.nodes_weight_range = undefined;
        graph.meta.links_weight_range = undefined;
        graph.max_groups_count = 0;
        Object.values(graph.states).forEach(state => {
            graph.max_groups_count = Math.max(graph.max_groups_count, state.groups.getNodesCount());

            graph.meta.links_count = Math.max(state.meta.links_count, graph.meta.links_count);
            graph.meta.nodes_count = Math.max(state.meta.nodes_count, graph.meta.nodes_count);
            if (state.meta.links_weight_range) {
                if (!graph.meta.links_weight_range)
                    graph.meta.links_weight_range = { min: Infinity, max: -Infinity, avg: 0, default: 0 };
                graph.meta.links_weight_range.min = Math.min(graph.meta.links_weight_range.min, state.meta.links_weight_range.min);
                graph.meta.links_weight_range.max = Math.max(graph.meta.links_weight_range.max, state.meta.links_weight_range.max);
                graph.meta.links_weight_range.avg += state.meta.links_weight_range.avg;
            }
            if (state.meta.nodes_weight_range) {
                if (!graph.meta.nodes_weight_range)
                    graph.meta.nodes_weight_range = { min: Infinity, max: -Infinity, avg: 0, default: 0 };
                graph.meta.nodes_weight_range.min = Math.min(graph.meta.nodes_weight_range.min, state.meta.nodes_weight_range.min);
                graph.meta.nodes_weight_range.max = Math.max(graph.meta.nodes_weight_range.max, state.meta.nodes_weight_range.max);
                graph.meta.nodes_weight_range.avg += state.meta.nodes_weight_range.avg;
            }
        });
        const states_count = Object.keys(graph.states).length;
        if (graph.meta.links_weight_range) {
            graph.meta.links_weight_range.avg /= states_count;
            graph.meta.links_weight_range.default = graph.meta.links_weight_range.avg;
        }
        if (graph.meta.nodes_weight_range) {
            graph.meta.nodes_weight_range.avg /= states_count;
            graph.meta.nodes_weight_range.default = graph.meta.nodes_weight_range.avg;
        }
    }

    export function calculateState(graph: Graph, expr: string[]): GraphState {
        if (expr.length % 2 == 0) {
            console.log('incorrect expression for calculation: extra symbols');
        }
        let last_id: number = 0;


        function findCorrespondingNode(state: GraphState, label: string): Ngraph.Node {
            let result = null;
            state.mutable_graph.forEachNode(node => {
                if (node.data.label == label) {
                    result = node;
                }
            });
            return result;
        }

        function findCorrespondingEdge(state: GraphState, from_label: string, to_label: string): Ngraph.Link {
            let result = null;
            state.mutable_graph.forEachLink(link => {
                if (!result) {
                    const from = state.mutable_graph.getNode(link.fromId);
                    const to = state.mutable_graph.getNode(link.toId);
                    if (from.data.label == from_label && to.data.label == to_label) {
                        result = link;
                    }
                }
            });
            return result;
        }

        function stateUnion(result: GraphState, stateB: GraphState) {
            result.mutable_graph.beginUpdate();
            stateB.mutable_graph.forEachNode(node => {
                const corrNode = findCorrespondingNode(result, node.data.label);
                if (corrNode)
                    corrNode.data["weight"] = Math.max(corrNode.data['weight'], node.data['weight']);
                else {
                    const data = Object.assign({}, node.data);
                    result.mutable_graph.addNode(++last_id, data);
                }
            });

            stateB.mutable_graph.forEachLink(link => {
                let from = stateB.mutable_graph.getNode(link.fromId);
                let to = stateB.mutable_graph.getNode(link.toId);
                const corrEdge = findCorrespondingEdge(result, from.data.label, to.data.label);
                if (corrEdge)
                    corrEdge.data['weight'] = Math.max(corrEdge.data['weight'], link.data['weight']);
                else {
                    from = findCorrespondingNode(result, from.data.label);
                    to = findCorrespondingNode(result, to.data.label);
                    if (from && to) {
                        const data = Object.assign({}, link.data);
                        result.mutable_graph.addLink(from.id, to.id, data);
                    }
                }
            });
            result.mutable_graph.endUpdate();
        }

        function stateIntersect(result: GraphState, stateB: GraphState) {
            const nodes_to_delete: Ngraph.NodeId[] = [];
            const links_to_delete: Ngraph.Link[] = [];
            //Удаляем все дуги, которых нет в обоих графах одновременно
            result.mutable_graph.forEachLink(link => {
                const from = result.mutable_graph.getNode(link.fromId);
                const to = result.mutable_graph.getNode(link.toId);
                const corrEdge = findCorrespondingEdge(stateB, from.data.label, to.data.label);
                if (!corrEdge)
                    links_to_delete.push(link);
            });


            //удаляем все ноды, которых нет в обоих графах одновременно
            result.mutable_graph.forEachNode(node => {
                const corrNode = findCorrespondingNode(stateB, node.data.label);
                if (!corrNode)
                    nodes_to_delete.push(node.id);
            });

            result.mutable_graph.beginUpdate();
            links_to_delete.forEach(link => result.mutable_graph.removeLink(link));
            nodes_to_delete.forEach(node_id => result.mutable_graph.removeNode(node_id));
            result.mutable_graph.endUpdate();
        }

        function stateDiff(result: GraphState, stateB: GraphState) {
            const nodes_to_delete: Ngraph.NodeId[] = [];
            const links_to_delete: Ngraph.Link[] = [];

            result.mutable_graph.forEachLink(link => {
                const from = result.mutable_graph.getNode(link.fromId);
                const to = result.mutable_graph.getNode(link.toId);
                const corrEdge = findCorrespondingEdge(stateB, from.data.label, to.data.label);
                if (corrEdge)
                    links_to_delete.push(link);
            });

            result.mutable_graph.forEachNode(node => {
                const corrNode = findCorrespondingNode(stateB, node.data.label);
                if (corrNode)
                    nodes_to_delete.push(node.id);
            });

            result.mutable_graph.beginUpdate();
            links_to_delete.forEach(link => result.mutable_graph.removeLink(link));
            nodes_to_delete.forEach(node_id => result.mutable_graph.removeNode(node_id));
            result.mutable_graph.endUpdate();
        }

        function stateSymDiff(result: GraphState, stateB: GraphState) {
            const nodes_to_delete: Ngraph.NodeId[] = [];
            const links_to_delete: Ngraph.Link[] = [];

            result.mutable_graph.forEachLink(link => {
                const from = result.mutable_graph.getNode(link.fromId);
                const to = result.mutable_graph.getNode(link.toId);
                const corrEdge = findCorrespondingEdge(stateB, from.data.label, to.data.label);
                if (corrEdge)
                    links_to_delete.push(link);
            });

            result.mutable_graph.forEachNode(node => {
                const corrNode = findCorrespondingNode(stateB, node.data.label);
                if (corrNode)
                    nodes_to_delete.push(node.id);
            });

            stateB.mutable_graph.forEachNode(node => {
                const corrNode = findCorrespondingNode(result, node.data.label);
                if (!corrNode)
                    result.mutable_graph.addNode(++last_id, node.data);
            });

            stateB.mutable_graph.forEachLink(link => {
                let from = stateB.mutable_graph.getNode(link.fromId);
                let to = stateB.mutable_graph.getNode(link.toId);
                const corrEdge = findCorrespondingEdge(result, from.data.label, to.data.label);
                if (!corrEdge) {
                    from = findCorrespondingNode(result, from.data.label);
                    to = findCorrespondingNode(result, to.data.label);
                    if (from && to)
                        result.mutable_graph.addLink(from.id, to.id, link.data);
                }
            });

            result.mutable_graph.beginUpdate();
            links_to_delete.forEach(link => result.mutable_graph.removeLink(link));
            nodes_to_delete.forEach(node_id => result.mutable_graph.removeNode(node_id));
            result.mutable_graph.endUpdate();
        }

        const result = graph.states[parseInt(expr[0])].copy();
        result.label = 'calculated';
        //-------------- calc last_id as max of all ids ------------
        result.mutable_graph.forEachNode(node => {
            if (typeof node.id == 'number' && node.id > last_id) last_id = node.id;
        });
        // ------------ calc state ------------------------
        for (let i = 1; i < expr.length; i += 2) {
            const state_index = parseInt(expr[i + 1]);
            switch (expr[i]) {
                case StateCalculatorOperand.UNION: stateUnion(result, graph.states[state_index]); break;
                case StateCalculatorOperand.INTERSECT: stateIntersect(result, graph.states[state_index]); break;
                case StateCalculatorOperand.DIFF: stateDiff(result, graph.states[state_index]); break;
                case StateCalculatorOperand.SYMDIFF: stateSymDiff(result, graph.states[state_index]); break;
                default: console.log('incorrect expression: invalid operation')
            }
        }
        //----------- update source_graph = mutable_graph ---------------
        result.source_graph.clear();
        result.mutable_graph.forEachNode(node => {
            const data = Object.assign({}, node.data);
            result.source_graph.addNode(node.id, data);
        });
        result.mutable_graph.forEachLink(link => {
            const data = Object.assign({}, link.data);
            result.source_graph.addLink(link.fromId, link.toId, data);
        });
        // ---------- calc metrics -----------------------

        result.updateMeta();
        result.updateGroups();
        return result;
    }
}

