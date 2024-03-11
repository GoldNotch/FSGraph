import {GraphView} from "../@types/GraphView";
import {vec2} from "../../modified_modules/tsm/tsm";
import NodeView = GraphView.NodeView;
import AABB = GraphView.AABB;
import {LayoutBuilder_Circle} from "./LayoutBuilder_Circle";
import {LayoutBuilder, LayoutConfiguration} from "../@types/LayoutBuilder";
import NodeGroup = GraphView.NodeGroup;
import LinkView = GraphView.LinkView;
import {random} from "chroma.ts";
import isLinkViewDisabled = GraphView.isLinkViewDisabled;

export class LayoutBuilder_FruchtermanReingold implements LayoutBuilder
{
    constructor(config?: LayoutConfiguration) {
        this.ranges = config;
    }

    layout(graph_view: GraphView.GraphView, scene_size: number): boolean {
        //get values of parameters
        const size = scene_size + 20;
        const iterations_count = this.ranges["iterations_count"].value;
        const optimal_distance = this.ranges["optimal_vertex_distance"].value;
        const is_bounding = this.ranges['is_bounding'].value;
        const use_cluster_splitting = this.ranges["use_cluster_splitting"].value;
        const pivot = new vec2([0,0]);
        const groups = Object.keys(graph_view.node_groups);

        if (use_cluster_splitting && groups.length > 1)
        {
            const links_for_groups : {[group: number]: LinkView[]} = {};
            //fill links_for_groups
            Object.keys(graph_view.links).forEach(id => {
               const link : LinkView = graph_view.links[id];
               if (link.from.group == link.to.group)
               {
                   if (!links_for_groups[link.from.group])
                       links_for_groups[link.from.group] = [];
                   links_for_groups[link.from.group].push(link);
               }
            });

            //vars for pivot calculating
            const R = size * 0.75;
            let alpha = 0.0;
            const dA = 2.0 * Math.PI / groups.length;
            groups.forEach(group => {
                //select pivot for group
                pivot.x = R * Math.cos(alpha);
                pivot.y = R * Math.sin(alpha);
                alpha += dA;
                //calc area and vertex distance in group
                const group_area = size * size / groups.length;
                const group_optimal_distance = optimal_distance / groups.length;
                const iter_count = iterations_count / groups.length;
                LayoutBuilder_FruchtermanReingold.layout_cluster(group_optimal_distance, group_area,
                                                                iter_count, is_bounding, pivot,
                                                                graph_view.node_groups[group], links_for_groups[group]);
            });
        }
        else
        {
            const links = Object.keys(graph_view.links).map(id => graph_view.links[id]);
            LayoutBuilder_FruchtermanReingold.layout_cluster(optimal_distance, size, iterations_count, is_bounding, pivot,
                                                                graph_view.nodes, links);
        }




        graph_view.RebuildQuadtree();
        return true;
    }

    getParamsNames(): string[] {
        return ["iterations_count", "optimal_vertex_distance", "is_bounding", "use_cluster_splitting"];
    }

    getConfiguration(): LayoutConfiguration {
        return this.ranges;
    }

    setConfiguration(config: LayoutConfiguration): void {
        this.ranges = config;
    }

    private ranges: LayoutConfiguration;


    private static layout_cluster(optimal_distance: number,
                                    size: number,
                                    iterations_count: number, is_bounding: boolean,
                                  pivot: vec2,
                                  group_nodes: NodeGroup, links: LinkView[])
    {
        const eps = 0.00001;
        const cooling_coeff = 0.9;
        const node_ids = Object.keys(group_nodes).filter(id => !group_nodes[id].is_hidden);
        const nodes_count = node_ids.length;
        const k = optimal_distance * Math.sqrt(size / nodes_count);
        let temperature = 10 * Math.sqrt(nodes_count);

        //attractive force (if force > 0 : objects are attracting else they're repulsing)
        const f_a = (distance: number, from_size: number, to_size: number) => distance * distance / k;
        //repulsive force (if force > 0 : objects are repulsing else they're attracting)
        const f_r = (distance: number, from_size: number, to_size: number) => k * k / distance;

        //смещения позиции для каждой вершины
        const dX: {[id: number]: vec2} = {};
        node_ids.forEach(id => {
            dX[id] = new vec2([0, 0]);
            const R = k;
            const step = 2 * Math.PI / nodes_count;
            let alpha = 0;
            node_ids.forEach(id => {
                group_nodes[id].position.x = pivot.x + R * Math.cos(alpha);
                group_nodes[id].position.y = pivot.y + R * Math.sin(alpha);
                alpha += step;
            });
        });
        const delta = new vec2();

        if (links)
        for(let i = 0; i < iterations_count && temperature > eps; i++)
        {
            //calc repulsive forces
            /*for v in V do
              begin
                 { each vertex has two vectors: .pos and .disp }
                  v.disp := 0;
                  for u in V do
                  if (u # v) then begin
                      { ∆ is short hand for the difference}
                      { vector between the positions of the two vertices )
                      ∆ := v.pos - u.pos;
                      v.disp := v.disp + ( ∆ /| ∆ |) * fr (| ∆ |)
                  end
              end */
            node_ids.forEach(id => {
                const v : NodeView = group_nodes[id];
                node_ids.forEach(adj_id => {
                    if (id != adj_id) {
                        const u = group_nodes[adj_id];
                        vec2.difference(v.position, u.position, delta);
                        let length = delta.length();
                        const repulse = f_r(length, v.size, u.size);
                        dX[adj_id].x -= (delta.x / length) * repulse;
                        dX[adj_id].y -= (delta.y / length) * repulse;
                        dX[id].x += (delta.x / length) * repulse;
                        dX[id].y += (delta.y / length) * repulse;
                    }
                });
            });

            //calc attractive forces
            /*
            for e in E do begin
            { each edge is an ordered pair of vertices .v and .u }
                ∆ := e.v.pos – e.u.pos
                e.v.disp := e.v.disp – ( ∆/| ∆ |) * fa (| ∆ |);
                e.u. disp := e.u.disp + ( ∆ /| ∆ |) * fa (| ∆ |)
            end
             */
                links.forEach(link => {
                    if (!isLinkViewDisabled(link)){
                        const from = link.from;
                        const to = link.to;
                        vec2.difference(from.position, to.position, delta);
                        let length = delta.length();
                        const attract = Math.min(f_a(length, from.size, to.size), length / 2);
                        dX[to.id].x += (delta.x / length) * attract;
                        dX[to.id].y += (delta.y / length) * attract;
                        dX[from.id].x -= (delta.x / length) * attract;
                        dX[from.id].y -= (delta.y / length) * attract;
                    }
                });

            //place nodes
            node_ids.forEach(id => {
                const v = group_nodes[id];
                let length = dX[id].length();
                if (length > 0) {
                    v.position.x += (dX[id].x / length) * Math.min(temperature, length);
                    v.position.y += (dX[id].y / length) * Math.min(temperature, length);
                    if (is_bounding) {
                        v.position.x = pivot.x + Math.min(size, Math.max(-size, v.position.x - pivot.x));
                        v.position.y = pivot.y + Math.min(size, Math.max(-size, v.position.y - pivot.y));
                    }
                }
                dX[id].x = 0;
                dX[id].y = 0;
            });
            temperature *= cooling_coeff;
        }
    }
}