import {GraphControlling} from "./@types/Graph";
import GraphState = GraphControlling.GraphState;
import EmptyMeta = GraphControlling.EmptyMeta;
import updateGraphMeta = GraphControlling.updateGraphMeta;


export class GraphSerializer implements GraphControlling.IGraphSerializer
{
    fromJSON(graph_json: Object): GraphControlling.Graph {
        let graph: GraphControlling.Graph = {states: [], meta: Object.assign({}, EmptyMeta),max_groups_count: 0 };
        if (graph_json){
            //здесь полная неразбериха. graph_json может быть либо как массив состояний либо объект с полем states.
            //поэтому надо проверять, что если поле states есть, то работаем с ним, а если его нет, то graph_json это массив состояний
            //либо это может быть просто переменная - состояние
            let json_states = graph_json["states"] || graph_json;
            console.log('graph_json', json_states);
            //если объект итерируемый
            if (json_states && typeof json_states[Symbol.iterator] === 'function') {
                for (let state of json_states)
                {
                    const state_label: string = state["label"] || state['state'] || '0';
                    console.log("state", state["graph_data"] || state);
                    graph.states.push(GraphSerializer.fillState(state_label, state["graph_data"] || state));
                }
            }
            //иначе если это одно цельное состояние которое передано как переменная
            else
                graph.states.push(GraphSerializer.fillState(graph_json["label"] || graph_json["state"] || "0", graph_json["graph_data"] || graph_json));
            updateGraphMeta(graph);
        }
        console.log(graph);
        return graph;
    }



    private static fillState(label: string, json_state: Object) : GraphState
    {
        const state : GraphState = new GraphState(label);
        state.source_graph.beginUpdate();
        const nodes = json_state["nodes"];
        const edges = json_state["edges"] || json_state["links"];
		console.log(nodes);
		console.log(edges);
        //-------------------- read nodes ------------------
        for(let node of nodes)
        {
            const node_id = node["id"];
            const node_group = node["group"] ? node["group"] : 0;
            const node_label = node["label"] ? node["label"] : "#no_label";
            let data : GraphControlling.NodeData = {label: node_label,
                                                    group: node_group,
                                                    norm_weight: 0};
            Object.keys(node).forEach(key => {
                if (key != "id" && key != "group" && key != "label")
                    data[key] = node[key];
            });
            state.source_graph.addNode(node_id, data);
        }

        // ------------------------ read links -----------------------
        for(let edge of edges)
        {
            const from_id = edge["source"] || edge["fromId"];
            const to_id = edge["target"] || edge["toId"];
            let data : GraphControlling.LinkData = {norm_weight: 0};
            Object.keys(edge).forEach(key => {
                if (key != "source" && key != "target")
                    data[key] = edge[key];
            });
            state.source_graph.addLink(from_id, to_id, data);
        }
        state.source_graph.endUpdate();

        //---------- copy source graph to mutable graph -------------
        state.mutable_graph.beginUpdate();
        state.source_graph.forEachNode(node => {{
            const data = Object.assign({}, node.data);
            state.mutable_graph.addNode(node.id, data);
        }});
        state.source_graph.forEachLink(link => {{
            const data = Object.assign({}, link.data);
            state.mutable_graph.addLink(link.fromId, link.toId, data);
        }});
        state.mutable_graph.endUpdate();

        state.updateMeta();
        state.updateGroups();
        return state;
    }

}