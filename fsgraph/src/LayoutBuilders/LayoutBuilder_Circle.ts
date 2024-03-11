import {GraphView} from "../@types/GraphView";
import NodeView = GraphView.NodeView;
import AABB = GraphView.AABB;
import NodeGroup = GraphView.NodeGroup;
import {LayoutBuilder, LayoutConfiguration} from "../@types/LayoutBuilder";

export class LayoutBuilder_Circle implements LayoutBuilder
{
    constructor(config?: LayoutConfiguration) {
        this.ranges = config;
    }

    layout(graph_view: GraphView.GraphView, scene_size: number): boolean
    {
        const maxR = this.ranges["R"].value;
        const use_cluster_splitting = this.ranges["use_cluster_splitting"].value;

        if (use_cluster_splitting) {
            const groups = Object.keys(graph_view.node_groups).sort((g1, g2) => graph_view.node_groups[g2].length - graph_view.node_groups[g1].length);
            const dR = maxR / groups.length;
            let R = maxR;
            groups.forEach(group => {
                const group_nodes: NodeGroup = graph_view.node_groups[group];
                LayoutBuilder_Circle.layout_cluster(group_nodes, R);
                R -= dR;
            });
        }
        else
        {
            LayoutBuilder_Circle.layout_cluster(graph_view.nodes, maxR);
        }
        graph_view.RebuildQuadtree();
        return true;
    }

    getParamsNames(): string[] {
        return ["R", "use_cluster_splitting"];
    }

    setConfiguration(config: LayoutConfiguration): void {
        this.ranges = config;
    }

    getConfiguration(): LayoutConfiguration {
        return this.ranges;
    }

    private ranges: LayoutConfiguration;

    private static layout_cluster(group_nodes: GraphView.NodeGroup, R: number) : void
    {
        let alpha = 0.0;
        const ids = Object.keys(group_nodes).filter(id => !group_nodes[id].is_hidden);
        const delta = 2.0 * Math.PI / ids.length;
        ids.forEach(id => {
            const node = group_nodes[id];
            node.position.x = R * Math.cos(alpha);
            node.position.y = R * Math.sin(alpha);
            alpha += delta;
        });
    }
}